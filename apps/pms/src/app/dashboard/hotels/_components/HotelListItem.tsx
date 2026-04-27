"use client";

import type { AdminHotel } from "../../../../lib/adminApi";
import { deleteHotelAction, updateHotelAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type HotelListItemProps = {
  hotel: AdminHotel;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function HotelDataPreview({ hotel }: { hotel: AdminHotel }) {
  const createdAt = hotel.created_at ? new Date(hotel.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = hotel.updated_at ? new Date(hotel.updated_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.9rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Razao social:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.legal_name || "-"}</p>
      </div>
      <div>
        <strong>Tax ID:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.tax_id || "-"}</p>
      </div>
      <div>
        <strong>Email:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.email || "-"}</p>
      </div>
      <div>
        <strong>Telefone:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.phone || "-"}</p>
      </div>
      <div>
        <strong>Cidade:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.city || "-"}</p>
      </div>
      <div>
        <strong>Estado:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.state || "-"}</p>
      </div>
      <div>
        <strong>Pais:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.country || "-"}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{hotel.is_active ? "Ativo" : "Inativo"}</p>
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

function HotelEditForm({ hotel }: { hotel: AdminHotel }) {
  return (
    <form action={updateHotelAction} className="mt-[0.9rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={hotel.id} />

      <div className="pms-field">
        <label htmlFor={`name-${hotel.id}`}>Nome</label>
        <input
          id={`name-${hotel.id}`}
          name="name"
          defaultValue={hotel.name}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`slug-${hotel.id}`}>Slug</label>
        <input
          id={`slug-${hotel.id}`}
          name="slug"
          defaultValue={hotel.slug}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`city-${hotel.id}`}>Cidade</label>
        <input id={`city-${hotel.id}`} name="city" defaultValue={hotel.city || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`email-${hotel.id}`}>Email</label>
        <input
          id={`email-${hotel.id}`}
          name="email"
          type="email"
          defaultValue={hotel.email || ""}
          className="pms-field-input"
        />
      </div>

      <label className="flex items-center gap-2">
        <input name="is_active" type="checkbox" defaultChecked={hotel.is_active} />
        <span>Hotel ativo</span>
      </label>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function HotelListItem({ hotel, canRead, canUpdate, canDelete, isViewing, isEditing }: HotelListItemProps) {
  const viewHref = `/dashboard/hotels/view?hotelId=${hotel.id}&mode=view`;
  const editHref = `/dashboard/hotels/view?hotelId=${hotel.id}&mode=edit`;

  return (
    <DashboardEntityListItemFrame
      title={hotel.name}
      subtitle={`Slug: ${hotel.slug}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={hotel.id}
          deleteAction={deleteHotelAction}
        />
      }
    >
      {isViewing ? <HotelDataPreview hotel={hotel} /> : null}
      {isEditing ? <HotelEditForm hotel={hotel} /> : null}
    </DashboardEntityListItemFrame>
  );
}
