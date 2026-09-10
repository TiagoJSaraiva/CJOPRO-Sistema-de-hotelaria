"use client";

import type { AdminMaintenanceCategory } from "@hotel/shared";
import { useState } from "react";

export function MaintenanceRecurrencePolicyForm({
  categories,
}: {
  categories: AdminMaintenanceCategory[];
}) {
  const [message, setMessage] = useState("");
  return (
    <section
      className="mb-5 rounded-xl border bg-white p-5"
      data-usage-guide="maintenance-settings-recurrence"
    >
      <h2 className="mt-0">Política de reincidência</h2>
      <p className="text-sm text-slate-600">
        A regra padrão é três ocorrências em 90 dias. Uma categoria selecionada
        cria ou atualiza sua especialização.
      </p>
      {message ? (
        <p role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      <form
        className="grid gap-3 sm:grid-cols-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const response = await fetch("/api/maintenance/recurrence-policy", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category_id: data.get("category_id") || undefined,
              window_days: Number(data.get("window_days")),
              occurrence_threshold: Number(data.get("occurrence_threshold")),
            }),
          });
          const payload = await response.json().catch(() => ({}));
          setMessage(
            response.ok
              ? "Política de reincidência atualizada."
              : payload.message || "Falha ao atualizar a política.",
          );
        }}
      >
        <select
          className="pms-field-input"
          name="category_id"
          aria-label="Categoria da política"
        >
          <option value="">Padrão do hotel</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <label className="grid gap-1 text-sm">
          Janela em dias
          <input
            className="pms-field-input"
            name="window_days"
            type="number"
            min="1"
            max="730"
            defaultValue="90"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Quantidade
          <input
            className="pms-field-input"
            name="occurrence_threshold"
            type="number"
            min="2"
            max="20"
            defaultValue="3"
            required
          />
        </label>
        <button className="self-end rounded border px-3 py-2">
          Salvar política
        </button>
      </form>
    </section>
  );
}
