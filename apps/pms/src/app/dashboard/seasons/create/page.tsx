import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { createSeasonAction } from "../actions";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "../access";
import { SeasonStatusMessage } from "../_components/SeasonStatusMessage";

type SeasonsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonsCreatePage({ searchParams }: SeasonsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);

  if (!access.canCreate) {
    const fallback = getSeasonsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Temporadas" message="Sem permissao para criar temporada." />;
  }

  return (
    <DashboardEntityPageShell
      title="Temporadas"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar temporada", href: "/dashboard/seasons/create", isVisible: access.canCreate },
        { key: "view", label: "Ver temporadas", href: "/dashboard/seasons/view", isVisible: access.canRead }
      ]}
      statusContent={<SeasonStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard title="Criar temporada" submitLabel="Criar temporada" action={createSeasonAction} resetKey={searchParams?.r}>
        <input name="name" placeholder="Nome" required className="pms-field-input" />
        <input name="start_date" type="date" required className="pms-field-input" />
        <input name="end_date" type="date" required className="pms-field-input" />
        <label className="flex items-center gap-2 text-[0.9rem]">
          <input name="is_active" type="checkbox" defaultChecked /> Ativa
        </label>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
