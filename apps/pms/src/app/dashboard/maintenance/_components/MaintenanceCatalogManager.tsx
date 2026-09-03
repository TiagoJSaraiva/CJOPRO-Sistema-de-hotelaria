"use client";

import type {
  AdminMaintenanceCategory,
  AdminMaintenanceLocation,
} from "@hotel/shared";
import { useState } from "react";

export function MaintenanceCatalogManager({
  initialCategories,
  initialLocations,
}: {
  initialCategories: AdminMaintenanceCategory[];
  initialLocations: AdminMaintenanceLocation[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [locations, setLocations] = useState(initialLocations);
  const [message, setMessage] = useState("");

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
      return;
    }
    update(payload.item);
    setMessage("Catálogo atualizado.");
  }
  function upsert<T extends { id: string }>(items: T[], item: T) {
    return items.some((value) => value.id === item.id)
      ? items.map((value) => (value.id === item.id ? item : value))
      : [...items, item];
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {message ? (
        <p role="status" className="col-span-full rounded-lg bg-[#eef6ff] p-3">
          {message}
        </p>
      ) : null}
      <section
        className="rounded-xl border border-[#d7dce2] bg-white p-5"
        data-usage-guide="maintenance-settings-categories"
      >
        <h2 className="mt-0">Categorias</h2>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void write<AdminMaintenanceCategory>(
              "categories",
              "POST",
              {
                name: data.get("name"),
                description: data.get("description"),
                display_order: Number(data.get("display_order")),
                asset_tag:
                  data.get("kind") === "equipment"
                    ? data.get("asset_tag") || null
                    : null,
                manufacturer:
                  data.get("kind") === "equipment"
                    ? data.get("manufacturer") || null
                    : null,
                model:
                  data.get("kind") === "equipment"
                    ? data.get("model") || null
                    : null,
                serial_number:
                  data.get("kind") === "equipment"
                    ? data.get("serial_number") || null
                    : null,
                installed_on:
                  data.get("kind") === "equipment"
                    ? data.get("installed_on") || null
                    : null,
                warranty_ends_on:
                  data.get("kind") === "equipment"
                    ? data.get("warranty_ends_on") || null
                    : null,
                lifecycle_status:
                  data.get("kind") === "equipment" ? "active" : null,
              },
              (item) => setCategories((current) => upsert(current, item)),
            );
            event.currentTarget.reset();
          }}
        >
          <input
            name="name"
            required
            placeholder="Nome"
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
          <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">
              Patrimônio (somente equipamentos)
            </legend>
            <input
              name="asset_tag"
              placeholder="Etiqueta patrimonial"
              className="pms-field-input"
            />
            <input
              name="manufacturer"
              placeholder="Fabricante"
              className="pms-field-input"
            />
            <input
              name="model"
              placeholder="Modelo"
              className="pms-field-input"
            />
            <input
              name="serial_number"
              placeholder="Número de série"
              className="pms-field-input"
            />
            <label className="grid gap-1 text-sm">
              Instalação
              <input
                name="installed_on"
                type="date"
                className="pms-field-input"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Fim da garantia
              <input
                name="warranty_ends_on"
                type="date"
                className="pms-field-input"
              />
            </label>
          </fieldset>
          <button className="rounded bg-[#102a43] px-3 py-2 text-white">
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
                  write<AdminMaintenanceCategory>(
                    `categories/${category.id}`,
                    "PUT",
                    { is_active: !category.is_active },
                    (item) => setCategories((current) => upsert(current, item)),
                  )
                }
                className="rounded border px-2 py-1"
              >
                {category.is_active ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="rounded-xl border border-[#d7dce2] bg-white p-5"
        data-usage-guide="maintenance-settings-locations"
      >
        <h2 className="mt-0">Áreas e equipamentos</h2>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void write<AdminMaintenanceLocation>(
              "locations",
              "POST",
              {
                name: data.get("name"),
                kind: data.get("kind"),
                parent_location_id: data.get("parent_location_id") || null,
                description: data.get("description"),
                display_order: Number(data.get("display_order")),
              },
              (item) => setLocations((current) => upsert(current, item)),
            );
            event.currentTarget.reset();
          }}
        >
          <input
            name="name"
            required
            placeholder="Nome"
            className="pms-field-input"
          />
          <select
            name="kind"
            aria-label="Tipo do local"
            className="pms-field-input"
          >
            <option value="area">Área</option>
            <option value="equipment">Equipamento</option>
          </select>
          <select
            name="parent_location_id"
            aria-label="Área pai"
            className="pms-field-input"
          >
            <option value="">Sem área pai</option>
            {locations
              .filter((item) => item.kind === "area")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
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
          <button className="rounded bg-[#102a43] px-3 py-2 text-white">
            Criar local
          </button>
        </form>
        <ul className="mt-4 grid gap-2">
          {locations.map((location) => (
            <li
              key={location.id}
              className="flex items-center justify-between rounded border p-3"
            >
              <span>
                {location.kind === "area" ? "Área" : "Equipamento"} ·{" "}
                {location.name}
                {location.parent_name ? ` · ${location.parent_name}` : ""}
                {location.asset_tag
                  ? ` · patrimônio ${location.asset_tag}`
                  : ""}
                {location.warranty_ends_on
                  ? ` · garantia até ${location.warranty_ends_on}`
                  : ""}
                {location.is_active ? "" : " · inativo"}
              </span>
              <button
                onClick={() =>
                  write<AdminMaintenanceLocation>(
                    `locations/${location.id}`,
                    "PUT",
                    { is_active: !location.is_active },
                    (item) => setLocations((current) => upsert(current, item)),
                  )
                }
                className="rounded border px-2 py-1"
              >
                {location.is_active ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
