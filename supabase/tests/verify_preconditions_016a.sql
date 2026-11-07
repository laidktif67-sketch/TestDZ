\ir verify_baseline_001_015.sql
DO $
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations) <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 baseline migration history rows before 016a';
  END IF;

  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version IN ('20261107000100','20261107000200','20261107000300')
  ) THEN
    RAISE EXCEPTION 'One or more target migrations are already recorded; refusing to apply 016a out of order';
  END IF;
END $$;
