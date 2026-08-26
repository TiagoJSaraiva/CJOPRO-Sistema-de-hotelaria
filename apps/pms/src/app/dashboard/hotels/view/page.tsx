import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { listHotels } from "../../../../lib/adminApi";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";
import { HotelsViewFilterableSection } from "../_components/HotelsViewFilterableSection";

type HotelViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    hotelId?: string;
    mode?: string;
  }>;
};

export default async function HotelViewPage({ searchParams }: HotelViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getHotelAccess(user);

  if (!access.canRead) {
    const fallback = getHotelDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Hotéis" message="Sem permissão para visualizar hotéis." />;
  }

  const activeHotelId = String(resolvedSearchParams?.hotelId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";
  const hotels = await listHotels();

  return (
    <DashboardEntityPageShell
      title="Hotéis"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
        { key: "view", label: "Ver hotéis", href: "/dashboard/hotels/view", isVisible: access.canRead }
      ]}
      statusContent={<HotelStatusMessage status={resolvedSearchParams?.status} />}
    >
      <HotelsViewFilterableSection
        hotels={hotels}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeHotelId={activeHotelId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
