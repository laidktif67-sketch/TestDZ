#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
RUN_ID=$(uuidgen | tr 'A-F' 'a-f')
IDS_FILE="/tmp/legacy_ids_$RUN_ID.env"
rm -f "$IDS_FILE"

echo "=== Prepare legacy data (4 states) ==="
echo "RUN_ID: $RUN_ID"
echo "IDS_FILE: $IDS_FILE"

U=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'legacy_$RUN_ID@testdz.local', now(),
          '{\"full_name\":\"Legacy User\"}') RETURNING id;")
[ -z "$U" ] && { echo "FAIL: user not created"; exit 1; }
echo "User: $U"

P=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.profiles WHERE id='$U';")
[ "$P" -ne 1 ] && { echo "FAIL: profile not created by trigger"; exit 1; }

echo "LEGACY_USER=$U" > "$IDS_FILE"

for state in forming running completed cancelled; do
  A=$(psql "$DB_URL" -qAt -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.apps (developer_id, name, package_name, category, status)
    VALUES ('$U', 'Legacy $state', 'com.testdz.lg_${state}_${RUN_ID}', 'tools', 'published')
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
  
  echo "LEGACY_${state^^}_COHORT=$C" >> "$IDS_FILE"
  echo "LEGACY_${state^^}_TEST=$T" >> "$IDS_FILE"
  echo "✓ $state: cohort=$C test=$T"
done

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LEGACY_IDS_FILE=$IDS_FILE" >> "$GITHUB_ENV"
  echo "✓ Exported LEGACY_IDS_FILE to GITHUB_ENV"
else
  echo "⚠️  GITHUB_ENV not set; set LEGACY_IDS_FILE manually: $IDS_FILE"
fi

echo "PASS: legacy data created (4 states)"
