import { createHotelAction } from "../actions";
import { CountryLocaleFields } from "./CountryLocaleFields";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";

type HotelCreateFormProps = {
  formKey?: string;
};

export function HotelCreateForm({ formKey }: HotelCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar hotel</h3>

      <form key={formKey} action={createHotelAction} className="grid gap-[0.7rem]">
        <div className="pms-field">
          <label htmlFor="create-name">Nome</label>
          <input id="create-name" name="name" minLength={2} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-legal-name">Razao Social</label>
          <input id="create-legal-name" name="legal_name" minLength={3} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-tax-id">CNPJ / Tax ID</label>
          <input
            id="create-tax-id"
            name="tax_id"
            inputMode="numeric"
            pattern="[0-9./-]{11,18}"
            title="Informe um CNPJ/Tax ID valido."
            required
            className="pms-field-input"
          />
        </div>

        <div className="pms-field">
          <label htmlFor="create-slug">Slug</label>
          <input
            id="create-slug"
            name="slug"
            pattern="[a-z0-9-]+"
            title="Use apenas letras minusculas, numeros e hifen."
            required
            className="pms-field-input"
          />
        </div>

        <div className="pms-field">
          <label htmlFor="create-email">Email</label>
          <input id="create-email" name="email" type="email" required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-phone">Telefone</label>
          <input
            id="create-phone"
            name="phone"
            inputMode="tel"
            pattern="[0-9 ()+-]{8,25}"
            title="Telefone deve conter apenas numeros e simbolos de telefone."
            required
            className="pms-field-input"
          />
        </div>

        <div className="pms-field">
          <label htmlFor="create-address-line">Endereco (logradouro)</label>
          <input id="create-address-line" name="address_line" minLength={3} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-address-number">Numero</label>
          <input id="create-address-number" name="address_number" minLength={1} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-address-complement">Complemento (opcional)</label>
          <input id="create-address-complement" name="address_complement" className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-district">Bairro</label>
          <input id="create-district" name="district" minLength={2} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-city">Cidade</label>
          <input id="create-city" name="city" minLength={2} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-state">Estado</label>
          <input id="create-state" name="state" minLength={2} required className="pms-field-input" />
        </div>

        <CountryLocaleFields defaultCountryCode="BR" />

        <div className="pms-field">
          <label htmlFor="create-zip-code">CEP / Zip code</label>
          <input
            id="create-zip-code"
            name="zip_code"
            inputMode="numeric"
            minLength={3}
            required
            className="pms-field-input"
          />
        </div>

        <PendingSubmitButton pendingLabel="Criando hotel..." className="justify-self-start">
          Criar hotel
        </PendingSubmitButton>
      </form>
    </article>
  );
}
