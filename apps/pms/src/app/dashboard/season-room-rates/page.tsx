import { getUserFromSession } from "../../../lib/auth";
import { listSeasonRoomRates } from "../../../lib/adminApi";
import { getSeasonRoomRatesAccess } from "./access";
import { createSeasonRoomRateAction, deleteSeasonRoomRateAction, updateSeasonRoomRateAction } from "./actions";

type SeasonRoomRatesPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonRoomRatesPage({ searchParams }: SeasonRoomRatesPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const items = access.canRead ? await listSeasonRoomRates() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
        <article className="pms-surface-card">
          <h3 className="mt-0">Criar tarifa</h3>
          <form key={searchParams?.r} action={createSeasonRoomRateAction} className="grid gap-[0.65rem] md:grid-cols-2">
            <input name="season_id" placeholder="Season ID" required className="pms-field-input" />
            <input name="room_type" placeholder="Room type" required className="pms-field-input" />
            <input name="daily_rate" type="number" min={0} step="0.01" placeholder="Daily rate" required className="pms-field-input" />
            <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
              Criar tarifa
            </button>
          </form>
        </article>
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">{item.room_type}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">Season: {item.season_id} | R$ {item.daily_rate.toFixed(2)}</p>

              {access.canUpdate ? (
                <form action={updateSeasonRoomRateAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
                  <input type="hidden" name="id" value={item.id} />
                  <input name="season_id" defaultValue={item.season_id} required className="pms-field-input" />
                  <input name="room_type" defaultValue={item.room_type} required className="pms-field-input" />
                  <input name="daily_rate" type="number" min={0} step="0.01" defaultValue={item.daily_rate} required className="pms-field-input" />
                  <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                    Salvar
                  </button>
                </form>
              ) : null}

              {access.canDelete ? (
                <form action={deleteSeasonRoomRateAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={item.id} />
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
