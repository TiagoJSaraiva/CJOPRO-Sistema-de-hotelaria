import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listConsumptionCorrections } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import {
  confirmPartnerRefundAction,
  decideConsumptionCorrectionAction,
} from "../accountActions";
import { getConsumptionAccess } from "../access";
import { consumptionAdjustmentsGuide } from "../usageGuides";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

export default async function ConsumptionAdjustmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canApproveAdjustments)
    return (
      <DashboardAccessDeniedCard
        title="Ajustes de consumo"
        message="Sem permissão para revisar ajustes de consumo."
      />
    );
  const query = params?.filter
    ? new URLSearchParams({ status: params.filter }).toString()
    : "";
  const corrections = await listConsumptionCorrections(query);
  const tabs = [
    {
      key: "launch",
      label: "Lançar consumo",
      href: "/dashboard/consumption/launch",
      isVisible: access.canPost,
    },
    {
      key: "history",
      label: "Histórico",
      href: "/dashboard/consumption/history",
      isVisible: access.canRead,
    },
    {
      key: "adjustments",
      label: "Ajustes",
      href: "/dashboard/consumption/adjustments",
      isVisible: access.canApproveAdjustments,
    },
    {
      key: "points",
      label: "Pontos de consumo",
      href: "/dashboard/consumption/points",
      isVisible: access.canRead,
    },
    {
      key: "offers",
      label: "Ofertas",
      href: "/dashboard/consumption/offers",
      isVisible: access.canRead,
    },
    {
      key: "partners",
      label: "Parceiros",
      href: "/dashboard/consumption/partners",
      isVisible: access.canReadCommercial,
    },
    {
      key: "agreements",
      label: "Acordos",
      href: "/dashboard/consumption/agreements",
      isVisible: access.canReadCommercial,
    },
  ];
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="adjustments"
      tabs={tabs}
      usageGuide={consumptionAdjustmentsGuide}
    >
      <div className="grid gap-4">
        {params?.status ? (
          <p className="pms-alert-success" role="status">
            Operação concluída: {params.status}.
          </p>
        ) : null}
        <section
          className="pms-surface-card"
          data-usage-guide="consumption-adjustment-filters"
        >
          <form className="flex flex-wrap items-end gap-2">
            <label className="pms-field">
              <span>Situação</span>
              <select
                name="filter"
                defaultValue={params?.filter || ""}
                className="pms-field-input"
              >
                <option value="">Todas</option>
                <option value="pending">Pendente</option>
                <option value="awaiting_refund">Aguardando reembolso</option>
                <option value="awaiting_partner_refund">
                  Aguardando parceiro
                </option>
                <option value="completed">Concluída</option>
                <option value="rejected">Rejeitada</option>
              </select>
            </label>
            <button className="pms-button-secondary">Filtrar</button>
          </form>
        </section>
        <section
          className="grid gap-3"
          data-usage-guide="consumption-adjustment-queue"
        >
          {corrections.map((correction) => (
            <article
              key={correction.id}
              className="pms-surface-card grid gap-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="m-0 text-base">
                    {correction.kind === "full_void"
                      ? "Anulação integral"
                      : "Ajuste parcial"}
                  </h2>
                  <p className="m-0 text-sm text-slate-600">
                    Comanda {correction.order_id.slice(0, 8)} ·{" "}
                    {correction.reason}
                  </p>
                </div>
                <span className="pms-status-pill">{correction.status}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <span>
                  Redução: <strong>{money(correction.net_reduction)}</strong>
                </span>
                <span>
                  Solicitante:{" "}
                  <strong>
                    {correction.requested_by_name ||
                      correction.requested_by.slice(0, 8)}
                  </strong>
                </span>
                <span>
                  Versão-base: <strong>{correction.account_version}</strong>
                </span>
              </div>
              {correction.status === "pending" ? (
                <form
                  action={decideConsumptionCorrectionAction}
                  className="grid gap-2"
                  data-usage-guide="consumption-adjustment-decision"
                >
                  <input type="hidden" name="id" value={correction.id} />
                  <label className="pms-field">
                    <span>Motivo da rejeição (obrigatório ao rejeitar)</span>
                    <input name="reason" className="pms-field-input" />
                  </label>
                  <div className="flex gap-2">
                    <button
                      name="decision"
                      value="approve"
                      className="pms-button-primary"
                    >
                      Aprovar
                    </button>
                    <button
                      name="decision"
                      value="reject"
                      className="pms-button-secondary"
                    >
                      Rejeitar
                    </button>
                  </div>
                </form>
              ) : null}
              {correction.status === "awaiting_partner_refund" ? (
                <form
                  action={confirmPartnerRefundAction}
                  className="flex flex-wrap items-end gap-2"
                  data-usage-guide="consumption-partner-refund"
                >
                  <input type="hidden" name="id" value={correction.id} />
                  <label className="pms-field">
                    <span>Referência externa</span>
                    <input name="reference_code" className="pms-field-input" />
                  </label>
                  <button className="pms-button-primary">
                    Confirmar reembolso do parceiro
                  </button>
                </form>
              ) : null}
              {correction.status === "awaiting_refund" ? (
                <p className="m-0 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  O reembolso do hotel deve ser concluído na conta da estadia.
                </p>
              ) : null}
            </article>
          ))}
          {!corrections.length ? (
            <p className="pms-empty-state">Nenhum ajuste neste filtro.</p>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
