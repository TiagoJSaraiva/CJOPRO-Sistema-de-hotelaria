"use client";

import Link from "next/link";
import type { AdminRoom } from "@hotel/shared";
import { deleteRoomAction, updateRoomAction } from "../actions";

type RoomListItemProps = {
  room: AdminRoom;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function RoomDataPreview({ room }: { room: AdminRoom }) {
  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Numero:</strong>
        <p className="m-0 mt-[0.2rem]">{room.room_number}</p>
      </div>
      <div>
        <strong>Tipo:</strong>
        <p className="m-0 mt-[0.2rem]">{room.room_type}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{room.status}</p>
      </div>
      <div>
        <strong>Capacidade maxima:</strong>
        <p className="m-0 mt-[0.2rem]">{room.max_occupancy}</p>
      </div>
      <div>
        <strong>Diaria base:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {room.base_daily_rate.toFixed(2)}</p>
      </div>
      <div>
        <strong>Observacoes:</strong>
        <p className="m-0 mt-[0.2rem]">{room.notes || "-"}</p>
      </div>
    </div>
  );
}

function RoomEditForm({ room }: { room: AdminRoom }) {
  return (
    <form action={updateRoomAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={room.id} />

      <div className="pms-field">
        <label htmlFor={`room-number-${room.id}`}>Numero</label>
        <input id={`room-number-${room.id}`} name="room_number" defaultValue={room.room_number} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`room-type-${room.id}`}>Tipo</label>
        <input id={`room-type-${room.id}`} name="room_type" defaultValue={room.room_type} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`room-max-occupancy-${room.id}`}>Capacidade maxima</label>
        <input id={`room-max-occupancy-${room.id}`} name="max_occupancy" type="number" min={1} defaultValue={room.max_occupancy} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`room-base-daily-rate-${room.id}`}>Diaria base</label>
        <input id={`room-base-daily-rate-${room.id}`} name="base_daily_rate" type="number" min={0} step="0.01" defaultValue={room.base_daily_rate} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`room-status-${room.id}`}>Status</label>
        <select id={`room-status-${room.id}`} name="status" defaultValue={room.status} className="pms-field-input">
          <option value="available">available</option>
          <option value="occupied">occupied</option>
          <option value="maintenance">maintenance</option>
          <option value="blocked">blocked</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`room-notes-${room.id}`}>Observacoes</label>
        <input id={`room-notes-${room.id}`} name="notes" defaultValue={room.notes || ""} className="pms-field-input" />
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function RoomListItem({ room, canRead, canUpdate, canDelete, isViewing, isEditing }: RoomListItemProps) {
  const viewHref = `/dashboard/rooms/view?roomId=${room.id}&mode=view`;
  const editHref = `/dashboard/rooms/view?roomId=${room.id}&mode=edit`;

  return (
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">Quarto {room.room_number}</h3>
          <p className="m-0 text-[#555]">Tipo: {room.room_type} | Status: {room.status}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              className={`rounded-lg border border-[#2d6cdf] px-[0.65rem] py-[0.45rem] no-underline ${
                isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
              }`}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              className={`rounded-lg border border-[#0f766e] px-[0.65rem] py-[0.45rem] no-underline ${
                isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
              }`}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteRoomAction}>
              <input type="hidden" name="id" value={room.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <RoomDataPreview room={room} /> : null}
      {isEditing ? <RoomEditForm room={room} /> : null}
    </article>
  );
}