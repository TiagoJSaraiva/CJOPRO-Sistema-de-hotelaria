"use client";

import type {
  AdminItemResponse,
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceReferenceData,
  AdminMaintenanceSupplier,
} from "@hotel/shared";
import { useState } from "react";
import { ContextHelp } from "../../_components/ContextHelp";

type Access = {
  canCreate: boolean;
  canTriage: boolean;
  canExecute: boolean;
  canManageBlocks: boolean;
  canInspect: boolean;
  canConfirmLiability: boolean;
  canManageSuppliers: boolean;
};
type Props = {
  initial: AdminMaintenanceOccurrenceDetail;
  referenceData: AdminMaintenanceReferenceData;
  access: Access;
  suppliers?: AdminMaintenanceSupplier[];
};

const statusLabels: Record<string, string> = {
  reported: "Relatada",
  triaged: "Triada",
  in_progress: "Em andamento",
  awaiting_inspection: "Aguardando inspeção",
  awaiting_liability: "Aguardando apuração",
  resolved: "Resolvida",
  canceled: "Cancelada",
  pending: "Pendente",
  assigned: "Atribuída",
  paused: "Pausada",
  waiting: "Em espera",
  completed: "Concluída",
};

export function MaintenanceOccurrenceWorkspace({
  initial,
  referenceData,
  access,
  suppliers = [],
}: Props) {
  const [item, setItem] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function mutate(path: string, body: Record<string, unknown>) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/maintenance/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response
        .json()
        .catch(
          () => ({}),
        )) as AdminItemResponse<AdminMaintenanceOccurrenceDetail> & {
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.message || "Não foi possível concluir a operação.",
        );
      if (payload.item) setItem(payload.item);
      setMessage("Alteração registrada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setPending(false);
    }
  }

  async function openAttachment(id: string) {
    const response = await fetch(`/api/maintenance/attachments/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = (await response.json()) as {
      signed_url?: string;
      message?: string;
    };
    if (payload.signed_url)
      window.open(payload.signed_url, "_blank", "noopener,noreferrer");
    else setMessage(payload.message || "Foto indisponível.");
  }

  async function uploadPhotos(files: File[]) {
    if (!files.length) return;
    setPending(true);
    setMessage("");
    try {
      const intentResponse = await fetch(
        `/api/maintenance/occurrences/${item.id}/attachments/upload-intents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
        throw new Error(
          intents.message || "Falha ao preparar envio das fotos.",
        );
      const uploaded = await Promise.all(
        files.map(async (file, index) => {
          const intent = intents.items![index]!;
          const response = await fetch(intent.signed_url, {
            method: "PUT",
            headers: { "Content-Type": file.type, "x-upsert": "false" },
            body: file,
          });
          if (!response.ok) throw new Error(`Falha ao enviar ${file.name}.`);
          return {
            storage_path: intent.storage_path,
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          };
        }),
      );
      const finalizeResponse = await fetch(
        `/api/maintenance/occurrences/${item.id}/attachments/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: uploaded }),
        },
      );
      const finalized =
        (await finalizeResponse.json()) as AdminItemResponse<AdminMaintenanceOccurrenceDetail> & {
          message?: string;
        };
      if (!finalizeResponse.ok || !finalized.item)
        throw new Error(finalized.message || "Falha ao confirmar fotos.");
      setItem(finalized.item);
      setMessage("Fotos adicionadas.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao enviar fotos.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section
        className="grid gap-3 rounded-xl border border-[#d7dce2] bg-white p-5 lg:grid-cols-[2fr_1fr]"
        data-usage-guide="maintenance-occurrence-summary"
      >
        <div>
          <p className="m-0 text-sm text-[#52606d]">
            {item.code} · {item.category_name}
          </p>
          <h2 className="my-2 text-xl">
            {item.room_number
              ? `Quarto ${item.room_number}`
              : item.location_name}
          </h2>
          <p className="whitespace-pre-wrap">{item.description}</p>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
          <dt>Situação</dt>
          <dd>{statusLabels[item.status] || item.status}</dd>
          <dt>Prioridade</dt>
          <dd>{item.priority}</dd>
          <dt>Responsabilidade</dt>
          <dd>{item.liability_status}</dd>
          <dt>Estadia</dt>
          <dd>{item.stay_id || "Não vinculada"}</dd>
          <dt>Bloqueio</dt>
          <dd>{item.active_block ? "Ativo" : "Não"}</dd>
          <dt>Origem</dt>
          <dd>{item.preventive_plan_id ? "Preventiva" : "Corretiva"}</dd>
          <dt>SLA de resposta</dt>
          <dd>
            {item.sla_response_due_at
              ? new Date(item.sla_response_due_at).toLocaleString("pt-BR")
              : "Não acompanhado"}
          </dd>
          <dt>SLA de resolução</dt>
          <dd>
            {item.sla_resolution_due_at
              ? new Date(item.sla_resolution_due_at).toLocaleString("pt-BR")
              : "Não acompanhado"}
          </dd>
        </dl>
      </section>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-[#eef6ff] p-3"
        >
          {message}
        </p>
      ) : null}

      <section
        className="rounded-xl border border-[#d7dce2] bg-white p-5"
        data-usage-guide="maintenance-occurrence-orders"
      >
        <h2 className="mt-0">
          Ordens de trabalho
          <ContextHelp label="Inspeção de ordem">
            Quando uma ordem exige inspeção, sua conclusão fica pendente até a
            revisão por outro usuário autorizado.
          </ContextHelp>
        </h2>
        <div className="grid gap-3">
          {item.work_orders.map((order) => (
            <article
              key={order.id}
              className="rounded-lg border border-[#d7dce2] p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{order.title}</strong>
                <span>{statusLabels[order.status] || order.status}</span>
              </div>
              <p>{order.instructions}</p>
              <p className="text-sm text-[#52606d]">
                Responsável: {order.assignee_name || "Não atribuído"} ·
                Inspeção:{" "}
                {order.requires_inspection ? "obrigatória" : "não obrigatória"}
              </p>
              {order.supplier_id ? (
                <p className="text-sm text-[#52606d]">
                  Fornecedor: {order.supplier_name || "Vinculado"} · situação
                  externa: {order.supplier_status}
                  {order.contract_number
                    ? ` · contrato ${order.contract_number}`
                    : ""}
                </p>
              ) : null}
              {(access.canExecute || access.canManageSuppliers) &&
              order.supplier_id &&
              !["completed", "canceled"].includes(
                order.supplier_status || "",
              ) ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {order.supplier_status === "sent" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          `work-orders/${order.id}/supplier-transition`,
                          {
                            action: "accept",
                            notes:
                              "Aceite do fornecedor registrado pela equipe interna",
                          },
                        )
                      }
                      className="rounded border px-3 py-2 text-sm"
                    >
                      Registrar aceite
                    </button>
                  ) : null}
                  {["sent", "accepted"].includes(
                    order.supplier_status || "",
                  ) ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          `work-orders/${order.id}/supplier-transition`,
                          {
                            action: "start",
                            notes:
                              "Início externo registrado pela equipe interna",
                          },
                        )
                      }
                      className="rounded border px-3 py-2 text-sm"
                    >
                      Registrar início externo
                    </button>
                  ) : null}
                  {order.supplier_status === "in_service" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          `work-orders/${order.id}/supplier-transition`,
                          {
                            action: "complete",
                            notes:
                              "Conclusão externa informada; ordem interna permanece independente",
                          },
                        )
                      }
                      className="rounded border px-3 py-2 text-sm"
                    >
                      Registrar conclusão externa
                    </button>
                  ) : null}
                </div>
              ) : null}
              {access.canManageSuppliers &&
              !order.supplier_id &&
              suppliers.length ? (
                <form
                  className="mb-3 flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void mutate(`work-orders/${order.id}/supplier-transition`, {
                      action: "send",
                      supplier_id: data.get("supplier_id"),
                      contract_id: data.get("contract_id") || null,
                      external_reference: data.get("external_reference"),
                      notes: "Ordem enviada ao fornecedor pela equipe interna",
                    });
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    Fornecedor
                    <select
                      required
                      name="supplier_id"
                      className="pms-field-input"
                    >
                      <option value="">Selecione</option>
                      {suppliers
                        .filter((supplier) => supplier.status === "active")
                        .map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Contrato
                    <select name="contract_id" className="pms-field-input">
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
                  </label>
                  <label className="grid gap-1 text-sm">
                    Referência externa
                    <input
                      name="external_reference"
                      className="pms-field-input"
                    />
                  </label>
                  <button className="rounded border px-3 py-2 text-sm">
                    Enviar ao fornecedor
                  </button>
                </form>
              ) : null}
              {order.checklist?.length ? (
                <fieldset className="my-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold">
                    Checklist
                  </legend>
                  <div className="grid gap-2">
                    {order.checklist.map((check) => (
                      <label
                        key={check.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(check.completed_at)}
                          disabled={pending || !access.canExecute}
                          onChange={(event) =>
                            void mutate(
                              `work-orders/${order.id}/checklist/${check.id}/complete`,
                              {
                                completed: event.target.checked,
                                notes: event.target.checked
                                  ? "Item conferido na execução"
                                  : "Item reaberto para conferência",
                              },
                            )
                          }
                        />
                        <span>
                          {check.description}
                          {check.is_required ? " *" : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {access.canExecute &&
              !["completed", "canceled", "awaiting_inspection"].includes(
                order.status,
              ) ? (
                <div className="flex flex-wrap gap-2">
                  {["start", "pause", "wait", "complete", "cancel"].map(
                    (action) => (
                      <button
                        key={action}
                        disabled={pending}
                        onClick={() =>
                          mutate(`work-orders/${order.id}/transition`, {
                            action,
                            waiting_reason:
                              action === "wait" ? "other" : undefined,
                            notes:
                              action === "wait"
                                ? "Aguardando nova definição"
                                : undefined,
                            diagnosis:
                              action === "complete"
                                ? "Serviço executado"
                                : undefined,
                          })
                        }
                        className="rounded border px-3 py-2"
                      >
                        {action}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
              {access.canInspect && order.status === "awaiting_inspection" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={pending}
                    onClick={() =>
                      mutate(`work-orders/${order.id}/inspect`, {
                        result: "approved",
                        notes: "Serviço inspecionado e aprovado",
                      })
                    }
                    className="rounded bg-[#176c43] px-3 py-2 text-white"
                  >
                    Aprovar
                  </button>
                  <button
                    disabled={pending}
                    onClick={() =>
                      mutate(`work-orders/${order.id}/inspect`, {
                        result: "rejected",
                        notes: "Serviço reprovado em inspeção",
                      })
                    }
                    className="rounded bg-[#9f1239] px-3 py-2 text-white"
                  >
                    Reprovar
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {access.canTriage ? (
          <form
            className="mt-4 grid gap-3 rounded-lg bg-[#f5f7fa] p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void mutate(`occurrences/${item.id}/work-orders`, {
                title: data.get("title"),
                instructions: data.get("instructions"),
                assigned_to: data.get("assigned_to") || null,
                priority: data.get("priority"),
                requires_inspection: data.get("requires_inspection") === "on",
              });
            }}
          >
            <h3 className="col-span-full m-0">Nova ordem</h3>
            <input
              name="title"
              required
              minLength={3}
              placeholder="Título"
              className="pms-field-input"
            />
            <textarea
              name="instructions"
              required
              minLength={3}
              placeholder="Instruções"
              className="pms-field-input"
            />
            <select
              name="assigned_to"
              aria-label="Responsável pela nova ordem"
              className="pms-field-input"
            >
              <option value="">Sem responsável</option>
              {referenceData.assignable_users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              name="priority"
              aria-label="Prioridade da nova ordem"
              defaultValue={item.priority}
              className="pms-field-input"
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
            <label>
              <input type="checkbox" name="requires_inspection" /> Exigir
              inspeção
            </label>
            <button
              disabled={pending}
              className="rounded bg-[#102a43] px-3 py-2 text-white"
            >
              Criar ordem
            </button>
          </form>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-xl border border-[#d7dce2] bg-white p-5"
          data-usage-guide="maintenance-occurrence-block"
        >
          <h2 className="mt-0">
            Bloqueio do quarto
            <ContextHelp label="Bloqueio do quarto">
              O bloqueio efetivo impede novas reservas e só termina com uma
              liberação explícita. A data final planejada não libera o quarto
              automaticamente.
            </ContextHelp>
          </h2>
          {item.room_blocks.map((block) => (
            <div key={block.id} className="mb-3 rounded-lg border p-3">
              {block.start_date} a {block.planned_end_date}
              {block.is_overdue ? " · atrasado" : ""}
              {!block.released_at && access.canManageBlocks ? (
                <button
                  disabled={pending}
                  onClick={() =>
                    mutate(`room-blocks/${block.id}/release`, {
                      reason: "Local inspecionado e liberado",
                    })
                  }
                  className="ml-3 rounded border px-2 py-1"
                >
                  Liberar
                </button>
              ) : null}
            </div>
          ))}
          {access.canManageBlocks && item.room_id && !item.active_block ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate(`occurrences/${item.id}/room-blocks`, {
                  start_date: data.get("start_date"),
                  end_date: data.get("end_date"),
                  conflict_acknowledgement: data.get(
                    "conflict_acknowledgement",
                  ),
                });
              }}
            >
              <input
                name="start_date"
                type="date"
                required
                className="pms-field-input"
              />
              <input
                name="end_date"
                type="date"
                required
                className="pms-field-input"
              />
              <textarea
                name="conflict_acknowledgement"
                placeholder="Justificativa se houver conflitos"
                className="pms-field-input"
              />
              <button
                disabled={pending}
                className="rounded bg-[#102a43] px-3 py-2 text-white"
              >
                Bloquear quarto
              </button>
            </form>
          ) : null}
        </section>
        <section
          className="rounded-xl border border-[#d7dce2] bg-white p-5"
          data-usage-guide="maintenance-occurrence-liability"
        >
          <h2 className="mt-0">
            Responsabilidade
            <ContextHelp label="Apuração de responsabilidade">
              Uma suspeita não é uma cobrança. A responsabilidade deve ser
              confirmada ou descartada por um usuário autorizado após a
              apuração.
            </ContextHelp>
          </h2>
          <p>{item.liability_notes || "Sem observações."}</p>
          {access.canTriage &&
          item.kind === "damage" &&
          item.liability_status === "not_assessed" ? (
            <button
              disabled={pending}
              onClick={() =>
                mutate(`occurrences/${item.id}/liability/suspect`, {
                  party: "guest",
                  notes: "Responsabilidade requer apuração",
                })
              }
              className="rounded border px-3 py-2"
            >
              Marcar suspeita
            </button>
          ) : null}
          {access.canConfirmLiability &&
          item.liability_status === "suspected" ? (
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  mutate(`occurrences/${item.id}/liability/decide`, {
                    decision: "confirmed",
                    party: item.suspected_party || "guest",
                    notes: "Responsabilidade confirmada após apuração",
                  })
                }
                className="rounded border px-3 py-2"
              >
                Confirmar
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  mutate(`occurrences/${item.id}/liability/decide`, {
                    decision: "dismissed",
                    notes: "Responsabilidade descartada após apuração",
                  })
                }
                className="rounded border px-3 py-2"
              >
                Descartar
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <section
        className="rounded-xl border border-[#d7dce2] bg-white p-5"
        data-usage-guide="maintenance-occurrence-evidence"
      >
        <h2 className="mt-0">Fotos</h2>
        <div className="flex flex-wrap gap-2">
          {item.attachments.length ? (
            item.attachments.map((attachment) => (
              <span key={attachment.id} className="inline-flex gap-1">
                <button
                  onClick={() => openAttachment(attachment.id)}
                  className="rounded border px-3 py-2"
                >
                  Abrir {attachment.original_filename}
                </button>
                {access.canCreate || access.canTriage ? (
                  <button
                    onClick={() => {
                      const reason = window.prompt(
                        "Informe o motivo da remoção da foto:",
                      );
                      if (reason)
                        void mutate(`attachments/${attachment.id}/remove`, {
                          reason,
                        });
                    }}
                    className="rounded border border-[#9f1239] px-2 py-1 text-[#9f1239]"
                  >
                    Remover
                  </button>
                ) : null}
              </span>
            ))
          ) : (
            <p>Nenhuma foto.</p>
          )}
        </div>
        {access.canCreate || access.canTriage || access.canExecute ? (
          <label className="mt-3 grid gap-1 text-sm">
            Adicionar fotos
            <input
              disabled={pending}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) =>
                void uploadPhotos(
                  Array.from(event.target.files || []).slice(0, 5),
                )
              }
            />
          </label>
        ) : null}
      </section>
      <section
        className="rounded-xl border border-[#d7dce2] bg-white p-5"
        data-usage-guide="maintenance-occurrence-history"
      >
        <h2 className="mt-0">Comentários e histórico</h2>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void mutate(`occurrences/${item.id}/comments`, {
              reason: data.get("reason"),
            });
            event.currentTarget.reset();
          }}
        >
          <input
            name="reason"
            required
            minLength={3}
            className="pms-field-input flex-1"
            placeholder="Adicionar comentário"
          />
          <button disabled={pending} className="rounded border px-3 py-2">
            Comentar
          </button>
        </form>
        <ol className="grid gap-2">
          {item.events.map((event) => (
            <li key={event.id}>
              <strong>{event.actor_name}</strong> · {event.event_type}
              {event.message ? ` — ${event.message}` : ""}
            </li>
          ))}
        </ol>
      </section>
      {access.canTriage ? (
        <section className="flex flex-wrap gap-2">
          {["resolved", "canceled"].includes(item.status) ? (
            <button
              disabled={pending}
              onClick={() =>
                mutate(`occurrences/${item.id}/reopen`, {
                  reason: "Ocorrência requer novo atendimento",
                })
              }
              className="rounded border px-3 py-2"
            >
              Reabrir
            </button>
          ) : (
            <>
              <button
                disabled={pending}
                onClick={() =>
                  mutate(`occurrences/${item.id}/cancel`, {
                    reason: "Registro cancelado com histórico preservado",
                  })
                }
                className="rounded border border-[#9f1239] px-3 py-2 text-[#9f1239]"
              >
                Cancelar ocorrência
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  const canonical = window.prompt(
                    "Informe o id da ocorrência canônica:",
                  );
                  if (canonical)
                    void mutate(`occurrences/${item.id}/duplicate`, {
                      duplicate_of_id: canonical,
                      reason: "Registro duplicado identificado na triagem",
                    });
                }}
                className="rounded border px-3 py-2"
              >
                Marcar como duplicada
              </button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
