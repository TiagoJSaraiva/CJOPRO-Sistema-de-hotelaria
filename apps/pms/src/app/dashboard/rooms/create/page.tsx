import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Quartos</h2>
        <p>Sem permissao para criar quarto.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Quartos</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar quarto", href: "/dashboard/rooms/create", isVisible: access.canCreate },
            { key: "view", label: "Ver quartos", href: "/dashboard/rooms/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <article className="pms-surface-card">
        <h3 className="mt-0">Criar quarto</h3>
        <form key={searchParams?.r} action={createRoomAction} className="grid gap-[0.65rem] md:grid-cols-2">
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
          <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
            Criar quarto
          </button>
        </form>
      </article>
    </section>
  );
}
