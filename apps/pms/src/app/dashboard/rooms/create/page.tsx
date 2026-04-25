import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { createRoomAction } from "../actions";
import { getRoomsAccess, getRoomsDefaultRoute } from "../access";

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
      status={searchParams?.status}
    >
      <DashboardCreateFormCard title="Criar quarto" submitLabel="Criar quarto" action={createRoomAction} resetKey={searchParams?.r}>
        <input name="room_number" placeholder="Numero" required className="pms-field-input" />
        <input name="room_type" placeholder="Tipo" required className="pms-field-input" />
        <input name="max_occupancy" type="number" min={1} placeholder="Capacidade" required className="pms-field-input" />
        <input name="base_daily_rate" type="number" min={0} step="0.01" placeholder="Diaria base" required className="pms-field-input" />
        <select name="status" defaultValue="available" className="pms-field-input">
          <option value="available">available</option>
          <option value="occupied">occupied</option>
          <option value="maintenance">maintenance</option>
          <option value="blocked">blocked</option>
        </select>
        <input name="notes" placeholder="Observacoes" className="pms-field-input" />
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
