import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenanceAnalytics,
  getMaintenanceAnalyticsRows,
  getMaintenancePreventivePlans,
  getMaintenanceReferenceData,
  getMaintenanceSuppliers,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenanceAnalyticsExports } from "../_components/MaintenanceAnalyticsExports";
import { maintenanceTabs } from "../tabs";
import { getMaintenanceAnalyticsGuide } from "../usageGuides";
import { ContextHelp } from "../../_components/ContextHelp";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MaintenanceAnalyticsPage({
  searchParams,
}: Props) {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canReadAnalytics)
    return (
      <DashboardAccessDeniedCard
        title="Indicadores de manutenção"
        message="Sem permissão para consultar análises gerenciais."
      />
    );
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "from",
    "to",
    "category_id",
    "priority",
    "status",
    "plan_id",
    "supplier_id",
    "target",
  ]) {
    const value = raw?.[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  const target = query.get("target") || "";
  if (target.startsWith("room:")) query.set("room_id", target.slice(5));
  if (target.startsWith("location:")) query.set("location_id", target.slice(9));
  query.delete("target");
  const [analytics, rows, references, plans, suppliers] = await Promise.all([
    getMaintenanceAnalytics(query.toString()),
    getMaintenanceAnalyticsRows(query.toString()),
    getMaintenanceReferenceData(),
    getMaintenancePreventivePlans(),
    getMaintenanceSuppliers(),
  ]);
  const cards = [
    ["Backlog", analytics.backlog],
    ["Críticas abertas", analytics.critical_open],
    ["Conformidade SLA", `${analytics.sla_compliance_rate}%`],
    ["Preventivas cumpridas", `${analytics.preventive_compliance_rate}%`],
    ["Recorrências em 30 dias", analytics.recurring_occurrences],
    ["Indisponibilidade", `${analytics.blocked_room_days.toFixed(1)} dias`],
  ];
  return (
    <DashboardEntityPageShell
      title="Indicadores de manutenção"
      activeTabKey="analytics"
      tabs={maintenanceTabs(access)}
      usageGuide={getMaintenanceAnalyticsGuide(access.canReadFinance)}
    >
      <form
        className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
        data-usage-guide="maintenance-analytics-filters"
      >
        <label className="grid gap-1 text-sm">
          De
          <input
            type="date"
            name="from"
            defaultValue={query.get("from") || ""}
            className="pms-field-input"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Até
          <input
            type="date"
            name="to"
            defaultValue={query.get("to") || ""}
            className="pms-field-input"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Categoria
          <select
            name="category_id"
            defaultValue={query.get("category_id") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            {references.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Prioridade
          <select
            name="priority"
            defaultValue={query.get("priority") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Situação
          <select
            name="status"
            defaultValue={query.get("status") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            <option value="reported">Relatada</option>
            <option value="triaged">Triada</option>
            <option value="in_progress">Em andamento</option>
            <option value="awaiting_inspection">Aguardando inspeção</option>
            <option value="awaiting_liability">Aguardando apuração</option>
            <option value="resolved">Resolvida</option>
            <option value="canceled">Cancelada</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Alvo
          <select
            name="target"
            defaultValue={target}
            className="pms-field-input"
          >
            <option value="">Todos</option>
            {references.rooms.map((item) => (
              <option key={item.id} value={`room:${item.id}`}>
                Quarto {item.room_number}
              </option>
            ))}
            {references.locations.map((item) => (
              <option key={item.id} value={`location:${item.id}`}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Plano
          <select
            name="plan_id"
            defaultValue={query.get("plan_id") || ""}
            className="pms-field-input"
          >
            <option value="">Todos</option>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Fornecedor
          <select
            name="supplier_id"
            defaultValue={query.get("supplier_id") || ""}
            className="pms-field-input"
          >
            <option value="">Todos</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="self-end rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
          Aplicar filtros
        </button>
      </form>
      <div
        className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Resumo gerencial"
        data-usage-guide="maintenance-analytics-summary"
      >
        {cards.map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <span className="block text-xs font-semibold uppercase text-slate-500">
              {label}
            </span>
            <strong className="text-xl">{value}</strong>
          </div>
        ))}
      </div>
      {analytics.financial ? (
        <section
          className="mb-5 rounded-xl border border-slate-200 bg-white p-4"
          aria-labelledby="analytics-finance"
          data-usage-guide="maintenance-analytics-finance"
        >
          <h2 id="analytics-finance" className="mt-0 text-lg font-semibold">
            Resultado financeiro autorizado
            <ContextHelp label="Valores dos indicadores">
              Valores financeiros só são consultados e exportados quando seu
              perfil possui a permissão financeira de manutenção.
            </ContextHelp>
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <span>
              Custos:{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: analytics.financial.currency,
              }).format(analytics.financial.approved_cost)}
            </span>
            <span>
              Recuperações:{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: analytics.financial.currency,
              }).format(analytics.financial.approved_recovery)}
            </span>
            <strong>
              Resultado líquido:{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: analytics.financial.currency,
              }).format(analytics.financial.net_result)}
            </strong>
          </div>
        </section>
      ) : null}
      <div
        className="mb-5 grid gap-5 lg:grid-cols-2"
        data-usage-guide="maintenance-analytics-performance"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold">
            Envelhecimento do backlog
          </h2>
          {analytics.aging.map((item) => (
            <div key={item.bucket} className="mb-3">
              <div className="flex justify-between text-sm">
                <span>{item.bucket}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-amber-500"
                  style={{
                    width: `${Math.min(100, (item.count / Math.max(analytics.backlog, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold">Desempenho</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>Triagem média</dt>
            <dd className="m-0 font-semibold">
              {analytics.average_triage_hours.toFixed(1)}h
            </dd>
            <dt>Resolução média</dt>
            <dd className="m-0 font-semibold">
              {analytics.average_resolution_hours.toFixed(1)}h
            </dd>
            <dt>Conclusão de fornecedores</dt>
            <dd className="m-0 font-semibold">
              {analytics.supplier_completion_rate}%
            </dd>
          </dl>
        </section>
      </div>
      <div data-usage-guide="maintenance-analytics-exports">
        <MaintenanceAnalyticsExports analytics={analytics} rows={rows} />
      </div>
    </DashboardEntityPageShell>
  );
}
