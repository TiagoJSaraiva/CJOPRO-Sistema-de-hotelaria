import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listConsumptionOffers,
  listConsumptionPoints,
  listProducts,
  listCommercialAgreements,
  listInventoryLocations,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { ConsumptionOffersManager } from "../_components/ConsumptionOffersManager";
import { ConsumptionStatusMessage } from "../_components/ConsumptionStatusMessage";
import { getConsumptionAccess } from "../access";
import { consumptionOffersGuide } from "../usageGuides";
import { consumptionTabs } from "../tabs";

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
  const [points, products, offers, agreements, inventoryLocations] =
    await Promise.all([
      listConsumptionPoints(true),
      listProducts(true),
      listConsumptionOffers({ includeArchived: true }),
      access.canReadCommercial
        ? listCommercialAgreements()
        : Promise.resolve([]),
      listInventoryLocations().catch(() => []),
    ]);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="offers"
      usageGuide={consumptionOffersGuide}
      tabs={consumptionTabs(access)}
      statusContent={<ConsumptionStatusMessage status={status} />}
    >
      <ConsumptionOffersManager
        points={points}
        products={products}
        offers={offers}
        agreements={agreements}
        canManage={access.canManage}
        inventoryLocations={inventoryLocations}
      />
    </DashboardEntityPageShell>
  );
}
