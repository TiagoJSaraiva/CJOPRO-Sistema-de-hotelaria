"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminMaintenanceNotification } from "@hotel/shared";

export function MaintenanceNotificationInbox({
  initialItems,
}: {
  initialItems: AdminMaintenanceNotification[];
}) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  async function update(id: string, status: "unread" | "read" | "dismissed") {
    const response = await fetch(
      `/api/maintenance/notifications/${id}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (response.ok) {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      setAnnouncement("Estado da notificação atualizado.");
    }
  }
  async function readAll() {
    const response = await fetch("/api/maintenance/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) {
      setItems((current) =>
        current.map((item) =>
          item.status === "unread" ? { ...item, status: "read" } : item,
        ),
      );
      setAnnouncement("Todas as notificações foram marcadas como lidas.");
    }
  }
  const visible = items.filter(
    (item) =>
      filter === "all" || item.status === filter || item.kind === filter,
  );
  return (
    <div aria-live="polite">
      <p className="sr-only">{announcement}</p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Filtrar
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="pms-field-input"
          >
            <option value="all">Todas</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
            <option value="sla_response">SLA de resposta</option>
            <option value="sla_resolution">SLA de resolução</option>
            <option value="preventive_deferred">Preventivas adiadas</option>
            <option value="contract_expiry">Contratos</option>
            <option value="warranty_expiry">Garantias</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void readAll()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
        >
          Marcar todas como lidas
        </button>
      </div>
      <div className="grid gap-3">
        {visible.length ? (
          visible.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border bg-white p-4 ${item.status === "unread" ? "border-amber-400" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    {item.severity} ·{" "}
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </span>
                  <h2 className="my-1 text-base font-semibold">{item.title}</h2>
                  <p className="m-0 text-sm text-slate-700">{item.message}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={item.href}
                    onClick={() => void update(item.id, "read")}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white no-underline"
                  >
                    Abrir
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      void update(
                        item.id,
                        item.status === "unread" ? "read" : "unread",
                      )
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {item.status === "unread"
                      ? "Marcar lida"
                      : "Marcar não lida"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void update(item.id, "dismissed")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    Dispensar
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            Nenhuma notificação neste filtro.
          </p>
        )}
      </div>
    </div>
  );
}
