import {
  PERMISSIONS,
  type CashRegisterView,
  type CashSessionView,
  type DailyCloseView,
} from "@hotel/shared";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../_components/UsageGuide";
import { getUserFromSession } from "../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import {
  approveDailyCloseAction,
  countCashSessionAction,
  decideCashDifferenceAction,
  openCashSessionAction,
  postCashMovementAction,
  prepareDailyCloseAction,
} from "./actions";
import { CashRegisterCreateForm } from "./CashRegisterCreateForm";
const guide: UsageGuideDefinition = {
  id: "cash",
  title: "Caixa e fechamento",
  steps: [
    {
      id: "register",
      target: "cash-registers",
      title: "Abra uma sessão própria",
      description:
        "Cada caixa aceita um único operador até a contagem ou troca auditada.",
    },
    {
      id: "blind",
      target: "cash-count",
      title: "Faça a contagem cega",
      description:
        "O valor esperado só aparece depois do envio; diferenças acima da tolerância aguardam outra pessoa.",
    },
    {
      id: "daily",
      target: "daily-close",
      title: "Feche o dia",
      description:
        "Prepare a conferência e peça a aprovação de outra pessoa; alterações exigem nova preparação.",
    },
  ],
};
export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.CASH_MANAGEMENT_READ))
    return (
      <DashboardAccessDeniedCard
        title="Caixa e fechamento"
        message="Sem permissão para consultar o caixa."
      />
    );
  const params = await searchParams,
    date = params.date || new Date().toISOString().slice(0, 10);
  const [data, daily, consumptionPoints] = await Promise.all([
    requestOperationsFinanceEndpoint<{ registers: CashRegisterView[] }>(
      "cash-registers",
      "GET",
    ),
    requestOperationsFinanceEndpoint<DailyCloseView>(
      `daily-close/${date}`,
      "GET",
    ),
    requestOperationsFinanceEndpoint<{
      items: Array<{ id: string; name: string }>;
    }>("consumption-points", "GET").catch(() => ({ items: [] })),
  ]);
  const operate = user.permissions.includes(PERMISSIONS.CASH_REGISTER_OPERATE),
    approve = user.permissions.includes(PERMISSIONS.CASH_DIFFERENCES_APPROVE),
    prepare = user.permissions.includes(PERMISSIONS.DAILY_CLOSE_PREPARE),
    approveDaily = user.permissions.includes(PERMISSIONS.DAILY_CLOSE_APPROVE);
  return (
    <DashboardEntityPageShell
      title="Caixa e fechamento"
      activeTabKey="cash"
      tabs={[
        {
          key: "cash",
          label: "Operação",
          href: "/dashboard/cash",
          isVisible: true,
        },
      ]}
      usageGuide={guide}
      status={params.status}
    >
      <div className="grid gap-4">
        <section className="pms-surface-card" data-usage-guide="cash-registers">
          <h2 className="mt-0">Caixas físicos</h2>
          <p className="text-sm text-slate-600">
            O cadastro identifica o caixa. O dinheiro entra na abertura da
            sessão como fundo inicial e nos movimentos feitos durante o turno.
          </p>
          <p className="rounded-lg bg-slate-50 p-3 font-medium">
            Cadastrar caixa → abrir sessão → registrar movimentos → contar
            dinheiro → fechar sessão → fechar o dia
          </p>
          {approve ? (
            <CashRegisterCreateForm
              consumptionPoints={consumptionPoints.items}
            />
          ) : null}
          <div className="mt-4 grid gap-3">
            {data.registers.map((r) => (
              <article key={r.id} className="rounded border p-3">
                <strong>{r.name}</strong> · {r.code} · tolerância{" "}
                {Number(r.difference_tolerance).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: r.currency,
                })}
                <p className="text-sm text-slate-600">
                  {r.kind === "reception"
                    ? "Recepção"
                    : `Ponto de consumo: ${r.consumption_point_name || "não identificado"}`}
                </p>
                {!r.active_session && operate ? (
                  <form
                    action={openCashSessionAction}
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <label className="pms-field">
                      Fundo inicial
                      <input
                        className="pms-field-input"
                        name="opening_float"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>
                    <button className="pms-button-primary self-end">
                      Abrir sessão
                    </button>
                  </form>
                ) : null}
                {r.active_session ? (
                  <SessionCard
                    session={r.active_session}
                    operate={operate}
                    approve={approve}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
        <section
          id="daily-close"
          className="pms-surface-card"
          data-usage-guide="daily-close"
        >
          <h2 className="mt-0">Fechamento diário</h2>
          <form className="mb-3 flex flex-wrap items-end gap-2">
            <label className="pms-field">
              Data operacional
              <input
                className="pms-field-input"
                type="date"
                name="date"
                defaultValue={date}
              />
            </label>
            <button className="pms-button-secondary">Consultar</button>
          </form>
          {daily.projection.is_zero_activity ? (
            <p className="rounded-lg bg-blue-50 p-3 font-medium">
              Dia sem movimentação. Confirme as sessões e faça o fechamento
              normalmente para registrar que a operação foi conferida.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Receitas", daily.projection.totals.income],
              ["Despesas", daily.projection.totals.expense],
              ["Reembolsos", daily.projection.totals.refund],
            ].map(([label, amount]) => (
              <div key={String(label)} className="rounded border p-3">
                <span>{label}</span>
                <strong className="block text-lg">
                  {Number(amount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </div>
            ))}
          </div>
          <h3>Totais por meio de pagamento</h3>
          {daily.projection.transactions.length ? (
            <ul>
              {daily.projection.transactions.map((transaction) => (
                <li key={`${transaction.type}-${transaction.payment_method}`}>
                  {transaction.type} · {transaction.payment_method}:{" "}
                  {Number(transaction.amount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  ({transaction.count})
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma transação concluída nesta data.</p>
          )}
          <p>
            {daily.projection.cash_sessions.length} sessão(ões) ·{" "}
            {daily.projection.blockers.length} impedimento(s).
          </p>
          {daily.projection.blockers.length ? (
            <ul>
              {daily.projection.blockers.map((b, i) => (
                <li key={i}>{b.title}</li>
              ))}
            </ul>
          ) : null}
          {daily.close ? (
            <p className="text-sm text-slate-600">
              Estado: {daily.close.status}
              {daily.close.prepared_by_name
                ? ` · preparado por ${daily.close.prepared_by_name}`
                : ""}
              {daily.close.approved_by_name
                ? ` · aprovado por ${daily.close.approved_by_name}`
                : ""}
            </p>
          ) : null}
          {prepare &&
          (!daily.close ||
            ["open", "rejected"].includes(daily.close.status)) ? (
            <form action={prepareDailyCloseAction}>
              <input type="hidden" name="date" value={date} />
              <input
                type="hidden"
                name="version"
                value={daily.close?.version || 0}
              />
              <button className="pms-button-primary">
                Preparar fechamento
              </button>
            </form>
          ) : null}
          {approveDaily && daily.close?.status === "prepared" ? (
            <form
              action={approveDailyCloseAction}
              className="grid gap-2 md:grid-cols-2"
            >
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="version" value={daily.close.version} />
              <input
                type="hidden"
                name="fingerprint"
                value={daily.close.fingerprint || ""}
              />
              <label className="pms-field">
                Observação
                <input className="pms-field-input" name="reason" />
              </label>
              <div className="flex items-end gap-2">
                <button
                  className="pms-button-primary"
                  name="action"
                  value="approve"
                >
                  Aprovar e fechar
                </button>
                <button
                  className="pms-button-secondary"
                  name="action"
                  value="reject"
                >
                  Devolver
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
function SessionCard({
  session,
  operate,
  approve,
}: {
  session: CashSessionView;
  operate: boolean;
  approve: boolean;
}) {
  return (
    <div className="mt-3 rounded bg-slate-50 p-3" data-usage-guide="cash-count">
      <p>
        <strong>Sessão {session.status.replaceAll("_", " ")}</strong>
        {session.operator_name ? ` · operador ${session.operator_name}` : ""}
      </p>
      <p>
        Fundo inicial:{" "}
        {Number(session.opening_float).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
        {session.expected_cash === null
          ? " · valor esperado protegido até a contagem"
          : ` · esperado ${Number(session.expected_cash).toLocaleString(
              "pt-BR",
              {
                style: "currency",
                currency: "BRL",
              },
            )}`}
      </p>
      {session.movement_totals &&
      Object.keys(session.movement_totals).length ? (
        <ul className="text-sm">
          {Object.entries(session.movement_totals).map(([kind, amount]) => (
            <li key={kind}>
              {kind.replaceAll("_", " ")}:{" "}
              {Number(amount).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {session.status === "open" && operate ? (
        <>
          <form
            action={postCashMovementAction}
            className="grid gap-2 md:grid-cols-4"
          >
            <input type="hidden" name="id" value={session.id} />
            <select className="pms-field-input" name="kind">
              <option value="cash_in">Suprimento</option>
              <option value="cash_out">Retirada</option>
              <option value="deposit">Depósito</option>
            </select>
            <input
              className="pms-field-input"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Valor"
              required
            />
            <input
              className="pms-field-input"
              name="reason"
              minLength={3}
              placeholder="Motivo"
              required
            />
            <button className="pms-button-secondary">Registrar</button>
          </form>
          <form
            action={countCashSessionAction}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input type="hidden" name="id" value={session.id} />
            <input type="hidden" name="version" value={session.version} />
            <label className="pms-field">
              Valor contado
              <input
                className="pms-field-input"
                name="counted_amount"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <button className="pms-button-primary self-end">
              Enviar contagem cega
            </button>
          </form>
        </>
      ) : null}
      {session.status === "difference_pending" ? (
        <>
          <p role="alert">Diferença: {session.difference_amount}</p>
          {approve ? (
            <form
              action={decideCashDifferenceAction}
              className="flex flex-wrap gap-2"
            >
              <input type="hidden" name="id" value={session.id} />
              <input type="hidden" name="version" value={session.version} />
              <input
                className="pms-field-input"
                name="reason"
                minLength={3}
                placeholder="Justificativa"
                required
              />
              <button
                className="pms-button-primary"
                name="action"
                value="approve_difference"
              >
                Aprovar
              </button>
              <button
                className="pms-button-secondary"
                name="action"
                value="request_recount"
              >
                Pedir recontagem
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
