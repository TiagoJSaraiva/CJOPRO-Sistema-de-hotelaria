import { createHotelAction } from "../actions";
import { CountryLocaleFields } from "./CountryLocaleFields";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";
import { FormField } from "../../_components/FormField";

type HotelCreateFormProps = {
  formKey?: string;
};

export function HotelCreateForm({ formKey }: HotelCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar hotel</h3>

      <form
        key={formKey}
        action={createHotelAction}
        className="grid gap-[0.7rem] md:grid-cols-2"
      >
        <FormField label="Nome" htmlFor="create-name">
          <input
            id="create-name"
            name="name"
            minLength={2}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Razão Social" htmlFor="create-legal-name">
          <input
            id="create-legal-name"
            name="legal_name"
            minLength={3}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="CNPJ / Tax ID" htmlFor="create-tax-id">
          <input
            id="create-tax-id"
            name="tax_id"
            inputMode="numeric"
            //pattern="[0-9./\-]{11,18}"
            title="Informe um CNPJ/Tax ID válido."
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Slug" htmlFor="create-slug">
          <input
            id="create-slug"
            name="slug"
            //pattern="[a-z0-9\-]+"
            title="Use apenas letras minúsculas, números e hífen."
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Email" htmlFor="create-email">
          <input
            id="create-email"
            name="email"
            type="email"
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Telefone" htmlFor="create-phone">
          <input
            id="create-phone"
            name="phone"
            inputMode="tel"
            //pattern="[0-9 ()\+\-]{8,25}"
            title="Telefone deve conter apenas números e símbolos de telefone."
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Endereço (logradouro)" htmlFor="create-address-line">
          <input
            id="create-address-line"
            name="address_line"
            minLength={3}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Número" htmlFor="create-address-number">
          <input
            id="create-address-number"
            name="address_number"
            minLength={1}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Complemento (opcional)"
          htmlFor="create-address-complement"
          fullWidth
        >
          <input
            id="create-address-complement"
            name="address_complement"
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Bairro" htmlFor="create-district">
          <input
            id="create-district"
            name="district"
            minLength={2}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Cidade" htmlFor="create-city">
          <input
            id="create-city"
            name="city"
            minLength={2}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Estado" htmlFor="create-state">
          <input
            id="create-state"
            name="state"
            minLength={2}
            required
            className="pms-field-input"
          />
        </FormField>

        <CountryLocaleFields defaultCountryCode="BR" />

        <FormField label="CEP / Zip code" htmlFor="create-zip-code">
          <input
            id="create-zip-code"
            name="zip_code"
            inputMode="numeric"
            minLength={3}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Check-in início (HH:mm)"
          htmlFor="create-checkin-time-start"
        >
          <input
            id="create-checkin-time-start"
            name="checkin_time_start"
            placeholder="14:00"
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Check-in limite (HH:mm)"
          htmlFor="create-checkin-time-limit"
        >
          <input
            id="create-checkin-time-limit"
            name="checkin_time_limit"
            placeholder="23:00"
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Checkout início (HH:mm)"
          htmlFor="create-checkout-time-start"
        >
          <input
            id="create-checkout-time-start"
            name="checkout_time_start"
            placeholder="06:00"
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Checkout limite (HH:mm)"
          htmlFor="create-checkout-time-limit"
        >
          <input
            id="create-checkout-time-limit"
            name="checkout_time_limit"
            placeholder="12:00"
            className="pms-field-input"
          />
        </FormField>

        <PendingSubmitButton
          pendingLabel="Criando hotel..."
          className="justify-self-start md:col-span-2"
        >
          Criar hotel
        </PendingSubmitButton>
      </form>
    </article>
  );
}
