"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminMaintenancePreventivePlan,
  AdminMaintenancePreventiveRun,
  AdminMaintenanceReferenceData,
  AdminMaintenanceSupplier,
} from "@hotel/shared";

type Props = {
  plans: AdminMaintenancePreventivePlan[];
  runs: AdminMaintenancePreventiveRun[];
  references: AdminMaintenanceReferenceData;
  suppliers: AdminMaintenanceSupplier[];
  canManage: boolean;
};

function futureDates(start: string, unit: string, interval: number) {
  const dates: string[] = [];
  const anchor = new Date(`${start}T12:00:00`);
  const day = anchor.getDate();
  for (let index = 0; index < 5; index += 1) {
    const current = new Date(anchor);
    if (unit === "daily") current.setDate(anchor.getDate() + index * interval);
    if (unit === "weekly")
      current.setDate(anchor.getDate() + index * interval * 7);
    if (unit === "monthly" && index) {
      current.setDate(1);
      current.setMonth(anchor.getMonth() + index * interval);
      current.setDate(
        Math.min(
          day,
          new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(),
        ),
      );
    }
    if (unit === "yearly" && index) {
      current.setDate(1);
      current.setFullYear(anchor.getFullYear() + index * interval);
      current.setMonth(anchor.getMonth());
      current.setDate(
        Math.min(
          day,
          new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(),
        ),
      );
    }
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

export function MaintenancePreventiveManager({
  plans,
  runs,
  references,
  suppliers,
  canManage,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [unit, setUnit] = useState("monthly");
  const [interval, setIntervalValue] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminMaintenancePreventivePlan | null>(
    null,
  );
  const preview = useMemo(
    () => futureDates(start, unit, interval),
    [start, unit, interval],
  );
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const target = String(data.get("target") || "");
    const [targetType, targetId] = target.split(":");
    const tasks = String(data.get("tasks") || "")
      .split("\n")
      .map((description) => description.trim())
      .filter(Boolean)
      .map((description, position) => ({
        position,
        description,
        is_required: true,
      }));
    const response = await fetch(
      editing
        ? `/api/maintenance/preventive-plans/${editing.id}`
        : "/api/maintenance/preventive-plans",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          category_id: data.get("category_id"),
          assigned_to: data.get("assigned_to"),
          room_id: targetType === "room" ? targetId : null,
          location_id: targetType === "location" ? targetId : null,
          supplier_id: data.get("supplier_id") || null,
          contract_id: data.get("contract_id") || null,
          priority: data.get("priority"),
          instructions: data.get("instructions"),
          recurrence_unit: unit,
          recurrence_interval: interval,
          starts_on: start,
          ends_on: data.get("ends_on") || null,
          local_time: data.get("local_time"),
          generation_lead_days: Number(data.get("lead_days")),
          completion_due_hours: Number(data.get("due_hours")),
          requires_inspection: data.get("requires_inspection") === "on",
          blocking_recommended: data.get("blocking_recommended") === "on",
          tasks,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok)
      setError(payload.message || "Não foi possível salvar o plano.");
    else {
      form.reset();
      setEditing(null);
      setError(null);
      router.refresh();
    }
  }
  async function status(id: string, action: "pause" | "resume" | "deactivate") {
    const response = await fetch(
      `/api/maintenance/preventive-plans/${id}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: `${action === "pause" ? "Pausa" : "Retomada"} manual do plano.`,
        }),
      },
    );
    if (!response.ok) setError("Não foi possível alterar o plano.");
    else router.refresh();
  }
  async function decide(
    run: AdminMaintenancePreventiveRun,
    action: "generate" | "skip" | "reschedule",
  ) {
    const reason = window.prompt("Informe a justificativa para esta decisão:");
    if (!reason?.trim()) return;
    const scheduledFor =
      action === "reschedule"
        ? window.prompt(
            "Nova data (AAAA-MM-DD):",
            run.rescheduled_for || run.scheduled_local_date,
          )
        : null;
    if (action === "reschedule" && !scheduledFor) return;
    const response = await fetch(
      `/api/maintenance/preventive-runs/${run.id}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        }),
      },
    );
    if (!response.ok)
      setError("Não foi possível decidir a competência adiada.");
    else {
      setError(null);
      router.refresh();
    }
  }
  function beginEdit(plan: AdminMaintenancePreventivePlan) {
    setEditing(plan);
    setStart(plan.starts_on);
    setUnit(plan.recurrence_unit);
    setIntervalValue(plan.recurrence_interval);
    document
      .getElementById("preventive-plan-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const deferred = runs.filter((run) => run.status === "deferred");
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]"
      aria-live="polite"
    >
      <section className="space-y-3" aria-labelledby="preventive-list-title">
        <h2 id="preventive-list-title" className="text-lg font-semibold">
          Planos e próximas competências
        </h2>
        {plans.length ? (
          plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    {plan.status} · {plan.priority}
                  </span>
                  <h3 className="my-1 font-semibold">{plan.name}</h3>
                  <p className="m-0 text-sm text-slate-600">
                    {plan.target_name} · próxima em {plan.next_due_date} ·{" "}
                    {plan.assignee_name}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(plan)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      Editar
                    </button>
                    {plan.status !== "inactive" ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void status(
                              plan.id,
                              plan.status === "paused" ? "resume" : "pause",
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          {plan.status === "paused" ? "Retomar" : "Pausar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void status(plan.id, "deactivate")}
                          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                        >
                          Desativar
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {plan.tasks.length ? (
                <ul className="mb-0 mt-3 text-sm text-slate-700">
                  {plan.tasks.map((task) => (
                    <li key={`${plan.id}-${task.position}`}>
                      {task.description}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            Nenhum plano cadastrado.
          </p>
        )}
        <div className="pt-3">
          <h2 className="text-lg font-semibold">Competências adiadas</h2>
          {deferred.length ? (
            deferred.map((run) => (
              <article
                key={run.id}
                className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <p className="m-0 font-semibold">
                  {plans.find((plan) => plan.id === run.plan_id)?.name ||
                    "Plano preventivo"}
                </p>
                <p className="my-2 text-sm text-slate-700">
                  Prevista para {run.scheduled_local_date}. A execução anterior
                  ainda estava aberta.
                </p>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(run, "generate")}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      Gerar agora
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(run, "reschedule")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      Reagendar
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(run, "skip")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      Ignorar
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              Nenhuma competência requer decisão.
            </p>
          )}
        </div>
      </section>
      {canManage ? (
        <form
          id="preventive-plan-form"
          key={editing?.id || "new"}
          className="h-fit rounded-xl border border-slate-200 bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="mt-0 text-lg font-semibold">
              {editing ? "Editar plano" : "Novo plano"}
            </h2>
            {editing ? (
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setEditing(null)}
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">
              Nome
              <input
                required
                minLength={3}
                name="name"
                defaultValue={editing?.name}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Categoria
              <select
                required
                name="category_id"
                defaultValue={editing?.category_id || ""}
                className="pms-field-input"
              >
                <option value="">Selecione</option>
                {references.categories
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Alvo
              <select
                required
                name="target"
                defaultValue={
                  editing
                    ? editing.room_id
                      ? `room:${editing.room_id}`
                      : `location:${editing.location_id}`
                    : ""
                }
                className="pms-field-input"
              >
                <option value="">Selecione</option>
                {references.rooms.map((item) => (
                  <option key={item.id} value={`room:${item.id}`}>
                    Quarto {item.room_number}
                  </option>
                ))}
                {references.locations
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={`location:${item.id}`}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Responsável
              <select
                required
                name="assigned_to"
                defaultValue={editing?.assigned_to || ""}
                className="pms-field-input"
              >
                <option value="">Selecione</option>
                {references.assignable_users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Fornecedor
              <select
                name="supplier_id"
                defaultValue={editing?.supplier_id || ""}
                className="pms-field-input"
              >
                <option value="">Interno</option>
                {suppliers
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Contrato
              <select
                name="contract_id"
                defaultValue={editing?.contract_id || ""}
                className="pms-field-input"
              >
                <option value="">Sem contrato</option>
                {suppliers.flatMap((supplier) =>
                  (supplier.contracts || [])
                    .filter((contract) => contract.status === "active")
                    .map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {supplier.name} · {contract.contract_number}
                      </option>
                    )),
                )}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Prioridade
              <select
                name="priority"
                defaultValue={editing?.priority || "normal"}
                className="pms-field-input"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Recorrência
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="pms-field-input"
              >
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Intervalo
              <input
                type="number"
                min={1}
                max={365}
                value={interval}
                onChange={(event) =>
                  setIntervalValue(Number(event.target.value))
                }
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Início
              <input
                required
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Fim opcional
              <input
                name="ends_on"
                type="date"
                defaultValue={editing?.ends_on || ""}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Horário local
              <input
                required
                name="local_time"
                type="time"
                defaultValue={editing?.local_time?.slice(0, 5) || "09:00"}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Antecedência (dias)
              <input
                name="lead_days"
                type="number"
                min={0}
                max={365}
                defaultValue={editing?.generation_lead_days || 0}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Prazo (horas)
              <input
                name="due_hours"
                type="number"
                min={1}
                defaultValue={editing?.completion_due_hours || 24}
                className="pms-field-input"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="requires_inspection"
                type="checkbox"
                defaultChecked={editing?.requires_inspection}
              />{" "}
              Exigir inspeção
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="blocking_recommended"
                type="checkbox"
                defaultChecked={editing?.blocking_recommended}
              />{" "}
              Recomendar bloqueio
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Instruções
              <textarea
                required
                minLength={3}
                name="instructions"
                rows={3}
                defaultValue={editing?.instructions}
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Checklist (um item por linha)
              <textarea
                name="tasks"
                rows={4}
                defaultValue={editing?.tasks
                  .map((task) => task.description)
                  .join("\n")}
                className="pms-field-input"
              />
            </label>
          </div>
          <div className="my-4 rounded-lg bg-slate-50 p-3 text-sm">
            <strong>Próximas datas:</strong> {preview.join(" · ")}
          </div>
          <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
            {editing ? "Salvar alterações" : "Criar plano"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
