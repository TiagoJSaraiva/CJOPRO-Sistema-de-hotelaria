import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listRooms } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRoomsAccess, getRoomsDefaultRoute } from "../access";
import { RoomsViewFilterableSection } from "../_components/RoomsViewFilterableSection";
import { RoomStatusMessage } from "../_components/RoomStatusMessage";

type RoomsViewPageProps = {
  searchParams?: {
    status?: string;
    roomId?: string;
    mode?: string;
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

    return <DashboardAccessDeniedCard title="Quartos" message="Sem permissao para visualizar quartos." />;
  }

  const rooms = await listRooms();
  const activeRoomId = String(searchParams?.roomId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Quartos"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar quarto", href: "/dashboard/rooms/create", isVisible: access.canCreate },
        { key: "view", label: "Ver quartos", href: "/dashboard/rooms/view", isVisible: access.canRead }
      ]}
      statusContent={<RoomStatusMessage status={searchParams?.status} />}
    >
      <RoomsViewFilterableSection
        rooms={rooms}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeRoomId={activeRoomId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
