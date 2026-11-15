#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')

echo "=== Create legacy assignment/cohort test mismatch ==="
echo "RUN_ID: $RUN_ID"

create_user() {
  local label=$1
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', '${label}_${RUN_ID}@testdz.local', now(),
            jsonb_build_object('full_name', '${label}')::jsonb)
    RETURNING id;"
}

DEV=$(create_user mismatch_dev)
[ -n "$DEV" ] || { echo "FAIL: developer user not created"; exit 1; }

TESTER=$(create_user mismatch_tester)
[ -n "$TESTER" ] || { echo "FAIL: tester user not created"; exit 1; }

A1=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, status)
  VALUES ('$DEV', 'Mismatch App A', 'com.testdz.mismatch_a_$RUN_ID', 'published')
  RETURNING id;")
[ -n "$A1" ] || { echo "FAIL: app A not created"; exit 1; }

A2=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, status)
  VALUES ('$DEV', 'Mismatch App B', 'com.testdz.mismatch_b_$RUN_ID', 'published')
  RETURNING id;")
[ -n "$A2" ] || { echo "FAIL: app B not created"; exit 1; }

T1=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$A1', '$DEV', 'Cohort test', 'recruiting', 12) RETURNING id;")
[ -n "$T1" ] || { echo "FAIL: cohort test not created"; exit 1; }

T2=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$A2', '$DEV', 'Mismatched assignment test', 'recruiting', 12) RETURNING id;")
[ -n "$T2" ] || { echo "FAIL: assignment test not created"; exit 1; }

C=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohorts (name, capacity, status, test_id)
  VALUES ('Mismatch_$RUN_ID', 13, 'forming', '$T1') RETURNING id;")
[ -n "$C" ] || { echo "FAIL: cohort not created"; exit 1; }

ASSIGNMENT=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
  VALUES ('$C', '$T2', '$TESTER', 'pending') RETURNING id;")
[ -n "$ASSIGNMENT" ] || { echo "FAIL: mismatched legacy assignment not created"; exit 1; }

MISMATCH=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.assignments a
  JOIN public.cohorts c ON c.id = a.cohort_id
  WHERE a.id = '$ASSIGNMENT' AND c.test_id IS DISTINCT FROM a.test_id;")
[ "$MISMATCH" -ne 1 ] && { echo "FAIL: expected one mismatched legacy assignment, got $MISMATCH"; exit 1; }

echo "PASS: created mismatched legacy assignment $ASSIGNMENT (cohort test=$T1, assignment test=$T2)"
echo "016c must fail with 016c_CONFLICT before mutating schema/data"
