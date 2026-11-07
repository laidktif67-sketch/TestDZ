\ir verify_016b.sql
DO $
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations) <> 17 THEN
    RAISE EXCEPTION 'Expected exactly 17 migration history rows before 016c';
  END IF;
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261107000300'
  ) THEN
    RAISE EXCEPTION '016c is already recorded; refusing duplicate application';
  END IF;
END $$;
