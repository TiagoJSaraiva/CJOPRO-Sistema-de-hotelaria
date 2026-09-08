import { PendingCards } from "../../pending/PendingWorkspace";
import Link from "next/link";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getConsumptionAnalytics,
  getOperationalPending,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { AnalyticsExportButton } from "../_components/ManagementClientActions";
import { getConsumptionAccess } from "../access";
import { consumptionAnalyticsGuide } from "../usageGuides";
import { consumptionTabs } from "../tabs";

const dimensions = [
  ["day", "Dia"],
  ["point", "Ponto"],
  ["category", "Categoria"],
  ["product", "Produto"],
  ["stay", "Estadia"],
  ["billing_mode", "Forma de cobrança"],
  ["payment_method", "Meio de pagamento"],
  ["provider", "Fornecedor"],
  ["partner", "Parceiro"],
  ["operator", "Operador"],
] as const;

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

function defaultPeriod() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  today.setUTCDate(1);
  return { from: today.toISOString().slice(0, 10), to: end };
}

export default async function ConsumptionAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = (await searchParams) || {};
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canReadAnalytics)
    return (
      <DashboardAccessDeniedCard
        title="Painel gerencial"
        message="Sem permissão para consultar indicadores de consumo."
      />
    );
  const fallback = defaultPeriod();
  const from = params.from || fallback.from;
  const to = params.to || fallback.to;
  const dimension = dimensions.some(([value]) => value === params.dimension)
    ? params.dimension!
    : "day";
  const [analytics, alerts] = await Promise.all([
    getConsumptionAnalytics({
      ...params,
      from,
      to,
      dimension,
      limit: "100",
    }),
    getOperationalPending("source=consumption"),
  ]);
  const cards = [
    ["Venda bruta", analytics.summary.gross_sales],
    ["Descontos", analytics.summary.discount_total],
    ["Cortesias", analytics.summary.courtesy_total],
    ["Estornos", analytics.summary.reversal_total],
    ["Venda líquida", analytics.summary.operational_net],
    ["Recebido pelo hotel", analytics.summary.hotel_collected],
    ["Recebido por parceiros", analytics.summary.partner_direct],
  ] as const;
  const maximum = Math.max(
    1,
    ...analytics.series.map((point) => point.operational_net),
  );
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="analytics"
      tabs={consumptionTabs(access)}
      usageGuide={consumptionAnalyticsGuide}
    >
      <div className="grid gap-5">
        <form
          className="pms-surface-card grid gap-3 md:grid-cols-4"
          data-usage-guide="consumption-analytics-filters"
        >
          <label className="pms-field">
            De
            <input
              className="pms-field-input"
              type="date"
              name="from"
              defaultValue={from}
              required
            />
          </label>
          <label className="pms-field">
            Até
            <input
              className="pms-field-input"
              type="date"
              name="to"
              defaultValue={to}
              required
            />
          </label>
          <label className="pms-field">
            Agrupar por
            <select
              className="pms-field-input"
              name="dimension"
              defaultValue={dimension}
            >
              {dimensions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Busca por estadia, quarto ou reserva
            <input
              className="pms-field-input"
              name="stay_search"
              defaultValue={params.stay_search || ""}
            />
          </label>
          <label className="pms-field">
            Cobrança
            <select
              className="pms-field-input"
              name="billing_mode"
              defaultValue={params.billing_mode || ""}
            >
              <option value="">Todas</option>
              <option value="stay_folio">Fólio</option>
              <option value="hotel_immediate">Imediato no hotel</option>
              <option value="partner_direct">Direto ao parceiro</option>
            </select>
          </label>
          <label className="pms-field">
            Fornecedor
            <select
              className="pms-field-input"
              name="provider_type"
              defaultValue={params.provider_type || ""}
            >
              <option value="">Todos</option>
              <option value="hotel">Hotel</option>
              <option value="partner">Parceiro</option>
            </select>
          </label>
          <label className="pms-field">
            Disposição
            <select
              className="pms-field-input"
              name="disposition"
              defaultValue={params.disposition || ""}
            >
              <option value="">Todas</option>
              <option value="charged">Cobrado</option>
              <option value="courtesy">Cortesia</option>
              <option value="legacy_unclassified">
                Legado não classificado
              </option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="pms-button-primary">Aplicar filtros</button>
            <AnalyticsExportButton
              rows={analytics.rows}
              filename={`consumo-${from}-${to}.csv`}
            />
          </div>
        </form>

        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores"
          data-usage-guide="consumption-analytics-summary"
        >
          {cards.map(([label, value]) => (
            <article className="pms-surface-card" key={label}>
              <p className="m-0 text-sm text-slate-600">{label}</p>
              <strong className="mt-2 block text-2xl">{money(value)}</strong>
            </article>
          ))}
        </section>

        <section
          className="pms-surface-card"
          data-usage-guide="consumption-analytics-series"
        >
          <h2 className="mt-0 text-xl">Evolução diária</h2>
          <div
            className="grid gap-2"
            role="img"
            aria-label="Evolução diária da venda líquida"
          >
            {analytics.series.length ? (
              analytics.series.map((point) => (
                <div
                  className="grid grid-cols-[6rem_1fr_auto] items-center gap-3"
                  key={point.date}
                >
                  <span>
                    {new Date(`${point.date}T12:00:00`).toLocaleDateString(
                      "pt-BR",
                    )}
                  </span>
                  <span className="h-3 overflow-hidden rounded bg-slate-100">
                    <span
                      className="block h-full rounded bg-sky-700"
                      style={{
                        width: `${Math.max(2, (point.operational_net / maximum) * 100)}%`,
                      }}
                    />
                  </span>
                  <strong>{money(point.operational_net)}</strong>
                </div>
              ))
            ) : (
              <p className="mb-0 text-slate-600">Nenhum consumo no período.</p>
            )}
          </div>
        </section>

        <section
          className="pms-surface-card overflow-x-auto"
          data-usage-guide="consumption-analytics-breakdown"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-xl">Detalhamento</h2>
            <span className="text-sm text-slate-600">
              {analytics.total} agrupamentos
            </span>
          </div>
          <table className="mt-4 w-full min-w-[38rem] border-collapse text-left">
            <thead>
              <tr>
                <th className="p-2">Dimensão</th>
                <th className="p-2">Comandas</th>
                <th className="p-2">Bruto</th>
                <th className="p-2">Líquido</th>
                <th className="p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {analytics.rows.map((row) => (
                <tr className="border-t border-slate-200" key={row.key}>
                  <th className="p-2">{row.label}</th>
                  <td className="p-2">{row.order_count}</td>
                  <td className="p-2">{money(row.gross_sales)}</td>
                  <td className="p-2">{money(row.operational_net)}</td>
                  <td className="p-2">
                    <Link
                      className="pms-link"
                      href={`/dashboard/consumption/history?from=${from}&to=${to}`}
                    >
                      Abrir histórico
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          className="pms-surface-card"
          data-usage-guide="consumption-management-alerts"
        >
          <h2 className="mt-0 text-xl">Alertas gerenciais</h2>
          <PendingCards data={alerts} source="consumption" />
          <Link
            className="pms-link inline-flex min-h-8 items-center"
            href="/dashboard/pending?source=consumption"
          >
            Tratar pendências de consumo
          </Link>
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
