"use client";

import { useMemo } from "react";
import type { AdminProduct } from "@hotel/shared";
import { deleteProductAction, updateProductAction } from "../actions";
import {
  DEFAULT_PRODUCT_VIEW_FILTERS,
  applyProductViewFilters,
  countAppliedProductFilters,
  type ProductViewFilters
} from "./productViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type ProductsViewFilterableSectionProps = {
  products: AdminProduct[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function ProductsViewFilterableSection({ products, canUpdate, canDelete, children }: ProductsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<ProductViewFilters>(DEFAULT_PRODUCT_VIEW_FILTERS);

  const appliedFilterCount = countAppliedProductFilters(appliedFilters);
  const filteredProducts = useMemo(() => applyProductViewFilters(products, appliedFilters), [products, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={products.length}
      filteredItems={filteredProducts}
      itemLabelPlural="produtos"
      filtersTitle="Filtros de produtos"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhum produto cadastrado ate o momento."
      filteredEmptyMessage="Nenhum produto corresponde aos filtros aplicados."
      getItemKey={(product) => product.id}
      renderItem={(product) => (
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">{product.name}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">R$ {product.unit_price.toFixed(2)} | {product.status}</p>

          {canUpdate ? (
            <form action={updateProductAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={product.id} />
              <input name="name" defaultValue={product.name} required className="pms-field-input" />
              <input name="category" defaultValue={product.category || ""} className="pms-field-input" />
              <input name="unit_price" type="number" min={0} step="0.01" defaultValue={product.unit_price} required className="pms-field-input" />
              <select name="status" defaultValue={product.status} className="pms-field-input">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteProductAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={product.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar
              </button>
            </form>
          ) : null}
        </article>
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field">
            <span>Nome ou categoria</span>
            <input value={draftFilters.search} onChange={(event) => updateDraftFilter("search", event.target.value)} placeholder="Ex.: cafe, frigobar" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select value={draftFilters.status} onChange={(event) => updateDraftFilter("status", event.target.value as ProductViewFilters["status"])} className={viewFiltersFieldClassName}>
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Preço mínimo</span>
            <input type="number" min={0} step="0.01" value={draftFilters.minPrice} onChange={(event) => updateDraftFilter("minPrice", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Preço máximo</span>
            <input type="number" min={0} step="0.01" value={draftFilters.maxPrice} onChange={(event) => updateDraftFilter("maxPrice", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}