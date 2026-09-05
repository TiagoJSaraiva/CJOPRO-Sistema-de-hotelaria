import type { PermissionTabItem } from "../_components/PermissionTabs";
import type { ConsumptionAccess } from "./access";

export function consumptionTabs(
  access: ConsumptionAccess,
): PermissionTabItem[] {
  return [
    {
      key: "launch",
      label: "Lançar consumo",
      href: "/dashboard/consumption/launch",
      isVisible: access.canPost,
    },
    {
      key: "history",
      label: "Histórico",
      href: "/dashboard/consumption/history",
      isVisible: access.canRead,
    },
    {
      key: "adjustments",
      label: "Ajustes",
      href: "/dashboard/consumption/adjustments",
      isVisible: access.canApproveAdjustments,
    },
    {
      key: "analytics",
      label: "Painel gerencial",
      href: "/dashboard/consumption/analytics",
      isVisible: access.canReadAnalytics,
    },
    {
      key: "settlements",
      label: "Apurações",
      href: "/dashboard/consumption/settlements",
      isVisible:
        access.canReadSettlements ||
        access.canPrepareSettlements ||
        access.canApproveSettlements ||
        access.canSettleSettlements,
    },
    {
      key: "points",
      label: "Pontos de consumo",
      href: "/dashboard/consumption/points",
      isVisible: access.canRead,
    },
    {
      key: "offers",
      label: "Ofertas",
      href: "/dashboard/consumption/offers",
      isVisible: access.canRead,
    },
    {
      key: "partners",
      label: "Parceiros",
      href: "/dashboard/consumption/partners",
      isVisible: access.canReadCommercial,
    },
    {
      key: "agreements",
      label: "Acordos",
      href: "/dashboard/consumption/agreements",
      isVisible: access.canReadCommercial,
    },
  ];
}
