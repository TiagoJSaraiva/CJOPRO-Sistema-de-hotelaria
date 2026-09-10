"use client";
import { useState } from "react";
import type {
  AdminMaintenanceOccurrenceSummary,
  AdminMaintenanceReferenceData,
} from "@hotel/shared";
import { useModalFocus } from "../../_components/useModalFocus";

const occurrenceLabels: Record<string, string> = {
  reported: "Relatada",
  triaged: "Triada",
  in_progress: "Em andamento",
  awaiting_inspection: "Aguardando inspeção",
  awaiting_liability: "Aguardando apuração",
  resolved: "Resolvida",
  canceled: "Cancelada",
};

export type MaintenanceDecision = {
  title: string;
  path: string;
  body: Record<string, unknown>;
  field: "notes" | "reason";
  diagnose?: boolean;
  wait?: boolean;
  assign?: boolean;
  duplicate?: boolean;
};
export function MaintenanceDecisionDialog({
  decision,
  occurrenceId,
  occurrenceCode,
  referenceData,
  submit,
  close,
}: {
  decision: MaintenanceDecision;
  occurrenceId: string;
  occurrenceCode: string;
  referenceData: AdminMaintenanceReferenceData;
  submit: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  close: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AdminMaintenanceOccurrenceSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const ref = useModalFocus<HTMLElement>(true, () => {
    if (!pending) close();
  });
  async function search(params: string, nextPage = 1) {
    setPending(true);
    setError("");
    setSelected("");
    try {
      const response = await fetch(
        `/api/maintenance/occurrences?${params}&page=${nextPage}&page_size=20&canonical=true`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Falha na busca.");
      setItems(
        result.items.filter(
          (item: AdminMaintenanceOccurrenceSummary) => item.id !== occurrenceId,
        ),
      );
      setPage(nextPage);
      setTotal(result.total);
      setQuery(params);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na busca.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-decision-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5"
      >
        <h2 id="maintenance-decision-title">{decision.title}</h2>
        {(decision.body.action === "cancel" ||
          decision.path.endsWith("/cancel")) && (
          <p>
            O cancelamento encerra este atendimento e registra seu motivo no
            histórico. Cobranças existentes continuam sujeitas às regras
            financeiras.
          </p>
        )}
        {decision.body.result === "rejected" && (
          <p>
            Explique o que ainda precisa ser corrigido. A reprovação devolve o
            serviço à execução.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {decision.duplicate && (
          <>
            <p>
              Origem: {occurrenceCode}. O vínculo preserva ordens, cobranças e
              evidências em suas ocorrências originais.
            </p>
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const params = new URLSearchParams();
                data.forEach((value, key) => {
                  if (value) params.set(key, String(value));
                });
                void search(params.toString());
              }}
            >
              <label className="pms-field">
                Buscar código ou descrição
                <input name="search" className="pms-field-input" />
              </label>
              <label className="pms-field">
                Quarto
                <select name="room_id" className="pms-field-input">
                  <option value="">Todos</option>
                  {referenceData.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Área ou equipamento
                <select name="location_id" className="pms-field-input">
                  <option value="">Todos</option>
                  {referenceData.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Situação
                <select name="status" className="pms-field-input">
                  <option value="">Todas</option>
                  <option value="reported">Relatada</option>
                  <option value="triaged">Triada</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="awaiting_inspection">
                    Aguardando inspeção
                  </option>
                  <option value="awaiting_liability">
                    Aguardando apuração
                  </option>
                  <option value="resolved">Resolvida</option>
                  <option value="canceled">Cancelada</option>
                </select>
              </label>
              <label className="pms-field">
                Desde
                <input
                  type="date"
                  name="created_from"
                  className="pms-field-input"
                />
              </label>
              <label className="pms-field">
                Até
                <input
                  type="date"
                  name="created_to"
                  className="pms-field-input"
                />
              </label>
              <button
                disabled={pending}
                className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
              >
                Buscar ocorrências
              </button>
            </form>
            <div className="my-3 grid gap-2">
              {items.map((item) => (
                <label key={item.id} className="rounded border p-3">
                  <input
                    type="radio"
                    name="destination"
                    checked={selected === item.id}
                    onChange={() => setSelected(item.id)}
                  />{" "}
                  {item.code} · {item.description} ·{" "}
                  {item.room_number || item.location_name} ·{" "}
                  {occurrenceLabels[item.status]} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}{" "}
                  <a
                    href={`/dashboard/maintenance/occurrences/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Comparar detalhes
                  </a>
                </label>
              ))}
              {!items.length && (
                <p>Nenhuma ocorrência selecionável. Use a busca.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                disabled={pending || page === 1}
                onClick={() => void search(query, page - 1)}
              >
                Anterior
              </button>
              <span>Página {page}</span>
              <button
                disabled={pending || page * 20 >= total}
                onClick={() => void search(query, page + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const body = { ...decision.body };
            data.forEach((value, key) => {
              body[key] = String(value).trim();
            });
            if (body.next_follow_up_at)
              body.next_follow_up_at = new Date(
                String(body.next_follow_up_at),
              ).toISOString();
            const minimum =
              decision.field === "reason" || decision.path.endsWith("/inspect")
                ? 3
                : 1;
            if (
              !decision.assign &&
              String(body[decision.field] || "").length < minimum
            ) {
              setError("Informe uma justificativa real.");
              return;
            }
            if (decision.diagnose && !body.diagnosis) {
              setError("Informe o diagnóstico.");
              return;
            }
            if (decision.duplicate) {
              if (!selected) {
                setError("Selecione a ocorrência de destino.");
                return;
              }
              body.duplicate_of_id = selected;
            }
            setPending(true);
            const ok = await submit(decision.path, body);
            setPending(false);
            if (ok) close();
            else
              setError(
                "Não foi possível concluir. Confira a mensagem do atendimento e revise os dados.",
              );
          }}
        >
          {decision.assign && (
            <label className="pms-field">
              Responsável
              <select name="assigned_to" required className="pms-field-input">
                <option value="">Selecione</option>
                {referenceData.assignable_users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {decision.wait && (
            <>
              <label className="pms-field">
                Motivo da espera
                <select
                  name="waiting_reason"
                  required
                  className="pms-field-input"
                >
                  <option value="">Selecione</option>
                  <option value="parts">Peça</option>
                  <option value="vendor">Fornecedor</option>
                  <option value="authorization">Autorização</option>
                  <option value="access">Acesso ao quarto</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <label className="pms-field">
                Responsável interno pelo desbloqueio
                <select
                  name="waiting_owner_id"
                  required
                  className="pms-field-input"
                >
                  <option value="">Selecione</option>
                  {referenceData.assignable_users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Próxima cobrança
                <input
                  name="next_follow_up_at"
                  type="datetime-local"
                  required
                  className="pms-field-input"
                />
              </label>
            </>
          )}
          {decision.diagnose && (
            <label className="pms-field">
              Diagnóstico
              <textarea
                name="diagnosis"
                required
                maxLength={4000}
                className="pms-field-input"
              />
            </label>
          )}
          {!decision.assign && (
            <label className="pms-field">
              {decision.diagnose
                ? "Serviço realizado"
                : "Justificativa / observação"}
              <textarea
                name={decision.field}
                required
                maxLength={2000}
                className="pms-field-input"
              />
            </label>
          )}
          {decision.duplicate && selected && (
            <p>
              Confirmar vínculo de {occurrenceCode} com{" "}
              {items.find((item) => item.id === selected)?.code}.
            </p>
          )}
          <div className="flex gap-3">
            <button
              disabled={pending}
              type="submit"
              className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
            >
              Confirmar decisão
            </button>
            <button disabled={pending} type="button" onClick={close}>
              Voltar sem alterar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
