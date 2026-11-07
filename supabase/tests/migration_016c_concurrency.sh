#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')

USER_IDS=()
APP_IDS=()
TEST_IDS=()
COHORT_IDS=()
LOCK_PID=""
P1=""
P2=""

cleanup() {
  for pid in "${LOCK_PID:-}" "${P1:-}" "${P2:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  for pid in "${LOCK_PID:-}" "${P1:-}" "${P2:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      for _ in 1 2 3 4 5; do
        sleep 0.2
        kill -0 "$pid" 2>/dev/null || break
      done
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  for pid in "${LOCK_PID:-}" "${P1:-}" "${P2:-}"; do
    if [ -n "$pid" ]; then
      wait "$pid" 2>/dev/null || true
    fi
  done
  for id in "${COHORT_IDS[@]:-}"; do
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.assignments WHERE cohort_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.cohort_tests WHERE cohort_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.cohorts WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${TEST_IDS[@]:-}"; do
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.tests WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${APP_IDS[@]:-}"; do
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.apps WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${USER_IDS[@]:-}"; do
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.user_roles WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.wallets WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM public.profiles WHERE id='$id';" 2>/dev/null || true
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM auth.users WHERE id='$id';" 2>/dev/null || true
  done
  rm -f "/tmp/conc_${RUN_ID}_"*.log
}
trap cleanup EXIT

echo "=== Creating concurrency fixtures (RUN_ID=$RUN_ID) ==="

U1=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'conc1_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Conc 1\"}') RETURNING id;")
[ -z "$U1" ] && { echo "FAIL: user1"; exit 1; }
USER_IDS+=("$U1")

U2=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'conc2_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Conc 2\"}') RETURNING id;")
[ -z "$U2" ] && { echo "FAIL: user2"; exit 1; }
USER_IDS+=("$U2")

A1=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$U1', 'ConcApp1', 'com.testdz.conc1_$RUN_ID', 'tools', 'published') RETURNING id;")
[ -z "$A1" ] && { echo "FAIL: app1"; exit 1; }
APP_IDS+=("$A1")

A2=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$U2', 'ConcApp2', 'com.testdz.conc2_$RUN_ID', 'tools', 'published') RETURNING id;")
[ -z "$A2" ] && { echo "FAIL: app2"; exit 1; }
APP_IDS+=("$A2")

T1=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$A1', '$U1', 'ConcTest1', 'recruiting', 12) RETURNING id;")
[ -z "$T1" ] && { echo "FAIL: test1"; exit 1; }
TEST_IDS+=("$T1")

T2=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$A2', '$U2', 'ConcTest2', 'recruiting', 12) RETURNING id;")
[ -z "$T2" ] && { echo "FAIL: test2"; exit 1; }
TEST_IDS+=("$T2")

CID=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('conc_$RUN_ID', 1, 'forming') RETURNING id;")
[ -z "$CID" ] && { echo "FAIL: cohort"; exit 1; }
COHORT_IDS+=("$CID")

echo "Fixtures: cohort=$CID test1=$T1 test2=$T2"

LOCK_APP="lock_holder_$RUN_ID"
LOCK_LOG="/tmp/conc_${RUN_ID}_lock.log"

PGAPPNAME="$LOCK_APP" psql "$DB_URL" -v ON_ERROR_STOP=1 > "$LOCK_LOG" 2>&1 <<SQL &
BEGIN;
SELECT id FROM public.cohorts WHERE id = '$CID' FOR UPDATE;
SELECT pg_sleep(30);
COMMIT;
SQL
LOCK_PID=$!

TIMEOUT_SECONDS=15
START_TS=$(date +%s)
LOCK_ACQUIRED=0
while [ $(( $(date +%s) - START_TS )) -lt "$TIMEOUT_SECONDS" ]; do
  READY=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    SELECT COUNT(*) FROM pg_stat_activity
    WHERE application_name = '$LOCK_APP'
      AND state = 'active'
      AND query LIKE '%pg_sleep%';")
  if [ "$READY" -ge 1 ]; then
    LOCK_ACQUIRED=1
    break
  fi
  sleep 0.3
done

if [ "$LOCK_ACQUIRED" -ne 1 ]; then
  echo "FAIL: lock holder did not reach pg_sleep within ${TIMEOUT_SECONDS}s"
  cat "$LOCK_LOG"
  echo "=== pg_stat_activity for $LOCK_APP ==="
  psql "$DB_URL" -c "
    SELECT pid, application_name, state, wait_event_type, left(query, 80)
    FROM pg_stat_activity WHERE application_name = '$LOCK_APP';"
  exit 1
fi
echo "✓ Lock holder in pg_sleep (FOR UPDATE completed, lock held)"

LOG1="/tmp/conc_${RUN_ID}_ins1.log"
LOG2="/tmp/conc_${RUN_ID}_ins2.log"

PGAPPNAME="ins1_$RUN_ID" psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  VALUES ('$CID', '$T1', '$U1');" > "$LOG1" 2>&1 &
P1=$!

PGAPPNAME="ins2_$RUN_ID" psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  VALUES ('$CID', '$T2', '$U2');" > "$LOG2" 2>&1 &
P2=$!

WAIT_TIMEOUT_SECONDS=15
WAIT_START_TS=$(date +%s)
WAITING=0
while [ $(( $(date +%s) - WAIT_START_TS )) -lt "$WAIT_TIMEOUT_SECONDS" ]; do
  WAITING=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    SELECT COUNT(*) FROM pg_stat_activity
    WHERE application_name IN ('ins1_$RUN_ID','ins2_$RUN_ID')
      AND state = 'active'
      AND wait_event_type = 'Lock';")
  if [ "$WAITING" -ge 2 ]; then
    break
  fi
  sleep 0.3
done

if [ "$WAITING" -lt 2 ]; then
  echo "FAIL: only $WAITING INSERTs waiting on lock (expected 2) within ${WAIT_TIMEOUT_SECONDS}s"
  echo "=== pg_stat_activity ==="
  psql "$DB_URL" -c "
    SELECT pid, application_name, state, wait_event_type, left(query, 80)
    FROM pg_stat_activity WHERE application_name LIKE '%_$RUN_ID';"
  exit 1
fi
echo "✓ Both INSERTs waiting on lock ($WAITING active)"

echo "Releasing database lock (terminate lock-holder backend)..."
TERMINATED=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE application_name = '$LOCK_APP'
    AND pid <> pg_backend_pid();")
if [ "$TERMINATED" != "t" ]; then
  echo "FAIL: could not terminate lock-holder backend (result=$TERMINATED)"
  exit 1
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
  kill -0 "$LOCK_PID" 2>/dev/null || break
  sleep 0.2
done
if kill -0 "$LOCK_PID" 2>/dev/null; then
  kill -KILL "$LOCK_PID" 2>/dev/null || true
fi
wait "$LOCK_PID" 2>/dev/null || true
LOCK_PID=""

wait_with_timeout() {
  local pid=$1
  local timeout=$2
  local start_ts
  start_ts=$(date +%s)
  while kill -0 "$pid" 2>/dev/null; do
    # A completed child can remain as a zombie until wait reaps it; do not
    # mistake that state for a still-running psql process.
    local state
    state=$(ps -o stat= -p "$pid" 2>/dev/null || true)
    case "$state" in
      ""|Z* ) break ;;
    esac
    if [ $(( $(date +%s) - start_ts )) -ge "$timeout" ]; then
      kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 0.2
  done
  wait "$pid" 2>/dev/null
  return $?
}

E1=0; wait_with_timeout "$P1" 20 || E1=$?
E2=0; wait_with_timeout "$P2" 20 || E2=$?
P1=""; P2=""

S=0
[ "$E1" -eq 0 ] && S=$((S+1))
[ "$E2" -eq 0 ] && S=$((S+1))

if [ "$S" -ne 1 ]; then
  echo "FAIL: expected 1 success, got $S"
  echo "=== ins1 ==="; cat "$LOG1"
  echo "=== ins2 ==="; cat "$LOG2"
  exit 1
fi

FAILED=$(if [ "$E1" -ne 0 ]; then cat "$LOG1"; else cat "$LOG2"; fi)
if ! echo "$FAILED" | grep -q "COHORT_FULL"; then
  echo "FAIL: wrong error (expected COHORT_FULL); exit codes: ins1=$E1 ins2=$E2"
  echo "=== ins1 log ==="; cat "$LOG1"
  echo "=== ins2 log ==="; cat "$LOG2"
  exit 1
fi

COUNT=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.cohort_tests WHERE cohort_id='$CID';")
if [ "$COUNT" -ne 1 ]; then
  echo "FAIL: expected 1 row, got $COUNT"
  exit 1
fi

echo "PASS: concurrency — 2 blocked, 1 success, 1 COHORT_FULL, 1 row"
