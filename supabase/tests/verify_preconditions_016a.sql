\ir verify_baseline_001_015.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261107000100'
  ) THEN
    RAISE EXCEPTION '016a is already recorded; refusing duplicate application';
  END IF;
END $$;
