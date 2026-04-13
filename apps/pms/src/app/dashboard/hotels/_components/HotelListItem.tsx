"use client";

import Link from "next/link";
import type { AdminHotel } from "../../../../lib/adminApi";
import { deleteHotelAction, updateHotelAction } from "../actions";

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginTop: "0.9rem" }}>
      <div>
        <strong>Razao social:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.legal_name || "-"}</p>
      </div>
      <div>
        <strong>Tax ID:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.tax_id || "-"}</p>
      </div>
      <div>
        <strong>Email:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.email || "-"}</p>
      </div>
      <div>
        <strong>Telefone:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.phone || "-"}</p>
      </div>
      <div>
        <strong>Cidade:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.city || "-"}</p>
      </div>
      <div>
        <strong>Estado:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.state || "-"}</p>
      </div>
      <div>
        <strong>Pais:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.country || "-"}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{hotel.is_active ? "Ativo" : "Inativo"}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p style={{ margin: "0.2rem 0 0" }}>{updatedAt}</p>
      </div>
    </div>
  );
}

function HotelEditForm({ hotel }: { hotel: AdminHotel }) {
  return (
    <form action={updateHotelAction} style={{ display: "grid", gap: "0.65rem", marginTop: "0.9rem" }}>
      <input type="hidden" name="id" value={hotel.id} />

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`name-${hotel.id}`}>Nome</label>
        <input
          id={`name-${hotel.id}`}
          name="name"
          defaultValue={hotel.name}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`slug-${hotel.id}`}>Slug</label>
        <input
          id={`slug-${hotel.id}`}
          name="slug"
          defaultValue={hotel.slug}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`city-${hotel.id}`}>Cidade</label>
        <input id={`city-${hotel.id}`} name="city" defaultValue={hotel.city || ""} style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`email-${hotel.id}`}>Email</label>
        <input
          id={`email-${hotel.id}`}
          name="email"
          type="email"
          defaultValue={hotel.email || ""}
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input name="is_active" type="checkbox" defaultChecked={hotel.is_active} />
        <span>Hotel ativo</span>
      </label>

      <button
        type="submit"
        style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer", justifySelf: "start" }}
      >
        Salvar alteracoes
      </button>
    </form>
  );
}

export function HotelListItem({ hotel, canRead, canUpdate, canDelete, isViewing, isEditing }: HotelListItemProps) {
  const viewHref = `/dashboard/hotels/view?hotelId=${hotel.id}&mode=view`;
  const editHref = `/dashboard/hotels/view?hotelId=${hotel.id}&mode=edit`;

  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0.95rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "0.2rem" }}>{hotel.name}</h3>
          <p style={{ margin: 0, color: "#555" }}>Slug: {hotel.slug}</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              style={{
                textDecoration: "none",
                border: "1px solid #2d6cdf",
                color: "#1b4db3",
                background: isViewing ? "#e9f0ff" : "#fff",
                borderRadius: "8px",
                padding: "0.45rem 0.65rem"
              }}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              style={{
                textDecoration: "none",
                border: "1px solid #0f766e",
                color: "#0a5f58",
                background: isEditing ? "#ddf5f2" : "#fff",
                borderRadius: "8px",
                padding: "0.45rem 0.65rem"
              }}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteHotelAction}>
              <input type="hidden" name="id" value={hotel.id} />
              <button
                type="submit"
                style={{ border: "1px solid #c83a3a", background: "#fff", color: "#b00020", borderRadius: "8px", padding: "0.45rem 0.65rem", cursor: "pointer" }}
              >
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <HotelDataPreview hotel={hotel} /> : null}
      {isEditing ? <HotelEditForm hotel={hotel} /> : null}
    </article>
  );
}
