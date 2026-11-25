#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the local disposable Supabase Postgres URL}"

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*|*\[::1\]*) ;;
  *)
    echo "BLOCKED: refusing non-loopback DATABASE_URL; this harness is local-only." >&2
    exit 2
    ;;
esac

command -v psql >/dev/null 2>&1 || { echo "BLOCKED: psql is required." >&2; exit 2; }

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

actor_a="93600000-0000-4000-8000-000000000001"
actor_b="93600000-0000-4000-8000-000000000002"
target="93600000-0000-4000-8000-000000000003"
original_key="reversal-concurrency-original"
second_key="reversal-concurrency-second"

# This creates immutable synthetic ledger data. Run only against a disposable
# local database and destroy the entire local Supabase stack after the test.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
BEGIN;
INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('$actor_a','authenticated','authenticated','reversal-concurrency-a@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Concurrency A"}'::jsonb,now(),now()),
  ('$actor_b','authenticated','authenticated','reversal-concurrency-b@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Concurrency B"}'::jsonb,now(),now()),
  ('$target','authenticated','authenticated','reversal-concurrency-target@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Concurrency Target"}'::jsonb,now(),now());
INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('$actor_a','financial'),('$actor_b','financial');
COMMIT;
SQL

original_id="$(
  psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<SQL | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -n 1
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor_a',false);
SELECT set_config('request.jwt.claims','{"sub":"$actor_a","role":"authenticated"}',false);
SELECT rebuild_v2_private.post_wallet_entry(
  '$target','earned_points',100,'reward','$original_key',
  'Original movement for concurrency contract'
);
SQL
)"

[[ -n "$original_id" ]] || { echo "FAIL: original movement was not created." >&2; exit 1; }

# Session A holds the original row lock before it posts the reversal.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmpdir/session-a.log" 2>&1 <<SQL &
BEGIN;
-- The harness holds the row lock as the local database owner, then switches
-- to the authenticated Financial identity before invoking the real function.
SELECT id FROM rebuild_v2.wallet_ledger WHERE id='$original_id' FOR UPDATE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor_a',true);
SELECT set_config('request.jwt.claims','{"sub":"$actor_a","role":"authenticated"}',true);
SELECT pg_sleep(3);
SELECT rebuild_v2_private.post_wallet_entry(
  '$target','earned_points',-100,'reversal','reversal-concurrency-first',
  'First concurrent reversal',NULL,NULL,'$original_id'
);
COMMIT;
SQL
pid_a=$!

sleep 0.4

# Session B uses a different financial actor and idempotency key.
set +e
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmpdir/session-b.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor_b',true);
SELECT set_config('request.jwt.claims','{"sub":"$actor_b","role":"authenticated"}',true);
SELECT rebuild_v2_private.post_wallet_entry(
  '$target','earned_points',-100,'reversal','$second_key',
  'Second concurrent reversal',NULL,NULL,'$original_id'
);
COMMIT;
SQL
pid_b=$!
set -e

# Require observable lock contention while B is attempting the function call.
lock_seen=0
for _ in $(seq 1 40); do
  waiting="$(
    psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -c       "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND state='active' AND query LIKE '%$second_key%';"
  )"
  if [[ "${waiting:-0}" -gt 0 ]]; then
    lock_seen=1
    break
  fi
  sleep 0.1
done

set +e
wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e

if [[ "$status_a" -ne 0 ]]; then
  cat "$tmpdir/session-a.log" >&2
  echo "FAIL: Session A did not commit the first reversal." >&2
  exit 1
fi

if [[ "$lock_seen" -ne 1 ]]; then
  cat "$tmpdir/session-b.log" >&2
  echo "FAIL: no lock wait was observed for Session B; concurrency overlap is UNVERIFIED." >&2
  exit 1
fi

if [[ "$status_b" -eq 0 ]] || ! grep -Fq "original ledger entry has already been reversed" "$tmpdir/session-b.log"; then
  cat "$tmpdir/session-b.log" >&2
  echo "FAIL: Session B did not fail for the expected already-reversed reason." >&2
  exit 1
fi

count="$(
  psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -c     "SELECT count(*) FROM rebuild_v2.wallet_ledger WHERE reversal_of='$original_id';"
)"
if [[ "$count" != "1" ]]; then
  echo "FAIL: expected one reversal row for $original_id, found $count." >&2
  exit 1
fi

echo "PASS: two independent sessions overlapped; Session B waited on a lock and was rejected."
echo "PASS: exactly one reversal exists for original $original_id."
echo "CLEANUP: immutable synthetic rows remain in this disposable database; destroy the local Supabase stack."
