"use client";

import type { AdminSeason, AdminSeasonRoomRate } from "@hotel/shared";
import {
  deleteSeasonRoomRateAction,
  updateSeasonRoomRateAction,
} from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";
import { SeasonRoomSelect } from "./SeasonRoomSelect";

type SeasonRoomRateListItemProps = {
  item: AdminSeasonRoomRate;
  canRead: boolean;
  seasons: AdminSeason[];
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function SeasonRoomRateDataPreview({
  item,
  seasons,
}: {
  item: AdminSeasonRoomRate;
  seasons: AdminSeason[];
}) {
  const createdAt = item.created_at
    ? new Date(item.created_at).toLocaleString("pt-BR")
    : "-";
  const updatedAt = item.updated_at
    ? new Date(item.updated_at).toLocaleString("pt-BR")
    : "-";

  const season = seasons.find((entry) => entry.id === item.season_id);
  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Temporada:</strong>
        <p className="m-0 mt-[0.2rem]">
          {season ? season.name : item.season_id}
        </p>
      </div>
      <div>
        <strong>Room type:</strong>
        <p className="m-0 mt-[0.2rem]">{item.room_type}</p>
      </div>
      <div>
        <strong>Diária:</strong>
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

function SeasonRoomRateEditForm({
  item,
  seasons,
}: {
  item: AdminSeasonRoomRate;
  seasons: AdminSeason[];
}) {
  return (
    <form
      action={updateSeasonRoomRateAction}
      className="mt-[0.85rem] grid gap-[0.65rem]"
    >
      <input type="hidden" name="id" value={item.id} />

      <div className="pms-field">
        <label htmlFor={`season-room-rate-season-id-${item.id}`}>
          Temporada
        </label>
        <SeasonRoomSelect
          id={`season-room-rate-season-id-${item.id}`}
          name="season_id"
          seasons={seasons}
          defaultValue={item.season_id}
          required
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-room-rate-room-type-${item.id}`}>
          Room type
        </label>
        <input
          id={`season-room-rate-room-type-${item.id}`}
          name="room_type"
          defaultValue={item.room_type}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-room-rate-daily-rate-${item.id}`}>Diária</label>
        <input
          id={`season-room-rate-daily-rate-${item.id}`}
          name="daily_rate"
          type="number"
          min={0}
          step="0.01"
          defaultValue={item.daily_rate}
          required
          className="pms-field-input"
        />
      </div>

      <button
        type="submit"
        className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white"
      >
        Salvar alterações
      </button>
    </form>
  );
}

export function SeasonRoomRateListItem({
  item,
  seasons,
  canRead,
  canUpdate,
  canDelete,
  isViewing,
  isEditing,
}: SeasonRoomRateListItemProps) {
  const viewHref = `/dashboard/season-room-rates/view?seasonRoomRateId=${item.id}&mode=view`;
  const editHref = `/dashboard/season-room-rates/view?seasonRoomRateId=${item.id}&mode=edit`;
  const season = seasons.find((entry) => entry.id === item.season_id);

  return (
    <DashboardEntityListItemFrame
      title={item.room_type}
      subtitle={`${season ? season.name : item.season_id} | R$ ${item.daily_rate.toFixed(2)}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={item.id}
          deleteAction={deleteSeasonRoomRateAction}
        />
      }
    >
      {isViewing ? (
        <SeasonRoomRateDataPreview item={item} seasons={seasons} />
      ) : null}
      {isEditing ? (
        <SeasonRoomRateEditForm item={item} seasons={seasons} />
      ) : null}
    </DashboardEntityListItemFrame>
  );
}
