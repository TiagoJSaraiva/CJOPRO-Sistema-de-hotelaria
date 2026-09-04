import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listConsumptionOffers,
  listConsumptionPoints,
  listProducts,
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
  const [points, products, offers] = await Promise.all([
    listConsumptionPoints(true),
    listProducts(true),
    listConsumptionOffers({ includeArchived: true }),
  ]);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="offers"
      usageGuide={consumptionOffersGuide}
      tabs={[
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
      ]}
      statusContent={<ConsumptionStatusMessage status={status} />}
    >
      <ConsumptionOffersManager
        points={points}
        products={products}
        offers={offers}
        canManage={access.canManage}
      />
    </DashboardEntityPageShell>
  );
}
