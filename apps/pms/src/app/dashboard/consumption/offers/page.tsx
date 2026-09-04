import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listConsumptionOffers,
  listConsumptionPoints,
  listProducts,
  listCommercialAgreements,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { ConsumptionOffersManager } from "../_components/ConsumptionOffersManager";
import { ConsumptionStatusMessage } from "../_components/ConsumptionStatusMessage";
import { getConsumptionAccess } from "../access";
import { consumptionOffersGuide } from "../usageGuides";

export default async function ConsumptionOffersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const status = (await searchParams)?.status;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Vendas e consumo"
        message="Sem permissão para visualizar ofertas de consumo."
      />
    );
  const [points, products, offers, agreements] = await Promise.all([
    listConsumptionPoints(true),
    listProducts(true),
    listConsumptionOffers({ includeArchived: true }),
    access.canReadCommercial ? listCommercialAgreements() : Promise.resolve([]),
  ]);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="offers"
      usageGuide={consumptionOffersGuide}
      tabs={[
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
      ]}
      statusContent={<ConsumptionStatusMessage status={status} />}
    >
      <ConsumptionOffersManager
        points={points}
        products={products}
        offers={offers}
        agreements={agreements}
        canManage={access.canManage}
      />
    </DashboardEntityPageShell>
  );
}
