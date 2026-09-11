"use client";

import { useState, useTransition } from "react";
import type {
  AdminConsumptionEligibleStay,
  AdminConsumptionOperationalContext,
  ConsumptionServiceAction,
  ConsumptionServiceStatus,
} from "@hotel/shared";
import { actServiceOrderAction, createServiceOrderAction } from "./actions";

type Order = {
  id: string;
  status: ConsumptionServiceStatus;
  version: number;
  room_number?: string;
  point_name?: string;
  guest_name?: string;
  mode: "restaurant" | "room_service";
  expected_at?: string | null;
  gross_amount: number;
  responsible_id?: string | null;
};

const labels: Record<ConsumptionServiceStatus, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export function ConsumptionServiceWorkspace({
  items,
  stays,
  context,
  selectedStayId,
  canManage,
  canCancel,
}: {
  items: Order[];
  stays: AdminConsumptionEligibleStay[];
  context: AdminConsumptionOperationalContext | null;
  selectedStayId?: string;
  canManage: boolean;
  canCancel: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const actionable = (
    order: Order,
  ): ConsumptionServiceAction["action"] | null =>
    order.status === "received"
      ? "start_preparing"
      : order.status === "preparing"
        ? "mark_ready"
        : order.status === "ready"
          ? "deliver"
          : null;

  return (
    <div className="grid gap-5">
      {canManage ? (
        <section
          className="pms-surface-card grid gap-3"
          data-usage-guide="consumption-service-receive"
        >
          <div>
            <h2 className="m-0 text-xl">Receber pedido</h2>
            <p className="mb-0 text-sm text-slate-600">
              A reserva nasce no recebimento; a cobrança e a baixa definitiva
              acontecem na entrega.
            </p>
          </div>
          <form
            className="grid gap-3 md:grid-cols-2"
            action={(formData) => {
              const offer = context?.offers.find(
                (candidate) => candidate.id === formData.get("offer_id"),
              );
              if (!context || !offer || !selectedStayId) return;
              startTransition(async () => {
                const result = await createServiceOrderAction({
                  stay_id: selectedStayId,
                  point_id: offer.point_id,
                  mode: formData.get("mode") as "restaurant" | "room_service",
                  expected_at:
                    String(formData.get("expected_at") || "") || undefined,
                  notes: String(formData.get("notes") || "") || undefined,
                  idempotency_key: crypto.randomUUID(),
                  items: [
                    {
                      offer_id: offer.id,
                      quantity: Number(formData.get("quantity")),
                      billing_mode: "stay_folio",
                    },
                  ],
                });
                setMessage(
                  result.ok ? "Pedido recebido e reservado." : result.error,
                );
              });
            }}
          >
            <label className="pms-field-label">
              Estadia
              <select
                className="pms-field-input"
                name="stay_id"
                value={selectedStayId}
                onChange={(event) => {
                  window.location.href = `?stay_id=${event.target.value}`;
                }}
              >
                {stays.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    Quarto {stay.room_number} · {stay.primary_guest_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field-label">
              Modo
              <select className="pms-field-input" name="mode">
                <option value="restaurant">Restaurante</option>
                <option value="room_service">Serviço de quarto</option>
              </select>
            </label>
            <label className="pms-field-label">
              Item
              <select className="pms-field-input" name="offer_id" required>
                {context?.offers
                  .filter((offer) => offer.allowed_modes.includes("stay_folio"))
                  .map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.product_name} · {offer.unit_price.toFixed(2)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="pms-field-label">
              Quantidade
              <input
                className="pms-field-input"
                name="quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <label className="pms-field-label">
              Previsão
              <input
                className="pms-field-input"
                name="expected_at"
                type="datetime-local"
              />
            </label>
            <label className="pms-field-label">
              Observações
              <input
                className="pms-field-input"
                name="notes"
                maxLength={1000}
              />
            </label>
            <button
              className="pms-button-primary md:col-span-2"
              disabled={pending || !context}
              type="submit"
            >
              {pending ? "Registrando…" : "Receber pedido"}
            </button>
          </form>
        </section>
      ) : null}

      {message ? (
        <p role="status" className="pms-status-info">
          {message}
        </p>
      ) : null}
      <section
        className="pms-surface-card grid gap-3"
        data-usage-guide="consumption-service-board"
      >
        <div>
          <h2 className="m-0 text-xl">Fila operacional</h2>
          <p className="mb-0 text-sm text-slate-600">
            Pedidos ativos primeiro, ordenados pela previsão.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((order) => {
            const action = actionable(order);
            return (
              <article
                key={order.id}
                className="rounded-xl border border-slate-200 p-4"
                data-usage-guide={
                  order.status === "ready"
                    ? "consumption-service-delivery"
                    : undefined
                }
              >
                <div className="flex justify-between gap-2">
                  <strong>Quarto {order.room_number || "—"}</strong>
                  <span className="pms-badge">{labels[order.status]}</span>
                </div>
                <p className="text-sm">
                  {order.point_name} ·{" "}
                  {order.mode === "room_service"
                    ? "Serviço de quarto"
                    : "Restaurante"}
                </p>
                <p className="text-sm">
                  Total reservado: R$ {Number(order.gross_amount).toFixed(2)}
                </p>
                {order.expected_at ? (
                  <p className="text-sm">
                    Previsão:{" "}
                    {new Date(order.expected_at).toLocaleString("pt-BR")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {canManage && action ? (
                    <button
                      className="pms-button-primary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await actServiceOrderAction(order.id, {
                            action,
                            expected_version: order.version,
                            ...(action === "deliver"
                              ? { idempotency_key: crypto.randomUUID() }
                              : {}),
                          });
                          setMessage(
                            result.ok ? "Pedido atualizado." : result.error,
                          );
                        })
                      }
                    >
                      {action === "start_preparing"
                        ? "Iniciar preparo"
                        : action === "mark_ready"
                          ? "Marcar pronto"
                          : "Confirmar entrega"}
                    </button>
                  ) : null}
                  {canCancel &&
                  !["delivered", "canceled"].includes(order.status) ? (
                    <button
                      className="pms-button-secondary"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt("Motivo do cancelamento");
                        if (!reason) return;
                        startTransition(async () =>
                          setMessage(
                            (
                              await actServiceOrderAction(order.id, {
                                action: "cancel",
                                expected_version: order.version,
                                reason,
                              })
                            ).error || "Pedido cancelado e reservas liberadas.",
                          ),
                        );
                      }}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!items.length ? <p>Nenhum pedido encontrado.</p> : null}
        </div>
      </section>
    </div>
  );
}
