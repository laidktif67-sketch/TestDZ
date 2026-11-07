#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')

echo "=== Create conflicting legacy data ==="
echo "RUN_ID: $RUN_ID"

U=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'conflict_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Conflict User\"}') RETURNING id;")
[ -z "$U" ] && { echo "FAIL: user not created"; exit 1; }

A=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ('$U', 'Conflict App', 'com.testdz.conflict_${RUN_ID}', 'tools', 'published')
  RETURNING id;")
[ -z "$A" ] && { echo "FAIL: app not created"; exit 1; }

T=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES ('$A', '$U', 'Conflict Test', 'recruiting', 12) RETURNING id;")
[ -z "$T" ] && { echo "FAIL: test not created"; exit 1; }

C1=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohorts (name, capacity, status, test_id)
  VALUES ('ConflictA_${RUN_ID}', 13, 'running', '$T') RETURNING id;")
[ -z "$C1" ] && { echo "FAIL: cohort1 not created"; exit 1; }

C2=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.cohorts (name, capacity, status, test_id)
  VALUES ('ConflictB_${RUN_ID}', 13, 'running', '$T') RETURNING id;")
[ -z "$C2" ] && { echo "FAIL: cohort2 not created"; exit 1; }

CONFLICT=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.cohorts
  WHERE test_id='$T' AND status IN ('forming','ready','running');")
[ "$CONFLICT" -ne 2 ] && { echo "FAIL: expected 2 active cohorts, got $CONFLICT"; exit 1; }

echo "PASS: conflict data created ($CONFLICT active cohorts with test $T)"
echo "016c must now fail with 016c_CONFLICT"
