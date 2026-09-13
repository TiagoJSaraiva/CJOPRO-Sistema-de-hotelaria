import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { createRatePlanAction } from "../stage6Actions";
import { reservationOperationsTabs } from "../stage6Tabs";
type Plan = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  versions: unknown[];
};
const guide: UsageGuideDefinition = {
  id: "rates-stage6",
  title: "Planos tarifários",
  steps: [
    {
      id: "version",
      target: "rate-versioning",
      title: "Publique por versão",
      description:
        "Uma versão ativa é imutável. Mudanças futuras não reprecificam reservas existentes.",
    },
    {
      id: "policy",
      target: "rate-policy",
      title: "Compare as políticas",
      description:
        "O plano reúne ocupação, garantia, cancelamento e benefícios apresentados ao hóspede.",
    },
  ],
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.RATE_PLANS_MANAGE))
    return (
      <DashboardAccessDeniedCard
        title="Planos tarifários"
        message="Sem permissão para gerenciar tarifas."
      />
    );
  const data = await requestOperationsFinanceEndpoint<{ items: Plan[] }>(
    "rate-plans",
    "GET",
  );
  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="rates"
      tabs={reservationOperationsTabs(user)}
      usageGuide={guide}
      status={(await searchParams).status}
    >
      <section className="pms-surface-card" data-usage-guide="rate-versioning">
        <h2 className="mt-0">Novo plano em rascunho</h2>
        <form
          action={createRatePlanAction}
          className="grid gap-3 md:grid-cols-4"
        >
          <input
            className="pms-field-input"
            name="name"
            placeholder="Nome"
            required
          />
          <input
            className="pms-field-input"
            name="code"
            placeholder="Código"
            required
          />
          <select
            aria-label="Tipo do plano tarifário"
            className="pms-field-input"
            name="kind"
          >
            <option value="flexible">Flexível</option>
            <option value="non_refundable">Não reembolsável</option>
            <option value="package">Pacote</option>
          </select>
          <input
            className="pms-field-input"
            name="description"
            placeholder="Descrição"
          />
          <button className="pms-button-primary" type="submit">
            Criar plano
          </button>
        </form>
      </section>
      <section className="grid gap-3" data-usage-guide="rate-policy">
        {(data.items || []).map((plan) => (
          <article className="pms-surface-card" key={plan.id}>
            <h3>
              {plan.name} <small>{plan.code}</small>
            </h3>
            <p>
              {plan.kind} · {plan.status} · {plan.versions?.length || 0}{" "}
              versão(ões)
            </p>
          </article>
        ))}
      </section>
    </DashboardEntityPageShell>
  );
}
