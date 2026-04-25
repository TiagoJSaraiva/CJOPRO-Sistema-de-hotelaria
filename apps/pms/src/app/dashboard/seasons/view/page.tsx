import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listSeasons } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "../access";
import { SeasonsViewFilterableSection } from "../_components/SeasonsViewFilterableSection";

type SeasonsViewPageProps = {
  searchParams?: {
    status?: string;
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Temporadas</h2>
        <p>Sem permissao para visualizar temporadas.</p>
      </section>
    );
  }

  const seasons = await listSeasons();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Temporadas</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar temporada", href: "/dashboard/seasons/create", isVisible: access.canCreate },
            { key: "view", label: "Ver temporadas", href: "/dashboard/seasons/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <SeasonsViewFilterableSection seasons={seasons} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
