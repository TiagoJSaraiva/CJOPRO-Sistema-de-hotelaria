import { getUserFromSession } from "../../../lib/auth";
import { listSeasons } from "../../../lib/adminApi";
import { getSeasonsAccess } from "./access";
import { createSeasonAction, deleteSeasonAction, updateSeasonAction } from "./actions";

type SeasonsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Temporadas</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const seasons = access.canRead ? await listSeasons() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Temporadas</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
        <article className="pms-surface-card">
          <h3 className="mt-0">Criar temporada</h3>
          <form key={searchParams?.r} action={createSeasonAction} className="grid gap-[0.65rem] md:grid-cols-2">
            <input name="name" placeholder="Nome" required className="pms-field-input" />
            <input name="start_date" type="date" required className="pms-field-input" />
            <input name="end_date" type="date" required className="pms-field-input" />
            <label className="flex items-center gap-2 text-[0.9rem]"><input name="is_active" type="checkbox" defaultChecked /> Ativa</label>
            <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
              Criar temporada
            </button>
          </form>
        </article>
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {seasons.map((season) => (
            <article key={season.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">{season.name}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">{season.start_date} ate {season.end_date} | {season.is_active ? "ativa" : "inativa"}</p>

              {access.canUpdate ? (
                <form action={updateSeasonAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
                  <input type="hidden" name="id" value={season.id} />
                  <input name="name" defaultValue={season.name} required className="pms-field-input" />
                  <input name="start_date" type="date" defaultValue={season.start_date} required className="pms-field-input" />
                  <input name="end_date" type="date" defaultValue={season.end_date} required className="pms-field-input" />
                  <label className="flex items-center gap-2 text-[0.9rem]"><input name="is_active" type="checkbox" defaultChecked={season.is_active} /> Ativa</label>
                  <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                    Salvar
                  </button>
                </form>
              ) : null}

              {access.canDelete ? (
                <form action={deleteSeasonAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={season.id} />
                  <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                    Apagar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
