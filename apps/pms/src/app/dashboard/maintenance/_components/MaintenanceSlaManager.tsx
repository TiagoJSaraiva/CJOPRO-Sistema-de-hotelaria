"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminMaintenanceCategory,
  AdminMaintenanceSlaPolicy,
} from "@hotel/shared";

export function MaintenanceSlaManager({
  policies,
  categories,
  canManage,
}: {
  policies: AdminMaintenanceSlaPolicy[];
  categories: AdminMaintenanceCategory[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const response = await fetch("/api/maintenance/sla-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: data.get("category_id") || null,
        priority: data.get("priority"),
        name: data.get("name"),
        response_hours: Number(data.get("response_hours")),
        resolution_hours: Number(data.get("resolution_hours")),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok)
      setError(payload.message || "Não foi possível criar a política.");
    else {
      form.reset();
      setError(null);
      router.refresh();
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]" aria-live="polite">
      <section>
        <h2 className="text-lg font-semibold">Precedência efetiva</h2>
        <p className="text-sm text-slate-600">
          Categoria + prioridade prevalece sobre a política padrão da
          prioridade. Ocorrências existentes preservam o snapshot original.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3">Política</th>
                <th className="p-3">Escopo</th>
                <th className="p-3">Resposta</th>
                <th className="p-3">Resolução</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{policy.name}</td>
                  <td className="p-3">
                    {policy.category_name
                      ? `${policy.category_name} + `
                      : "Padrão "}
                    {policy.priority}
                  </td>
                  <td className="p-3">{policy.response_hours}h</td>
                  <td className="p-3">{policy.resolution_hours}h</td>
                  <td className="p-3">
                    {policy.is_active ? "Ativa" : "Inativa"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {canManage ? (
        <form
          className="h-fit rounded-xl border border-slate-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void create(event.currentTarget);
          }}
        >
          <h2 className="mt-0 text-lg font-semibold">Nova especialização</h2>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Nome
              <input
                required
                minLength={2}
                name="name"
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Categoria
              <select name="category_id" className="pms-field-input">
                <option value="">Padrão da prioridade</option>
                {categories
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Prioridade
              <select name="priority" className="pms-field-input">
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="normal">Normal</option>
                <option value="low">Baixa</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Resposta (horas)
              <input
                required
                min={1}
                name="response_hours"
                type="number"
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Resolução (horas)
              <input
                required
                min={1}
                name="resolution_hours"
                type="number"
                className="pms-field-input"
              />
            </label>
          </div>
          <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
            Criar política
          </button>
        </form>
      ) : null}
    </div>
  );
}
