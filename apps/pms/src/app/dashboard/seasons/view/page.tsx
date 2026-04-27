import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listSeasons } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "../access";
import { SeasonsViewFilterableSection } from "../_components/SeasonsViewFilterableSection";
import { SeasonStatusMessage } from "../_components/SeasonStatusMessage";

type SeasonsViewPageProps = {
  searchParams?: {
    status?: string;
    seasonId?: string;
    mode?: string;
  };
};

export default async function SeasonsViewPage({ searchParams }: SeasonsViewPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);

  if (!access.canRead) {
    const fallback = getSeasonsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Temporadas" message="Sem permissao para visualizar temporadas." />;
  }

  const seasons = await listSeasons();
  const activeSeasonId = String(searchParams?.seasonId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Temporadas"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar temporada", href: "/dashboard/seasons/create", isVisible: access.canCreate },
        { key: "view", label: "Ver temporadas", href: "/dashboard/seasons/view", isVisible: access.canRead }
      ]}
      statusContent={<SeasonStatusMessage status={searchParams?.status} />}
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
