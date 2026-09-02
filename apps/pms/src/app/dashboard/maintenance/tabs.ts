import type { getMaintenanceAccess } from "./access";

type Access = ReturnType<typeof getMaintenanceAccess>;

export function maintenanceTabs(access: Access) {
  return [
    {
      key: "operation",
      label: "Operação",
      href: "/dashboard/maintenance/view",
      isVisible: access.canRead,
    },
    {
      key: "agenda",
      label: "Minha agenda",
      href: "/dashboard/maintenance/agenda",
      isVisible: access.canExecute,
    },
    {
      key: "preventive",
      label: "Preventivas",
      href: "/dashboard/maintenance/preventive",
      isVisible: access.canManagePlans || access.canExecute,
    },
    {
      key: "suppliers",
      label: "Fornecedores",
      href: "/dashboard/maintenance/suppliers",
      isVisible: access.canManageSuppliers,
    },
    {
      key: "analytics",
      label: "Indicadores",
      href: "/dashboard/maintenance/analytics",
      isVisible: access.canReadAnalytics,
    },
    {
      key: "finance",
      label: "Financeiro",
      href: "/dashboard/maintenance/finance",
      isVisible: access.canReadFinance,
    },
    {
      key: "settings",
      label: "Configuração",
      href: "/dashboard/maintenance/settings",
      isVisible: access.canManageCatalogs || access.canManageSla,
    },
  ];
}
