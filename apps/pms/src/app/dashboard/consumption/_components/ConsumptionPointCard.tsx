"use client";

import type { AdminConsumptionPoint } from "@hotel/shared";
import {
  archiveConsumptionPointAction,
  reorderConsumptionPointsAction,
  updateConsumptionPointAction,
} from "../actions";
import { BillingModeFields, billingModeLabel } from "./BillingModeFields";

export function ConsumptionPointCard({
  point,
  orderedIds,
  index,
  canManage,
}: {
  point: AdminConsumptionPoint;
  orderedIds: string[];
  index: number;
  canManage: boolean;
}) {
  const confirmImpact = (event: React.FormEvent<HTMLFormElement>) => {
    if (
      point.inherited_offers_count > 0 &&
      !window.confirm(
        `Esta alteração pode afetar ${point.inherited_offers_count} oferta(s) que herdam a política. Deseja continuar?`,
      )
    )
      event.preventDefault();
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold text-slate-900">
            {point.name}
          </h2>
          <p className="m-0 text-sm text-slate-600">
            {point.internal_code || "Sem código"} · {point.offers_count}{" "}
            oferta(s) · {point.is_active ? "Ativo" : "Inativo"}
            {point.archived_at ? " · Arquivado" : ""}
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          Padrão: {billingModeLabel(point.default_policy.default_mode)}
        </span>
      </header>
      <p className="text-sm text-slate-700">
        {point.description || "Sem descrição."}
      </p>
      {canManage ? (
        <div className="grid gap-3">
          {!point.archived_at ? (
            <form
              action={updateConsumptionPointAction}
              onSubmit={confirmImpact}
              className="grid gap-3"
            >
              <input type="hidden" name="id" value={point.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="pms-field">
                  Nome
                  <input
                    name="name"
                    required
                    defaultValue={point.name}
                    className="pms-field-input"
                  />
                </label>
                <label className="pms-field">
                  Código interno
                  <input
                    name="internal_code"
                    defaultValue={point.internal_code || ""}
                    className="pms-field-input"
                  />
                </label>
              </div>
              <label className="pms-field">
                Descrição
                <textarea
                  name="description"
                  maxLength={1000}
                  defaultValue={point.description || ""}
                  className="pms-field-input"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={point.is_active}
                />{" "}
                Ponto ativo
              </label>
              <BillingModeFields
                allowedModes={point.default_policy.allowed_modes}
                defaultMode={point.default_policy.default_mode}
                prefix={point.id}
              />
              <button type="submit" className="pms-button-primary">
                Salvar ponto
              </button>
            </form>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!point.archived_at ? (
              <>
                <form action={reorderConsumptionPointsAction}>
                  <input
                    type="hidden"
                    name="ids"
                    value={orderedIds.join(",")}
                  />
                  <input type="hidden" name="id" value={point.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    className="pms-button-secondary"
                  >
                    Subir
                  </button>
                </form>
                <form action={reorderConsumptionPointsAction}>
                  <input
                    type="hidden"
                    name="ids"
                    value={orderedIds.join(",")}
                  />
                  <input type="hidden" name="id" value={point.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === orderedIds.length - 1}
                    className="pms-button-secondary"
                  >
                    Descer
                  </button>
                </form>
              </>
            ) : null}
            <form action={archiveConsumptionPointAction}>
              <input type="hidden" name="id" value={point.id} />
              <input
                type="hidden"
                name="archived"
                value={point.archived_at ? "false" : "true"}
              />
              <button type="submit" className="pms-button-secondary">
                {point.archived_at ? "Restaurar" : "Arquivar"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}
