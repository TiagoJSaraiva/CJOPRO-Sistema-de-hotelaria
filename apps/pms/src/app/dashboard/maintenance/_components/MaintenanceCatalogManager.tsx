"use client";

import type {
  AdminMaintenanceCategory,
  AdminMaintenanceLocation,
  MaintenanceWarrantyDecision,
  MaintenanceWarrantyOccurrence,
} from "@hotel/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ContextHelp } from "../../_components/ContextHelp";

type WarrantyContext = {
  location: AdminMaintenanceLocation;
  decisions: MaintenanceWarrantyDecision[];
  current_decision_id: string | null;
  active_occurrences: MaintenanceWarrantyOccurrence[];
};

const field = (data: FormData, name: string) =>
  String(data.get(name) || "").trim() || null;

const upsert = <T extends { id: string }>(items: T[], item: T) =>
  items.some((value) => value.id === item.id)
    ? items.map((value) => (value.id === item.id ? item : value))
    : [...items, item];

function EquipmentFields({
  location,
}: {
  location?: AdminMaintenanceLocation;
}) {
  return (
    <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">
        Identificação e garantia do equipamento
      </legend>
      <input
        name="asset_tag"
        defaultValue={location?.asset_tag || ""}
        placeholder="Patrimônio, ex.: PAT-REC-001"
        className="pms-field-input"
      />
      <input
        name="manufacturer"
        defaultValue={location?.manufacturer || ""}
        placeholder="Fabricante"
        className="pms-field-input"
      />
      <input
        name="model"
        defaultValue={location?.model || ""}
        placeholder="Modelo"
        className="pms-field-input"
      />
      <input
        name="serial_number"
        defaultValue={location?.serial_number || ""}
        placeholder="Número de série"
        className="pms-field-input"
      />
      <label className="pms-field">
        Data de instalação
        <input
          name="installed_on"
          type="date"
          defaultValue={location?.installed_on || ""}
          className="pms-field-input"
        />
      </label>
      <label className="pms-field">
        Fim da garantia
        <input
          name="warranty_ends_on"
          type="date"
          defaultValue={location?.warranty_ends_on || ""}
          className="pms-field-input"
        />
      </label>
    </fieldset>
  );
}

function locationPayload(data: FormData, kind: "area" | "equipment") {
  return {
    name: field(data, "name"),
    kind,
    parent_location_id:
      kind === "equipment" ? field(data, "parent_location_id") : null,
    description: field(data, "description"),
    display_order: Number(data.get("display_order") || 0),
    is_active: data.get("is_active") !== "false",
    asset_tag: kind === "equipment" ? field(data, "asset_tag") : null,
    manufacturer: kind === "equipment" ? field(data, "manufacturer") : null,
    model: kind === "equipment" ? field(data, "model") : null,
    serial_number: kind === "equipment" ? field(data, "serial_number") : null,
    installed_on: kind === "equipment" ? field(data, "installed_on") : null,
    warranty_ends_on:
      kind === "equipment" ? field(data, "warranty_ends_on") : null,
    lifecycle_status: kind === "equipment" ? "active" : null,
  };
}

export function MaintenanceCatalogManager({
  initialCategories,
  initialLocations,
  focusLocationId,
  canManageWarranties,
  canManageCatalogs,
}: {
  initialCategories: AdminMaintenanceCategory[];
  initialLocations: AdminMaintenanceLocation[];
  focusLocationId?: string;
  canManageWarranties: boolean;
  canManageCatalogs: boolean;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [locations, setLocations] = useState(initialLocations);
  const [kind, setKind] = useState<"area" | "equipment">("area");
  const [message, setMessage] = useState("");
  const [warranty, setWarranty] = useState<Record<string, WarrantyContext>>({});
  const focused = useRef(false);

  const loadWarranty = useCallback(async (locationId: string) => {
    const response = await fetch(
      `/api/maintenance/locations/${locationId}/warranty`,
    );
    const payload = (await response
      .json()
      .catch(() => ({}))) as WarrantyContext & { message?: string };
    if (!response.ok || !payload.location) {
      setMessage(payload.message || "Falha ao consultar a garantia.");
      return;
    }
    setWarranty((current) => ({ ...current, [locationId]: payload }));
    setLocations((current) => upsert(current, payload.location));
  }, []);

  useEffect(() => {
    if (!focusLocationId || focused.current) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-location-id]"),
    ).find((element) => element.dataset.locationId === focusLocationId);
    if (!target) return;
    focused.current = true;
    target.scrollIntoView?.({ block: "center" });
    target.focus();
    if (canManageWarranties) void loadWarranty(focusLocationId);
  }, [canManageWarranties, focusLocationId, loadWarranty]);

  async function write<T>(
    path: string,
    method: "POST" | "PUT",
    body: Record<string, unknown>,
    update: (item: T) => void,
  ) {
    setMessage("");
    const response = await fetch(`/api/maintenance/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      item?: T;
      message?: string;
    };
    if (!response.ok || !payload.item) {
      setMessage(payload.message || "Falha ao salvar catálogo.");
      return false;
    }
    update(payload.item);
    setMessage("Catálogo atualizado.");
    return true;
  }

  const areas = locations.filter((item) => item.kind === "area");
  const equipment = locations.filter((item) => item.kind === "equipment");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="col-span-full rounded-lg bg-[#eef6ff] p-3"
        >
          {message}
        </p>
      ) : null}
      {canManageCatalogs ? (
        <section
          className="rounded-xl border border-[#d7dce2] bg-white p-5"
          data-usage-guide="maintenance-settings-categories"
        >
          <h2 className="mt-0">Categorias de ocorrência</h2>
          <p className="text-sm text-slate-600">
            Categorias classificam problemas; dados patrimoniais pertencem aos
            equipamentos.
          </p>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void write<AdminMaintenanceCategory>(
                "categories",
                "POST",
                {
                  name: data.get("name"),
                  description: data.get("description"),
                  display_order: Number(data.get("display_order")),
                },
                (item) => setCategories((current) => upsert(current, item)),
              ).then((ok) => ok && form.reset());
            }}
          >
            <input
              name="name"
              required
              placeholder="Nome, ex.: Climatização"
              className="pms-field-input"
            />
            <input
              name="description"
              placeholder="Descrição"
              className="pms-field-input"
            />
            <input
              name="display_order"
              type="number"
              aria-label="Ordem de exibição da categoria"
              defaultValue="0"
              className="pms-field-input"
            />
            <button className="pms-button-primary justify-self-start">
              Criar categoria
            </button>
          </form>
          <ul className="mt-4 grid gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <span>
                  {category.name} · ordem {category.display_order}
                  {category.is_active ? "" : " · inativa"}
                </span>
                <button
                  onClick={() =>
                    void write<AdminMaintenanceCategory>(
                      `categories/${category.id}`,
                      "PUT",
                      { name: category.name, is_active: !category.is_active },
                      (item) =>
                        setCategories((current) => upsert(current, item)),
                    )
                  }
                  className="pms-button-secondary"
                >
                  {category.is_active ? "Desativar" : "Ativar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canManageCatalogs ? (
        <section
          className="rounded-xl border border-[#d7dce2] bg-white p-5"
          data-usage-guide="maintenance-settings-locations"
        >
          <h2 className="mt-0">Nova área ou equipamento</h2>
          <p className="text-sm text-slate-600">
            Área é um lugar físico. Equipamento é um bem instalado em uma área e
            pode ter patrimônio e garantia.
          </p>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void write<AdminMaintenanceLocation>(
                "locations",
                "POST",
                locationPayload(data, kind),
                (item) => setLocations((current) => upsert(current, item)),
              ).then((ok) => ok && form.reset());
            }}
          >
            <label className="pms-field">
              Nome
              <input
                name="name"
                required
                placeholder={
                  kind === "area" ? "Recepção" : "Ar-condicionado da recepção"
                }
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Tipo
              <select
                name="kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "area" | "equipment")
                }
                className="pms-field-input"
              >
                <option value="area">Área</option>
                <option value="equipment">Equipamento</option>
              </select>
            </label>
            {kind === "equipment" ? (
              <label className="pms-field">
                Área onde está instalado
                <select name="parent_location_id" className="pms-field-input">
                  <option value="">Sem área pai</option>
                  {areas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <input
              name="description"
              placeholder="Descrição"
              className="pms-field-input"
            />
            <input
              name="display_order"
              type="number"
              aria-label="Ordem de exibição do local"
              defaultValue="0"
              className="pms-field-input"
            />
            {kind === "equipment" ? <EquipmentFields /> : null}
            <button className="pms-button-primary justify-self-start">
              Criar {kind === "area" ? "área" : "equipamento"}
            </button>
          </form>
        </section>
      ) : null}
      <section className="pms-surface-card lg:col-span-2">
        <h2 className="mt-0">Áreas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {areas.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              areas={areas}
              canEdit={canManageCatalogs}
              write={write}
              onUpdate={(item) =>
                setLocations((current) => upsert(current, item))
              }
            />
          ))}
        </div>
      </section>
      <section
        className="pms-surface-card lg:col-span-2"
        data-usage-guide={
          canManageWarranties ? "maintenance-warranty-decision" : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="my-0">Equipamentos</h2>
          <ContextHelp label="garantia de equipamentos">
            A garantia pertence ao equipamento e exige uma decisão auditável
            quando se aproxima do vencimento.
          </ContextHelp>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {equipment.map((location) => {
            const warrantyContext = warranty[location.id];
            return (
              <article
                key={location.id}
                tabIndex={-1}
                data-location-id={location.id}
                className={`rounded-lg border p-4 outline-none focus:ring-2 focus:ring-[#1d4ed8] ${focusLocationId === location.id ? "border-[#1d4ed8] bg-blue-50" : ""}`}
              >
                <LocationCard
                  location={location}
                  areas={areas}
                  canEdit={canManageCatalogs}
                  write={write}
                  onUpdate={(item) =>
                    setLocations((current) => upsert(current, item))
                  }
                />
                {canManageWarranties && location.warranty_ends_on ? (
                  <div className="mt-3 border-t pt-3">
                    <button
                      className="pms-button-secondary"
                      onClick={() => void loadWarranty(location.id)}
                    >
                      Tratar garantia
                    </button>
                    {warrantyContext ? (
                      <WarrantyPanel
                        context={warrantyContext}
                        replacements={equipment.filter(
                          (item) =>
                            item.id !== location.id &&
                            item.is_active &&
                            item.lifecycle_status === "active",
                        )}
                        onSaved={() => void loadWarranty(location.id)}
                        setMessage={setMessage}
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LocationCard({
  location,
  areas,
  canEdit,
  write,
  onUpdate,
}: {
  location: AdminMaintenanceLocation;
  areas: AdminMaintenanceLocation[];
  canEdit: boolean;
  write: <T>(
    path: string,
    method: "POST" | "PUT",
    body: Record<string, unknown>,
    update: (item: T) => void,
  ) => Promise<boolean>;
  onUpdate: (item: AdminMaintenanceLocation) => void;
}) {
  return (
    <div>
      <strong>{location.name}</strong>
      <p className="text-sm text-slate-600">
        {location.kind === "area" ? "Área" : "Equipamento"}
        {location.parent_name ? ` · ${location.parent_name}` : ""}
        {location.asset_tag ? ` · patrimônio ${location.asset_tag}` : ""}
        {location.warranty_ends_on
          ? ` · garantia até ${location.warranty_ends_on}`
          : ""}
        {location.is_active ? "" : " · inativo"}
      </p>
      {canEdit ? (
        <details>
          <summary className="cursor-pointer font-medium">Editar</summary>
          <form
            className="mt-2 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void write<AdminMaintenanceLocation>(
                `locations/${location.id}`,
                "PUT",
                {
                  ...locationPayload(data, location.kind),
                  expected_version: location.version,
                },
                onUpdate,
              );
            }}
          >
            <input
              name="name"
              aria-label={`Nome de ${location.name}`}
              defaultValue={location.name}
              required
              className="pms-field-input"
            />
            <input
              name="description"
              aria-label={`Descrição de ${location.name}`}
              defaultValue={location.description || ""}
              className="pms-field-input"
            />
            <input
              name="display_order"
              aria-label={`Ordem de ${location.name}`}
              type="number"
              defaultValue={location.display_order}
              className="pms-field-input"
            />
            <input
              type="hidden"
              name="is_active"
              value={String(location.is_active)}
            />
            {location.kind === "equipment" ? (
              <>
                <select
                  name="parent_location_id"
                  aria-label={`Área de ${location.name}`}
                  defaultValue={location.parent_location_id || ""}
                  className="pms-field-input"
                >
                  <option value="">Sem área pai</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                <EquipmentFields location={location} />
              </>
            ) : null}
            <div className="flex gap-2">
              <button className="pms-button-primary">Salvar</button>
              <button
                type="button"
                className="pms-button-secondary"
                onClick={() =>
                  void write<AdminMaintenanceLocation>(
                    `locations/${location.id}`,
                    "PUT",
                    {
                      ...location,
                      expected_version: location.version,
                      is_active: !location.is_active,
                    },
                    onUpdate,
                  )
                }
              >
                {location.is_active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function WarrantyPanel({
  context,
  replacements,
  onSaved,
  setMessage,
}: {
  context: WarrantyContext;
  replacements: AdminMaintenanceLocation[];
  onSaved: () => void;
  setMessage: (message: string) => void;
}) {
  const [result, setResult] = useState<MaintenanceWarrantyDecision["result"]>(
    "expiry_acknowledged",
  );
  const currentDecision = context.decisions.find(
    (decision) => decision.id === context.current_decision_id,
  );
  const correctionRequired =
    currentDecision?.warranty_ends_on === context.location.warranty_ends_on;
  const [correcting, setCorrecting] = useState(
    Boolean(context.current_decision_id),
  );
  useEffect(() => {
    setCorrecting(Boolean(context.current_decision_id));
  }, [context.current_decision_id]);
  return (
    <div className="mt-3 grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const response = await fetch(
            `/api/maintenance/locations/${context.location.id}/warranty-decisions`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                result,
                reason: field(data, "reason"),
                expected_location_version: context.location.version,
                occurrence_id: field(data, "occurrence_id") || undefined,
                replacement_location_id:
                  field(data, "replacement_location_id") || undefined,
                new_warranty_ends_on:
                  field(data, "new_warranty_ends_on") || undefined,
                supersedes_id:
                  correcting && context.current_decision_id
                    ? context.current_decision_id
                    : undefined,
              }),
            },
          );
          const payload = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          if (!response.ok)
            return setMessage(payload.message || "Falha ao registrar decisão.");
          setMessage(
            "Decisão de garantia registrada. A pendência será encerrada na próxima reconciliação.",
          );
          onSaved();
        }}
      >
        <label className="pms-field">
          Decisão
          <select
            className="pms-field-input min-w-0 w-full"
            value={result}
            onChange={(event) => setResult(event.target.value as typeof result)}
          >
            <option value="expiry_acknowledged">
              Registrar ciência do vencimento
            </option>
            <option value="claim_submitted">Acionar garantia</option>
            <option value="renewed">Renovar garantia</option>
            <option value="replaced">Substituir equipamento</option>
            <option value="retired">Aposentar equipamento</option>
          </select>
        </label>
        {context.current_decision_id ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm">
            <p className="mt-0">
              {correcting
                ? "Esta decisão corrigirá a decisão vigente e preservará todo o histórico."
                : "Uma nova decisão será registrada para a vigência atual."}
            </p>
            {!correctionRequired ? (
              <button
                type="button"
                className="pms-button-secondary"
                onClick={() => setCorrecting((value) => !value)}
              >
                {correcting
                  ? "Registrar decisão para vigência atual"
                  : "Corrigir decisão anterior"}
              </button>
            ) : null}
          </div>
        ) : null}
        {result === "claim_submitted" ? (
          <label className="pms-field">
            Ocorrência ativa vinculada
            <select
              className="pms-field-input min-w-0 w-full"
              style={{ minWidth: 0, width: "100%", maxWidth: "100%" }}
              name="occurrence_id"
              required
            >
              <option value="">Selecione</option>
              {context.active_occurrences.map((occurrence) => (
                <option key={occurrence.id} value={occurrence.id}>
                  {occurrence.code} · {occurrence.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {result === "renewed" ? (
          <label className="pms-field">
            Nova data de garantia
            <input
              className="pms-field-input min-w-0 w-full"
              type="date"
              name="new_warranty_ends_on"
              required
            />
          </label>
        ) : null}
        {result === "replaced" ? (
          <label className="pms-field">
            Equipamento substituto
            <select
              className="pms-field-input min-w-0 w-full"
              name="replacement_location_id"
              required
            >
              <option value="">Selecione</option>
              {replacements.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="pms-field">
          Justificativa
          <textarea
            className="pms-field-input"
            name="reason"
            minLength={3}
            maxLength={1000}
            required
          />
        </label>
        <button className="pms-button-primary justify-self-start">
          {correcting && context.current_decision_id
            ? "Corrigir decisão vigente"
            : "Registrar decisão auditável"}
        </button>
      </form>
      <details>
        <summary className="cursor-pointer font-medium">
          Histórico ({context.decisions.length})
        </summary>
        {context.decisions.length ? (
          <ol className="mt-2 grid gap-2">
            {context.decisions.map((decision) => (
              <li key={decision.id} className="rounded border p-2">
                <strong>{decision.result.replaceAll("_", " ")}</strong> ·{" "}
                {decision.decided_by_name || "Usuário"}
                <p>{decision.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>Nenhuma decisão registrada para este equipamento.</p>
        )}
      </details>
    </div>
  );
}
