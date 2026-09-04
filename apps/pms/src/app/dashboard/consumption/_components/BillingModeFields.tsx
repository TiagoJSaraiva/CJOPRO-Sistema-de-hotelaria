import type { ConsumptionBillingMode } from "@hotel/shared";

const labels: Record<ConsumptionBillingMode, string> = {
  hotel_immediate: "Pagamento imediato ao hotel",
  stay_folio: "Lançamento no fólio",
  partner_direct: "Pagamento direto ao parceiro",
};

export function BillingModeFields({
  allowedModes = ["hotel_immediate", "stay_folio"],
  defaultMode = "stay_folio",
  prefix,
  allowPartnerDirect = false,
}: {
  allowedModes?: ConsumptionBillingMode[];
  defaultMode?: ConsumptionBillingMode;
  prefix: string;
  allowPartnerDirect?: boolean;
}) {
  const supported = (Object.keys(labels) as ConsumptionBillingMode[]).filter(
    (mode) => mode !== "partner_direct" || allowPartnerDirect,
  );
  return (
    <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 font-semibold">Formas permitidas</legend>
      {supported.map((mode) => (
        <label key={mode} className="flex items-center gap-2">
          <input
            type="checkbox"
            name="allowed_modes"
            value={mode}
            defaultChecked={allowedModes.includes(mode)}
          />
          {labels[mode]}
        </label>
      ))}
      <label className="pms-field">
        Opção sugerida
        <select
          name="default_mode"
          defaultValue={defaultMode}
          className="pms-field-input"
          aria-describedby={`${prefix}-billing-help`}
        >
          {supported.map((mode) => (
            <option key={mode} value={mode}>
              {labels[mode]}
            </option>
          ))}
        </select>
      </label>
      <details id={`${prefix}-billing-help`} className="text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">
          Ajuda sobre cobrança
        </summary>
        <p className="mb-0">
          Pagamento imediato é recebido pelo hotel no momento da venda. No
          fólio, o valor compõe a conta da estadia para quitação no checkout.
          Pagamento direto é recebido pelo parceiro e só pode ser usado quando o
          acordo vigente autoriza esse recebedor.
        </p>
      </details>
    </fieldset>
  );
}

export function billingModeLabel(mode: ConsumptionBillingMode) {
  return labels[mode];
}
