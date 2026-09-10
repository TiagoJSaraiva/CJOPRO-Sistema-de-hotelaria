"use client";

import type {
  MaintenancePlanningBoard,
  MaintenanceScheduleSimulation,
} from "@hotel/shared";
import { useMemo, useState } from "react";

type Access = {
  canExecute: boolean;
  canManageTeams: boolean;
  canManageSchedule: boolean;
  canOverrideSchedule: boolean;
};
const inputClass = "rounded border border-slate-300 px-3 py-2";

async function send(path: string, body: unknown) {
  const response = await fetch(`/api/maintenance/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

export function MaintenancePlanningWorkspace({
  initial,
  viewerId,
  access,
}: {
  initial: MaintenancePlanningBoard;
  viewerId: string;
  access: Access;
}) {
  const [board, setBoard] = useState(initial);
  const [view, setView] = useState<"day" | "week">("week");
  const [message, setMessage] = useState("");
  const [simulation, setSimulation] =
    useState<MaintenanceScheduleSimulation | null>(null);
  const [pending, setPending] = useState(false);
  const schedules = useMemo(() => {
    if (view === "week") return board.schedules;
    const today = new Date().toISOString().slice(0, 10);
    return board.schedules.filter((item) =>
      item.planned_start.startsWith(today),
    );
  }, [board.schedules, view]);

  async function reload() {
    const response = await fetch("/api/maintenance/planning/board");
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.message || "Falha ao atualizar o quadro.");
    setBoard(payload);
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    setMessage("");
    try {
      await action();
      await reload();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        data-usage-guide="maintenance-planning-summary"
      >
        {[
          ["Agendadas", board.summary.scheduled],
          ["Backlog", board.summary.backlog],
          ["Capacidade", `${board.summary.capacity_minutes} min`],
          ["Alocada", `${board.summary.allocated_minutes} min`],
          ["Conflitos", board.summary.conflicts],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border bg-white p-4">
            <span className="text-sm text-slate-600">{label}</span>
            <strong className="block text-2xl">{value}</strong>
          </article>
        ))}
      </section>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-blue-50 p-3"
        >
          {message}
        </p>
      ) : null}
      <section
        className="rounded-xl border bg-white p-5"
        data-usage-guide="maintenance-planning-calendar"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0">Agenda</h2>
          <div role="group" aria-label="Período">
            <button
              type="button"
              className={inputClass}
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              Dia
            </button>{" "}
            <button
              type="button"
              className={inputClass}
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              Semana
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {schedules.map((item) => (
            <article key={item.id} className="rounded-lg border p-4">
              <strong>
                {item.occurrence_code} · {item.title}
              </strong>
              <p className="text-sm text-slate-600">
                {item.room_number ? `Quarto ${item.room_number} · ` : ""}
                {new Date(item.planned_start).toLocaleString("pt-BR")}–
                {new Date(item.planned_end).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm">
                {item.team_name || "Sem equipe"} ·{" "}
                {item.technician_name || "Sem técnico"} · impacto{" "}
                {item.impact_score}
              </p>
              {access.canExecute && item.technician_id === viewerId ? (
                <form
                  className="grid gap-2 sm:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void run(
                      () =>
                        send(
                          `work-orders/${item.work_order_id}/reschedule-requests`,
                          {
                            requested_start:
                              data.get("requested_start") || undefined,
                            reason: data.get("reason"),
                          },
                        ),
                      "Pedido de reagendamento enviado.",
                    );
                  }}
                >
                  <label className="pms-field">
                    <span>Novo horário sugerido</span>
                    <input
                      className={inputClass}
                      name="requested_start"
                      type="datetime-local"
                    />
                  </label>
                  <label className="pms-field">
                    <span>Motivo do reagendamento</span>
                    <input
                      className={inputClass}
                      required
                      minLength={3}
                      name="reason"
                    />
                  </label>
                  <button disabled={pending} className={inputClass}>
                    Solicitar reagendamento
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {!schedules.length ? <p>Nenhum atendimento neste período.</p> : null}
        </div>
      </section>
      {access.canManageSchedule ? (
        <section
          className="rounded-xl border bg-white p-5"
          data-usage-guide="maintenance-planning-backlog"
        >
          <h2 className="mt-0">Backlog não agendado</h2>
          <div className="grid gap-4">
            {board.backlog.map((item) => (
              <ScheduleForm
                key={item.work_order_id}
                item={item}
                board={board}
                access={access}
                pending={pending}
                setPending={setPending}
                setMessage={setMessage}
                setSimulation={setSimulation}
                run={run}
              />
            ))}
            {!board.backlog.length ? (
              <p>Nenhuma ordem aguardando agenda.</p>
            ) : null}
          </div>
          {simulation ? (
            <div role="status" className="mt-4 rounded-lg bg-amber-50 p-3">
              <strong>
                {simulation.valid
                  ? "Horário disponível"
                  : "Conflitos encontrados"}
              </strong>
              <ul>
                {simulation.conflicts.map((conflict) => (
                  <li key={`${conflict.kind}-${conflict.message}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {board.reschedule_requests?.length ? (
            <div className="mt-5 grid gap-3 border-t pt-4">
              <h3 className="m-0">Pedidos de reagendamento</h3>
              {board.reschedule_requests.map((request) => (
                <article key={request.id} className="rounded-lg border p-3">
                  <strong>
                    {request.occurrence_code} · {request.title}
                  </strong>
                  <p className="text-sm">
                    {request.requester_name}: {request.reason}
                    {request.requested_start
                      ? ` · ${new Date(request.requested_start).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(
                        () =>
                          send(`reschedule-requests/${request.id}/decision`, {
                            approved: data.get("approved") === "true",
                            reason: data.get("reason"),
                          }),
                        "Pedido de reagendamento decidido.",
                      );
                    }}
                  >
                    <label className="pms-field">
                      <span>Decisão do reagendamento</span>
                      <select className={inputClass} name="approved">
                        <option value="true">Aprovar</option>
                        <option value="false">Rejeitar</option>
                      </select>
                    </label>
                    <label className="pms-field">
                      <span>Motivo da decisão</span>
                      <input
                        className={inputClass}
                        required
                        minLength={3}
                        name="reason"
                      />
                    </label>
                    <button disabled={pending} className={inputClass}>
                      Registrar decisão
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {access.canManageTeams ? (
        <TeamForm board={board} pending={pending} run={run} />
      ) : null}
    </div>
  );
}

function scheduleBody(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    team_id: data.get("team_id") || undefined,
    technician_id: data.get("technician_id") || undefined,
    planned_start: new Date(String(data.get("planned_start"))).toISOString(),
    estimated_minutes: Number(data.get("estimated_minutes")),
    access_kind: data.get("access_kind"),
    access_notes: data.get("access_notes") || undefined,
    override_conflicts: data.get("override_conflicts") === "on",
    override_reason: data.get("override_reason") || undefined,
  };
}

function ScheduleForm({
  item,
  board,
  access,
  pending,
  setPending,
  setMessage,
  setSimulation,
  run,
}: {
  item: MaintenancePlanningBoard["backlog"][number];
  board: MaintenancePlanningBoard;
  access: Access;
  pending: boolean;
  setPending: (value: boolean) => void;
  setMessage: (value: string) => void;
  setSimulation: (value: MaintenanceScheduleSimulation | null) => void;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  return (
    <form
      className="rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          () =>
            send(
              `work-orders/${item.work_order_id}/schedule`,
              scheduleBody(event.currentTarget),
            ),
          "Agendamento confirmado.",
        );
      }}
    >
      <strong>
        {item.occurrence_code} · {item.title}
      </strong>
      <p className="text-sm text-slate-600">
        Prioridade técnica {item.priority}; recomendação{" "}
        {item.recommended_priority} ({item.impact_score} pontos).
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="pms-field">
          <span>Equipe</span>
          <select className={inputClass} name="team_id">
            <option value="">Sem equipe</option>
            {board.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          <span>Técnico</span>
          <select className={inputClass} name="technician_id">
            <option value="">Sem técnico</option>
            {board.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          <span>Início planejado</span>
          <input
            className={inputClass}
            required
            name="planned_start"
            type="datetime-local"
          />
        </label>
        <label className="pms-field">
          <span>Duração estimada em minutos</span>
          <input
            className={inputClass}
            required
            name="estimated_minutes"
            type="number"
            min="5"
            defaultValue="60"
          />
        </label>
        <label className="pms-field">
          <span>Restrição de acesso</span>
          <select className={inputClass} name="access_kind">
            <option value="free">Acesso livre</option>
            <option value="vacant_room">Quarto vazio</option>
            <option value="guest_authorized">Autorização do hóspede</option>
            <option value="front_desk_coordination">
              Coordenação da recepção
            </option>
          </select>
        </label>
        <label className="pms-field">
          <span>Janela ou instrução de acesso</span>
          <input className={inputClass} name="access_notes" />
        </label>
      </div>
      {access.canOverrideSchedule ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr]">
          <label>
            <input name="override_conflicts" type="checkbox" /> Autorizar
            exceção
          </label>
          <label className="pms-field">
            <span>Justificativa da exceção</span>
            <input className={inputClass} name="override_reason" />
          </label>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={inputClass}
          onClick={async (event) => {
            const form = event.currentTarget.form!;
            if (!form.reportValidity()) return;
            setPending(true);
            try {
              const payload = await send(
                `work-orders/${item.work_order_id}/schedule/simulate`,
                scheduleBody(form),
              );
              setSimulation(payload.item);
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Falha na simulação.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          Simular
        </button>
        <button disabled={pending} className={inputClass}>
          Confirmar
        </button>
      </div>
    </form>
  );
}

function TeamForm({
  board,
  pending,
  run,
}: {
  board: MaintenancePlanningBoard;
  pending: boolean;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  return (
    <section
      className="rounded-xl border bg-white p-5"
      data-usage-guide="maintenance-planning-teams"
    >
      <h2 className="mt-0">Equipes e capacidade</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {board.teams.map((team) => (
          <article key={team.id} className="rounded-lg border p-3">
            <strong>{team.name}</strong>
            <p className="m-0 text-sm">
              {team.members.length} membro(s) · {team.availability.length}{" "}
              janela(s)
            </p>
          </article>
        ))}
      </div>
      <form
        className="mt-4 grid gap-2 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(
            () =>
              send("teams", {
                name: data.get("name"),
                members: [
                  {
                    user_id: data.get("user_id"),
                    role: data.get("role"),
                    valid_from: data.get("valid_from"),
                  },
                ],
                availability: [
                  {
                    weekday: Number(data.get("weekday")),
                    starts_at: data.get("starts_at"),
                    ends_at: data.get("ends_at"),
                    capacity: Number(data.get("capacity")),
                  },
                  {
                    user_id: data.get("user_id"),
                    weekday: Number(data.get("weekday")),
                    starts_at: data.get("starts_at"),
                    ends_at: data.get("ends_at"),
                    capacity: 1,
                  },
                ],
              }),
            "Equipe criada.",
          );
        }}
      >
        <label className="pms-field">
          <span>Nome da equipe</span>
          <input className={inputClass} required minLength={2} name="name" />
        </label>
        <label className="pms-field">
          <span>Membro</span>
          <select className={inputClass} required name="user_id">
            <option value="">Selecione</option>
            {board.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          <span>Função na equipe</span>
          <input
            className={inputClass}
            required
            name="role"
            defaultValue="Técnico"
          />
        </label>
        <label className="pms-field">
          <span>Início da vigência</span>
          <input
            className={inputClass}
            required
            name="valid_from"
            type="date"
          />
        </label>
        <label className="pms-field">
          <span>Dia da semana</span>
          <select className={inputClass} name="weekday">
            <option value="1">Segunda</option>
            <option value="2">Terça</option>
            <option value="3">Quarta</option>
            <option value="4">Quinta</option>
            <option value="5">Sexta</option>
            <option value="6">Sábado</option>
            <option value="0">Domingo</option>
          </select>
        </label>
        <label className="pms-field">
          <span>Início da disponibilidade</span>
          <input
            className={inputClass}
            required
            name="starts_at"
            type="time"
            defaultValue="08:00"
          />
        </label>
        <label className="pms-field">
          <span>Fim da disponibilidade</span>
          <input
            className={inputClass}
            required
            name="ends_at"
            type="time"
            defaultValue="17:00"
          />
        </label>
        <label className="pms-field">
          <span>Capacidade simultânea</span>
          <input
            className={inputClass}
            required
            name="capacity"
            type="number"
            min="1"
            defaultValue="1"
          />
        </label>
        <button disabled={pending} className={inputClass}>
          Criar equipe
        </button>
      </form>
      <form
        className="mt-5 grid gap-2 border-t pt-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(
            () =>
              send("availability-exceptions", {
                team_id: data.get("team_id"),
                kind: data.get("kind"),
                starts_at: new Date(
                  String(data.get("starts_at")),
                ).toISOString(),
                ends_at: new Date(String(data.get("ends_at"))).toISOString(),
                capacity_delta: Number(data.get("capacity_delta") || 0),
                reason: data.get("reason"),
              }),
            "Exceção de disponibilidade registrada.",
          );
        }}
      >
        <h3 className="col-span-full m-0">Exceção de disponibilidade</h3>
        <label className="pms-field">
          <span>Equipe da exceção</span>
          <select className={inputClass} required name="team_id">
            <option value="">Selecione</option>
            {board.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pms-field">
          <span>Tipo de exceção</span>
          <select className={inputClass} name="kind">
            <option value="unavailable">Indisponibilidade</option>
            <option value="additional_capacity">Capacidade adicional</option>
          </select>
        </label>
        <label className="pms-field">
          <span>Capacidade adicional</span>
          <input
            className={inputClass}
            name="capacity_delta"
            type="number"
            min="0"
          />
        </label>
        <label className="pms-field">
          <span>Início da exceção</span>
          <input
            className={inputClass}
            required
            name="starts_at"
            type="datetime-local"
          />
        </label>
        <label className="pms-field">
          <span>Fim da exceção</span>
          <input
            className={inputClass}
            required
            name="ends_at"
            type="datetime-local"
          />
        </label>
        <label className="pms-field">
          <span>Motivo da exceção</span>
          <input className={inputClass} required minLength={3} name="reason" />
        </label>
        <button disabled={pending} className={inputClass}>
          Registrar exceção
        </button>
      </form>
    </section>
  );
}
