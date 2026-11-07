#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"

echo "=== Verify rollback after failed migration ==="

# 1. cohorts.test_id still exists
COLS=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id';")
[ "$COLS" -ne 1 ] && { echo "FAIL: cohorts.test_id missing (rollback failed)"; exit 1; }
echo "✓ cohorts.test_id preserved"

# 2. cohort_tests empty
CT=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM public.cohort_tests;")
[ "$CT" -ne 0 ] && { echo "FAIL: cohort_tests not empty ($CT)"; exit 1; }
echo "✓ cohort_tests empty"

# 3. No new triggers (any state)
TRIGGERS=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_trigger
  WHERE tgname IN (
    'trg_cohorts_validate_status', 'trg_cohorts_sync_is_active',
    'trg_cohort_tests_capacity', 'trg_cohorts_check_capacity_update',
    'trg_cohort_tests_prevent_key_update', 'trg_assignments_prevent_self_test'
  ) AND NOT tgisinternal;")
[ "$TRIGGERS" -ne 0 ] && { echo "FAIL: triggers exist ($TRIGGERS)"; exit 1; }
echo "✓ no triggers"

# 4. Old policy preserved (exactly 1, references test_id)
POLICIES=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_policies
  WHERE schemaname='public' AND tablename='cohorts'
    AND policyname='cohorts_select_participants';")
[ "$POLICIES" -ne 1 ] && { echo "FAIL: expected 1 policy, got $POLICIES"; exit 1; }

HAS_TEST_ID=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_policies
  WHERE schemaname='public' AND tablename='cohorts'
    AND policyname='cohorts_select_participants'
    AND COALESCE(qual, '') LIKE '%test_id%';")
[ "$HAS_TEST_ID" -ne 1 ] && { echo "FAIL: old policy missing test_id reference"; exit 1; }
echo "✓ old policy preserved"

# 5. Old FK preserved
OLD_FK=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_constraint
  WHERE conname='cohorts_test_id_fkey'
    AND conrelid='public.cohorts'::regclass
    AND contype='f';")
[ "$OLD_FK" -ne 1 ] && { echo "FAIL: old FK missing"; exit 1; }
echo "✓ old FK preserved"

# 6. Index on cohorts.test_id preserved (find by columns)
IDX=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'public.cohorts'::regclass
    AND a.attname = 'test_id'
    AND ic.relname != 'cohorts_pkey';")
[ "$IDX" -lt 1 ] && { echo "FAIL: no index on cohorts.test_id"; exit 1; }
echo "✓ index on cohorts.test_id preserved"

# 7. Migration not in history
TABLE_EXISTS=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL;")
[ "$TABLE_EXISTS" != "t" ] && { echo "FAIL: migration history table unavailable"; exit 1; }

HISTORY=$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  SELECT COUNT(*) FROM supabase_migrations.schema_migrations
  WHERE version = '20261107000300';")
[ "$HISTORY" -ne 0 ] && { echo "FAIL: failed migration recorded in history"; exit 1; }
echo "✓ migration not in history"

echo "PASS: rollback verified (all changes reverted)"
