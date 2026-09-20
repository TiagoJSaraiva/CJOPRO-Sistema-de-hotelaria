"use client";

import { useState } from "react";
import { ContextHelp } from "../_components/ContextHelp";
import { createCashRegisterAction } from "./actions";

export function CashRegisterCreateForm({
  consumptionPoints,
}: {
  consumptionPoints: Array<{ id: string; name: string }>;
}) {
  const [kind, setKind] = useState<"reception" | "consumption">("reception");
  return (
    <form
      action={createCashRegisterAction}
      className="grid gap-3 md:grid-cols-4"
    >
      <label className="pms-field">
        Nome
        <input
          className="pms-field-input"
          name="name"
          placeholder="Caixa da recepção"
          required
        />
      </label>
      <label className="pms-field">
        Código
        <input
          className="pms-field-input"
          name="code"
          placeholder="REC-01"
          required
        />
      </label>
      <label className="pms-field">
        Tipo
        <select
          className="pms-field-input"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="reception">Recepção</option>
          <option value="consumption">Ponto de consumo</option>
        </select>
      </label>
      {kind === "consumption" ? (
        <label className="pms-field">
          Ponto de consumo
          <select
            className="pms-field-input"
            name="consumption_point_id"
            required
          >
            <option value="">Selecione</option>
            {consumptionPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="pms-field">
        Moeda
        <input
          className="pms-field-input"
          name="currency"
          defaultValue="BRL"
          required
        />
      </label>
      <label className="pms-field">
        <span>
          Tolerância{" "}
          <ContextHelp label="tolerância do caixa">
            É a diferença máxima entre o dinheiro esperado e contado que pode
            encerrar a sessão sem aprovação de outra pessoa.
          </ContextHelp>
        </span>
        <input
          className="pms-field-input"
          name="difference_tolerance"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          required
        />
      </label>
      <button className="pms-button-primary md:col-span-4 md:w-fit">
        Cadastrar caixa
      </button>
    </form>
  );
}
