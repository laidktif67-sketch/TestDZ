#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"
IDS_FILE="${LEGACY_IDS_FILE:?LEGACY_IDS_FILE not set}"
[ -f "$IDS_FILE" ] || { echo "FAIL: LEGACY_IDS_FILE not found: $IDS_FILE"; exit 1; }
source "$IDS_FILE"

echo "=== Verify upgrade migration ==="
echo "IDS_FILE: $IDS_FILE"

for state in forming running completed cancelled; do
  COHORT_VAR="LEGACY_${state^^}_COHORT"
  TEST_VAR="LEGACY_${state^^}_TEST"
  ASSIGNMENT_VAR="LEGACY_${state^^}_ASSIGNMENT"
  C="${!COHORT_VAR}"
  T="${!TEST_VAR}"
  A="${!ASSIGNMENT_VAR}"

  COUNT=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
    SELECT COUNT(*) FROM public.cohort_tests
    WHERE cohort_id='$C' AND test_id='$T' AND developer_id='$LEGACY_USER';")
  [ "$COUNT" -ne 1 ] && { echo "FAIL: $state cohort_tests count=$COUNT"; exit 1; }

  IA=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
    SELECT is_active FROM public.cohort_tests
    WHERE cohort_id='$C' AND test_id='$T';")

  case "$state" in
    forming|running) EXP="t" ;;
    completed|cancelled) EXP="f" ;;
  esac
  [ "$IA" != "$EXP" ] && { echo "FAIL: $state is_active=$IA expected=$EXP"; exit 1; }
  echo "✓ $state cohort_test migrated (is_active=$IA)"

  ASSIGNMENT_COUNT=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
    SELECT COUNT(*) FROM public.assignments
    WHERE id='$A' AND cohort_id='$C' AND test_id='$T' AND tester_id='$LEGACY_TESTER';")
  [ "$ASSIGNMENT_COUNT" -ne 1 ] && { echo "FAIL: $state legacy assignment missing or changed (count=$ASSIGNMENT_COUNT)"; exit 1; }
  echo "✓ $state legacy assignment preserved"
done

COLS=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id';")
[ "$COLS" -ne 0 ] && { echo "FAIL: cohorts.test_id still exists"; exit 1; }
echo "✓ cohorts.test_id dropped"

FK=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_constraint c
  WHERE c.conrelid='public.assignments'::regclass
    AND c.conname='assignments_cohort_test_fk'
    AND c.contype='f'
    AND c.confrelid='public.cohort_tests'::regclass
    AND c.convalidated
    AND (SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
         FROM pg_attribute a
         WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey))
        = ARRAY['cohort_id','test_id']::name[]
    AND (SELECT array_agg(a.attname ORDER BY array_position(c.confkey, a.attnum))
         FROM pg_attribute a
         WHERE a.attrelid=c.confrelid AND a.attnum=ANY(c.confkey))
        = ARRAY['cohort_id','test_id']::name[];")
[ "$FK" -ne 1 ] && { echo "FAIL: validated assignments_cohort_test_fk missing or incorrect"; exit 1; }
echo "✓ composite assignments FK exists and is validated"

TRIGGERS=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_trigger
  WHERE (
    (tgname='trg_cohorts_validate_status' AND tgrelid='public.cohorts'::regclass)
    OR (tgname='trg_cohorts_sync_is_active' AND tgrelid='public.cohorts'::regclass)
    OR (tgname='trg_cohort_tests_capacity' AND tgrelid='public.cohort_tests'::regclass)
    OR (tgname='trg_cohorts_check_capacity_update' AND tgrelid='public.cohorts'::regclass)
    OR (tgname='trg_cohort_tests_prevent_key_update' AND tgrelid='public.cohort_tests'::regclass)
    OR (tgname='trg_assignments_prevent_self_test' AND tgrelid='public.assignments'::regclass)
  ) AND tgenabled='O' AND NOT tgisinternal;")
[ "$TRIGGERS" -ne 6 ] && { echo "FAIL: expected 6 triggers, got $TRIGGERS"; exit 1; }
echo "✓ 6 triggers on correct tables"

HISTORY=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20261107000300%';")
[ "$HISTORY" -ne 1 ] && { echo "FAIL: 016c not in migration history"; exit 1; }
echo "✓ 016c recorded in migration history"

echo "PASS: upgrade migration verified with legacy assignments"
