"use client";

import Link from "next/link";
import type { AdminSeasonRoomRate } from "@hotel/shared";
import { deleteSeasonRoomRateAction, updateSeasonRoomRateAction } from "../actions";

type SeasonRoomRateListItemProps = {
  item: AdminSeasonRoomRate;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function SeasonRoomRateDataPreview({ item }: { item: AdminSeasonRoomRate }) {
  const createdAt = item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = item.updated_at ? new Date(item.updated_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Season ID:</strong>
        <p className="m-0 mt-[0.2rem]">{item.season_id}</p>
      </div>
      <div>
        <strong>Room type:</strong>
        <p className="m-0 mt-[0.2rem]">{item.room_type}</p>
      </div>
      <div>
        <strong>Diaria:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {item.daily_rate.toFixed(2)}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p className="m-0 mt-[0.2rem]">{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p className="m-0 mt-[0.2rem]">{updatedAt}</p>
      </div>
    </div>
  );
}

function SeasonRoomRateEditForm({ item }: { item: AdminSeasonRoomRate }) {
  return (
    <form action={updateSeasonRoomRateAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={item.id} />

      <div className="pms-field">
        <label htmlFor={`season-room-rate-season-id-${item.id}`}>Season ID</label>
        <input id={`season-room-rate-season-id-${item.id}`} name="season_id" defaultValue={item.season_id} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-room-rate-room-type-${item.id}`}>Room type</label>
        <input id={`season-room-rate-room-type-${item.id}`} name="room_type" defaultValue={item.room_type} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-room-rate-daily-rate-${item.id}`}>Diaria</label>
        <input id={`season-room-rate-daily-rate-${item.id}`} name="daily_rate" type="number" min={0} step="0.01" defaultValue={item.daily_rate} required className="pms-field-input" />
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function SeasonRoomRateListItem({ item, canRead, canUpdate, canDelete, isViewing, isEditing }: SeasonRoomRateListItemProps) {
  const viewHref = `/dashboard/season-room-rates/view?seasonRoomRateId=${item.id}&mode=view`;
  const editHref = `/dashboard/season-room-rates/view?seasonRoomRateId=${item.id}&mode=edit`;

  return (
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{item.room_type}</h3>
          <p className="m-0 text-[#555]">Season: {item.season_id} | R$ {item.daily_rate.toFixed(2)}</p>
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
            <form action={deleteSeasonRoomRateAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <SeasonRoomRateDataPreview item={item} /> : null}
      {isEditing ? <SeasonRoomRateEditForm item={item} /> : null}
    </article>
  );
}