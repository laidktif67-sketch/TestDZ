BEGIN;
SELECT plan(6);

-- ============================================================
-- TEST 1: Old UNIQUE gone
-- ============================================================
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname='assignments_cohort_id_tester_id_key'
  ),
  'TEST 1: old UNIQUE(cohort_id, tester_id) removed'
);

-- ============================================================
-- TEST 2: New UNIQUE has the exact ordered columns
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.assignments'::regclass
      AND c.conname='assignments_cohort_test_tester_unique'
      AND c.contype='u'
      AND (
        SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
        FROM pg_attribute a
        WHERE a.attrelid=c.conrelid
          AND a.attnum = ANY(c.conkey)
      ) = ARRAY['cohort_id', 'test_id', 'tester_id']::name[]
  ),
  'TEST 2: UNIQUE(cohort_id, test_id, tester_id) exists with correct column order'
);

-- ============================================================
-- TEST 3a: assignments_cohort_test_fk -> cohort_tests(cohort_id, test_id)
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_test_fk'
      AND c.contype = 'f'
      AND c.confrelid = 'public.cohort_tests'::regclass
      AND c.convalidated
      AND (
        SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      ) = ARRAY['cohort_id', 'test_id']::name[]
      AND (
        SELECT array_agg(a.attname ORDER BY array_position(c.confkey, a.attnum))
        FROM pg_attribute a
        WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)
      ) = ARRAY['cohort_id', 'test_id']::name[]
  ),
  'TEST 3a: assignments_cohort_test_fk -> cohort_tests(cohort_id, test_id)'
);

-- ============================================================
-- TEST 3b: assignments_cohort_tester_fk -> cohort_tests(cohort_id, developer_id)
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_tester_fk'
      AND c.contype = 'f'
      AND c.confrelid = 'public.cohort_tests'::regclass
      AND c.convalidated
      AND (
        SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      ) = ARRAY['cohort_id', 'tester_id']::name[]
      AND (
        SELECT array_agg(a.attname ORDER BY array_position(c.confkey, a.attnum))
        FROM pg_attribute a
        WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)
      ) = ARRAY['cohort_id', 'developer_id']::name[]
  ),
  'TEST 3b: assignments_cohort_tester_fk -> cohort_tests(cohort_id, developer_id)'
);

-- ============================================================
-- TEST 4a: feedback NOT NULL
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='feedback'
      AND column_name='assignment_id'
      AND is_nullable='NO'
  ),
  'TEST 4a: feedback.assignment_id is NOT NULL'
);

-- ============================================================
-- TEST 4b: valid, full UNIQUE index on assignment_id only
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attname = 'assignment_id'
    WHERE n.nspname = 'public'
      AND ic.relname = 'feedback_one_per_assignment'
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND i.indpred IS NULL
      AND i.indnatts = 1
      AND i.indnkeyatts = 1
      AND i.indkey[0] = a.attnum
  ),
  'TEST 4b: feedback_one_per_assignment is a valid full UNIQUE index on assignment_id only'
);

SELECT * FROM finish();
ROLLBACK;
