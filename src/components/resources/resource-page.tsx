import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { RESOURCES } from "@/lib/resources/config";
import { ResourceTable } from "./resource-table";

export async function ResourcePage({ resource }: { resource: string }) {
  const config = RESOURCES[resource];
  if (!config) redirect("/");
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.permissions.has(config.viewPermission) && !auth.roles.includes("OWNER")) redirect("/");
  const publicConfig = { ...config, fields: config.fields.filter((field) => !field.hidden) };
  return (
    <ResourceTable
      config={publicConfig}
      locale={auth.locale}
      canManage={auth.permissions.has(config.managePermission) || auth.roles.includes("OWNER")}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
    />
  );
}
