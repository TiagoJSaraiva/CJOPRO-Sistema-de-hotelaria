"use client";

import { useState } from "react";
import type {
  AdminItemResponse,
  AdminMaintenanceCostItem,
  AdminMaintenanceFinanceOccurrence,
  AdminMaintenanceRecovery,
  AdminMaintenanceSupplier,
} from "@hotel/shared";
import { ContextHelp } from "../../_components/ContextHelp";

type Props = {
  occurrenceId: string;
  stayId: string | null;
  initial: AdminMaintenanceFinanceOccurrence;
  canPropose: boolean;
  suppliers?: AdminMaintenanceSupplier[];
};

function format(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    value,
  );
}

export function MaintenanceOccurrenceFinancePanel({
  occurrenceId,
  stayId,
  initial,
  canPropose,
  suppliers = [],
}: Props) {
  const [finance, setFinance] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch(
      `/api/maintenance/occurrences/${occurrenceId}/finance`,
    );
    const payload =
      (await response.json()) as AdminItemResponse<AdminMaintenanceFinanceOccurrence>;
    if (response.ok && payload.item) setFinance(payload.item);
  }

  async function request(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/maintenance/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok)
      setMessage(
        payload.message || "Não foi possível registrar a operação financeira.",
      );
    else {
      await refresh();
      setMessage("Operação financeira registrada.");
    }
    setBusy(false);
  }

  async function upload(
    target: AdminMaintenanceCostItem | AdminMaintenanceRecovery,
    files: File[],
  ) {
    if (!files.length) return;
    const targetType = "actual_amount" in target ? "cost_item" : "recovery";
    setBusy(true);
    setMessage("");
    try {
      const intentResponse = await fetch(
        `/api/maintenance/occurrences/${occurrenceId}/financial-attachments/upload-intents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: targetType,
            target_id: target.id,
            files: files.map((file) => ({
              filename: file.name,
              content_type: file.type,
              size_bytes: file.size,
            })),
          }),
        },
      );
      const intents = (await intentResponse.json()) as {
        items?: Array<{ storage_path: string; signed_url: string }>;
        message?: string;
      };
      if (!intentResponse.ok || !intents.items)
        throw new Error(intents.message || "Falha ao preparar documentos.");
      const uploaded = await Promise.all(
        files.map(async (file, index) => {
          const intent = intents.items![index]!;
          const sent = await fetch(intent.signed_url, {
            method: "PUT",
            headers: { "Content-Type": file.type, "x-upsert": "false" },
            body: file,
          });
          if (!sent.ok) throw new Error(`Falha ao enviar ${file.name}.`);
          return {
            storage_path: intent.storage_path,
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          };
        }),
      );
      const finalResponse = await fetch(
        `/api/maintenance/occurrences/${occurrenceId}/financial-attachments/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: targetType,
            target_id: target.id,
            files: uploaded,
          }),
        },
      );
      if (!finalResponse.ok) throw new Error("Falha ao confirmar documentos.");
      await refresh();
      setMessage("Documentos adicionados.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao enviar documentos.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/maintenance/financial-attachments/${id}/access`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        signed_url?: string;
        message?: string;
      };
      if (!response.ok || !payload.signed_url)
        throw new Error(payload.message || "Documento indisponível.");
      window.open(payload.signed_url, "_blank", "noopener,noreferrer");
      setMessage("Acesso temporário ao documento gerado.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao abrir documento.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(id: string) {
    const reason = window.prompt("Informe o motivo da remoção do documento:");
    if (!reason?.trim()) return;
    await request(`financial-attachments/${id}/remove`, {
      reason: reason.trim(),
    });
  }

  const items = [...finance.cost_items, ...finance.recoveries];
  return (
    <section
      className="rounded-xl border border-[#d7dce2] bg-white p-5"
      aria-labelledby="maintenance-finance-title"
      data-usage-guide="maintenance-occurrence-finance"
    >
      <h2 id="maintenance-finance-title" className="mt-0">
        Financeiro
        <ContextHelp label="Financeiro da ocorrência">
          Custos e recuperações começam como propostas. Aprovação e liquidação
          dependem de permissões separadas e não alteram a conclusão operacional
          da ocorrência.
        </ContextHelp>
      </h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Estimado", finance.estimated_cost],
          ["Custo aprovado", finance.approved_cost],
          ["Custo pago", finance.settled_cost],
          ["Recuperação", finance.approved_recovery],
          ["Recebido", finance.received_recovery],
          ["Resultado líquido", finance.net_result],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
            <p className="m-0 text-xs text-slate-500">{label}</p>
            <strong>{format(Number(value), finance.currency)}</strong>
          </div>
        ))}
      </div>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg bg-blue-50 p-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {items.map((item) => {
          const cost = "actual_amount" in item;
          return (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{cost ? item.description : item.justification}</strong>
                <span>
                  {item.approval_status} · {item.settlement_status}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {cost
                  ? `Estimado ${format(item.estimated_amount || 0, item.currency)} · Real ${format(item.actual_amount || 0, item.currency)}`
                  : `Cobrança ${format(item.charge_amount, item.currency)} · Dispensa ${format(item.waived_amount, item.currency)}`}
              </p>
              {canPropose &&
              ["draft", "rejected"].includes(item.approval_status) ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    void request(
                      `${cost ? "cost-items" : "recoveries"}/${item.id}/transition`,
                      { action: "submit" },
                    )
                  }
                  className="rounded border px-3 py-2 text-sm"
                >
                  Submeter para aprovação
                </button>
              ) : null}
              {canPropose ? (
                <label className="ml-3 inline-flex cursor-pointer rounded border px-3 py-2 text-sm">
                  Anexar documento
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void upload(
                        item,
                        Array.from(event.target.files || []).slice(0, 5),
                      );
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              ) : null}
              {item.attachments?.length ? (
                <ul className="mt-3 grid gap-2 p-0">
                  {item.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm"
                    >
                      <span>
                        {attachment.original_filename}
                        {attachment.removed_at ? " · removido" : ""}
                      </span>
                      {!attachment.removed_at ? (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void openDocument(attachment.id)}
                            className="rounded border px-2 py-1"
                          >
                            Abrir
                          </button>
                          {canPropose ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeDocument(attachment.id)}
                              className="rounded border border-red-300 px-2 py-1 text-red-700"
                            >
                              Remover
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
      {canPropose ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form
            className="grid gap-2 rounded-lg bg-slate-50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void request(`occurrences/${occurrenceId}/cost-items`, {
                kind: data.get("kind"),
                description: data.get("description"),
                quantity: Number(data.get("quantity")),
                estimated_amount: data.get("estimated_amount")
                  ? Number(data.get("estimated_amount"))
                  : null,
                actual_amount: data.get("actual_amount")
                  ? Number(data.get("actual_amount"))
                  : null,
                due_date: data.get("due_date") || null,
                counterparty: data.get("counterparty") || null,
                supplier_id: data.get("supplier_id") || null,
                contract_id: data.get("contract_id") || null,
              });
            }}
          >
            <h3 className="m-0">Novo custo</h3>
            <select name="kind" className="pms-field-input">
              <option value="material">Material</option>
              <option value="labor">Mão de obra</option>
              <option value="external_service">Serviço externo</option>
              <option value="other">Outro</option>
            </select>
            <textarea
              name="description"
              required
              minLength={3}
              placeholder="Descrição"
              className="pms-field-input"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue="1"
                className="pms-field-input"
                aria-label="Quantidade"
              />
              <input
                name="estimated_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Estimado"
                className="pms-field-input"
              />
              <input
                name="actual_amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Real"
                className="pms-field-input"
              />
            </div>
            <input
              name="counterparty"
              placeholder="Favorecido"
              className="pms-field-input"
            />
            <select
              name="supplier_id"
              className="pms-field-input"
              aria-label="Fornecedor cadastrado do custo"
            >
              <option value="">Sem fornecedor cadastrado</option>
              {suppliers
                .filter((supplier) => supplier.status === "active")
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </select>
            <select
              name="contract_id"
              className="pms-field-input"
              aria-label="Contrato do custo"
            >
              <option value="">Sem contrato</option>
              {suppliers.flatMap((supplier) =>
                (supplier.contracts || [])
                  .filter((contract) => contract.status === "active")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number}
                    </option>
                  )),
              )}
            </select>
            <input
              name="due_date"
              type="date"
              className="pms-field-input"
              aria-label="Vencimento"
            />
            <button
              disabled={busy}
              className="rounded bg-slate-900 px-3 py-2 text-white"
            >
              Salvar rascunho
            </button>
          </form>
          <form
            className="grid gap-2 rounded-lg bg-slate-50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const party = String(data.get("responsible_party"));
              void request(`occurrences/${occurrenceId}/recoveries`, {
                responsible_party: party,
                stay_id: party === "guest" ? stayId : null,
                debtor_name:
                  party === "supplier" ? data.get("debtor_name") || null : null,
                supplier_id:
                  party === "supplier" ? data.get("supplier_id") || null : null,
                contract_id:
                  party === "supplier" ? data.get("contract_id") || null : null,
                charge_amount: Number(data.get("charge_amount") || 0),
                waived_amount: Number(data.get("waived_amount") || 0),
                justification: data.get("justification"),
                due_date: data.get("due_date") || null,
              });
            }}
          >
            <h3 className="m-0">Nova recuperação ou dispensa</h3>
            <select name="responsible_party" className="pms-field-input">
              <option value="guest">Hóspede</option>
              <option value="supplier">Fornecedor/terceiro</option>
            </select>
            <input
              name="debtor_name"
              placeholder="Devedor terceiro"
              className="pms-field-input"
            />
            <select
              name="supplier_id"
              className="pms-field-input"
              aria-label="Fornecedor devedor cadastrado"
            >
              <option value="">Terceiro textual</option>
              {suppliers
                .filter((supplier) => supplier.status === "active")
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </select>
            <select
              name="contract_id"
              className="pms-field-input"
              aria-label="Contrato da recuperação"
            >
              <option value="">Sem contrato</option>
              {suppliers.flatMap((supplier) =>
                (supplier.contracts || [])
                  .filter((contract) => contract.status === "active")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number}
                    </option>
                  )),
              )}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="charge_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Cobrança"
                className="pms-field-input"
              />
              <input
                name="waived_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Dispensa"
                className="pms-field-input"
              />
            </div>
            <textarea
              name="justification"
              required
              minLength={3}
              placeholder="Justificativa"
              className="pms-field-input"
            />
            <input
              name="due_date"
              type="date"
              className="pms-field-input"
              aria-label="Vencimento"
            />
            <button
              disabled={busy}
              className="rounded bg-slate-900 px-3 py-2 text-white"
            >
              Salvar rascunho
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
