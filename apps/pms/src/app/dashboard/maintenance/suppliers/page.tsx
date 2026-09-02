import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenanceReferenceData,
  getMaintenanceSuppliers,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenanceSupplierManager } from "../_components/MaintenanceSupplierManager";
import { maintenanceTabs } from "../tabs";

export default async function MaintenanceSuppliersPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canManageSuppliers)
    return (
      <DashboardAccessDeniedCard
        title="Fornecedores"
        message="Sem permissão para gerenciar fornecedores e contratos."
      />
    );
  const [suppliers, references] = await Promise.all([
    getMaintenanceSuppliers(),
    getMaintenanceReferenceData(),
  ]);
  return (
    <DashboardEntityPageShell
      title="Fornecedores e contratos"
      activeTabKey="suppliers"
      tabs={maintenanceTabs(access)}
    >
      <MaintenanceSupplierManager
        suppliers={suppliers}
        categories={references.categories}
        locations={references.locations}
        canReadFinance={access.canReadFinance}
      />
    </DashboardEntityPageShell>
  );
}
