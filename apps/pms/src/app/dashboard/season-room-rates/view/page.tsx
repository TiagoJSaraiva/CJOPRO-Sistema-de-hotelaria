import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listSeasonRoomRates, listSeasons } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";
import { SeasonRoomRatesViewFilterableSection } from "../_components/SeasonRoomRatesViewFilterableSection";
import { SeasonRoomRateStatusMessage } from "../_components/SeasonRoomRateStatusMessage";

type SeasonRoomRatesViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    seasonRoomRateId?: string;
    mode?: string;
  }>;
};

export default async function SeasonRoomRatesViewPage({ searchParams }: SeasonRoomRatesViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);

  if (!access.canRead) {
    const fallback = getSeasonRoomRatesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Tarifas por Temporada" message="Sem permissão para visualizar tarifas de temporada." />;
  }

  const items = await listSeasonRoomRates();
  const seasons = await listSeasons();
  const activeSeasonRoomRateId = String(resolvedSearchParams?.seasonRoomRateId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";

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
      statusContent={<SeasonRoomRateStatusMessage status={resolvedSearchParams?.status} />}
    >
      <SeasonRoomRatesViewFilterableSection
        items={items}
        seasons={seasons}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeSeasonRoomRateId={activeSeasonRoomRateId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
