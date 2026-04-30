import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { listSeasons } from "../../../../lib/adminApi";
import { createSeasonRoomRateAction } from "../actions";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "../access";
import { SeasonRoomRateStatusMessage } from "../_components/SeasonRoomRateStatusMessage";
import { SeasonRoomSelect } from "../_components/SeasonRoomSelect";

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

  const seasons = await listSeasons();

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
        <FormField label="Temporada" htmlFor="create-season-rate-season-id">
          <SeasonRoomSelect id="create-season-rate-season-id" name="season_id" seasons={seasons} required />
        </FormField>

        <FormField label="Tipo de quarto" htmlFor="create-season-rate-room-type">
          <input id="create-season-rate-room-type" name="room_type" required className="pms-field-input" />
        </FormField>

        <FormField label="Taxa diária" htmlFor="create-season-rate-daily-rate">
          <input id="create-season-rate-daily-rate" name="daily_rate" type="number" min={0} step="0.01" required className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
