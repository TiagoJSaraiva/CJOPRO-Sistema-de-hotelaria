"use client";

import { useRef, useState } from "react";
import type {
  AdminConsumptionOperationalContext,
  ConsumptionBillingMode,
  ConsumptionPaymentMethod,
  GovernanceActionInput,
  GovernanceBoard,
  GovernanceCycle,
  GovernanceTemplate,
} from "@hotel/shared";

type Access = {
  canRead: boolean;
  canExecute: boolean;
  canInspect: boolean;
  canAssign: boolean;
  canManageTemplates: boolean;
  canPostConsumption: boolean;
  canReceivePayment: boolean;
  canGrantCourtesy: boolean;
  canReportMaintenance: boolean;
};

const statusLabels: Record<string, string> = {
  departure_review: "Conferência de saída",
  cleaning_pending: "Limpeza pendente",
  cleaning_in_progress: "Limpeza em andamento",
  inspection_pending: "Aguardando inspeção",
  maintenance_hold: "Retido pela manutenção",
  released: "Liberado",
};
const taskLabels: Record<string, string> = {
  departure_review: "Conferência de saída",
  cleaning: "Limpeza",
  replenishment: "Reposição",
  inspection: "Inspeção final",
};
const eventLabels: Record<string, string> = {
  cycle_created: "Ciclo aberto",
  checkout_registered: "Checkout registrado",
  maintenance_hold: "Interdição de manutenção",
  maintenance_released: "Manutenção liberada",
  note: "Nota operacional",
  claim: "Responsável assumiu",
  release_assignment: "Responsável devolveu à fila",
  assign: "Responsável atribuído",
  start: "Etapa iniciada",
  complete: "Etapa concluída",
  approve: "Inspeção aprovada",
  reject: "Inspeção reprovada",
  handoff_note: "Passagem de turno",
  cancel: "Ciclo cancelado",
  minibar_discrepancy: "Divergência de frigobar",
  minibar_posted: "Consumo do frigobar lançado",
  defect_reported: "Avaria registrada",
  readiness_override: "Check-in com exceção gerencial",
};

function currentTask(cycle: GovernanceCycle) {
  return [...cycle.tasks]
    .reverse()
    .find((task) => task.status !== "completed" && task.status !== "canceled");
}

function AuthorizedMinibarForm({
  cycleId,
  context,
  access,
  busy,
  submit,
}: {
  cycleId: string;
  context: AdminConsumptionOperationalContext;
  access: Access;
  busy: boolean;
  submit: (path: string, body: unknown) => Promise<boolean>;
}) {
  const availableOffers = context.offers.filter((offer) => offer.available);
  const [offerId, setOfferId] = useState(availableOffers[0]?.id || "");
  const selected = availableOffers.find((offer) => offer.id === offerId);
  const allowedModes = (selected?.allowed_modes || []).filter(
    (mode) => mode !== "hotel_immediate" || access.canReceivePayment,
  );
  const suggestedMode =
    selected?.default_mode && allowedModes.includes(selected.default_mode)
      ? selected.default_mode
      : (["stay_folio", "hotel_immediate", "partner_direct"].find((mode) =>
          allowedModes.includes(mode as ConsumptionBillingMode),
        ) as ConsumptionBillingMode | undefined);
  const [mode, setMode] = useState<ConsumptionBillingMode | "courtesy" | "">(
    suggestedMode || "",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<ConsumptionPaymentMethod>("pix");
  const requestRef = useRef<{ signature: string; key: string } | null>(null);

  return (
    <form
      data-usage-guide="governance-minibar"
      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selected || !mode) return;
        const form = new FormData(event.currentTarget);
        const base = {
          point_id: selected.point_id,
          occurred_at: context.occurred_at,
          disposition: mode === "courtesy" ? "courtesy" : "charged",
          ...(mode === "courtesy" ? {} : { billing_mode: mode }),
          items: [
            {
              offer_id: selected.id,
              quantity: Number(form.get("quantity")),
              replenishment_quantity: Number(
                form.get("replenishment_quantity"),
              ),
              version_token: selected.version_token,
            },
          ],
          payment_method:
            mode === "hotel_immediate" ? paymentMethod : undefined,
          payment_reference:
            mode === "hotel_immediate"
              ? String(form.get("payment_reference") || "").trim() || undefined
              : undefined,
          partner_receipt_confirmed:
            mode === "partner_direct"
              ? form.get("partner_receipt_confirmed") === "on"
              : undefined,
          courtesy_reason:
            mode === "courtesy"
              ? String(form.get("courtesy_reason") || "").trim()
              : undefined,
          notes: String(form.get("notes") || "").trim() || undefined,
        };
        const signature = JSON.stringify(base);
        const requestKey =
          requestRef.current?.signature === signature
            ? requestRef.current.key
            : crypto.randomUUID();
        requestRef.current = { signature, key: requestKey };
        const completed = await submit(`cycles/${cycleId}/minibar`, {
          ...base,
          idempotency_key: requestKey,
        });
        if (completed) requestRef.current = null;
      }}
    >
      <strong className="sm:col-span-2">
        Conferência financeira do frigobar
      </strong>
      <label className="pms-field sm:col-span-2">
        Item disponível
        <select
          className="pms-field-input"
          value={offerId}
          onChange={(event) => {
            const offer = availableOffers.find(
              (item) => item.id === event.target.value,
            );
            setOfferId(event.target.value);
            const modes = (offer?.allowed_modes || []).filter(
              (item) => item !== "hotel_immediate" || access.canReceivePayment,
            );
            setMode(
              offer?.default_mode && modes.includes(offer.default_mode)
                ? offer.default_mode
                : modes[0] || "",
            );
            requestRef.current = null;
          }}
          required
        >
          {availableOffers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.product_name} — {offer.point_name}
            </option>
          ))}
        </select>
      </label>
      <label className="pms-field">
        Quantidade consumida
        <input
          className="pms-field-input"
          name="quantity"
          type="number"
          min="0.001"
          step="0.001"
          required
        />
      </label>
      <label className="pms-field">
        Quantidade para reposição
        <input
          className="pms-field-input"
          name="replenishment_quantity"
          type="number"
          min="0"
          step="0.001"
          required
        />
      </label>
      <fieldset className="grid gap-1 sm:col-span-2">
        <legend>Forma de cobrança autorizada</legend>
        {allowedModes.map((item) => (
          <label key={item} className="flex gap-2">
            <input
              type="radio"
              checked={mode === item}
              onChange={() => setMode(item)}
            />
            {item === "stay_folio"
              ? "Conta da estadia"
              : item === "hotel_immediate"
                ? "Pagamento imediato"
                : "Pagamento ao parceiro"}
          </label>
        ))}
        {access.canGrantCourtesy ? (
          <label className="flex gap-2">
            <input
              type="radio"
              checked={mode === "courtesy"}
              onChange={() => setMode("courtesy")}
            />
            Cortesia explícita
          </label>
        ) : null}
      </fieldset>
      {mode === "hotel_immediate" ? (
        <>
          <label className="pms-field">
            Meio de pagamento
            <select
              className="pms-field-input"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as ConsumptionPaymentMethod)
              }
            >
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="debit_card">Cartão de débito</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="pms-field">
            Referência
            <input
              className="pms-field-input"
              name="payment_reference"
              maxLength={120}
            />
          </label>
        </>
      ) : null}
      {mode === "partner_direct" ? (
        <label className="flex gap-2 sm:col-span-2">
          <input type="checkbox" name="partner_receipt_confirmed" required />{" "}
          Confirmo o recebimento direto pelo parceiro.
        </label>
      ) : null}
      {mode === "courtesy" ? (
        <label className="pms-field sm:col-span-2">
          Justificativa da cortesia
          <textarea
            className="pms-field-input"
            name="courtesy_reason"
            minLength={3}
            maxLength={1000}
            required
          />
        </label>
      ) : null}
      <label className="pms-field sm:col-span-2">
        Observação
        <textarea className="pms-field-input" name="notes" maxLength={1000} />
      </label>
      <button
        disabled={busy || !selected || !mode}
        className="justify-self-start rounded-lg bg-[#1c6d4e] px-3 py-2 text-white"
      >
        Lançar e vincular à vistoria
      </button>
    </form>
  );
}

export function GovernanceWorkspace({
  initial,
  templates,
  minibarContexts = {},
  access,
  initialRoomId = "",
}: {
  initial: GovernanceBoard;
  templates: GovernanceTemplate[];
  minibarContexts?: Record<string, AdminConsumptionOperationalContext | null>;
  access: Access;
  initialRoomId?: string;
}) {
  const [board, setBoard] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await fetch("/api/governance/board");
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.message || "Falha ao atualizar a governança.");
    setBoard(payload);
  }

  async function request(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/governance/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message || "A ação deixou de ser possível.");
      await reload();
      setMessage("Governança atualizada.");
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Falha na operação.");
      await reload().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function act(
    cycle: GovernanceCycle,
    input: Omit<GovernanceActionInput, "expected_version">,
  ) {
    await request(`cycles/${cycle.id}/actions`, {
      ...input,
      expected_version: cycle.version,
    });
  }

  return (
    <div className="grid gap-4">
      <div
        data-usage-guide="governance-summary"
        className="grid gap-3 sm:grid-cols-4"
      >
        {[
          ["Em giro", board.summary.total],
          ["Críticos", board.summary.critical],
          ["Sem responsável", board.summary.unassigned],
          ["Em inspeção", board.summary.awaiting_inspection],
        ].map(([label, value]) => (
          <div key={String(label)} className="pms-surface-card">
            <span>{label}</span>
            <strong className="block text-2xl">{value}</strong>
          </div>
        ))}
      </div>

      {access.canExecute ? (
        <form
          className="pms-surface-card grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void request("cycles", {
              room_id: String(data.get("room_id") || "").trim(),
              source: "manual",
              note: String(data.get("note") || "").trim() || undefined,
            });
          }}
        >
          <label className="pms-field">
            Quarto para limpeza avulsa
            <select
              className="pms-field-input"
              name="room_id"
              defaultValue={initialRoomId}
              required
            >
              <option value="">Selecione o quarto</option>
              {board.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} — {room.room_type}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Contexto
            <input className="pms-field-input" name="note" maxLength={1000} />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-[#1c6d4e] px-4 py-2 text-white sm:col-span-2 sm:justify-self-start"
          >
            Abrir ciclo
          </button>
        </form>
      ) : null}

      <p role="status" aria-live="polite">
        {message}
      </p>
      {board.items.length === 0 ? (
        <div className="pms-surface-card">
          <p>
            Nenhum quarto em giro. Os quartos sem impedimento estão liberados.
          </p>
        </div>
      ) : null}
      {board.items.map((cycle) => {
        const task = currentTask(cycle);
        return (
          <article
            key={cycle.id}
            className="pms-surface-card grid gap-3"
            data-usage-guide="governance-task"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Quarto {cycle.room_number}
                </h2>
                <p>{statusLabels[cycle.status] || cycle.status}</p>
              </div>
              <div className="text-right">
                <strong>
                  {cycle.severity === "critical"
                    ? "Crítico"
                    : cycle.severity === "warning"
                      ? "Atenção"
                      : "Normal"}
                </strong>
                <p>
                  {cycle.next_arrival_at
                    ? `Próxima chegada: ${new Date(cycle.next_arrival_at).toLocaleString("pt-BR")}`
                    : "Sem próxima chegada"}
                </p>
                <p>
                  Atualizado em{" "}
                  {new Date(cycle.last_updated_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            {task ? (
              <div className="grid gap-3">
                <p>
                  <strong>Próxima ação:</strong>{" "}
                  {task.next_action || taskLabels[task.kind]}
                </p>
                <p>
                  <strong>Responsável:</strong>{" "}
                  {task.assignee_name || "Fila compartilhada"}
                </p>
                {task.checklist.length ? (
                  <form
                    data-usage-guide="governance-checklist"
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const answers = task.checklist.map((item) => ({
                        item_id: item.id,
                        result: String(
                          form.get(`result:${item.id}`) || "approved",
                        ) as "approved" | "rejected" | "not_applicable",
                        notes:
                          String(form.get(`notes:${item.id}`) || "").trim() ||
                          undefined,
                      }));
                      const rejected = answers.some(
                        (answer) => answer.result === "rejected",
                      );
                      const action =
                        task.kind === "inspection"
                          ? rejected
                            ? "reject"
                            : "approve"
                          : "complete";
                      const inspectionNote = String(
                        form.get("inspection_note") || "",
                      ).trim();
                      void act(cycle, {
                        action,
                        task_id: task.id,
                        answers,
                        note:
                          task.kind === "inspection"
                            ? inspectionNote
                            : undefined,
                      });
                    }}
                  >
                    {task.checklist.map((item) => (
                      <fieldset
                        key={item.id}
                        className="rounded-lg border border-[#d2d2d2] p-3"
                      >
                        <legend className="font-medium">
                          {item.label}
                          {item.required ? " *" : ""}
                        </legend>
                        <div className="flex flex-wrap gap-3">
                          <label>
                            <input
                              type="radio"
                              name={`result:${item.id}`}
                              value="approved"
                              defaultChecked
                            />{" "}
                            Conforme
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`result:${item.id}`}
                              value="rejected"
                            />{" "}
                            Reprovar
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`result:${item.id}`}
                              value="not_applicable"
                            />{" "}
                            Não se aplica
                          </label>
                        </div>
                        <label className="pms-field mt-2">
                          Observação
                          <input
                            className="pms-field-input"
                            name={`notes:${item.id}`}
                            maxLength={1000}
                          />
                        </label>
                      </fieldset>
                    ))}
                    {task.kind === "inspection" ? (
                      <label className="pms-field">
                        Observação da inspeção
                        <textarea
                          className="pms-field-input"
                          name="inspection_note"
                          required
                          maxLength={1000}
                        />
                      </label>
                    ) : null}
                    {(task.status === "assigned" ||
                      task.status === "in_progress") &&
                    (task.kind !== "inspection" || access.canInspect) ? (
                      <button
                        disabled={busy}
                        className="justify-self-start rounded-lg bg-[#1c6d4e] px-4 py-2 text-white"
                      >
                        {task.kind === "inspection"
                          ? "Aprovar e liberar"
                          : "Concluir etapa"}
                      </button>
                    ) : null}
                  </form>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {access.canExecute && task.status === "pending" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(cycle, { action: "claim", task_id: task.id })
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      Assumir
                    </button>
                  ) : null}
                  {access.canExecute && task.status === "assigned" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(cycle, { action: "start", task_id: task.id })
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      Iniciar
                    </button>
                  ) : null}
                  {access.canExecute &&
                  task.kind === "replenishment" &&
                  (task.status === "assigned" ||
                    task.status === "in_progress") ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(cycle, {
                          action: "complete",
                          task_id: task.id,
                        })
                      }
                      className="rounded-lg bg-[#1c6d4e] px-3 py-2 text-white"
                    >
                      Concluir reposição
                    </button>
                  ) : null}
                  {cycle.stay_id &&
                  access.canPostConsumption &&
                  !minibarContexts[cycle.id] ? (
                    <p>
                      A conferência financeira só está disponível antes do
                      checkout.
                    </p>
                  ) : null}
                </div>
                {access.canAssign &&
                board.assignable_users.length &&
                task.status !== "completed" &&
                task.status !== "canceled" ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void act(cycle, {
                        action: "assign",
                        task_id: task.id,
                        assigned_to: String(form.get("assigned_to")),
                      });
                    }}
                  >
                    <label className="pms-field">
                      Atribuir responsável
                      <select
                        className="pms-field-input"
                        name="assigned_to"
                        defaultValue={task.assigned_to || ""}
                        required
                      >
                        <option value="">Selecione</option>
                        {board.assignable_users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy}
                      className="rounded-lg border px-3 py-2"
                    >
                      Atribuir
                    </button>
                  </form>
                ) : null}
                {cycle.stay_id &&
                access.canPostConsumption &&
                minibarContexts[cycle.id] ? (
                  <AuthorizedMinibarForm
                    cycleId={cycle.id}
                    context={minibarContexts[cycle.id]!}
                    access={access}
                    busy={busy}
                    submit={request}
                  />
                ) : null}
                {cycle.stay_id &&
                !access.canPostConsumption &&
                board.minibar_options.length ? (
                  <form
                    data-usage-guide="governance-minibar"
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void request(`cycles/${cycle.id}/minibar`, {
                        discrepancy_only: true,
                        idempotency_key: crypto.randomUUID(),
                        notes: String(form.get("notes") || "").trim(),
                        items: [
                          {
                            offer_id: form.get("offer_id"),
                            quantity: Number(form.get("quantity")),
                            replenishment_quantity: Number(
                              form.get("quantity"),
                            ),
                          },
                        ],
                      });
                    }}
                  >
                    <strong className="sm:col-span-2">
                      Achado de frigobar para a recepção
                    </strong>
                    <label className="pms-field">
                      Item
                      <select
                        className="pms-field-input"
                        name="offer_id"
                        required
                      >
                        <option value="">Selecione</option>
                        {board.minibar_options.map((option) => (
                          <option key={option.offer_id} value={option.offer_id}>
                            {option.product_name} — {option.point_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="pms-field">
                      Quantidade
                      <input
                        className="pms-field-input"
                        name="quantity"
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                      />
                    </label>
                    <label className="pms-field sm:col-span-2">
                      Observação para a recepção
                      <textarea
                        className="pms-field-input"
                        name="notes"
                        required
                        maxLength={1000}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="justify-self-start rounded-lg border px-3 py-2"
                    >
                      Registrar divergência
                    </button>
                  </form>
                ) : null}
                {access.canExecute && board.maintenance_categories.length ? (
                  <form
                    data-usage-guide="governance-defect"
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const blocking = form.get("blocking") === "on";
                      void request(`cycles/${cycle.id}/defects`, {
                        category_id: form.get("category_id"),
                        kind: form.get("kind"),
                        priority: form.get("priority"),
                        description: String(
                          form.get("description") || "",
                        ).trim(),
                        blocking,
                        block_end_date: blocking
                          ? form.get("block_end_date")
                          : undefined,
                        conflict_acknowledgement: blocking
                          ? String(
                              form.get("conflict_acknowledgement") || "",
                            ).trim() || undefined
                          : undefined,
                      });
                    }}
                  >
                    <strong className="sm:col-span-2">
                      Registrar avaria do quarto
                    </strong>
                    <label className="pms-field">
                      Categoria
                      <select
                        className="pms-field-input"
                        name="category_id"
                        required
                      >
                        {board.maintenance_categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="pms-field">
                      Prioridade
                      <select className="pms-field-input" name="priority">
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="critical">Crítica</option>
                        <option value="low">Baixa</option>
                      </select>
                    </label>
                    <label className="pms-field sm:col-span-2">
                      Descrição
                      <textarea
                        className="pms-field-input"
                        name="description"
                        required
                        maxLength={2000}
                      />
                    </label>
                    <label>
                      <input type="checkbox" name="blocking" /> Avaria
                      impeditiva
                    </label>
                    <label className="pms-field">
                      Previsão de fim do bloqueio
                      <input
                        className="pms-field-input"
                        name="block_end_date"
                        type="date"
                      />
                    </label>
                    <input type="hidden" name="kind" value="defect" />
                    <label className="pms-field sm:col-span-2">
                      Ciência sobre reservas conflitantes
                      <textarea
                        className="pms-field-input"
                        name="conflict_acknowledgement"
                        maxLength={1000}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="justify-self-start rounded-lg border px-3 py-2"
                    >
                      Registrar avaria
                    </button>
                  </form>
                ) : null}
                {access.canExecute || access.canAssign ? (
                  <form
                    data-usage-guide="governance-handoff"
                    className="grid gap-2 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void act(cycle, {
                        action: "handoff_note",
                        task_id: task.id,
                        note: String(form.get("note") || "").trim(),
                        next_action: String(
                          form.get("next_action") || "",
                        ).trim(),
                      });
                    }}
                  >
                    <label className="pms-field">
                      Nota para o próximo turno
                      <input
                        className="pms-field-input"
                        name="note"
                        required
                        maxLength={1000}
                      />
                    </label>
                    <label className="pms-field">
                      Próxima ação
                      <input
                        className="pms-field-input"
                        name="next_action"
                        required
                        maxLength={500}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="justify-self-start rounded-lg border px-3 py-2"
                    >
                      Registrar passagem
                    </button>
                  </form>
                ) : null}
                {cycle.events.length ? (
                  <details>
                    <summary className="cursor-pointer font-medium">
                      Histórico do ciclo
                    </summary>
                    <ol className="mt-2 grid gap-2">
                      {cycle.events.map((event) => (
                        <li key={event.id} className="rounded-lg border p-2">
                          <strong>
                            {eventLabels[event.action] ||
                              `Evento: ${event.action.replaceAll("_", " ")}`}
                          </strong>
                          <span>
                            {" "}
                            ·{" "}
                            {new Date(event.created_at).toLocaleString("pt-BR")}
                          </span>
                          {event.actor_name ? (
                            <span> · {event.actor_name}</span>
                          ) : null}
                          {event.message ? <p>{event.message}</p> : null}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            ) : (
              <p>Aguardando a manutenção liberar o quarto para inspeção.</p>
            )}
          </article>
        );
      })}

      {access.canManageTemplates ? (
        <section className="pms-surface-card grid gap-3">
          <h2 className="text-lg font-semibold">Modelos de checklist</h2>
          <ul>
            {templates
              .filter((item) => item.is_active)
              .map((item) => (
                <li key={item.id}>
                  {taskLabels[item.kind]} — versão {item.version}: {item.name}
                </li>
              ))}
          </ul>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const items = String(form.get("items") || "")
                .split(/\r?\n/)
                .map((label) => label.trim())
                .filter(Boolean)
                .map((label) => ({ label, required: true }));
              void request("checklist-templates", {
                kind: form.get("kind"),
                name: String(form.get("name") || "").trim(),
                items,
              });
            }}
          >
            <label className="pms-field">
              Etapa
              <select className="pms-field-input" name="kind">
                <option value="departure_review">Conferência de saída</option>
                <option value="cleaning">Limpeza</option>
                <option value="inspection">Inspeção</option>
              </select>
            </label>
            <label className="pms-field">
              Nome da versão
              <input
                className="pms-field-input"
                name="name"
                required
                maxLength={120}
              />
            </label>
            <label className="pms-field">
              Itens, um por linha
              <textarea
                className="pms-field-input"
                name="items"
                required
                rows={5}
              />
            </label>
            <button
              disabled={busy}
              className="justify-self-start rounded-lg bg-[#1c6d4e] px-4 py-2 text-white"
            >
              Ativar nova versão
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
