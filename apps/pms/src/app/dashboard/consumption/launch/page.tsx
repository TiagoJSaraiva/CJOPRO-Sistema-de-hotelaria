import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getConsumptionOperationalContext,
  listConsumptionEligibleStays,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { ConsumptionOrderComposer } from "../_components/ConsumptionOrderComposer";
import { getConsumptionAccess } from "../access";
import { consumptionLaunchGuide } from "../usageGuides";

export default async function ConsumptionLaunchPage({
  searchParams,
}: {
  searchParams?: Promise<{ stay_id?: string; search?: string }>;
}) {
  const params = await searchParams;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canPost)
    return (
      <DashboardAccessDeniedCard
        title="Lançar consumo"
        message="Sem permissão para lançar consumos."
      />
    );
  const stays = await listConsumptionEligibleStays(params?.search || "");
  const selectedStayId = params?.stay_id || stays[0]?.id;
  const context = selectedStayId
    ? await getConsumptionOperationalContext(selectedStayId).catch(() => null)
    : null;
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
      activeTabKey="launch"
      tabs={tabs}
      usageGuide={consumptionLaunchGuide}
    >
      <div className="grid gap-5">
        <section
          className="pms-surface-card grid gap-3"
          data-usage-guide="consumption-stay-search"
        >
          <div>
            <h2 className="m-0 text-xl">1. Localize a estadia</h2>
            <p className="mb-0 text-sm text-slate-600">
              Somente estadias com check-in podem receber consumo.
            </p>
          </div>
          <form className="flex flex-wrap gap-2">
            <input
              className="pms-field-input min-w-64 flex-1"
              name="search"
              defaultValue={params?.search}
              placeholder="Quarto, reserva ou hóspede"
            />
            <button className="pms-button-secondary" type="submit">
              Buscar
            </button>
          </form>
          <nav className="flex flex-wrap gap-2" aria-label="Estadias elegíveis">
            {stays.map((stay) => (
              <a
                key={stay.id}
                className={
                  stay.id === selectedStayId
                    ? "pms-button-primary"
                    : "pms-button-secondary"
                }
                href={`/dashboard/consumption/launch?stay_id=${stay.id}`}
              >
                Quarto {stay.room_number} · {stay.primary_guest_name}
              </a>
            ))}
          </nav>
        </section>
        {context ? (
          <ConsumptionOrderComposer
            context={context}
            canReceivePayment={access.canReceivePayment}
            canGrantCourtesy={access.canGrantCourtesy}
          />
        ) : (
          <section className="pms-surface-card">
            <p className="m-0">Nenhuma estadia em check-in foi encontrada.</p>
          </section>
        )}
      </div>
    </DashboardEntityPageShell>
  );
}
