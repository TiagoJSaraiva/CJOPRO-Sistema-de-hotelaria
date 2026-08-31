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
      <section className="rounded-xl border border-[#d7dce2] bg-white p-5">
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
            defaultValue="0"
            className="pms-field-input"
          />
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
      <section className="rounded-xl border border-[#d7dce2] bg-white p-5">
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
          <select name="kind" className="pms-field-input">
            <option value="area">Área</option>
            <option value="equipment">Equipamento</option>
          </select>
          <select name="parent_location_id" className="pms-field-input">
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
