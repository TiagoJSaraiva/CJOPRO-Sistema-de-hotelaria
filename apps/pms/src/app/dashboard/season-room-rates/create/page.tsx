import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { createSeasonRoomRateAction } from "../actions";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";

type SeasonRoomRatesCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonRoomRatesCreatePage({ searchParams }: SeasonRoomRatesCreatePageProps) {
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);

  if (!access.canCreate) {
    const fallback = getSeasonRoomRatesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Tarifas por Temporada</h2>
        <p>Sem permissao para criar tarifa de temporada.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        <PermissionTabs
          activeKey="create"
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

      <article className="pms-surface-card">
        <h3 className="mt-0">Criar tarifa</h3>
        <form key={searchParams?.r} action={createSeasonRoomRateAction} className="grid gap-[0.65rem] md:grid-cols-2">
          <input name="season_id" placeholder="Season ID" required className="pms-field-input" />
          <input name="room_type" placeholder="Room type" required className="pms-field-input" />
          <input name="daily_rate" type="number" min={0} step="0.01" placeholder="Daily rate" required className="pms-field-input" />
          <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
            Criar tarifa
          </button>
        </form>
      </article>
    </section>
  );
}
