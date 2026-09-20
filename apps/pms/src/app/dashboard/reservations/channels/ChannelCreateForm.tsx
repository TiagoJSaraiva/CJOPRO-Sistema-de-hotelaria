"use client";

import { useActionState } from "react";
import { createBookingChannelWithSecretAction } from "../stage6Actions";

export function ChannelCreateForm() {
  const [state, action, pending] = useActionState(
    createBookingChannelWithSecretAction,
    { message: "", secret: undefined },
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <input
        className="pms-field-input"
        name="name"
        placeholder="HospedaLink Sandbox"
        required
      />
      <input
        className="pms-field-input"
        name="code"
        placeholder="HOSPEDALINK-AURORA"
        required
      />
      <button className="pms-button-primary" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar conexão"}
      </button>
      {state.message ? (
        <p role="status" className="md:col-span-3">
          {state.message}
        </p>
      ) : null}
      {state.secret ? (
        <div className="md:col-span-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <strong>Copie agora: este segredo aparece uma única vez.</strong>
          <output
            className="mt-2 block break-all font-mono"
            aria-label="Segredo do canal"
          >
            {state.secret}
          </output>
        </div>
      ) : null}
    </form>
  );
}
