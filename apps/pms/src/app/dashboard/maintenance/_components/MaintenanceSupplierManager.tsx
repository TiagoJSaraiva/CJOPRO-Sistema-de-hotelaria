"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContextHelp } from "../../_components/ContextHelp";
import type {
  AdminMaintenanceCategory,
  AdminMaintenanceLocation,
  AdminMaintenanceSupplier,
} from "@hotel/shared";

export function MaintenanceSupplierManager({
  suppliers,
  categories,
  locations,
  canReadFinance,
}: {
  suppliers: AdminMaintenanceSupplier[];
  categories: AdminMaintenanceCategory[];
  locations: AdminMaintenanceLocation[];
  canReadFinance: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const response = await fetch("/api/maintenance/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        legal_name: data.get("legal_name") || null,
        tax_document: data.get("tax_document") || null,
        email: data.get("email") || null,
        phone: data.get("phone") || null,
        specialties: String(data.get("specialties") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        notes: data.get("notes") || null,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok)
      setError(payload.message || "Não foi possível cadastrar o fornecedor.");
    else {
      form.reset();
      setError(null);
      router.refresh();
    }
  }
  async function deactivate(supplier: AdminMaintenanceSupplier) {
    const response = await fetch(`/api/maintenance/suppliers/${supplier.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: supplier.status === "active" ? "inactive" : "active",
      }),
    });
    if (!response.ok) setError("Não foi possível alterar o fornecedor.");
    else router.refresh();
  }
  async function createChild(
    supplierId: string,
    kind: "contacts" | "contracts",
    form: HTMLFormElement,
  ) {
    const data = new FormData(form);
    const body =
      kind === "contacts"
        ? {
            name: data.get("name"),
            role: data.get("role") || null,
            email: data.get("email") || null,
            phone: data.get("phone") || null,
            is_primary: data.get("is_primary") === "on",
          }
        : {
            contract_number: data.get("contract_number"),
            kind: data.get("kind"),
            status: "active",
            starts_on: data.get("starts_on"),
            ends_on: data.get("ends_on") || null,
            scope_notes: data.get("scope_notes") || null,
            category_ids: data.getAll("category_ids"),
            location_ids: data.getAll("location_ids"),
            ...(canReadFinance
              ? {
                  commercial_terms: data.get("commercial_terms") || null,
                  contract_amount: data.get("contract_amount")
                    ? Number(data.get("contract_amount"))
                    : null,
                  currency: "BRL",
                }
              : {}),
          };
    const response = await fetch(
      `/api/maintenance/suppliers/${supplierId}/${kind}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok)
      setError(
        `Não foi possível cadastrar ${kind === "contacts" ? "o contato" : "o contrato"}.`,
      );
    else {
      form.reset();
      setError(null);
      router.refresh();
    }
  }
  async function uploadDocuments(
    targetType: "supplier" | "contract",
    targetId: string,
    files: File[],
  ) {
    if (!files.length) return;
    const selected = files.slice(0, 5);
    const intentResponse = await fetch(
      "/api/maintenance/management-documents/upload-intents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          files: selected.map((file) => ({
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          })),
        }),
      },
    );
    const intents = (await intentResponse.json().catch(() => ({}))) as {
      items?: Array<{ storage_path: string; signed_url: string }>;
      message?: string;
    };
    if (!intentResponse.ok || !intents.items) {
      setError(intents.message || "Não foi possível preparar os documentos.");
      return;
    }
    try {
      const uploaded = await Promise.all(
        selected.map(async (file, index) => {
          const intent = intents.items![index];
          if (!intent) throw new Error(file.name);
          const response = await fetch(intent.signed_url, {
            method: "PUT",
            headers: { "Content-Type": file.type, "x-upsert": "false" },
            body: file,
          });
          if (!response.ok) throw new Error(file.name);
          return {
            storage_path: intent.storage_path,
            filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          };
        }),
      );
      const finalize = await fetch(
        "/api/maintenance/management-documents/finalize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            files: uploaded,
          }),
        },
      );
      if (!finalize.ok) throw new Error("finalize");
      setError(null);
      router.refresh();
    } catch {
      setError("Parte dos documentos não pôde ser enviada. Tente novamente.");
    }
  }
  async function openDocument(id: string) {
    const response = await fetch(
      `/api/maintenance/management-documents/${id}/access`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      signed_url?: string;
    };
    if (payload.signed_url)
      window.open(payload.signed_url, "_blank", "noopener,noreferrer");
    else setError("Documento indisponível.");
  }
  async function removeDocument(id: string) {
    const reason = window.prompt("Informe o motivo da remoção do documento:");
    if (!reason || reason.trim().length < 3) return;
    const response = await fetch(
      `/api/maintenance/management-documents/${id}/remove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) setError("Não foi possível remover o documento.");
    else router.refresh();
  }
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      aria-live="polite"
    >
      <section
        className="grid gap-3"
        aria-label="Fornecedores cadastrados"
        data-usage-guide="maintenance-suppliers-list"
      >
        {suppliers.length ? (
          suppliers.map((supplier) => (
            <article
              key={supplier.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    {supplier.status}
                  </span>
                  <h2 className="my-1 text-lg font-semibold">
                    {supplier.name}
                    <ContextHelp label="Fornecedor da manutenção">
                      O fornecedor registra a execução externa, mas não
                      substitui o responsável interno nem conclui a ordem
                      automaticamente.
                    </ContextHelp>
                  </h2>
                  <p className="m-0 text-sm text-slate-600">
                    {supplier.specialties.join(" · ") || "Sem especialidades"} ·{" "}
                    {supplier.email || supplier.phone || "Sem contato geral"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deactivate(supplier)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {supplier.status === "active" ? "Desativar" : "Reativar"}
                </button>
              </div>
              {supplier.contacts?.length ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Contatos</h3>
                  <ul className="text-sm">
                    {supplier.contacts.map((contact) => (
                      <li key={contact.id}>
                        {contact.name}: {contact.email || contact.phone}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {supplier.contracts?.length ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Contratos</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {supplier.contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <strong>{contract.contract_number}</strong>
                        <br />
                        {contract.status} · {contract.starts_on} a{" "}
                        {contract.ends_on || "indeterminado"}
                        {canReadFinance && contract.contract_amount != null ? (
                          <>
                            <br />
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: contract.currency || "BRL",
                            }).format(contract.contract_amount)}
                          </>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {contract.documents?.map((document) => (
                            <span key={document.id} className="inline-flex">
                              <button
                                type="button"
                                onClick={() => void openDocument(document.id)}
                                className="rounded-l border border-slate-300 bg-white px-2 py-1"
                              >
                                {document.original_filename}
                              </button>
                              <button
                                type="button"
                                aria-label={`Remover ${document.original_filename} do contrato ${contract.contract_number}`}
                                onClick={() => void removeDocument(document.id)}
                                className="rounded-r border border-l-0 border-red-300 bg-white px-2 py-1 text-red-700"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <label className="mt-2 block text-xs">
                          Anexar ao contrato
                          <input
                            type="file"
                            className="mt-1 block w-full"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            multiple
                            onChange={(event) =>
                              void uploadDocuments(
                                "contract",
                                contract.id,
                                Array.from(event.target.files || []),
                              )
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Adicionar contato
                  </summary>
                  <form
                    className="mt-3 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createChild(
                        supplier.id,
                        "contacts",
                        event.currentTarget,
                      );
                    }}
                  >
                    <input
                      required
                      minLength={2}
                      name="name"
                      aria-label="Nome do contato"
                      placeholder="Nome"
                      className="pms-field-input"
                    />
                    <input
                      name="role"
                      aria-label="Função do contato"
                      placeholder="Função"
                      className="pms-field-input"
                    />
                    <input
                      name="email"
                      type="email"
                      aria-label="E-mail do contato"
                      placeholder="E-mail"
                      className="pms-field-input"
                    />
                    <input
                      name="phone"
                      aria-label="Telefone do contato"
                      placeholder="Telefone"
                      className="pms-field-input"
                    />
                    <label className="text-sm">
                      <input name="is_primary" type="checkbox" /> Contato
                      principal
                    </label>
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      Salvar contato
                    </button>
                  </form>
                </details>
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Adicionar contrato
                  </summary>
                  <form
                    className="mt-3 grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createChild(
                        supplier.id,
                        "contracts",
                        event.currentTarget,
                      );
                    }}
                  >
                    <input
                      required
                      name="contract_number"
                      aria-label="Número do contrato"
                      placeholder="Número"
                      className="pms-field-input"
                    />
                    <select
                      name="kind"
                      aria-label="Tipo do contrato"
                      className="pms-field-input"
                    >
                      <option value="fixed">Fixo</option>
                      <option value="per_service">Por serviço</option>
                      <option value="warranty">Garantia</option>
                      <option value="other">Outro</option>
                    </select>
                    <label className="grid gap-1 text-sm">
                      Início
                      <input
                        required
                        name="starts_on"
                        type="date"
                        className="pms-field-input"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Fim
                      <input
                        name="ends_on"
                        type="date"
                        className="pms-field-input"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Categorias do escopo
                      <select
                        name="category_ids"
                        multiple
                        className="pms-field-input"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      Locais do escopo
                      <select
                        name="location_ids"
                        multiple
                        className="pms-field-input"
                      >
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      name="scope_notes"
                      aria-label="Escopo do contrato"
                      placeholder="Escopo"
                      className="pms-field-input"
                    />
                    {canReadFinance ? (
                      <>
                        <textarea
                          name="commercial_terms"
                          aria-label="Termos comerciais"
                          placeholder="Termos comerciais"
                          className="pms-field-input"
                        />
                        <input
                          name="contract_amount"
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label="Valor do contrato"
                          placeholder="Valor"
                          className="pms-field-input"
                        />
                      </>
                    ) : null}
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      Salvar contrato
                    </button>
                  </form>
                </details>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold">
                  Documentos do fornecedor
                </h3>
                <div className="flex flex-wrap gap-2">
                  {supplier.documents?.map((document) => (
                    <span key={document.id} className="inline-flex">
                      <button
                        type="button"
                        onClick={() => void openDocument(document.id)}
                        className="rounded-l-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        Abrir {document.original_filename}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${document.original_filename}`}
                        onClick={() => void removeDocument(document.id)}
                        className="rounded-r-lg border border-l-0 border-red-300 px-2 py-2 text-sm text-red-700"
                      >
                        Remover
                      </button>
                    </span>
                  ))}
                </div>
                <label className="mt-2 grid gap-1 text-sm">
                  Adicionar documentos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={(event) =>
                      void uploadDocuments(
                        "supplier",
                        supplier.id,
                        Array.from(event.target.files || []),
                      )
                    }
                  />
                </label>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            Nenhum fornecedor cadastrado.
          </p>
        )}
      </section>
      <form
        className="h-fit rounded-xl border border-slate-200 bg-white p-5"
        data-usage-guide="maintenance-suppliers-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create(event.currentTarget);
        }}
      >
        <h2 className="mt-0 text-lg font-semibold">Novo fornecedor</h2>
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Nome
            <input
              required
              minLength={2}
              name="name"
              className="pms-field-input"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Razão social
            <input name="legal_name" className="pms-field-input" />
          </label>
          <label className="grid gap-1 text-sm">
            Documento fiscal
            <input name="tax_document" className="pms-field-input" />
          </label>
          <label className="grid gap-1 text-sm">
            E-mail
            <input name="email" type="email" className="pms-field-input" />
          </label>
          <label className="grid gap-1 text-sm">
            Telefone
            <input name="phone" className="pms-field-input" />
          </label>
          <label className="grid gap-1 text-sm">
            Especialidades, separadas por vírgula
            <input name="specialties" className="pms-field-input" />
          </label>
          <label className="grid gap-1 text-sm">
            Observações
            <textarea name="notes" className="pms-field-input" />
          </label>
        </div>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
          Cadastrar
        </button>
      </form>
    </div>
  );
}
