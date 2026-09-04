import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listConsumptionPoints } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { createConsumptionPointAction } from "../actions";
import { BillingModeFields } from "../_components/BillingModeFields";
import { ConsumptionPointCard } from "../_components/ConsumptionPointCard";
import { ConsumptionStatusMessage } from "../_components/ConsumptionStatusMessage";
import { consumptionPointsGuide } from "../usageGuides";

export default async function ConsumptionPointsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const status = (await searchParams)?.status;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Vendas e consumo"
        message="Sem permissão para visualizar configurações de consumo."
      />
    );
  const points = await listConsumptionPoints(true);
  const active = points.filter((point) => !point.archived_at);
  const orderedIds = active.map((point) => point.id);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="points"
      usageGuide={consumptionPointsGuide}
      tabs={[
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
      ]}
      statusContent={<ConsumptionStatusMessage status={status} />}
    >
      <div className="grid gap-5">
        {access.canManage ? (
          <form
            action={createConsumptionPointAction}
            className="pms-surface-card grid gap-4"
            data-usage-guide="consumption-point-form"
          >
            <div>
              <h2 className="m-0 text-xl font-semibold">Novo ponto</h2>
              <p className="mb-0 text-sm text-slate-600">
                Cadastre um canal do hotel, não um equipamento ou quarto
                individual.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="pms-field">
                Nome
                <input
                  name="name"
                  required
                  maxLength={120}
                  className="pms-field-input"
                  placeholder="Ex.: Frigobar"
                />
              </label>
              <label className="pms-field">
                Código interno
                <input
                  name="internal_code"
                  maxLength={80}
                  className="pms-field-input"
                  placeholder="Opcional"
                />
              </label>
            </div>
            <label className="pms-field">
              Descrição
              <textarea
                name="description"
                maxLength={1000}
                className="pms-field-input"
              />
            </label>
            <BillingModeFields prefix="new-point" />
            <button type="submit" className="pms-button-primary">
              Criar ponto de consumo
            </button>
          </form>
        ) : null}
        <section
          className="grid gap-3"
          data-usage-guide="consumption-point-list"
        >
          <h2 className="m-0 text-xl font-semibold">Pontos configurados</h2>
          {points.map((point) => (
            <ConsumptionPointCard
              key={point.id}
              point={point}
              orderedIds={orderedIds}
              index={active.findIndex((item) => item.id === point.id)}
              canManage={access.canManage}
            />
          ))}
          {!points.length ? (
            <p className="pms-status-muted">
              Nenhum ponto cadastrado. Crie o primeiro canal para disponibilizar
              produtos.
            </p>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
