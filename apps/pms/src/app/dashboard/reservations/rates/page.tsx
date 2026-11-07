import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { reservationOperationsTabs } from "../stage6Tabs";
type Plan = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  active_version_id?: string | null;
  versions: Array<{
    id: string;
    version_number: number;
    cancellation_type?: string;
    cancellation_value?: number;
    cancellation_cutoff_hours?: number;
  }>;
};
const KIND_LABEL: Record<string, string> = {
  flexible: "Tarifa flexível",
  non_refundable: "Não reembolsável",
  package: "Pacote",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  retired: "Encerrado",
};
function cancellationPolicy(version: Plan["versions"][number]): string {
  const value = Number(version.cancellation_value || 0);
  const penalty: Record<string, string> = {
    fixed: `R$ ${value.toFixed(2).replace(".", ",")}`,
    percentage: `${value}% do total`,
    first_night: "primeira diária",
    full_stay: "valor total",
  };
  const amount = penalty[version.cancellation_type || ""];
  if (!amount) return "Cancelamento e no-show sem multa.";
  const hours = Number(version.cancellation_cutoff_hours || 0);
  return `Multa de cancelamento e no-show: ${amount}, até ${hours} horas antes da chegada é grátis no cancelamento.`;
}
const guide: UsageGuideDefinition = {
  id: "rates-stage6",
  title: "Planos tarifários",
  steps: [
    {
      id: "version",
      target: "rate-versioning",
      title: "Consulte os planos do hotel",
      description:
        "Por enquanto esta tela só consulta. Uma versão ativa é imutável: mudanças futuras não reprecificam reservas existentes.",
    },
    {
      id: "policy",
      target: "rate-policy",
      title: "Compare as políticas",
      description:
        "A multa de cancelamento e no-show mostrada aqui é a que o painel da reserva cobra.",
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
        <h2 className="mt-0">Planos cadastrados</h2>
        <p className="mb-0">
          Criar planos e publicar versões ainda não está disponível nesta tela.
        </p>
      </section>
      <section className="grid gap-3" data-usage-guide="rate-policy">
        {(data.items || []).map((plan) => {
          const active = plan.versions?.find(
            (version) => version.id === plan.active_version_id,
          );
          return (
            <article className="pms-surface-card" key={plan.id}>
              <h3>
                {plan.name} <small>{plan.code}</small>
              </h3>
              <p>
                {KIND_LABEL[plan.kind] || "Tipo não informado"} ·{" "}
                {STATUS_LABEL[plan.status] || "Situação não informada"} ·{" "}
                {active
                  ? `versão ${active.version_number}`
                  : "sem versão ativa"}
              </p>
              {active ? (
                <p className="mb-0">{cancellationPolicy(active)}</p>
              ) : null}
            </article>
          );
        })}
      </section>
    </DashboardEntityPageShell>
  );
}
