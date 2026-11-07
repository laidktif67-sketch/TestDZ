#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')

USER_IDS=()
APP_IDS=()
TEST_IDS=()
COHORT_IDS=()

cleanup() {
  for id in "${COHORT_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.assignments WHERE cohort_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.cohort_tests WHERE cohort_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.cohorts WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${TEST_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.tests WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${APP_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.apps WHERE id='$id';" 2>/dev/null || true
  done
  for id in "${USER_IDS[@]:-}"; do
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.user_roles WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.wallets WHERE user_id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM public.profiles WHERE id='$id';" 2>/dev/null || true
    psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "DELETE FROM auth.users WHERE id='$id';" 2>/dev/null || true
  done
}
trap cleanup EXIT

echo "=== RLS test fixtures (RUN_ID=$RUN_ID) ==="

create_user() {
  local label=$1
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', '${label}_${RUN_ID}@testdz.local', now(),
            jsonb_build_object('full_name', '${label}')::jsonb)
    RETURNING id;"
}

DEV=$(create_user dev)
[ -n "$DEV" ] || { echo "FAIL: dev user"; exit 1; }
USER_IDS+=("$DEV")

TESTER=$(create_user tester)
[ -n "$TESTER" ] || { echo "FAIL: tester user"; exit 1; }
USER_IDS+=("$TESTER")

OUTSIDER=$(create_user outsider)
[ -n "$OUTSIDER" ] || { echo "FAIL: outsider user"; exit 1; }
USER_IDS+=("$OUTSIDER")

ADMIN=$(create_user admin)
[ -n "$ADMIN" ] || { echo "FAIL: admin user"; exit 1; }
USER_IDS+=("$ADMIN")

# user_roles has PRIMARY KEY (user_id, role); replace the trigger-created tester role.
psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM public.user_roles WHERE user_id = '$ADMIN';
INSERT INTO public.user_roles (user_id, role) VALUES ('$ADMIN', 'admin');
COMMIT;
SQL

IS_ADMIN=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.user_roles WHERE user_id = '$ADMIN' AND role = 'admin';")
[ "$IS_ADMIN" = "1" ] || { echo "FAIL: admin role not set (got $IS_ADMIN)"; exit 1; }

DEV_APP=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$DEV', 'DevApp', 'com.testdz.rlsdev_$RUN_ID', 'tools', 'published') RETURNING id;")
[ -n "$DEV_APP" ] || { echo "FAIL: dev app"; exit 1; }
APP_IDS+=("$DEV_APP")

DEV_TEST=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$DEV_APP', '$DEV', 'DevTest', 'recruiting', 12) RETURNING id;")
[ -n "$DEV_TEST" ] || { echo "FAIL: dev test"; exit 1; }
TEST_IDS+=("$DEV_TEST")

TESTER_APP=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$TESTER', 'TesterApp', 'com.testdz.rlstest_$RUN_ID', 'tools', 'published') RETURNING id;")
[ -n "$TESTER_APP" ] || { echo "FAIL: tester app"; exit 1; }
APP_IDS+=("$TESTER_APP")

TESTER_TEST=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$TESTER_APP', '$TESTER', 'TesterTest', 'recruiting', 12) RETURNING id;")
[ -n "$TESTER_TEST" ] || { echo "FAIL: tester test"; exit 1; }
TEST_IDS+=("$TESTER_TEST")

COHORT=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('RLS_$RUN_ID', 13, 'forming') RETURNING id;")
[ -n "$COHORT" ] || { echo "FAIL: cohort"; exit 1; }
COHORT_IDS+=("$COHORT")

psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
VALUES ('$COHORT', '$DEV_TEST', '$DEV'), ('$COHORT', '$TESTER_TEST', '$TESTER');

INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
VALUES ('$COHORT', '$DEV_TEST', '$TESTER', 'active');
SQL

echo "Fixtures created."

run_as_user() {
  local user_id=$1
  local query=$2
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL request.jwt.claim.sub = '$user_id';
SET LOCAL request.jwt.claims = '{"sub":"$user_id","role":"authenticated","aud":"authenticated"}';
SET LOCAL role = 'authenticated';
$query;
COMMIT;
SQL
}

assert_count() {
  local label=$1
  local user_id=$2
  local expected=$3
  local result
  result=$(run_as_user "$user_id" "SELECT COUNT(*) FROM public.cohorts WHERE id = '$COHORT'")
  if [ "$result" != "$expected" ]; then
    echo "FAIL: $label — expected $expected, got $result"
    exit 1
  fi
  echo "✓ $label"
}

assert_count "TEST 1: Developer sees own cohort" "$DEV" "1"
assert_count "TEST 2: Assigned tester sees cohort" "$TESTER" "1"
assert_count "TEST 3: Outsider cannot see cohort" "$OUTSIDER" "0"
assert_count "TEST 4: Admin sees cohort" "$ADMIN" "1"

echo "PASS: RLS — 4/4 (developer, assigned tester, outsider, admin)"
