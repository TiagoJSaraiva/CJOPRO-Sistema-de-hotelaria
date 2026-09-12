"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Config = {
  hotel: { name: string; city?: string; currency: string };
  configuration: {
    introduction?: string;
    terms: string;
    consent_version: string;
    guarantee_instructions?: string;
  };
};
type QuoteItem = {
  id: string;
  room_index: number;
  room_type: string;
  plan_name?: string;
  plan_kind?: string;
  rate_plan_version_id: string;
  available_count: number;
  total: number;
  nightly: Array<{ date: string; final: number }>;
  guarantee?: { type: string; value: number };
  cancellation?: { type: string; value: number; cutoff_hours: number };
  benefit_plan_version_id?: string;
};
type Quote = {
  quote_id: string;
  fingerprint: string;
  expires_at: string;
  currency: string;
  items: QuoteItem[];
};
const api = process.env.NEXT_PUBLIC_BOOKING_API_URL || "http://localhost:3333";

export function BookingJourney({ slug }: { slug: string }) {
  const [config, setConfig] = useState<Config>();
  const [quote, setQuote] = useState<Quote>();
  const [selected, setSelected] = useState<Record<number, QuoteItem>>({});
  const [message, setMessage] = useState("");
  const holdAttempt = useRef<{ fingerprint: string; key: string } | undefined>(
    undefined,
  );
  const tomorrow = useMemo(
    () => new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    [],
  );
  useEffect(() => {
    fetch(`${api}/public/hotels/${slug}/booking-config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConfig)
      .catch(() =>
        setMessage("Este hotel não está disponível para reservas diretas."),
      );
  }, [slug]);
  async function quoteStay(form: FormData) {
    setMessage("Consultando disponibilidade…");
    const roomCount = Number(form.get("rooms"));
    const response = await fetch(`${api}/public/hotels/${slug}/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkin_date: form.get("checkin"),
        checkout_date: form.get("checkout"),
        rooms: Array.from({ length: roomCount }, () => ({
          adults: Number(form.get("adults")),
          children: Number(form.get("children")),
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok)
      return setMessage(
        "A disponibilidade mudou. Revise as datas e tente novamente.",
      );
    setQuote(body);
    setSelected({});
    setMessage("");
  }
  async function createHold(form: FormData) {
    if (!quote || !config) return;
    setMessage("Criando sua pré-reserva…");
    const selections = Object.values(selected).sort(
      (a, b) => a.room_index - b.room_index,
    );
    const fingerprint = JSON.stringify([
      quote.quote_id,
      selections.map((item) => item.id),
      form.get("name"),
      form.get("email"),
      form.get("phone"),
    ]);
    if (!holdAttempt.current || holdAttempt.current.fingerprint !== fingerprint)
      holdAttempt.current = { fingerprint, key: crypto.randomUUID() };
    const response = await fetch(`${api}/public/hotels/${slug}/holds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quote_id: quote.quote_id,
        quote_fingerprint: quote.fingerprint,
        idempotency_key: holdAttempt.current.key,
        contact_name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone") || undefined,
        consent_version: config.configuration.consent_version,
        selections: selections.map((item) => ({
          quote_item_id: item.id,
          room_type: item.room_type,
          rate_plan_version_id: item.rate_plan_version_id,
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok)
      return setMessage(
        "A cotação expirou ou o inventário mudou. Faça uma nova consulta.",
      );
    setMessage(
      `Pré-reserva ${body.reservation_code} criada. Prazo: ${new Date(body.expires_at).toLocaleString("pt-BR")}. Guarde o acesso: /pre-chegada/${body.access_token}`,
    );
  }
  if (!config)
    return (
      <main className="shell">
        <p role="status">{message || "Carregando hotel…"}</p>
      </main>
    );
  const roomIndexes = quote
    ? [...new Set(quote.items.map((item) => item.room_index))]
    : [];
  const selectionComplete =
    roomIndexes.length > 0 && roomIndexes.every((index) => selected[index]);
  return (
    <main className="shell">
      <header>
        <p className="eyebrow">{config.hotel.city || "Reserva direta"}</p>
        <h1>{config.hotel.name}</h1>
        <p>{config.configuration.introduction}</p>
      </header>
      <section className="card">
        <h2>1. Período e ocupação</h2>
        <form action={quoteStay} className="grid">
          <label>
            Chegada
            <input name="checkin" type="date" min={tomorrow} required />
          </label>
          <label>
            Saída
            <input name="checkout" type="date" min={tomorrow} required />
          </label>
          <label>
            Acomodações
            <input
              name="rooms"
              type="number"
              min="1"
              max="20"
              defaultValue="1"
              required
            />
          </label>
          <label>
            Adultos por acomodação
            <input
              name="adults"
              type="number"
              min="1"
              max="20"
              defaultValue="2"
              required
            />
          </label>
          <label>
            Crianças por acomodação
            <input
              name="children"
              type="number"
              min="0"
              max="20"
              defaultValue="0"
              required
            />
          </label>
          <button type="submit">Consultar categorias</button>
        </form>
      </section>
      {quote && (
        <section className="card">
          <h2>2. Compare as opções</h2>
          <p>
            A cotação vale até{" "}
            {new Date(quote.expires_at).toLocaleTimeString("pt-BR")}.
          </p>
          {roomIndexes.map((roomIndex) => (
            <div key={roomIndex}>
              <h3>Acomodação {roomIndex}</h3>
              <div className="options">
                {quote.items
                  .filter((item) => item.room_index === roomIndex)
                  .map((item) => (
                    <label
                      className={
                        selected[roomIndex]?.id === item.id
                          ? "option selected"
                          : "option"
                      }
                      key={item.id}
                    >
                      <input
                        type="radio"
                        name={`option-${roomIndex}`}
                        onChange={() =>
                          setSelected((current) => ({
                            ...current,
                            [roomIndex]: item,
                          }))
                        }
                      />
                      <strong>{item.room_type}</strong>
                      <span>{item.plan_name || item.plan_kind}</span>
                      <span>
                        Garantia: {item.guarantee?.type || "sem garantia"} ·
                        Cancelamento:{" "}
                        {item.cancellation?.type || "sem penalidade"}
                      </span>
                      {item.benefit_plan_version_id ? (
                        <span>Inclui benefícios de hospedagem</span>
                      ) : null}
                      <b>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: quote.currency,
                        }).format(item.total)}
                      </b>
                      <small>{item.available_count} disponível(is)</small>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {selectionComplete && (
        <section className="card">
          <h2>3. Contato e pré-reserva</h2>
          <form action={createHold} className="grid">
            <label>
              Nome completo
              <input name="name" required minLength={2} />
            </label>
            <label>
              E-mail
              <input name="email" type="email" required />
            </label>
            <label>
              Telefone
              <input name="phone" />
            </label>
            <label className="consent">
              <input name="consent" type="checkbox" required /> Li e aceito os
              termos: {config.configuration.terms}
            </label>
            <button type="submit">Criar pré-reserva</button>
          </form>
          <p>{config.configuration.guarantee_instructions}</p>
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
