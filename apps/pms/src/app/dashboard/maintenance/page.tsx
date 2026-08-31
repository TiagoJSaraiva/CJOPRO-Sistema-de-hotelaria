import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getMaintenanceAccess } from "./access";

export default async function MaintenancePage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (access.canRead) redirect("/dashboard/maintenance/view");
  if (access.canCreate) redirect("/dashboard/maintenance/report");
  if (access.canManageCatalogs) redirect("/dashboard/maintenance/settings");
  redirect("/dashboard");
}
