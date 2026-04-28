import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { createRoomAction } from "../actions";
import { getRoomsAccess, getRoomsDefaultRoute } from "../access";
import { RoomStatusMessage } from "../_components/RoomStatusMessage";

type RoomsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function RoomsCreatePage({ searchParams }: RoomsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getRoomsAccess(user);

  if (!access.canCreate) {
    const fallback = getRoomsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Quartos" message="Sem permissao para criar quarto." />;
  }

  return (
    <DashboardEntityPageShell
      title="Quartos"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar quarto", href: "/dashboard/rooms/create", isVisible: access.canCreate },
        { key: "view", label: "Ver quartos", href: "/dashboard/rooms/view", isVisible: access.canRead }
      ]}
      statusContent={<RoomStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard title="Criar quarto" submitLabel="Criar quarto" action={createRoomAction} resetKey={searchParams?.r}>
        <FormField label="Numero" htmlFor="create-room-number">
          <input id="create-room-number" name="room_number" required className="pms-field-input" />
        </FormField>

        <FormField label="Tipo" htmlFor="create-room-type">
          <input id="create-room-type" name="room_type" required className="pms-field-input" />
        </FormField>

        <FormField label="Capacidade" htmlFor="create-room-capacity">
          <input id="create-room-capacity" name="max_occupancy" type="number" min={1} required className="pms-field-input" />
        </FormField>

        <FormField label="Diaria base" htmlFor="create-room-base-daily-rate">
          <input id="create-room-base-daily-rate" name="base_daily_rate" type="number" min={0} step="0.01" required className="pms-field-input" />
        </FormField>

        <FormField label="Status" htmlFor="create-room-status">
          <select id="create-room-status" name="status" defaultValue="available" className="pms-field-input">
            <option value="available">available</option>
            <option value="occupied">occupied</option>
            <option value="maintenance">maintenance</option>
            <option value="blocked">blocked</option>
          </select>
        </FormField>

        <FormField label="Observacoes" htmlFor="create-room-notes" fullWidth>
          <input id="create-room-notes" name="notes" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
