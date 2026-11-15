#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')
IDS_FILE="/tmp/legacy_ids_$RUN_ID.env"
rm -f "$IDS_FILE"

echo "=== Prepare legacy data (4 states + assignments) ==="
echo "RUN_ID: $RUN_ID"
echo "IDS_FILE: $IDS_FILE"

U=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'legacy_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Legacy Developer\"}') RETURNING id;")
[ -z "$U" ] && { echo "FAIL: developer user not created"; exit 1; }

P=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.profiles WHERE id='$U';")
[ "$P" -ne 1 ] && { echo "FAIL: developer profile not created by trigger"; exit 1; }

TU=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'legacy_tester_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Legacy Tester\"}') RETURNING id;")
[ -z "$TU" ] && { echo "FAIL: tester user not created"; exit 1; }

TP=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.profiles WHERE id='$TU';")
[ "$TP" -ne 1 ] && { echo "FAIL: tester profile not created by trigger"; exit 1; }

{
  echo "LEGACY_USER=$U"
  echo "LEGACY_TESTER=$TU"
} > "$IDS_FILE"

for state in forming running completed cancelled; do
  A=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.apps (developer_id, name, package_name, status)
    VALUES ('$U', 'Legacy $state', 'com.testdz.lg_${state}_${RUN_ID}', 'published')
    RETURNING id;")
  [ -z "$A" ] && { echo "FAIL: app not created ($state)"; exit 1; }

  T=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
    VALUES ('$A', '$U', 'Legacy $state', 'recruiting', 12) RETURNING id;")
  [ -z "$T" ] && { echo "FAIL: test not created ($state)"; exit 1; }

  C=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.cohorts (name, capacity, status, test_id)
    VALUES ('L_${state}_${RUN_ID}', 13, '$state', '$T') RETURNING id;")
  [ -z "$C" ] && { echo "FAIL: cohort not created ($state)"; exit 1; }

  ASSIGNMENT=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
    VALUES ('$C', '$T', '$TU', 'pending') RETURNING id;")
  [ -z "$ASSIGNMENT" ] && { echo "FAIL: legacy assignment not created ($state)"; exit 1; }

  echo "LEGACY_${state^^}_COHORT=$C" >> "$IDS_FILE"
  echo "LEGACY_${state^^}_TEST=$T" >> "$IDS_FILE"
  echo "LEGACY_${state^^}_ASSIGNMENT=$ASSIGNMENT" >> "$IDS_FILE"
  echo "✓ $state: cohort=$C test=$T assignment=$ASSIGNMENT"
done

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LEGACY_IDS_FILE=$IDS_FILE" >> "$GITHUB_ENV"
  echo "✓ Exported LEGACY_IDS_FILE to GITHUB_ENV"
else
  echo "⚠️  GITHUB_ENV not set; set LEGACY_IDS_FILE manually: $IDS_FILE"
fi

echo "PASS: legacy cohorts and assignments created (4 states)"
