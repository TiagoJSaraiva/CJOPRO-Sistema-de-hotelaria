import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { listHotels } from "../../../../lib/adminApi";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";
import { HotelsViewFilterableSection } from "../_components/HotelsViewFilterableSection";

type HotelViewPageProps = {
  searchParams?: {
    status?: string;
    hotelId?: string;
    mode?: string;
  };
};

export default async function HotelViewPage({ searchParams }: HotelViewPageProps) {
  const user = await getUserFromSession();
  const access = getHotelAccess(user);

  if (!access.canRead) {
    const fallback = getHotelDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Hoteis</h2>
        <p>Sem permissao para visualizar hoteis.</p>
      </section>
    );
  }

  const activeHotelId = String(searchParams?.hotelId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";
  const hotels = await listHotels();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Hoteis</h1>
        <HotelStatusMessage status={searchParams?.status} />
      </section>

      <HotelsViewFilterableSection
        hotels={hotels}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeHotelId={activeHotelId}
        mode={mode}
      >
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
            { key: "view", label: "Ver hoteis", href: "/dashboard/hotels/view", isVisible: access.canRead }
          ]}
        />
      </HotelsViewFilterableSection>
    </section>
  );
}
