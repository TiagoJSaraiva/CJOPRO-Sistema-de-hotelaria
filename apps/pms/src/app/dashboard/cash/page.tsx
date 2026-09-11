import { PERMISSIONS } from "@hotel/shared";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../_components/UsageGuide";
import { getUserFromSession } from "../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import {
  approveDailyCloseAction,
  countCashSessionAction,
  createCashRegisterAction,
  decideCashDifferenceAction,
  openCashSessionAction,
  postCashMovementAction,
  prepareDailyCloseAction,
} from "./actions";
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
type Session = {
  id: string;
  status: string;
  version: number;
  operator_id: string;
  expected_cash: number;
  difference_amount: number | null;
};
type Register = {
  id: string;
  name: string;
  code: string;
  currency: string;
  difference_tolerance: number;
  active_session: Session | null;
};
type Registers = { registers: Register[] };
type Daily = {
  close: {
    id: string;
    status: string;
    version: number;
    fingerprint: string | null;
    prepared_by: string | null;
  } | null;
  projection: {
    transactions: unknown[];
    cash_sessions: unknown[];
    blockers: unknown[];
  };
};
const today = new Date().toISOString().slice(0, 10);
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
    date = params.date || today;
  const [data, daily] = await Promise.all([
    requestOperationsFinanceEndpoint<Registers>("cash-registers", "GET"),
    requestOperationsFinanceEndpoint<Daily>(`daily-close/${date}`, "GET"),
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
          {approve ? (
            <form
              action={createCashRegisterAction}
              className="grid gap-3 md:grid-cols-4"
            >
              <label className="pms-field">
                Nome
                <input className="pms-field-input" name="name" required />
              </label>
              <label className="pms-field">
                Código
                <input className="pms-field-input" name="code" required />
              </label>
              <label className="pms-field">
                Moeda
                <input
                  className="pms-field-input"
                  name="currency"
                  defaultValue="BRL"
                  required
                />
              </label>
              <label className="pms-field">
                Tolerância
                <input
                  className="pms-field-input"
                  name="difference_tolerance"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </label>
              <button className="pms-button-primary md:col-span-4 md:w-fit">
                Cadastrar caixa
              </button>
            </form>
          ) : null}
          <div className="mt-4 grid gap-3">
            {data.registers.map((r) => (
              <article key={r.id} className="rounded border p-3">
                <strong>{r.name}</strong> · {r.code} · tolerância{" "}
                {Number(r.difference_tolerance).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: r.currency,
                })}
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
        <section className="pms-surface-card" data-usage-guide="daily-close">
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
          <p>
            {daily.projection.transactions.length} consolidações ·{" "}
            {daily.projection.blockers.length} impedimentos.
          </p>
          {daily.projection.blockers.length ? (
            <ul>
              {daily.projection.blockers.map((b, i) => (
                <li key={i}>{JSON.stringify(b)}</li>
              ))}
            </ul>
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
  session: Session;
  operate: boolean;
  approve: boolean;
}) {
  return (
    <div className="mt-3 rounded bg-slate-50 p-3" data-usage-guide="cash-count">
      <p>
        <strong>Sessão {session.status.replaceAll("_", " ")}</strong>
      </p>
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
