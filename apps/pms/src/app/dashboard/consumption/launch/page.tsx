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
import { consumptionTabs } from "../tabs";

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
  let stays: Awaited<ReturnType<typeof listConsumptionEligibleStays>> = [];
  let searchFailed = false;
  try {
    stays = await listConsumptionEligibleStays(params?.search || "");
  } catch {
    searchFailed = true;
  }
  const selectedStayId = params?.stay_id || stays[0]?.id;
  let context: Awaited<
    ReturnType<typeof getConsumptionOperationalContext>
  > | null = null;
  let contextError: number | null = null;
  if (selectedStayId && !searchFailed) {
    try {
      context = await getConsumptionOperationalContext(selectedStayId);
    } catch (cause) {
      contextError =
        (cause as Error & { statusCode?: number }).statusCode || 500;
    }
  }
  const retryParams = new URLSearchParams();
  if (params?.search) retryParams.set("search", params.search);
  if (params?.stay_id) retryParams.set("stay_id", params.stay_id);
  const retryHref = `/dashboard/consumption/launch${retryParams.size ? `?${retryParams}` : ""}`;
  const tabs = consumptionTabs(access);
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
              aria-label="Buscar estadia por quarto, reserva ou hóspede"
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
                href={`/dashboard/consumption/launch?stay_id=${encodeURIComponent(stay.id)}`}
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
        ) : searchFailed || contextError ? (
          <section className="pms-surface-card" role="alert">
            <p className="m-0">
              {contextError === 404 || contextError === 409
                ? "Esta estadia não está mais disponível para lançamento de consumo. Busque outra estadia em check-in."
                : "Não foi possível carregar as estadias para consumo. Tente novamente."}
            </p>
            <a
              className="pms-button-secondary mt-3 inline-flex"
              href={retryHref}
            >
              Tentar novamente
            </a>
          </section>
        ) : (
          <section className="pms-surface-card" role="status">
            <p className="m-0">Nenhuma estadia em check-in foi encontrada.</p>
          </section>
        )}
      </div>
    </DashboardEntityPageShell>
  );
}
