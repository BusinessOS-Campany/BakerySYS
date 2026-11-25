-- Keep a single branch per tenant: remap all data from NORTH to MAIN, then
-- remove the NORTH branch row. Runs per tenant so multi-tenant data is safe.
DO $$
DECLARE
  pair RECORD;
  tbl RECORD;
BEGIN
  FOR pair IN
    SELECT n.id AS north_id, m.id AS main_id
    FROM "branches" n
    JOIN "branches" m
      ON m."tenantId" = n."tenantId" AND m.code = 'MAIN'
    WHERE n.code = 'NORTH'
  LOOP
    -- Avoid unique-index conflicts on branch-scoped role grants.
    DELETE FROM "user_roles" duplicate
    USING "user_roles" kept
    WHERE duplicate."branchId" = pair.north_id
      AND kept."branchId" = pair.main_id
      AND kept."userId" = duplicate."userId"
      AND kept."roleId" = duplicate."roleId";

    DELETE FROM "user_branch_access" duplicate
    USING "user_branch_access" kept
    WHERE duplicate."branchId" = pair.north_id
      AND kept."branchId" = pair.main_id
      AND kept."userId" = duplicate."userId";

    -- Remap every column named branchId, including tables whose feature was
    -- removed earlier but whose historical rows are still present.
    FOR tbl IN
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'branchId'
        AND data_type = 'text'
    LOOP
      EXECUTE format(
        'UPDATE %I SET "branchId" = $1 WHERE "branchId" = $2',
        tbl.table_name
      ) USING pair.main_id, pair.north_id;
    END LOOP;

    DELETE FROM "branches" WHERE id = pair.north_id;
  END LOOP;
END $$;
