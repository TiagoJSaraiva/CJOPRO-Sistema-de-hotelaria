import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { reconcileAnalyticsAction } from "../stage6Actions";
import { reservationOperationsTabs } from "../stage6Tabs";
type Fact = {
  date: string;
  forecast: Record<string, number>;
  actual: Record<string, number>;
  reconciled_at: string;
  stale_since?: string;
  closed_snapshot: boolean;
};
const guide: UsageGuideDefinition = {
  id: "analytics-stage6",
  title: "Indicadores integrados",
  steps: [
    {
      id: "modes",
      target: "analytics-modes",
      title: "Separe previsão e realizado",
      description:
        "Pré-reservas ficam separadas da ocupação confirmada; bloqueios reduzem o inventário vendável.",
    },
    {
      id: "freshness",
      target: "analytics-freshness",
      title: "Confira a atualização",
      description:
        "Uma série marcada como desatualizada preserva o último snapshot válido até a próxima reconciliação.",
    },
  ],
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    date?: string;
    metric?: string;
  }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.INTEGRATED_ANALYTICS_READ))
    return (
      <DashboardAccessDeniedCard
        title="Indicadores"
        message="Sem permissão para consultar indicadores integrados."
      />
    );
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = params.from || today;
  const to = params.to || today;
  const data = await requestOperationsFinanceEndpoint<{ items: Fact[] }>(
    `analytics/operations?from=${from}&to=${to}`,
    "GET",
  );
  const drilldown =
    params.date && params.metric
      ? await requestOperationsFinanceEndpoint<{
          result: string;
          items: Array<Record<string, unknown>>;
        }>(
          `analytics/operations/drilldown?date=${params.date}&metric=${params.metric}`,
          "GET",
        )
      : null;
  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="analytics"
      tabs={reservationOperationsTabs(user)}
      usageGuide={guide}
      status={params.status}
    >
      <section
        className="pms-surface-card"
        data-usage-guide="analytics-freshness"
      >
        <form
          action={reconcileAnalyticsAction}
          className="flex flex-wrap gap-3"
        >
          <label>
            Início
            <input
              className="pms-field-input"
              type="date"
              name="from"
              defaultValue={from}
            />
          </label>
          <label>
            Fim
            <input
              className="pms-field-input"
              type="date"
              name="to"
              defaultValue={to}
            />
          </label>
          <button className="pms-button-primary" type="submit">
            Atualizar indicadores
          </button>
        </form>
      </section>
      <section className="grid gap-3" data-usage-guide="analytics-modes">
        {(data.items || []).map((item) => (
          <article className="pms-surface-card" key={item.date}>
            <h2>{item.date}</h2>
            <p>
              {item.stale_since ? "Dados desatualizados" : "Atualizado"} ·{" "}
              {item.closed_snapshot ? "realizado fechado" : "realizado aberto"}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h3>Previsão</h3>
                <p>
                  Ocupação confirmada:{" "}
                  {item.forecast.confirmed_room_nights || 0}
                </p>
                <p>Pré-reservas: {item.forecast.held_room_nights || 0}</p>
                <p>Receita: {item.forecast.lodging_revenue ?? "restrita"}</p>
                <p>ADR previsto: {item.forecast.adr ?? "restrito"}</p>
                <p>RevPAR previsto: {item.forecast.revpar ?? "restrito"}</p>
              </div>
              <div>
                <h3>Realizado</h3>
                <p>Ocupação: {item.actual.occupied_room_nights || 0}</p>
                <p>Hospedagem: {item.actual.lodging_revenue ?? "restrita"}</p>
                <p>Consumo: {item.actual.consumption_revenue ?? "restrito"}</p>
                <p>ADR realizado: {item.actual.adr ?? "restrito"}</p>
                <p>RevPAR realizado: {item.actual.revpar ?? "restrito"}</p>
                <p>
                  Perdas de estoque: quantidade{" "}
                  {item.actual.inventory_loss_quantity || 0} · custo{" "}
                  {item.actual.inventory_loss_cost ?? "restrito"}
                </p>
                <p>
                  Impacto de manutenção:{" "}
                  {item.actual.maintenance_impact_room_hours || 0}{" "}
                  quarto-hora(s) · {item.actual.maintenance_recurrences || 0}{" "}
                  reincidência(s)
                </p>
                <p>
                  Reserva direta: {item.actual.direct_confirmations || 0} de{" "}
                  {item.actual.direct_holds || 0} pré-reserva(s) confirmada(s)
                </p>
              </div>
            </div>
            <p>
              <a
                href={`?from=${from}&to=${to}&date=${item.date}&metric=unassigned_arrivals`}
              >
                Abrir chegadas sem quarto
              </a>{" "}
              ·{" "}
              <a
                href={`?from=${from}&to=${to}&date=${item.date}&metric=maintenance_occurrences`}
              >
                Abrir manutenção
              </a>
            </p>
          </article>
        ))}
      </section>
      {drilldown ? (
        <section className="pms-surface-card" aria-live="polite">
          <h2>Registros de origem: {params.metric}</h2>
          {drilldown.items?.length ? (
            <pre className="overflow-auto whitespace-pre-wrap">
              {JSON.stringify(drilldown.items, null, 2)}
            </pre>
          ) : (
            <p>Nenhum registro visível com suas permissões.</p>
          )}
        </section>
      ) : null}
    </DashboardEntityPageShell>
  );
}
