import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { createSeasonRoomRateAction } from "../actions";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";
import { SeasonRoomRateStatusMessage } from "../_components/SeasonRoomRateStatusMessage";

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

    return <DashboardAccessDeniedCard title="Tarifas por Temporada" message="Sem permissao para criar tarifa de temporada." />;
  }

  return (
    <DashboardEntityPageShell
      title="Tarifas por Temporada"
      activeTabKey="create"
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
      statusContent={<SeasonRoomRateStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard title="Criar tarifa" submitLabel="Criar tarifa" action={createSeasonRoomRateAction} resetKey={searchParams?.r}>
        <input name="season_id" placeholder="Season ID" required className="pms-field-input" />
        <input name="room_type" placeholder="Room type" required className="pms-field-input" />
        <input name="daily_rate" type="number" min={0} step="0.01" placeholder="Daily rate" required className="pms-field-input" />
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
