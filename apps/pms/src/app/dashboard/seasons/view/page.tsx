import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listSeasons } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "../access";
import { SeasonsViewFilterableSection } from "../_components/SeasonsViewFilterableSection";
import { SeasonStatusMessage } from "../_components/SeasonStatusMessage";

type SeasonsViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    seasonId?: string;
    mode?: string;
  }>;
};

export default async function SeasonsViewPage({
  searchParams,
}: SeasonsViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);

  if (!access.canRead) {
    const fallback = getSeasonsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Temporadas"
        message="Sem permissão para visualizar temporadas."
      />
    );
  }

  const seasons = await listSeasons();
  const activeSeasonId = String(resolvedSearchParams?.seasonId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Temporadas"
      activeTabKey="view"
      tabs={[
        {
          key: "create",
          label: "Criar temporada",
          href: "/dashboard/seasons/create",
          isVisible: access.canCreate,
        },
        {
          key: "view",
          label: "Ver temporadas",
          href: "/dashboard/seasons/view",
          isVisible: access.canRead,
        },
      ]}
      statusContent={
        <SeasonStatusMessage status={resolvedSearchParams?.status} />
      }
    >
      <SeasonsViewFilterableSection
        seasons={seasons}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeSeasonId={activeSeasonId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
