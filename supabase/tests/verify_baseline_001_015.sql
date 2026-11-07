-- Verify that the remote database has the exact established baseline (001-015).
DO $$
DECLARE
  v_missing integer;
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Supabase migration history table is missing';
  END IF;

  WITH expected(version) AS (
    VALUES
      ('20261106172737'), ('20261106172753'), ('20261106173022'),
      ('20261106173040'), ('20261106173057'), ('20261106173140'),
      ('20261106173720'), ('20261106173729'), ('20261106174500'),
      ('20261106174620'), ('20261106174644'), ('20261106174816'),
      ('20261106175505'), ('20261106175522'), ('20261106175905')
  )
  SELECT COUNT(*) INTO v_missing
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations m
    WHERE m.version = e.version
  );

  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'Baseline mismatch: % of the 15 expected migrations are missing', v_missing;
  END IF;


  RAISE NOTICE 'Baseline 001-015 verified; target migrations are not yet recorded';
END $$;
