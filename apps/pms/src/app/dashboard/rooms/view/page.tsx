import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listRooms } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRoomsAccess, getRoomsDefaultRoute } from "../access";
import { RoomsViewFilterableSection } from "../_components/RoomsViewFilterableSection";

type RoomsViewPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function RoomsViewPage({ searchParams }: RoomsViewPageProps) {
  const user = await getUserFromSession();
  const access = getRoomsAccess(user);

  if (!access.canRead) {
    const fallback = getRoomsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Quartos</h2>
        <p>Sem permissao para visualizar quartos.</p>
      </section>
    );
  }

  const rooms = await listRooms();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Quartos</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar quarto", href: "/dashboard/rooms/create", isVisible: access.canCreate },
            { key: "view", label: "Ver quartos", href: "/dashboard/rooms/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <RoomsViewFilterableSection rooms={rooms} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
