"use client";

import type { AdminRoom } from "@hotel/shared";
import { deleteRoomAction, updateRoomAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

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
    <DashboardEntityListItemFrame
      title={`Quarto ${room.room_number}`}
      subtitle={`Tipo: ${room.room_type} | Status: ${room.status}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={room.id}
          deleteAction={deleteRoomAction}
        />
      }
    >
      {isViewing ? <RoomDataPreview room={room} /> : null}
      {isEditing ? <RoomEditForm room={room} /> : null}
    </DashboardEntityListItemFrame>
  );
}