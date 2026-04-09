import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelCreateForm } from "../_components/HotelCreateForm";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";

type HotelCreatePageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function HotelCreatePage({ searchParams }: HotelCreatePageProps) {
  const user = await getUserFromSession();
  const access = getHotelAccess(user);

  if (!access.canCreate) {
    const fallback = getHotelDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Hoteis</h2>
        <p>Sem permissao para criar hotel.</p>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Hoteis</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
            { key: "view", label: "Ver hoteis", href: "/dashboard/hotels/view", isVisible: access.canRead }
          ]}
        />
        <HotelStatusMessage status={searchParams?.status} />
      </section>

      <HotelCreateForm />
    </section>
  );
}
