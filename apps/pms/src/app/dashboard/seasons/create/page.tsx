import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { createSeasonAction } from "../actions";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "../access";

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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Temporadas</h2>
        <p>Sem permissao para criar temporada.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Temporadas</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar temporada", href: "/dashboard/seasons/create", isVisible: access.canCreate },
            { key: "view", label: "Ver temporadas", href: "/dashboard/seasons/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <article className="pms-surface-card">
        <h3 className="mt-0">Criar temporada</h3>
        <form key={searchParams?.r} action={createSeasonAction} className="grid gap-[0.65rem] md:grid-cols-2">
          <input name="name" placeholder="Nome" required className="pms-field-input" />
          <input name="start_date" type="date" required className="pms-field-input" />
          <input name="end_date" type="date" required className="pms-field-input" />
          <label className="flex items-center gap-2 text-[0.9rem]">
            <input name="is_active" type="checkbox" defaultChecked /> Ativa
          </label>
          <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
            Criar temporada
          </button>
        </form>
      </article>
    </section>
  );
}
