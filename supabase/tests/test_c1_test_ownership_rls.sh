#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"

# This test writes fixtures and must never run against a hosted database.
case "$DB_URL" in
  *@localhost:*|*@127.0.0.1:*) ;;
  *)
    echo "FAIL: refusing non-local database URL; use the local DB_URL from supabase status"
    exit 1
    ;;
esac

RUN_ID=$(uuidgen | tr 'A-F' 'a-f')

USER_IDS=()
APP_IDS=()
TEST_IDS=()

cleanup() {
  for id in "${TEST_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM public.tests WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${APP_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM public.apps WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${USER_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM public.user_roles WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM public.wallets WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM public.profiles WHERE id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
      -c "DELETE FROM auth.users WHERE id='$id';" 2>/dev/null || true
  done
}
trap cleanup EXIT

echo "=== C1 test creation ownership regression test (RUN_ID=$RUN_ID) ==="

create_user() {
  local label=$1
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', '${label}_${RUN_ID}@testdz.local', now(),
            jsonb_build_object('full_name', '${label}')::jsonb)
    RETURNING id;"
}

DEV1=$(create_user c1_dev1)
DEV2=$(create_user c1_dev2)
TESTER=$(create_user c1_tester)
ADMIN=$(create_user c1_admin)
for id in "$DEV1" "$DEV2" "$TESTER" "$ADMIN"; do
  [ -n "$id" ] || { echo "FAIL: could not create test user"; exit 1; }
  USER_IDS+=("$id")
done

# The auth trigger creates a tester role for every user. Replace the fixture
# roles so each case exercises the intended authorization path.
psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM public.user_roles
 WHERE user_id IN ('$DEV1', '$DEV2', '$TESTER', '$ADMIN');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('$DEV1', 'developer'),
  ('$DEV2', 'developer'),
  ('$TESTER', 'tester'),
  ('$ADMIN', 'admin');
COMMIT;
SQL

APP1=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$DEV1', 'C1 App One', 'com.testdz.c1one_$RUN_ID', 'tools', 'draft')
  RETURNING id;")
APP2=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$DEV2', 'C1 App Two', 'com.testdz.c1two_$RUN_ID', 'tools', 'draft')
  RETURNING id;")
TESTER_APP=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$TESTER', 'C1 Tester App', 'com.testdz.c1tester_$RUN_ID', 'tools', 'draft')
  RETURNING id;")
for id in "$APP1" "$APP2" "$TESTER_APP"; do
  [ -n "$id" ] || { echo "FAIL: could not create fixture app"; exit 1; }
  APP_IDS+=("$id")
done

run_as_user() {
  local user_id=$1
  local query=$2
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
\set VERBOSITY verbose
BEGIN;
SET LOCAL request.jwt.claim.sub = '$user_id';
SET LOCAL request.jwt.claims = '{"sub":"$user_id","role":"authenticated","aud":"authenticated"}';
SET LOCAL role = 'authenticated';
$query;
COMMIT;
SQL
}

expect_failure() {
  local label=$1
  local user_id=$2
  local expected=$3
  local query=$4
  local output

  if output=$(run_as_user "$user_id" "$query" 2>&1); then
    echo "FAIL: $label — unexpectedly succeeded: $output"
    exit 1
  fi
  if ! grep -Fq "$expected" <<<"$output"; then
    echo "FAIL: $label — expected '$expected', got: $output"
    exit 1
  fi
  echo "✓ $label"
}

NEW_TEST=$(run_as_user "$DEV1" "
  INSERT INTO public.tests (app_id, developer_id, title, description, min_testers)
  VALUES ('$APP1', '$DEV1', 'Own test', 'C1 ownership regression fixture', 12)
  RETURNING id;")
[ -n "$NEW_TEST" ] || { echo "FAIL: owner could not create test on own app"; exit 1; }
TEST_IDS+=("$NEW_TEST")
echo "✓ owner can create a test on an app they own"

expect_failure \
  "cross-owner app insert is rejected" \
  "$DEV1" \
  "row-level security policy" \
  "INSERT INTO public.tests (app_id, developer_id, title)
   VALUES ('$APP2', '$DEV1', 'Cross-owner test');"

expect_failure \
  "developer_id spoofing is rejected" \
  "$DEV1" \
  "row-level security policy" \
  "INSERT INTO public.tests (app_id, developer_id, title)
   VALUES ('$APP1', '$DEV2', 'Spoofed owner test');"

expect_failure \
  "tester role cannot create tests" \
  "$TESTER" \
  "row-level security policy" \
  "INSERT INTO public.tests (app_id, developer_id, title)
   VALUES ('$TESTER_APP', '$TESTER', 'Tester-created test');"

expect_failure \
  "client cannot set lifecycle status on insert" \
  "$DEV1" \
  "permission denied for table tests" \
  "INSERT INTO public.tests (app_id, developer_id, title, status)
   VALUES ('$APP1', '$DEV1', 'Lifecycle insert', 'running');"

UPDATED=$(run_as_user "$DEV1" "
  UPDATE public.tests
     SET title = 'Own test updated'
   WHERE id = '$NEW_TEST'
  RETURNING id;")
[ "$UPDATED" = "$NEW_TEST" ] || { echo "FAIL: owner could not update own test"; exit 1; }
echo "✓ owner can update developer-authored fields"

expect_failure \
  "client cannot change app_id" \
  "$DEV1" \
  "permission denied for table tests" \
  "UPDATE public.tests SET app_id = '$APP2' WHERE id = '$NEW_TEST';"

expect_failure \
  "client cannot change developer_id" \
  "$DEV1" \
  "permission denied for table tests" \
  "UPDATE public.tests SET developer_id = '$DEV2' WHERE id = '$NEW_TEST';"

expect_failure \
  "client cannot change lifecycle status" \
  "$DEV1" \
  "permission denied for table tests" \
  "UPDATE public.tests SET status = 'running' WHERE id = '$NEW_TEST';"

UPDATED_BY_OTHER=$(run_as_user "$DEV2" "
  WITH changed AS (
    UPDATE public.tests SET title = 'Hijacked by other developer'
     WHERE id = '$NEW_TEST'
    RETURNING 1
  )
  SELECT count(*) FROM changed;")
[ "$UPDATED_BY_OTHER" = "0" ] || { echo "FAIL: other developer updated the test"; exit 1; }
echo "✓ another developer cannot update the test"

TITLE=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
  -c "SELECT title FROM public.tests WHERE id='$NEW_TEST';")
[ "$TITLE" = "Own test updated" ] || { echo "FAIL: test title changed unexpectedly: $TITLE"; exit 1; }

expect_failure \
  "composite FK blocks mismatched ownership even for admin" \
  "$ADMIN" \
  "violates foreign key constraint" \
  "INSERT INTO public.tests (app_id, developer_id, title)
   VALUES ('$APP1', '$DEV2', 'Admin mismatched test');"

ADMIN_TEST=$(run_as_user "$ADMIN" "
  INSERT INTO public.tests (app_id, developer_id, title)
  VALUES ('$APP2', '$DEV2', 'Admin valid test')
  RETURNING id;")
[ -n "$ADMIN_TEST" ] || { echo "FAIL: admin could not create a valid test"; exit 1; }
TEST_IDS+=("$ADMIN_TEST")
echo "✓ admin can create a valid test"

echo "PASS: C1 test creation ownership regression suite"
