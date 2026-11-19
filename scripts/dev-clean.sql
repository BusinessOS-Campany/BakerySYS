-- DEVELOPMENT ONLY. Removes all business rows while preserving migration history.
-- Never run against a database that contains real business data.
DO $$
DECLARE
  stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE'
    INTO stmt
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';
  IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
END $$;
