/**
 * Idempotently creates or repairs the local `admin` / `admin` shortcut login.
 * Safe to run against an existing database: no other users or data are changed.
 * Run: npm run db:admin
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../src/lib/auth/admin";

const TENANT_SLUG = "golden-crust";
const OWNER_ROLE = "OWNER";

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: TENANT_SLUG }, select: { id: true } });
  if (!tenant) throw new Error(`[admin] Tenant '${TENANT_SLUG}' not found. Run npm run db:seed first.`);

  const ownerRole = await db.role.findFirst({
    where: { tenantId: tenant.id, code: OWNER_ROLE },
    select: { id: true },
  });
  if (!ownerRole) throw new Error(`[admin] Role '${OWNER_ROLE}' not found in tenant '${TENANT_SLUG}'.`);

  const data = {
    tenantId: tenant.id,
    nameAr: "مدير النظام",
    nameEn: "System Admin",
    passwordHash: hashPassword(ADMIN_PASSWORD, 1),
    locale: "en",
    active: true,
    mustReset: false,
  };

  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, ...data },
    update: data,
    select: { id: true, email: true },
  });

  const existingRole = await db.userRole.findFirst({
    where: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id, branchId: null },
    select: { id: true },
  });
  if (!existingRole) {
    await db.userRole.create({
      data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id, branchId: null },
    });
  }

  console.log(`[admin] Ready: admin / admin (${user.email})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
