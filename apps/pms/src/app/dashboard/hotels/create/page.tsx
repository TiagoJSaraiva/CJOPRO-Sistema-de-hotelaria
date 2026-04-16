import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelCreateForm } from "../_components/HotelCreateForm";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";

type HotelCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
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
      <section className="pms-surface-card">
        <h2 className="mt-0">Hoteis</h2>
        <p>Sem permissao para criar hotel.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Hoteis</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
            { key: "view", label: "Ver hoteis", href: "/dashboard/hotels/view", isVisible: access.canRead }
          ]}
        />
        <HotelStatusMessage status={searchParams?.status} />
      </section>

      <HotelCreateForm formKey={searchParams?.r} />
    </section>
  );
}
