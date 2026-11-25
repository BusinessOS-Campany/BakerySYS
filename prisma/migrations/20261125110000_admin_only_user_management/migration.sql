-- User and permission management is OWNER/admin-only.
-- Remove the stale users.manage grant from every non-owner role so the catalog,
-- role editor and authorization checks all agree.
DELETE FROM "role_permissions" rp
USING "roles" r
WHERE rp."roleId" = r.id
  AND rp."permission" = 'users.manage'
  AND r.code <> 'OWNER';
