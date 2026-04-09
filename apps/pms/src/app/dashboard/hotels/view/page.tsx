import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { listHotels } from "../../../../lib/adminApi";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelListItem } from "../_components/HotelListItem";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";

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
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Hoteis</h2>
        <p>Sem permissao para visualizar hoteis.</p>
      </section>
    );
  }

  const hotels = await listHotels();
  const activeHotelId = String(searchParams?.hotelId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Hoteis</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
            { key: "view", label: "Ver hoteis", href: "/dashboard/hotels/view", isVisible: access.canRead }
          ]}
        />
        <HotelStatusMessage status={searchParams?.status} />
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {hotels.length ? (
          hotels.map((hotel) => (
            <HotelListItem
              key={hotel.id}
              hotel={hotel}
              canRead={access.canRead}
              canUpdate={access.canUpdate}
              canDelete={access.canDelete}
              isViewing={activeHotelId === hotel.id && mode === "view"}
              isEditing={activeHotelId === hotel.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            Nenhum hotel cadastrado ate o momento.
          </article>
        )}
      </section>
    </section>
  );
}
