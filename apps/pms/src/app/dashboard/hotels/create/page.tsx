import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "../access";
import { HotelCreateForm } from "../_components/HotelCreateForm";
import { HotelStatusMessage } from "../_components/HotelStatusMessage";

type HotelCreatePageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function HotelCreatePage({ searchParams }: HotelCreatePageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getHotelAccess(user);

  if (!access.canCreate) {
    const fallback = getHotelDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Hotéis" message="Sem permissão para criar hotel." />;
  }

  return (
    <DashboardEntityPageShell
      title="Hotéis"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar hotel", href: "/dashboard/hotels/create", isVisible: access.canCreate },
        { key: "view", label: "Ver hotéis", href: "/dashboard/hotels/view", isVisible: access.canRead }
      ]}
      statusContent={<HotelStatusMessage status={resolvedSearchParams?.status} />}
    >
      <HotelCreateForm formKey={resolvedSearchParams?.r} />
    </DashboardEntityPageShell>
  );
}
