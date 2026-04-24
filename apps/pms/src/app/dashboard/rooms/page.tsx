import { getUserFromSession } from "../../../lib/auth";
import { listRooms } from "../../../lib/adminApi";
import { getRoomsAccess } from "./access";
import { createRoomAction, deleteRoomAction, updateRoomAction } from "./actions";

type RoomsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const user = await getUserFromSession();
  const access = getRoomsAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Quartos</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const rooms = access.canRead ? await listRooms() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Quartos</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
        <article className="pms-surface-card">
          <h3 className="mt-0">Criar quarto</h3>
          <form key={searchParams?.r} action={createRoomAction} className="grid gap-[0.65rem] md:grid-cols-2">
            <input name="room_number" placeholder="Numero" required className="pms-field-input" />
            <input name="room_type" placeholder="Tipo" required className="pms-field-input" />
            <input name="max_occupancy" type="number" min={1} placeholder="Capacidade" required className="pms-field-input" />
            <input name="base_daily_rate" type="number" min={0} step="0.01" placeholder="Diaria base" required className="pms-field-input" />
            <select name="status" defaultValue="available" className="pms-field-input">
              <option value="available">available</option>
              <option value="occupied">occupied</option>
              <option value="maintenance">maintenance</option>
              <option value="blocked">blocked</option>
            </select>
            <input name="notes" placeholder="Observacoes" className="pms-field-input" />
            <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
              Criar quarto
            </button>
          </form>
        </article>
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {rooms.map((room) => (
            <article key={room.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">Quarto {room.room_number}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">Tipo: {room.room_type} | Status: {room.status}</p>

              {access.canUpdate ? (
                <form action={updateRoomAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
                  <input type="hidden" name="id" value={room.id} />
                  <input name="room_number" defaultValue={room.room_number} required className="pms-field-input" />
                  <input name="room_type" defaultValue={room.room_type} required className="pms-field-input" />
                  <input name="max_occupancy" type="number" min={1} defaultValue={room.max_occupancy} required className="pms-field-input" />
                  <input name="base_daily_rate" type="number" min={0} step="0.01" defaultValue={room.base_daily_rate} required className="pms-field-input" />
                  <select name="status" defaultValue={room.status} className="pms-field-input">
                    <option value="available">available</option>
                    <option value="occupied">occupied</option>
                    <option value="maintenance">maintenance</option>
                    <option value="blocked">blocked</option>
                  </select>
                  <input name="notes" defaultValue={room.notes || ""} className="pms-field-input" />
                  <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                    Salvar
                  </button>
                </form>
              ) : null}

              {access.canDelete ? (
                <form action={deleteRoomAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={room.id} />
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
