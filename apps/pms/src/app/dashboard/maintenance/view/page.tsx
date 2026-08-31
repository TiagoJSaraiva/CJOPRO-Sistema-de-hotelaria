import Link from "next/link";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenanceOccurrences,
  getMaintenanceSummary,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
const labels: Record<string, string> = {
  reported: "Relatada",
  triaged: "Triada",
  in_progress: "Em andamento",
  awaiting_inspection: "Aguardando inspeção",
  awaiting_liability: "Aguardando apuração",
  resolved: "Resolvida",
  canceled: "Cancelada",
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
};

export default async function MaintenanceViewPage({ searchParams }: PageProps) {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Manutenção"
        message="Sem permissão para consultar as ocorrências."
      />
    );
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "status",
    "priority",
    "assigned_to",
    "overdue",
    "blocked",
    "search",
    "room_id",
  ]) {
    const value = raw?.[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  const [data, summary] = await Promise.all([
    getMaintenanceOccurrences(query.toString()),
    getMaintenanceSummary(),
  ]);
  const tabs = [
    {
      key: "all",
      label: "Todas",
      href: "/dashboard/maintenance/view",
      isVisible: access.canRead,
    },
    {
      key: "mine",
      label: "Minhas ordens",
      href: "/dashboard/maintenance/view?assigned_to=me",
      isVisible: access.canRead,
    },
    {
      key: "unassigned",
      label: "Sem responsável",
      href: "/dashboard/maintenance/view?assigned_to=unassigned",
      isVisible: access.canRead,
    },
    {
      key: "overdue",
      label: "Atrasadas",
      href: "/dashboard/maintenance/view?overdue=true",
      isVisible: access.canRead,
    },
    {
      key: "inspection",
      label: "Aguardando inspeção",
      href: "/dashboard/maintenance/view?status=awaiting_inspection",
      isVisible: access.canRead,
    },
    {
      key: "report",
      label: "Registrar",
      href: "/dashboard/maintenance/report",
      isVisible: access.canCreate,
    },
    {
      key: "settings",
      label: "Configuração",
      href: "/dashboard/maintenance/settings",
      isVisible: access.canManageCatalogs,
    },
  ];
  const activeTabKey =
    query.get("assigned_to") === "me"
      ? "mine"
      : query.get("assigned_to") === "unassigned"
        ? "unassigned"
        : query.get("overdue")
          ? "overdue"
          : query.get("status") === "awaiting_inspection"
            ? "inspection"
            : "all";
  return (
    <DashboardEntityPageShell
      title="Manutenção"
      activeTabKey={activeTabKey}
      tabs={tabs}
    >
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Resumo de manutenção"
      >
        {[
          ["Abertas", summary.open],
          ["Minhas", summary.assigned_to_me],
          ["Sem responsável", summary.unassigned],
          ["Atrasadas", summary.overdue],
          ["Inspeção", summary.awaiting_inspection],
          ["Quartos bloqueados", summary.blocked_rooms],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-[#d7dce2] bg-white p-4"
          >
            <span className="block text-sm text-[#52606d]">{label}</span>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap gap-3 rounded-xl border border-[#d7dce2] bg-white p-4"
        role="search"
      >
        <label className="grid gap-1 text-sm">
          Buscar
          <input
            name="search"
            defaultValue={query.get("search") || ""}
            className="pms-field-input"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Situação
          <select
            name="status"
            defaultValue={query.get("status") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            {[
              "reported",
              "triaged",
              "in_progress",
              "awaiting_inspection",
              "awaiting_liability",
              "resolved",
              "canceled",
            ].map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Prioridade
          <select
            name="priority"
            defaultValue={query.get("priority") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            {["low", "normal", "high", "critical"].map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <button className="self-end rounded-lg bg-[#102a43] px-4 py-2 font-semibold text-white">
          Filtrar
        </button>
      </form>
      <div className="mt-4 grid gap-3">
        {data.items.length ? (
          data.items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/maintenance/occurrences/${item.id}`}
              className="grid gap-2 rounded-xl border border-[#d7dce2] bg-white p-4 text-inherit no-underline sm:grid-cols-[1fr_auto]"
            >
              <div>
                <strong>
                  {item.code} ·{" "}
                  {item.room_number
                    ? `Quarto ${item.room_number}`
                    : item.location_name}
                </strong>
                <p className="my-1 text-sm text-[#52606d]">
                  {item.category_name} · {item.description}
                </p>
                <span className="text-sm">
                  {labels[item.status]} · Prioridade {labels[item.priority]}
                </span>
              </div>
              <div className="text-sm text-[#52606d]">
                {item.active_block ? "Quarto bloqueado" : ""}
                {item.open_work_orders
                  ? `${item.active_block ? " · " : ""}${item.open_work_orders} ordem(ns) aberta(s)`
                  : ""}
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#aeb7c2] bg-white p-6 text-center">
            Nenhuma ocorrência encontrada.
          </p>
        )}
      </div>
    </DashboardEntityPageShell>
  );
}
