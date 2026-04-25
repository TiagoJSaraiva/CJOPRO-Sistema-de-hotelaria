"use client";

import { useMemo } from "react";
import type { AdminProduct } from "@hotel/shared";
import {
  DEFAULT_PRODUCT_VIEW_FILTERS,
  applyProductViewFilters,
  countAppliedProductFilters,
  type ProductViewFilters
} from "./productViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { ProductListItem } from "./ProductListItem";

type ProductsViewFilterableSectionProps = {
  products: AdminProduct[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeProductId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function ProductsViewFilterableSection({ products, canRead, canUpdate, canDelete, activeProductId, mode, children }: ProductsViewFilterableSectionProps) {
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
        <ProductListItem
          product={product}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeProductId === product.id && mode === "view"}
          isEditing={activeProductId === product.id && mode === "edit"}
        />
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