import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listSeasonRoomRates } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";
import { SeasonRoomRatesViewFilterableSection } from "../_components/SeasonRoomRatesViewFilterableSection";

type SeasonRoomRatesViewPageProps = {
  searchParams?: {
    status?: string;
    seasonRoomRateId?: string;
    mode?: string;
  };
};

export default async function SeasonRoomRatesViewPage({ searchParams }: SeasonRoomRatesViewPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);

  if (!access.canRead) {
    const fallback = getSeasonRoomRatesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Tarifas por Temporada" message="Sem permissao para visualizar tarifas de temporada." />;
  }

  const items = await listSeasonRoomRates();
  const activeSeasonRoomRateId = String(searchParams?.seasonRoomRateId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Tarifas por Temporada"
      activeTabKey="view"
      tabs={[
        {
          key: "create",
          label: "Criar tarifa",
          href: "/dashboard/season-room-rates/create",
          isVisible: access.canCreate
        },
        {
          key: "view",
          label: "Ver tarifas",
          href: "/dashboard/season-room-rates/view",
          isVisible: access.canRead
        }
      ]}
      status={searchParams?.status}
    >
      <SeasonRoomRatesViewFilterableSection
        items={items}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeSeasonRoomRateId={activeSeasonRoomRateId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
