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
        placeholder="Provedor"
        required
      />
      <input
        className="pms-field-input"
        name="code"
        placeholder="Código"
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
        <output
          className="pms-field-input md:col-span-3"
          aria-label="Segredo do canal"
        >
          {state.secret}
        </output>
      ) : null}
    </form>
  );
}
