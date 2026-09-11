import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listCorporateAccounts } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { consumptionTabs } from "../tabs";
import { corporateAccountsGuide } from "../usageGuides";
import { createCorporateAccountAction } from "./actions";

export default async function CorporateAccountsPage() {
  const access = getConsumptionAccess(await getUserFromSession());
  if (
    !access.canManageCorporate &&
    !access.canRequestCorporateCredit &&
    !access.canApproveCorporateCredit &&
    !access.canSettleCorporateReceivables
  )
    return (
      <DashboardAccessDeniedCard
        title="Empresas pagadoras"
        message="Sem permissão para consultar faturamento empresarial."
      />
    );
  const companies = await listCorporateAccounts();
  return (
    <DashboardEntityPageShell
      title="Empresas pagadoras"
      activeTabKey="companies"
      tabs={consumptionTabs(access)}
      usageGuide={corporateAccountsGuide}
    >
      <div className="grid gap-5">
        {access.canManageCorporate ? (
          <form
            action={createCorporateAccountAction}
            className="pms-surface-card grid gap-3 md:grid-cols-2"
            data-usage-guide="corporate-account-policy"
          >
            <h2 className="m-0 md:col-span-2">Cadastrar empresa e política</h2>
            <label className="pms-field-label">
              Razão social
              <input
                className="pms-field-input"
                name="legal_name"
                minLength={2}
                required
              />
            </label>
            <label className="pms-field-label">
              Documento fiscal
              <input
                className="pms-field-input"
                name="tax_id"
                minLength={3}
                required
              />
            </label>
            <label className="pms-field-label">
              E-mail de cobrança
              <input
                className="pms-field-input"
                name="billing_email"
                type="email"
              />
            </label>
            <label className="pms-field-label">
              Telefone
              <input className="pms-field-input" name="billing_phone" />
            </label>
            <label className="pms-field-label">
              Limite
              <input
                className="pms-field-input"
                name="credit_limit"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label className="pms-field-label">
              Prazo em dias
              <input
                className="pms-field-input"
                name="payment_term_days"
                type="number"
                min="0"
                max="365"
                required
              />
            </label>
            <input type="hidden" name="currency" value="BRL" />
            <button className="pms-button-primary md:col-span-2">
              Salvar empresa
            </button>
          </form>
        ) : null}
        <section
          className="pms-surface-card"
          data-usage-guide="corporate-credit-segregation"
        >
          <h2>Empresas cadastradas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {companies.map((company) => (
              <article
                className="rounded-xl border border-slate-200 p-3"
                key={String(company.id)}
              >
                <strong>{String(company.legal_name)}</strong>
                <p className="mb-0 text-sm">
                  Documento {String(company.tax_id)} · limite{" "}
                  {String(company.currency)}{" "}
                  {Number(company.credit_limit).toFixed(2)} ·{" "}
                  {Number(company.payment_term_days)} dias
                </p>
              </article>
            ))}
          </div>
          {!companies.length ? <p>Nenhuma empresa cadastrada.</p> : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
