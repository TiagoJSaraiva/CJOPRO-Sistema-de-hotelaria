import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { actPrearrivalRequestAction } from "../stage6Actions";
import { reservationOperationsTabs } from "../stage6Tabs";

type RequestItem = {
  id: string;
  type: string;
  category: string;
  description: string;
  status: string;
  version: number;
  due_at?: string;
  next_action?: string;
};
const guide: UsageGuideDefinition = {
  id: "prearrival-stage6",
  title: "Chegadas e pré-chegada",
  steps: [
    {
      id: "readiness",
      target: "arrival-readiness",
      title: "Revise antes da chegada",
      description:
        "Dados ausentes, quarto não alocado e solicitações aparecem na mesma fila.",
    },
    {
      id: "triage",
      target: "special-request-triage",
      title: "Faça a triagem",
      description:
        "Aceitar uma solicitação não cria estoque, cobrança ou tarefa até a conversão explícita.",
    },
  ],
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.PREARRIVAL_MANAGE))
    return (
      <DashboardAccessDeniedCard
        title="Pré-chegada"
        message="Sem permissão para acompanhar chegadas."
      />
    );
  const board = await requestOperationsFinanceEndpoint<{
    requests: RequestItem[];
    unassigned_arrivals: unknown[];
  }>("prearrival/board", "GET");
  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="arrivals"
      tabs={reservationOperationsTabs(user)}
      usageGuide={guide}
      status={(await searchParams).status}
    >
      <section
        className="pms-surface-card"
        data-usage-guide="arrival-readiness"
      >
        <h2 className="mt-0">Prontidão da chegada</h2>
        <p>
          {board.unassigned_arrivals?.length || 0} chegada(s) próxima(s) ainda
          sem quarto. A alocação continua sendo confirmada pela recepção.
        </p>
      </section>
      <div className="grid gap-3" data-usage-guide="special-request-triage">
        {(board.requests || []).map((item) => (
          <article key={item.id} className="pms-surface-card">
            <h3>{item.category.replaceAll("_", " ")}</h3>
            <p>{item.description}</p>
            <p>
              Situação: <strong>{item.status}</strong> · Próxima ação:{" "}
              {item.next_action || "definir"}
            </p>
            <form
              action={actPrearrivalRequestAction}
              className="grid gap-2 md:grid-cols-3"
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="version" value={item.version} />
              <select className="pms-field-input" name="action">
                <option value="triage">Triar</option>
                <option value="accept">Aceitar</option>
                <option value="reject">Rejeitar</option>
                <option value="convert">Converter</option>
                <option value="resolve">Resolver</option>
              </select>
              <input
                className="pms-field-input"
                name="reason"
                minLength={3}
                placeholder="Motivo da decisão"
                required
              />
              <input
                className="pms-field-input"
                name="next_action"
                placeholder="Próxima ação"
              />
              <button className="pms-button-primary" type="submit">
                Registrar decisão
              </button>
            </form>
          </article>
        ))}
      </div>
    </DashboardEntityPageShell>
  );
}
