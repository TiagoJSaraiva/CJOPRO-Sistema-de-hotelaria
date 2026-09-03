import Link from "next/link";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenanceOccurrence,
  getMaintenanceOccurrences,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { maintenanceTabs } from "../tabs";
import { maintenanceAgendaGuide } from "../usageGuides";

export default async function MaintenanceAgendaPage() {
  const user = await getUserFromSession();
  const access = getMaintenanceAccess(user);
  if (!access.canExecute)
    return (
      <DashboardAccessDeniedCard
        title="Minha agenda"
        message="Sem permissão para executar ordens de manutenção."
      />
    );
  const occurrences = await getMaintenanceOccurrences(
    "assigned_to=me&page_size=100",
  );
  const details = await Promise.all(
    occurrences.items.map((item) => getMaintenanceOccurrence(item.id)),
  );
  const orders = details.flatMap((occurrence) =>
    occurrence.work_orders
      .filter(
        (order) =>
          order.assigned_to === user?.id &&
          !["completed", "canceled"].includes(order.status),
      )
      .map((order) => ({ ...order, occurrence })),
  );
  const today = new Date().toISOString().slice(0, 10);
  const groups = [
    {
      label: "Atrasadas",
      items: orders.filter(
        (item) => item.due_at && item.due_at.slice(0, 10) < today,
      ),
    },
    {
      label: "Hoje",
      items: orders.filter((item) => item.due_at?.slice(0, 10) === today),
    },
    {
      label: "Próximas",
      items: orders.filter(
        (item) => !item.due_at || item.due_at.slice(0, 10) > today,
      ),
    },
  ];
  return (
    <DashboardEntityPageShell
      title="Minha agenda de manutenção"
      activeTabKey="agenda"
      tabs={maintenanceTabs(access)}
      usageGuide={maintenanceAgendaGuide}
    >
      <p className="mb-5 text-sm text-slate-600">
        Tarefas priorizadas por prazo. Checklists e controles ficam no detalhe
        da ocorrência.
      </p>
      <div className="grid gap-6" data-usage-guide="maintenance-agenda-groups">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`agenda-${group.label}`}>
            <h2
              id={`agenda-${group.label}`}
              className="mb-3 text-lg font-semibold"
            >
              {group.label} ({group.items.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.length ? (
                group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/maintenance/occurrences/${item.occurrence.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      {item.occurrence.code} · {item.occurrence.category_name}
                    </span>
                    <h3 className="my-1 font-semibold">{item.title}</h3>
                    <p className="m-0 text-sm text-slate-600">
                      {item.occurrence.room_number
                        ? `Quarto ${item.occurrence.room_number}`
                        : item.occurrence.location_name}{" "}
                      · prazo{" "}
                      {item.due_at
                        ? new Date(item.due_at).toLocaleString("pt-BR")
                        : "não definido"}
                    </p>
                    {item.checklist?.length ? (
                      <p className="mb-0 mt-2 text-sm">
                        Checklist:{" "}
                        {
                          item.checklist.filter((entry) => entry.completed_at)
                            .length
                        }
                        /{item.checklist.length}
                      </p>
                    ) : null}
                  </Link>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                  Nenhuma tarefa nesta faixa.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </DashboardEntityPageShell>
  );
}
