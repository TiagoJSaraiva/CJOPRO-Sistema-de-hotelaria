"use client";
import { useState } from "react";
import type {
  OperationalPendingList,
  OperationalPending,
  OperationalPendingAction,
} from "@hotel/shared";
const statusLabels = {
  open: "Aberta",
  claimed: "Assumida",
  resolved: "Resolvida",
};
const severityLabels = {
  info: "Informação",
  warning: "Atenção",
  critical: "Crítica",
};
const kinds = {
  guest_balance: "Saldo de hóspede",
  critical_stock: "Estoque crítico",
  agreement_expiry: "Acordo vencendo",
  pending_settlement: "Apuração pendente",
  sla_response: "SLA de resposta",
  sla_resolution: "SLA de resolução",
  preventive_deferred: "Preventiva adiada",
  contract_expiry: "Contrato vencendo",
  warranty_expiry: "Garantia vencendo",
  governance_departure_review: "Conferência de saída",
  governance_cleaning: "Limpeza pendente",
  governance_inspection: "Inspeção pendente",
  governance_maintenance: "Retido pela manutenção",
  governance_replenishment: "Reposição pendente",
  governance_minibar: "Divergência de frigobar",
  governance_relocation: "Reserva afetada",
  expired_lot: "Lote vencido",
  expiring_lot: "Lote próximo do vencimento",
  replenishment: "Reposição pendente",
  procurement_invoice: "Nota ou conta de fornecedor",
  cash_session: "Sessão de caixa",
  daily_close: "Fechamento diário",
  partner_dispute: "Contestação de parceiro",
  organization_conflict: "Divergência cadastral",
};
export function PendingCards({
  data,
  source,
}: {
  data: OperationalPendingList;
  source?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {(["open", "claimed", "resolved", "unread"] as const).map((key) => (
        <a
          key={key}
          className="pms-surface-card text-inherit no-underline"
          href={`/dashboard/pending?${source ? `source=${encodeURIComponent(source)}&` : ""}${key === "unread" ? "read=unread" : "status=" + key}`}
        >
          <span>{key === "unread" ? "Não lidas" : statusLabels[key]}</span>
          <strong className="block text-2xl">{data.summary[key]}</strong>
        </a>
      ))}
    </div>
  );
}
export function PendingWorkspace({
  initial,
  userId,
  initialQuery = "",
}: {
  initial: OperationalPendingList;
  userId: string;
  initialQuery?: string;
}) {
  const [data, setData] = useState(initial),
    [query, setQuery] = useState(initialQuery),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load(nextQuery = query) {
    const response = await fetch(`/api/operational-pending?${nextQuery}`);
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.message || "Falha ao consultar pendências.");
    setData(payload);
    setQuery(nextQuery);
  }
  async function act(
    body: OperationalPendingAction | { action: "reconcile" },
    href?: string,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/operational-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        await load();
        throw new Error(payload.message || "Falha ao atualizar.");
      }
      if (href) {
        window.location.assign(href);
        return;
      }
      await load();
      setMessage("Pendências atualizadas.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  const params = new URLSearchParams(query),
    page = Number(params.get("page") || 1);
  function read(item: OperationalPending, href?: string) {
    void act({ ids: [item.id], action: "read" }, href);
  }
  return (
    <div className="grid gap-4">
      <PendingCards data={data} source={params.get("source") || undefined} />
      <form
        data-usage-guide="pending-filters"
        className="pms-surface-card grid gap-3 sm:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const filters = new URLSearchParams();
          new FormData(event.currentTarget).forEach((value, key) => {
            if (value) filters.set(key, String(value));
          });
          setBusy(true);
          try {
            await load(filters.toString());
          } catch {
            setMessage("Falha ao filtrar. A lista anterior foi preservada.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="pms-field">
          Origem
          <select
            name="source"
            defaultValue={params.get("source") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            <option value="maintenance">Manutenção</option>
            <option value="consumption">Consumo</option>
            <option value="governance">Governança</option>
            <option value="inventory">Estoque</option>
            <option value="procurement">Compras</option>
            <option value="cash">Caixa</option>
            <option value="partner">Parceiros</option>
          </select>
        </label>
        <label className="pms-field">
          Tipo
          <select
            name="kind"
            defaultValue={params.get("kind") || ""}
            className="pms-field-input"
          >
            <option value="">Todos</option>
            {Object.entries(kinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          Prioridade
          <select
            name="severity"
            defaultValue={params.get("severity") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            {Object.entries(severityLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          Situação
          <select
            name="status"
            defaultValue={params.get("status") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          Responsável
          <select
            name="assignee"
            defaultValue={params.get("assignee") || ""}
            className="pms-field-input"
          >
            <option value="">Todos</option>
            <option value="me">Minhas pendências</option>
            <option value="unassigned">Sem responsável</option>
          </select>
        </label>
        <label className="pms-field">
          Minha leitura
          <select
            name="read"
            defaultValue={params.get("read") || ""}
            className="pms-field-input"
          >
            <option value="">Todas</option>
            <option value="read">Lidas</option>
            <option value="unread">Não lidas</option>
          </select>
        </label>
        <button
          disabled={busy}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
        >
          Aplicar filtros
        </button>
      </form>
      <section className="pms-surface-card" data-usage-guide="pending-sync">
        <p>
          Última atualização:{" "}
          {data.sync.last_success_at
            ? new Date(data.sync.last_success_at).toLocaleString("pt-BR")
            : "Ainda não executada"}
        </p>
        {data.sync.error_message && (
          <p role="alert">{data.sync.error_message}</p>
        )}
        <button
          disabled={busy}
          onClick={() => void act({ action: "reconcile" })}
          className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
        >
          Atualizar pendências
        </button>
      </section>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <button
        disabled={busy || !data.items.length}
        onClick={() =>
          void act({ ids: data.items.map((item) => item.id), action: "read" })
        }
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
      >
        Marcar esta página como lida
      </button>
      <div className="grid gap-3" data-usage-guide="pending-items">
        {data.items.map((item) => (
          <article key={item.id} className="pms-surface-card">
            <h2 className="text-lg">{item.title}</h2>
            <p>
              {severityLabels[item.severity]} · {statusLabels[item.status]} ·{" "}
              {item.read ? "Lida por você" : "Não lida"}
            </p>
            <p>Responsável: {item.assignee_name || "Sem responsável"}</p>
            {item.resolution_reason && <p>{item.resolution_reason}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => read(item, item.href)}
                className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
              >
                Abrir contexto
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void act({
                    ids: [item.id],
                    action: item.read ? "unread" : "read",
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
              >
                {item.read ? "Marcar não lida" : "Marcar lida"}
              </button>
              {item.status === "open" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act({
                      ids: [item.id],
                      action: "claim",
                      expected_version: item.version,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
                >
                  Assumir
                </button>
              )}
              {item.assigned_to === userId && item.status === "claimed" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act({
                      ids: [item.id],
                      action: "release",
                      expected_version: item.version,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
                >
                  Devolver à fila
                </button>
              )}
            </div>
          </article>
        ))}
        {!data.items.length && <p>Nenhuma pendência neste filtro.</p>}
      </div>
      <div className="flex gap-3">
        <button
          disabled={busy || page <= 1}
          onClick={() => {
            params.set("page", String(page - 1));
            void load(params.toString()).catch(() =>
              setMessage("Falha ao mudar página."),
            );
          }}
        >
          Anterior
        </button>
        <span>
          Página {page} · {data.total} resultado(s)
        </span>
        <button
          disabled={busy || page * 30 >= data.total}
          onClick={() => {
            params.set("page", String(page + 1));
            void load(params.toString()).catch(() =>
              setMessage("Falha ao mudar página."),
            );
          }}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
