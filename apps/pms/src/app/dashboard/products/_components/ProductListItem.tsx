"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type {
  AdminCatalogAuditEvent,
  AdminProduct,
  AdminProductCategory,
} from "@hotel/shared";
import {
  deleteProductAction,
  restoreProductAction,
  updateProductAction,
} from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

const units: Record<AdminProduct["sales_unit"], string> = {
  unit: "Unidade",
  portion: "Porção",
  person: "Pessoa",
  hour: "Hora",
  daily: "Diária",
  service: "Serviço",
};
const detailTabs = ["information", "price", "history"] as const;
type DetailTab = (typeof detailTabs)[number];

export function ProductListItem({
  product,
  categories,
  history,
  canRead,
  canUpdate,
  canDelete,
  isViewing,
  isEditing,
}: {
  product: AdminProduct;
  categories: AdminProductCategory[];
  history: AdminCatalogAuditEvent[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
}) {
  const [activeDetailTab, setActiveDetailTab] =
    useState<DetailTab>("information");
  const detailTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const viewHref = `/dashboard/products/view?productId=${product.id}&mode=view`;
  const editHref = `/dashboard/products/view?productId=${product.id}&mode=edit`;
  const availableCategories = categories.filter(
    (category) =>
      (category.is_active && !category.archived_at) ||
      category.id === product.category.id,
  );
  const changeDetailTabWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % detailTabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + detailTabs.length) % detailTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = detailTabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = detailTabs[nextIndex];
    if (!nextTab) return;
    setActiveDetailTab(nextTab);
    detailTabRefs.current[nextIndex]?.focus();
  };
  return (
    <DashboardEntityListItemFrame
      title={product.name}
      subtitle={`${product.category.name} · ${product.kind === "physical" ? "Produto" : "Serviço"} · R$ ${product.unit_price.toFixed(2)}${product.archived_at ? " · Arquivado" : ""}`}
      actions={
        <>
          <DashboardEntityActionButtons
            canRead={canRead}
            canUpdate={canUpdate}
            canDelete={canDelete && !product.archived_at}
            isViewing={isViewing}
            isEditing={isEditing}
            viewHref={viewHref}
            editHref={editHref}
            deleteId={product.id}
            deleteAction={deleteProductAction}
            deleteLabel="Arquivar"
          />
          {canDelete && product.archived_at ? (
            <form action={restoreProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <button
                type="submit"
                className="rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]"
              >
                Restaurar
              </button>
            </form>
          ) : null}
        </>
      }
    >
      {isViewing ? (
        <div className="mt-3 grid gap-3">
          <div
            role="tablist"
            aria-label={`Ficha de ${product.name}`}
            className="flex flex-wrap gap-2"
          >
            {detailTabs.map((tab, index) => (
              <button
                key={tab}
                ref={(element) => {
                  detailTabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${product.id}-${tab}-tab`}
                aria-controls={`${product.id}-${tab}-panel`}
                aria-selected={activeDetailTab === tab}
                data-usage-guide={
                  tab === "history" ? "products-history" : undefined
                }
                tabIndex={activeDetailTab === tab ? 0 : -1}
                onClick={() => setActiveDetailTab(tab)}
                onKeyDown={(event) => changeDetailTabWithKeyboard(event, index)}
                className={`rounded-lg border px-3 py-2 ${
                  activeDetailTab === tab
                    ? "border-[#0f766e] bg-[#ddf5f2] text-[#0a5f58]"
                    : "border-slate-300 bg-white"
                }`}
              >
                {tab === "information"
                  ? "Informações"
                  : tab === "price"
                    ? "Preço"
                    : "Histórico"}
              </button>
            ))}
          </div>
          {activeDetailTab === "information" ? (
            <section
              role="tabpanel"
              id={`${product.id}-information-panel`}
              aria-labelledby={`${product.id}-information-tab`}
              className="grid gap-3"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <span>
                  <strong>Código:</strong> {product.internal_code || "-"}
                </span>
                <span>
                  <strong>Tipo:</strong>{" "}
                  {product.kind === "physical" ? "Produto físico" : "Serviço"}
                </span>
                <span>
                  <strong>Status:</strong>{" "}
                  {product.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <span>
                <strong>Fornecedor:</strong> Hotel
              </span>
              <p className="m-0">{product.description || "Sem descrição."}</p>
            </section>
          ) : null}
          {activeDetailTab === "price" ? (
            <section
              role="tabpanel"
              id={`${product.id}-price-panel`}
              aria-labelledby={`${product.id}-price-tab`}
              className="grid gap-2"
            >
              <span>
                <strong>Preço atual:</strong> R$ {product.unit_price.toFixed(2)}
              </span>
              <span>
                <strong>Unidade de venda:</strong> {units[product.sales_unit]}
              </span>
            </section>
          ) : null}
          {activeDetailTab === "history" ? (
            <section
              role="tabpanel"
              id={`${product.id}-history-panel`}
              aria-labelledby={`${product.id}-history-tab`}
            >
              {history.length ? (
                <ul className="m-0 grid gap-1 pl-5">
                  {history.map((event) => (
                    <li key={event.id}>
                      {new Date(event.created_at).toLocaleString("pt-BR")} ·{" "}
                      {event.action} · {event.actor_name || "Sistema"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0">Sem eventos registrados.</p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
      {isEditing ? (
        <form
          action={updateProductAction}
          className="mt-3 grid gap-3"
          data-usage-guide="products-form"
        >
          <input type="hidden" name="id" value={product.id} />
          <label className="pms-field">
            Nome
            <input
              name="name"
              defaultValue={product.name}
              required
              className="pms-field-input"
            />
          </label>
          <label className="pms-field">
            Categoria
            <select
              name="category_id"
              defaultValue={product.category.id}
              required
              className="pms-field-input"
            >
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Código interno
            <input
              name="internal_code"
              defaultValue={product.internal_code || ""}
              className="pms-field-input"
            />
          </label>
          <label className="pms-field">
            Descrição
            <textarea
              name="description"
              defaultValue={product.description || ""}
              maxLength={1000}
              className="pms-field-input"
            />
          </label>
          <label className="pms-field">
            Tipo
            <select
              name="kind"
              defaultValue={product.kind}
              className="pms-field-input"
            >
              <option value="physical">Produto físico</option>
              <option value="service">Serviço</option>
            </select>
          </label>
          <label className="pms-field">
            Unidade de venda
            <select
              name="sales_unit"
              defaultValue={product.sales_unit}
              className="pms-field-input"
            >
              {Object.entries(units).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Preço unitário
            <input
              name="unit_price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product.unit_price}
              required
              className="pms-field-input"
            />
          </label>
          <label className="pms-field">
            Status
            <select
              name="status"
              defaultValue={product.status}
              className="pms-field-input"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <button
            type="submit"
            className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-3 py-2 text-white"
          >
            Salvar alterações
          </button>
        </form>
      ) : null}
    </DashboardEntityListItemFrame>
  );
}
