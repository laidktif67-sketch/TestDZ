\ir verify_baseline_001_015.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version IN ('20261107000100','20261107000200','20261107000300')
  ) THEN
    RAISE EXCEPTION 'One or more target migrations are already recorded; refusing to apply 016a out of order';
  END IF;
END $$;
