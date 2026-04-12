import { createHotelAction } from "../actions";
import { CountryLocaleFields } from "./CountryLocaleFields";

type HotelCreateFormProps = {
  formKey?: string;
};

export function HotelCreateForm({ formKey }: HotelCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar hotel</h3>

      <form key={formKey} action={createHotelAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-name">Nome</label>
          <input id="create-name" name="name" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-legal-name">Razao Social</label>
          <input id="create-legal-name" name="legal_name" minLength={3} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-tax-id">CNPJ / Tax ID</label>
          <input
            id="create-tax-id"
            name="tax_id"
            inputMode="numeric"
            pattern="[0-9./-]{11,18}"
            title="Informe um CNPJ/Tax ID valido."
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-slug">Slug</label>
          <input
            id="create-slug"
            name="slug"
            pattern="[a-z0-9-]+"
            title="Use apenas letras minusculas, numeros e hifen."
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-email">Email</label>
          <input id="create-email" name="email" type="email" required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-phone">Telefone</label>
          <input
            id="create-phone"
            name="phone"
            inputMode="tel"
            pattern="[0-9 ()+-]{8,25}"
            title="Telefone deve conter apenas numeros e simbolos de telefone."
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-address-line">Endereco (logradouro)</label>
          <input id="create-address-line" name="address_line" minLength={3} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-address-number">Numero</label>
          <input id="create-address-number" name="address_number" minLength={1} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-address-complement">Complemento (opcional)</label>
          <input id="create-address-complement" name="address_complement" style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-district">Bairro</label>
          <input id="create-district" name="district" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-city">Cidade</label>
          <input id="create-city" name="city" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-state">Estado</label>
          <input id="create-state" name="state" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <CountryLocaleFields defaultCountryCode="BR" />

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-zip-code">CEP / Zip code</label>
          <input
            id="create-zip-code"
            name="zip_code"
            inputMode="numeric"
            minLength={3}
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <button
          type="submit"
          style={{ border: 0, background: "#0f6d5f", color: "#fff", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", justifySelf: "start" }}
        >
          Criar hotel
        </button>
      </form>
    </article>
  );
}
