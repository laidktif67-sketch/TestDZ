\ir verify_016a.sql
DO $verify$
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations) <> 16 THEN
    RAISE EXCEPTION 'Expected exactly 16 migration history rows before 016b';
  END IF;
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261107000200'
  ) THEN
    RAISE EXCEPTION '016b is already recorded; refusing duplicate application';
  END IF;
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261107000300'
  ) THEN
    RAISE EXCEPTION '016c is already recorded before 016b';
  END IF;
END $verify$;
