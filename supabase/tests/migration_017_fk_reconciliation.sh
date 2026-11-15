#!/usr/bin/env bash
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL not set}"

# This test writes fixtures and must never run against a hosted database.
case "$DB_URL" in
  *@localhost:*|*@127.0.0.1:*|*@\\[::1\\]:*) ;;
  *)
    echo "FAIL: refusing non-local database URL; use the local DB_URL from supabase status"
    exit 1
    ;;
esac

echo "=== Week 5 FK reconciliation regression test ==="

# 016c must have created the intended FK. Make it NOT VALID to exercise
# the migration's validation path, then recreate the known legacy bad FK.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_cohort_test_fk;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_cohort_test_fk
  FOREIGN KEY (cohort_id, test_id)
  REFERENCES public.cohort_tests (cohort_id, test_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_cohort_tester_fk
  FOREIGN KEY (cohort_id, tester_id)
  REFERENCES public.cohort_tests (cohort_id, developer_id)
  NOT VALID;
SQL

echo "✓ legacy FK fixture created; correct FK is NOT VALID"

# Apply only pending local migrations. This is deliberately local-only.
supabase migration up --local

RESULT=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  SELECT
    (SELECT COUNT(*) FROM pg_constraint
     WHERE conrelid='public.assignments'::regclass
       AND conname='assignments_cohort_tester_fk') || ':' ||
    (SELECT COUNT(*) FROM pg_constraint
     WHERE conrelid='public.assignments'::regclass
       AND conname='assignments_cohort_test_fk'
       AND contype='f'
       AND confrelid='public.cohort_tests'::regclass
       AND convalidated
       AND confdeltype='r');")

[ "$RESULT" = "0:1" ] || {
  echo "FAIL: expected invalid FK absent and correct validated RESTRICT FK present; got $RESULT"
  exit 1
}

echo "PASS: invalid legacy FK removed; correct composite FK validated with ON DELETE RESTRICT"
