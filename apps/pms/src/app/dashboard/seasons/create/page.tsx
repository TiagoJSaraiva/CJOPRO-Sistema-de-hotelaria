import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
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

    return <DashboardAccessDeniedCard title="Temporadas" message="Sem permissão para criar temporada." />;
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
        <FormField label="Nome" htmlFor="create-season-name">
          <input id="create-season-name" name="name" required className="pms-field-input" />
        </FormField>

        <FormField label="Data inicial" htmlFor="create-season-start-date">
          <input id="create-season-start-date" name="start_date" type="date" required className="pms-field-input" />
        </FormField>

        <FormField label="Data final" htmlFor="create-season-end-date">
          <input id="create-season-end-date" name="end_date" type="date" required className="pms-field-input" />
        </FormField>

        <div className="pms-field">
          <label htmlFor="create-season-active">Ativa</label>
          <input id="create-season-active" name="is_active" type="checkbox" defaultChecked className="justify-self-start" />
        </div>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
