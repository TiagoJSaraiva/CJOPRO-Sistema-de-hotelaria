import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import { type AdminHotel, listHotels } from "../../../lib/adminApi";
import { createHotelAction, deleteHotelAction, updateHotelAction } from "./actions";
import { CountryLocaleFields } from "./_components/CountryLocaleFields";

const statusMessages: Record<string, string> = {
  created: "Hotel criado com sucesso.",
  updated: "Hotel atualizado com sucesso.",
  deleted: "Hotel excluido com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha todos os campos obrigatorios do cadastro inicial.",
  update_missing_fields: "Preencha id, nome e slug para atualizar hotel.",
  delete_missing_id: "Nao foi possivel identificar o hotel para exclusao.",
  create_error: "Falha ao criar hotel.",
  update_error: "Falha ao atualizar hotel.",
  delete_error: "Falha ao excluir hotel."
};

type HotelsPageProps = {
  searchParams?: {
    status?: string;
  };
};

function HotelEditorCard({
  hotel,
  canUpdate,
  canDelete
}: {
  hotel: AdminHotel;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  return (
    <article style={{ border: "1px solid #e3e3e3", borderRadius: "10px", padding: "0.9rem", background: "#fff" }}>
      <form action={updateHotelAction} style={{ display: "grid", gap: "0.65rem" }}>
        <input type="hidden" name="id" value={hotel.id} />

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor={`name-${hotel.id}`}>Nome</label>
          <input
            id={`name-${hotel.id}`}
            name="name"
            defaultValue={hotel.name}
            required
            disabled={!canUpdate}
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
            disabled={!canUpdate}
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor={`city-${hotel.id}`}>Cidade</label>
          <input
            id={`city-${hotel.id}`}
            name="city"
            defaultValue={hotel.city || ""}
            disabled={!canUpdate}
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor={`email-${hotel.id}`}>Email</label>
          <input
            id={`email-${hotel.id}`}
            name="email"
            type="email"
            defaultValue={hotel.email || ""}
            disabled={!canUpdate}
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input name="is_active" type="checkbox" defaultChecked={hotel.is_active} disabled={!canUpdate} />
          <span>Hotel ativo</span>
        </label>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {canUpdate ? (
            <button
              type="submit"
              style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer" }}
            >
              Salvar alteracoes
            </button>
          ) : null}
        </div>
      </form>

      {canDelete ? (
        <form action={deleteHotelAction} style={{ marginTop: "0.6rem" }}>
          <input type="hidden" name="id" value={hotel.id} />
          <button
            type="submit"
            style={{ border: "1px solid #c83a3a", background: "#fff", color: "#b00020", borderRadius: "8px", padding: "0.5rem 0.75rem", cursor: "pointer" }}
          >
            Excluir hotel
          </button>
        </form>
      ) : null}
    </article>
  );
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const user = await getUserFromSession();
  const status = searchParams?.status;

  const canRead = !!user?.permissions.includes(PERMISSIONS.HOTEL_READ);
  const canCreate = !!user?.permissions.includes(PERMISSIONS.HOTEL_CREATE);
  const canUpdate = !!user?.permissions.includes(PERMISSIONS.HOTEL_UPDATE);
  const canDelete = !!user?.permissions.includes(PERMISSIONS.HOTEL_DELETE);

  if (!canRead) {
    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h1 style={{marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem"}}>Hoteis</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  const hotels = await listHotels();

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Hoteis</h1>

        {status && statusMessages[status] ? (
          <p style={{ marginBottom: 0, color: status.includes("error") || status.includes("forbidden") ? "#b00020" : "#1f6f51" }}>{statusMessages[status]}</p>
        ) : null}
      </section>

      {canCreate ? (
        <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Criar hotel</h3>

          <form action={createHotelAction} style={{ display: "grid", gap: "0.7rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-name">Nome</label>
              <input id="create-name" name="name" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-legal-name">Razão Social</label>
              <input id="create-legal-name" name="legal_name" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-tax-id">CNPJ / Tax ID</label>
              <input id="create-tax-id" name="tax_id" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-slug">Slug</label>
              <input id="create-slug" name="slug" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-email">Email</label>
              <input id="create-email" name="email" type="email" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-phone">Telefone</label>
              <input id="create-phone" name="phone" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-address-line">Endereço (logradouro)</label>
              <input id="create-address-line" name="address_line" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-address-number">Número</label>
              <input id="create-address-number" name="address_number" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-address-complement">Complemento (opcional)</label>
              <input id="create-address-complement" name="address_complement" style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-district">Bairro</label>
              <input id="create-district" name="district" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-city">Cidade</label>
              <input id="create-city" name="city" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-state">Estado</label>
              <input id="create-state" name="state" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <CountryLocaleFields defaultCountryCode="BR" />

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="create-zip-code">CEP / Zip code</label>
              <input id="create-zip-code" name="zip_code" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
            </div>

            <button
              type="submit"
              style={{ border: 0, background: "#0f6d5f", color: "#fff", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", justifySelf: "start" }}
            >
              Criar hotel
            </button>
          </form>
        </article>
      ) : null}

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {hotels.length ? (
          hotels.map((hotel) => <HotelEditorCard key={hotel.id} hotel={hotel} canUpdate={canUpdate} canDelete={canDelete} />)
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            Nenhum hotel cadastrado ate o momento.
          </article>
        )}
      </section>
    </section>
  );
}
