"use client";

import { useEffect, useState } from "react";

const api = process.env.NEXT_PUBLIC_BOOKING_API_URL || "http://localhost:3333";
type Access = {
  reservation: {
    reservation_code: string;
    version: number;
    lifecycle_status: string;
  };
  accommodations: Array<{
    id: string;
    room_type: string;
    checkin_date: string;
    checkout_date: string;
  }>;
  requests: unknown[];
};

export function PrearrivalJourney({ token }: { token: string }) {
  const [access, setAccess] = useState<Access>();
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch(`${api}/public/booking-access/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAccess)
      .catch(() =>
        setMessage("Este link é inválido, expirou ou foi substituído."),
      );
  }, [token]);
  async function submit(form: FormData) {
    setMessage("Salvando dados…");
    const response = await fetch(
      `${api}/public/booking-access/${token}/prearrival`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expected_version: access?.reservation.version,
          arrival_time: form.get("arrival_time") || undefined,
          primary_guest: {
            full_name: form.get("name"),
            document_type: form.get("document_type"),
            document_number: form.get("document_number"),
            birth_date: form.get("birth_date"),
          },
          requests: form.get("request")
            ? [
                {
                  category: form.get("request_category"),
                  description: form.get("request"),
                },
              ]
            : [],
        }),
      },
    );
    if (!response.ok)
      return setMessage(
        "A reserva mudou desde a abertura. Recarregue e revise antes de reenviar.",
      );
    setMessage(
      "Pré-chegada registrada. A equipe revisará pedidos especiais antes de confirmá-los.",
    );
  }
  async function requestChange(form: FormData) {
    const response = await fetch(
      `${api}/public/booking-access/${token}/change-requests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: form.get("type"),
          description: form.get("description"),
        }),
      },
    );
    setMessage(
      response.ok
        ? "Solicitação enviada para análise da equipe. A reserva ainda não foi alterada."
        : "Não foi possível registrar a solicitação.",
    );
  }
  if (!access)
    return (
      <main className="shell">
        <p role="status">{message || "Abrindo pré-chegada…"}</p>
      </main>
    );
  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Pré-chegada segura</p>
        <h1>Reserva {access.reservation.reservation_code}</h1>
        {access.accommodations.map((item) => (
          <p key={item.id}>
            {item.room_type}: {item.checkin_date} a {item.checkout_date}
          </p>
        ))}
      </header>
      <section className="card">
        <h2>Complete os dados de chegada</h2>
        <form action={submit} className="grid">
          <label>
            Horário previsto
            <input type="time" name="arrival_time" />
          </label>
          <label>
            Nome completo
            <input name="name" required />
          </label>
          <label>
            Tipo do documento
            <input name="document_type" required />
          </label>
          <label>
            Número do documento
            <input name="document_number" required />
          </label>
          <label>
            Nascimento
            <input name="birth_date" type="date" required />
          </label>
          <label>
            Pedido especial
            <select name="request_category">
              <option value="accessibility">Acessibilidade</option>
              <option value="room_preference">Preferência de quarto</option>
              <option value="food">Alimentação</option>
              <option value="celebration">Celebração</option>
              <option value="service">Serviço</option>
              <option value="other">Outro</option>
            </select>
            <input
              name="request"
              placeholder="Opcional; depende de confirmação"
            />
          </label>
          <button type="submit">Salvar pré-chegada</button>
        </form>
      </section>
      <section className="card">
        <h2>Solicitar mudança ou cancelamento</h2>
        <p>A solicitação só produz efeito após análise da equipe.</p>
        <form action={requestChange} className="grid">
          <label>
            Tipo
            <select name="type">
              <option value="amendment">Alteração</option>
              <option value="cancellation">Cancelamento</option>
            </select>
          </label>
          <label>
            O que precisa mudar?
            <input name="description" minLength={3} required />
          </label>
          <button type="submit">Enviar para análise</button>
        </form>
      </section>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
