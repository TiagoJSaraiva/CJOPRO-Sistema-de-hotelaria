import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listSeasonRoomRates } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";
import { SeasonRoomRatesViewFilterableSection } from "../_components/SeasonRoomRatesViewFilterableSection";

type SeasonRoomRatesViewPageProps = {
  searchParams?: {
    status?: string;
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Tarifas por Temporada</h2>
        <p>Sem permissao para visualizar tarifas de temporada.</p>
      </section>
    );
  }

  const items = await listSeasonRoomRates();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        <PermissionTabs
          activeKey="view"
          items={[
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
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <SeasonRoomRatesViewFilterableSection items={items} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
