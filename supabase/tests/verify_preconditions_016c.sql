\ir verify_016b.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261107000300'
  ) THEN
    RAISE EXCEPTION '016c is already recorded; refusing duplicate application';
  END IF;
END $$;
