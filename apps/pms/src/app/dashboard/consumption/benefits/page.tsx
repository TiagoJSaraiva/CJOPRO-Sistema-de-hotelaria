import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listConsumptionBenefitPlans } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { consumptionTabs } from "../tabs";
import { consumptionBenefitsGuide } from "../usageGuides";
import { createBenefitPlanAction, createBenefitVersionAction } from "./actions";

export default async function ConsumptionBenefitsPage() {
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canManageBenefits && !access.canOverrideBenefits)
    return (
      <DashboardAccessDeniedCard
        title="Benefícios"
        message="Sem permissão para consultar benefícios de consumo."
      />
    );
  const plans = await listConsumptionBenefitPlans();
  return (
    <DashboardEntityPageShell
      title="Benefícios de consumo"
      activeTabKey="benefits"
      tabs={consumptionTabs(access)}
      usageGuide={consumptionBenefitsGuide}
    >
      <div className="grid gap-5">
        {access.canManageBenefits ? (
          <>
            <form
              action={createBenefitPlanAction}
              className="pms-surface-card grid gap-3 md:grid-cols-2"
              data-usage-guide="benefit-plan-form"
            >
              <h2 className="m-0 md:col-span-2">Novo plano</h2>
              <label className="pms-field-label">
                Nome
                <input
                  className="pms-field-input"
                  name="name"
                  minLength={2}
                  required
                />
              </label>
              <label className="pms-field-label">
                Descrição
                <input className="pms-field-input" name="description" />
              </label>
              <button className="pms-button-primary md:col-span-2">
                Criar plano
              </button>
            </form>
            {plans.length ? (
              <form
                action={createBenefitVersionAction}
                className="pms-surface-card grid gap-3 md:grid-cols-2"
              >
                <h2 className="m-0 md:col-span-2">Criar e ativar versão</h2>
                <label className="pms-field-label">
                  Plano
                  <select className="pms-field-input" name="plan_id">
                    {plans.map((plan) => (
                      <option key={String(plan.id)} value={String(plan.id)}>
                        {String(plan.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pms-field-label">
                  Franquia
                  <select className="pms-field-input" name="allowance_scope">
                    <option value="stay">Por estadia</option>
                    <option value="night">Por diária</option>
                    <option value="calendar_day">Por dia civil</option>
                  </select>
                </label>
                <label className="pms-field-label">
                  Alvo
                  <select className="pms-field-input" name="target_kind">
                    <option value="category_id">Categoria</option>
                    <option value="product_id">Produto</option>
                    <option value="offer_id">Oferta</option>
                    <option value="point_id">Ponto</option>
                  </select>
                </label>
                <label className="pms-field-label">
                  Identificador do alvo
                  <input
                    className="pms-field-input"
                    name="target_id"
                    required
                  />
                </label>
                <label className="pms-field-label">
                  Crédito
                  <input
                    className="pms-field-input"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <button className="pms-button-primary md:col-span-2">
                  Ativar versão
                </button>
              </form>
            ) : null}
          </>
        ) : null}
        <section
          className="pms-surface-card"
          data-usage-guide="benefit-plan-list"
        >
          <h2>Planos versionados</h2>
          <ul>
            {plans.map((plan) => (
              <li key={String(plan.id)}>
                <strong>{String(plan.name)}</strong> ·{" "}
                {Array.isArray(plan.versions) ? plan.versions.length : 0}{" "}
                versão(ões)
              </li>
            ))}
          </ul>
          {!plans.length ? <p>Nenhum plano cadastrado.</p> : null}
        </section>
        <section
          className="pms-surface-card"
          data-usage-guide="benefit-application-explanation"
        >
          <h2>Aplicação automática</h2>
          <p>
            Benefícios elegíveis são aplicados pela maior vantagem. Empates usam
            o vencimento mais próximo e a concessão mais antiga. A retirada
            exige permissão e motivo.
          </p>
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
