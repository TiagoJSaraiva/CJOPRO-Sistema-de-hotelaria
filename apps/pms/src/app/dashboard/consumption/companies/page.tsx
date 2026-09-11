import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listCorporateAccounts } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { consumptionTabs } from "../tabs";
import { corporateAccountsGuide } from "../usageGuides";
import {
  actCorporateCreditAction,
  createCorporateAccountAction,
  payCorporateReceivableAction,
  requestCorporateCreditAction,
} from "./actions";

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
                {access.canRequestCorporateCredit ? (
                  <form
                    action={requestCorporateCreditAction}
                    className="mt-3 grid gap-2"
                  >
                    <input
                      type="hidden"
                      name="corporate_account_id"
                      value={String(company.id)}
                    />
                    <input
                      className="pms-field-input"
                      name="stay_id"
                      required
                      placeholder="UUID da estadia"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="pms-field-input"
                        name="amount_limit"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="Limite autorizado"
                      />
                      <input
                        className="pms-field-input"
                        name="expires_at"
                        type="datetime-local"
                        required
                      />
                    </div>
                    <input
                      className="pms-field-input"
                      name="reason"
                      minLength={3}
                      required
                      placeholder="Motivo da solicitação"
                    />
                    <label className="text-sm">
                      <input type="checkbox" name="covers_maintenance" /> Cobrir
                      danos/manutenção explicitamente
                    </label>
                    <button className="pms-button-secondary">
                      Solicitar crédito
                    </button>
                  </form>
                ) : null}
                {(
                  (company.authorizations || []) as Array<
                    Record<string, unknown>
                  >
                ).map((authorization) => (
                  <div
                    className="mt-3 rounded-lg border border-slate-200 p-2 text-sm"
                    key={String(authorization.id)}
                  >
                    <p className="m-0">
                      Autorização {String(authorization.status)} · R${" "}
                      {Number(authorization.amount_limit).toFixed(2)}
                    </p>
                    {(access.canApproveCorporateCredit &&
                      authorization.status === "submitted") ||
                    (access.canRequestCorporateCredit &&
                      ["draft", "approved"].includes(
                        String(authorization.status),
                      )) ? (
                      <form
                        action={actCorporateCreditAction}
                        className="mt-2 flex flex-wrap gap-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(authorization.id)}
                        />
                        <input
                          type="hidden"
                          name="version"
                          value={Number(authorization.version)}
                        />
                        <input
                          className="pms-field-input min-w-48 flex-1"
                          name="reason"
                          minLength={3}
                          required
                          placeholder="Motivo da decisão"
                        />
                        <select
                          className="pms-field-input"
                          name="action"
                          defaultValue={
                            authorization.status === "submitted"
                              ? "approve"
                              : authorization.status === "draft"
                                ? "submit"
                                : "revoke"
                          }
                        >
                          {authorization.status === "draft" ? (
                            <option value="submit">Enviar</option>
                          ) : null}
                          {authorization.status === "submitted" ? (
                            <>
                              <option value="approve">Aprovar</option>
                              <option value="reject">Rejeitar</option>
                            </>
                          ) : null}
                          {authorization.status === "approved" ? (
                            <option value="revoke">Revogar</option>
                          ) : null}
                        </select>
                        <button className="pms-button-secondary">
                          Registrar
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {access.canSettleCorporateReceivables
                  ? (
                      (company.receivables || []) as Array<
                        Record<string, unknown>
                      >
                    )
                      .filter((receivable) =>
                        ["open", "partially_paid"].includes(
                          String(receivable.status),
                        ),
                      )
                      .map((receivable) => {
                        const balance =
                          Number(receivable.amount) -
                          Number(receivable.paid_amount);
                        return (
                          <form
                            action={payCorporateReceivableAction}
                            className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2"
                            key={String(receivable.id)}
                          >
                            <strong className="text-sm">
                              Recebível · vence {String(receivable.due_on)} ·
                              saldo R$ {balance.toFixed(2)}
                            </strong>
                            <input
                              type="hidden"
                              name="id"
                              value={String(receivable.id)}
                            />
                            <input
                              type="hidden"
                              name="version"
                              value={Number(receivable.version)}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="pms-field-input"
                                name="amount"
                                type="number"
                                min="0.01"
                                max={balance}
                                step="0.01"
                                required
                                placeholder="Valor"
                              />
                              <select
                                className="pms-field-input"
                                name="payment_method"
                                defaultValue="bank_transfer"
                              >
                                <option value="bank_transfer">
                                  Transferência
                                </option>
                                <option value="pix">Pix</option>
                                <option value="cash">Dinheiro</option>
                              </select>
                            </div>
                            <input
                              className="pms-field-input"
                              name="reference_code"
                              placeholder="Referência"
                            />
                            <button className="pms-button-primary">
                              Registrar recebimento
                            </button>
                          </form>
                        );
                      })
                  : null}
              </article>
            ))}
          </div>
          {!companies.length ? <p>Nenhuma empresa cadastrada.</p> : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
