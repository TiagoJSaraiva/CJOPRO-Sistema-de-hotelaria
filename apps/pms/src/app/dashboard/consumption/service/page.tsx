import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getConsumptionOperationalContext,
  getConsumptionServiceBoard,
  listConsumptionEligibleStays,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { consumptionTabs } from "../tabs";
import { consumptionServiceGuide } from "../usageGuides";
import { ConsumptionServiceWorkspace } from "./ConsumptionServiceWorkspace";

export default async function ConsumptionServicePage({
  searchParams,
}: {
  searchParams?: Promise<{ stay_id?: string }>;
}) {
  const params = await searchParams;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canRead && !access.canManageService)
    return (
      <DashboardAccessDeniedCard
        title="Pedidos"
        message="Sem permissão para consultar pedidos de consumo."
      />
    );
  const [board, stays] = await Promise.all([
    getConsumptionServiceBoard(),
    listConsumptionEligibleStays(""),
  ]);
  const selectedStayId = params?.stay_id || stays[0]?.id;
  const context = selectedStayId
    ? await getConsumptionOperationalContext(selectedStayId).catch(() => null)
    : null;
  return (
    <DashboardEntityPageShell
      title="Pedidos de consumo"
      activeTabKey="service"
      tabs={consumptionTabs(access)}
      usageGuide={consumptionServiceGuide}
    >
      <ConsumptionServiceWorkspace
        items={board.items as never[]}
        stays={stays}
        context={context}
        selectedStayId={selectedStayId}
        canManage={access.canManageService}
        canCancel={access.canCancelService}
      />
    </DashboardEntityPageShell>
  );
}
