import Link from "next/link";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getConsumptionManagementSettings,
  getPartnerSettlement,
  listPartnerSettlementCandidates,
  listPartnerSettlements,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import {
  ConfirmSubmitButton,
  PrintManagementReportButton,
} from "../_components/ManagementClientActions";
import { getConsumptionAccess } from "../access";
import {
  createSettlementAction,
  decideSettlementAction,
  paySettlementAction,
  recalculateSettlementAction,
  reverseSettlementPaymentAction,
  submitSettlementAction,
  updateManagementSettingsAction,
} from "../managementActions";
import { consumptionSettlementsGuide } from "../usageGuides";
import { consumptionTabs } from "../tabs";

const statusLabel = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  settled: "Quitada",
};
const directionLabel = {
  hotel_to_partner: "Repasse ao parceiro",
  partner_to_hotel: "Cobrança do parceiro",
  balanced: "Sem saldo",
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

export default async function PartnerSettlementsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = (await searchParams) || {};
  const access = getConsumptionAccess(await getUserFromSession());
  const canEnter =
    access.canReadSettlements ||
    access.canPrepareSettlements ||
    access.canApproveSettlements ||
    access.canSettleSettlements;
  if (!canEnter)
    return (
      <DashboardAccessDeniedCard
        title="Apurações de parceiros"
        message="Sem permissão para consultar apurações."
      />
    );
  const month = params.month || previousMonth();
  const periodStart = `${month}-01`;
  const [settings, candidates, list, selected] = await Promise.all([
    getConsumptionManagementSettings(),
    listPartnerSettlementCandidates(periodStart),
    listPartnerSettlements({
      period_start: params.only_month === "true" ? periodStart : undefined,
      status: params.filter_status,
      limit: "100",
    }),
    params.id ? getPartnerSettlement(params.id) : Promise.resolve(null),
  ]);
  const now = new Date().toISOString().slice(0, 16);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="settlements"
      tabs={consumptionTabs(access)}
      usageGuide={consumptionSettlementsGuide}
      statusContent={
        params.status ? (
          <p className="pms-alert-success" role="status">
            Operação concluída: {params.status.replaceAll("_", " ")}.
          </p>
        ) : null
      }
    >
      <div className="grid gap-5">
        <section
          className="pms-surface-card"
          data-usage-guide="settlement-filters"
        >
          <form className="flex flex-wrap items-end gap-3">
            <label className="pms-field">
              Mês de referência
              <input
                className="pms-field-input"
                type="month"
                name="month"
                defaultValue={month}
                required
              />
            </label>
            <label className="pms-field">
              Situação
              <select
                className="pms-field-input"
                name="filter_status"
                defaultValue={params.filter_status || ""}
              >
                <option value="">Todas</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                name="only_month"
                value="true"
                defaultChecked={params.only_month === "true"}
              />
              Somente mês selecionado
            </label>
            <button className="pms-button-secondary">Filtrar</button>
          </form>
        </section>

        {access.canPrepareSettlements ? (
          <details
            className="pms-surface-card"
            data-usage-guide="settlement-settings"
          >
            <summary className="cursor-pointer font-semibold">
              Configurações gerenciais
            </summary>
            <form
              action={updateManagementSettingsAction}
              className="mt-4 grid gap-3 md:grid-cols-4"
            >
              <label className="pms-field">
                Início do acompanhamento
                <input
                  className="pms-field-input"
                  type="date"
                  name="settlement_tracking_starts_on"
                  defaultValue={settings.settlement_tracking_starts_on}
                  required
                />
              </label>
              <label className="pms-field">
                Prazo de pagamento (dias)
                <input
                  className="pms-field-input"
                  type="number"
                  min="0"
                  max="90"
                  name="payment_due_days"
                  defaultValue={settings.payment_due_days}
                  required
                />
              </label>
              <label className="pms-field">
                Avisar acordo antes (dias)
                <input
                  className="pms-field-input"
                  type="number"
                  min="1"
                  max="365"
                  name="agreement_expiry_alert_days"
                  defaultValue={settings.agreement_expiry_alert_days}
                  required
                />
              </label>
              <label className="pms-field">
                Antecedência de saldo (dias)
                <input
                  className="pms-field-input"
                  type="number"
                  min="0"
                  max="30"
                  name="guest_balance_alert_days"
                  defaultValue={settings.guest_balance_alert_days}
                  required
                />
              </label>
              <button className="pms-button-primary md:col-span-4 md:w-fit">
                Salvar configurações
              </button>
            </form>
          </details>
        ) : null}

        <section
          className="pms-surface-card"
          data-usage-guide="settlement-candidates"
        >
          <h2 className="mt-0 text-xl">
            Candidatos de {month.split("-").reverse().join("/")}
          </h2>
          <p className="text-sm text-slate-600">
            Inclui acordos com aluguel ou mínimo garantido mesmo quando não
            houve vendas.
          </p>
          <div className="grid gap-2">
            {candidates.length ? (
              candidates.map((candidate) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 p-3"
                  key={candidate.partner.id}
                >
                  <div>
                    <strong>{candidate.partner.trade_name}</strong>
                    <span className="ml-2 text-sm text-slate-600">
                      {candidate.status === "missing"
                        ? "Ainda não gerada"
                        : statusLabel[candidate.status]}
                    </span>
                  </div>
                  {candidate.settlement_id ? (
                    <Link
                      className="pms-link"
                      href={`?month=${month}&id=${candidate.settlement_id}`}
                    >
                      Abrir
                    </Link>
                  ) : access.canPrepareSettlements ? (
                    <form action={createSettlementAction}>
                      <input
                        type="hidden"
                        name="partner_id"
                        value={candidate.partner.id}
                      />
                      <input
                        type="hidden"
                        name="period_start"
                        value={periodStart}
                      />
                      <ConfirmSubmitButton
                        message={`Gerar a apuração de ${candidate.partner.trade_name} para ${month}?`}
                      >
                        Gerar apuração
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="mb-0">Nenhum parceiro elegível para este mês.</p>
            )}
          </div>
        </section>

        {selected ? (
          <section
            className="pms-surface-card min-w-0 print:border-0 print:shadow-none"
            data-usage-guide="settlement-statement"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm uppercase tracking-wide text-slate-500">
                  Demonstrativo gerencial — não fiscal
                </p>
                <h2 className="my-1 text-2xl">{selected.partner.trade_name}</h2>
                <p className="m-0">
                  {selected.period_start} a {selected.period_end} · versão{" "}
                  {selected.version}
                </p>
              </div>
              <div className="text-right">
                <strong>{statusLabel[selected.status]}</strong>
                <p className="my-1">{directionLabel[selected.direction]}</p>
                <strong className="text-xl">
                  {money(Math.abs(selected.net_settlement))}
                </strong>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Recebido pelo hotel"
                value={selected.hotel_collected}
              />
              <Metric
                label="Direto ao parceiro"
                value={selected.partner_direct}
              />
              <Metric label="Aluguel apropriado" value={selected.rent_total} />
              <Metric label="Comissão" value={selected.commission_total} />
              <Metric
                label="Complemento mínimo"
                value={selected.minimum_guarantee_topup}
              />
              <Metric
                label="Contribuição total"
                value={selected.contribution_total}
              />
              <Metric label="Venda líquida" value={selected.operational_net} />
              <Metric
                label="Ajustes/estornos"
                value={selected.reversal_total}
              />
            </div>

            <div
              className="mt-5 overflow-x-auto"
              role="region"
              aria-label="Memória de cálculo da apuração"
              tabIndex={0}
            >
              <h3>Memória por acordo e revisão</h3>
              <table className="w-full min-w-[48rem] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="p-2">Acordo</th>
                    <th className="p-2">Vigência</th>
                    <th className="p-2">Modelo</th>
                    <th className="p-2">Base líquida</th>
                    <th className="p-2">Aluguel</th>
                    <th className="p-2">Comissão</th>
                    <th className="p-2">Contribuição</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.components.map((component) => (
                    <tr
                      className="border-t border-slate-200"
                      key={component.id}
                    >
                      <td className="p-2">
                        {component.agreement_number} · v
                        {component.revision_version}
                        {component.source_kind === "late_correction"
                          ? " (ajuste anterior)"
                          : ""}
                      </td>
                      <td className="p-2">
                        {component.segment_start}–{component.segment_end}
                      </td>
                      <td className="p-2">{component.commercial_model}</td>
                      <td className="p-2">
                        {money(component.operational_net)}
                      </td>
                      <td className="p-2">{money(component.prorated_rent)}</td>
                      <td className="p-2">
                        {money(component.commission_amount)}
                      </td>
                      <td className="p-2">
                        {money(component.contribution_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-5">
              <summary className="cursor-pointer font-semibold">
                Fontes individualizadas ({selected.sources.length})
              </summary>
              <div
                className="mt-3 overflow-x-auto"
                role="region"
                aria-label="Fontes individualizadas da apuração"
                tabIndex={0}
              >
                <table className="w-full min-w-[44rem] text-left">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Produto</th>
                      <th>Quarto/reserva</th>
                      <th>Cobrança</th>
                      <th>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.sources.map((source) => (
                      <tr key={source.id} className="border-t border-slate-200">
                        <td>
                          {new Date(source.occurred_at).toLocaleString("pt-BR")}
                        </td>
                        <td>{source.product_name}</td>
                        <td>
                          {source.room_number || source.reservation_code || "—"}
                        </td>
                        <td>{source.billing_mode || "Legado"}</td>
                        <td>{money(source.operational_net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <div
              className="mt-5 flex flex-wrap gap-3 print:hidden"
              data-usage-guide="settlement-workflow"
            >
              {access.canPrepareSettlements &&
              (selected.status === "draft" ||
                selected.status === "in_review") ? (
                <form action={recalculateSettlementAction}>
                  <input type="hidden" name="id" value={selected.id} />
                  <input
                    type="hidden"
                    name="expected_version"
                    value={selected.version}
                  />
                  <ConfirmSubmitButton
                    message="Recalcular usando as fontes atuais? A versão será atualizada."
                    className="pms-button-secondary"
                  >
                    Recalcular
                  </ConfirmSubmitButton>
                </form>
              ) : null}
              {access.canPrepareSettlements && selected.status === "draft" ? (
                <form action={submitSettlementAction}>
                  <input type="hidden" name="id" value={selected.id} />
                  <input
                    type="hidden"
                    name="expected_version"
                    value={selected.version}
                  />
                  <ConfirmSubmitButton
                    message={`Enviar a versão ${selected.version} para revisão por outra pessoa?`}
                  >
                    Enviar para revisão
                  </ConfirmSubmitButton>
                </form>
              ) : null}
              <PrintManagementReportButton />
            </div>

            {access.canApproveSettlements && selected.status === "in_review" ? (
              <form
                action={decideSettlementAction}
                className="mt-5 grid gap-3 rounded border border-slate-200 p-4"
                data-usage-guide="settlement-decision"
              >
                <input type="hidden" name="id" value={selected.id} />
                <input
                  type="hidden"
                  name="expected_version"
                  value={selected.version}
                />
                <label className="pms-field">
                  Motivo da rejeição (obrigatório ao rejeitar)
                  <textarea className="pms-field-input" name="reason" />
                </label>
                <div className="flex gap-2">
                  <button
                    className="pms-button-secondary"
                    name="decision"
                    value="reject"
                  >
                    Rejeitar
                  </button>
                  <ConfirmSubmitButton
                    message={`Aprovar e tornar imutável a versão ${selected.version}?`}
                  >
                    Aprovar
                  </ConfirmSubmitButton>
                </div>
              </form>
            ) : null}

            {access.canSettleSettlements &&
            selected.status === "approved" &&
            selected.direction !== "balanced" ? (
              <form
                action={paySettlementAction}
                className="mt-5 grid gap-3 rounded border border-slate-200 p-4 md:grid-cols-3"
                data-usage-guide="settlement-payment"
              >
                <input type="hidden" name="id" value={selected.id} />
                <input
                  type="hidden"
                  name="expected_version"
                  value={selected.version}
                />
                <label className="pms-field">
                  Valor exato
                  <input
                    className="pms-field-input"
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    defaultValue={Math.abs(selected.net_settlement)}
                    readOnly
                  />
                </label>
                <label className="pms-field">
                  Meio
                  <select
                    className="pms-field-input"
                    name="payment_method"
                    defaultValue="pix"
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de crédito</option>
                    <option value="debit_card">Cartão de débito</option>
                    <option value="bank_transfer">Transferência</option>
                  </select>
                </label>
                <label className="pms-field">
                  Data
                  <input
                    className="pms-field-input"
                    type="datetime-local"
                    name="paid_at"
                    defaultValue={now}
                    max={now}
                    required
                  />
                </label>
                <label className="pms-field">
                  Referência
                  <input className="pms-field-input" name="reference_code" />
                </label>
                <label className="pms-field md:col-span-2">
                  Observações
                  <textarea className="pms-field-input" name="notes" />
                </label>
                <ConfirmSubmitButton
                  message={`${directionLabel[selected.direction]} no valor exato de ${money(Math.abs(selected.net_settlement))}?`}
                >
                  Registrar quitação
                </ConfirmSubmitButton>
              </form>
            ) : null}

            {access.canSettleSettlements && selected.status === "settled"
              ? selected.payments
                  .filter((payment) => !payment.reversal_of_id)
                  .map((payment) => (
                    <form
                      action={reverseSettlementPaymentAction}
                      className="mt-5 grid gap-3 rounded border border-amber-300 bg-amber-50 p-4 md:grid-cols-3"
                      key={payment.id}
                    >
                      <input
                        type="hidden"
                        name="settlement_id"
                        value={selected.id}
                      />
                      <input
                        type="hidden"
                        name="payment_id"
                        value={payment.id}
                      />
                      <label className="pms-field md:col-span-2">
                        Justificativa da reversão
                        <input
                          className="pms-field-input"
                          name="reason"
                          minLength={3}
                          required
                        />
                      </label>
                      <label className="pms-field">
                        Data
                        <input
                          className="pms-field-input"
                          type="datetime-local"
                          name="reversed_at"
                          defaultValue={now}
                          max={now}
                          required
                        />
                      </label>
                      <ConfirmSubmitButton
                        message="Criar lançamento compensatório e devolver a apuração para aprovada?"
                        className="pms-button-secondary"
                      >
                        Reverter quitação
                      </ConfirmSubmitButton>
                    </form>
                  ))
              : null}

            <details className="mt-5">
              <summary className="cursor-pointer font-semibold">
                Linha do tempo
              </summary>
              <ol>
                {selected.events.map((event) => (
                  <li key={event.id}>
                    {new Date(event.created_at).toLocaleString("pt-BR")} —{" "}
                    {event.action}
                    {event.actor_name ? ` por ${event.actor_name}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          </section>
        ) : null}

        <section
          className="pms-surface-card"
          data-usage-guide="settlement-list"
        >
          <h2 className="mt-0 text-xl">Apurações</h2>
          <div className="grid gap-2">
            {list.items.length ? (
              list.items.map((item) => (
                <Link
                  className="grid gap-1 rounded border border-slate-200 p-3 no-underline text-inherit sm:grid-cols-[1fr_auto_auto]"
                  href={`?month=${month}&id=${item.id}`}
                  key={item.id}
                >
                  <strong>
                    {item.partner.trade_name} · {item.period_start.slice(0, 7)}
                  </strong>
                  <span>{statusLabel[item.status]}</span>
                  <span>
                    {directionLabel[item.direction]} ·{" "}
                    {money(Math.abs(item.net_settlement))}
                  </span>
                </Link>
              ))
            ) : (
              <p className="mb-0">Nenhuma apuração gerada.</p>
            )}
          </div>
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <span className="block text-sm text-slate-600">{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}
