"use client";

import type { ReactNode } from "react";
import { ViewFiltersActionsBar, ViewFiltersModal } from "./ViewFiltersBase";

type EntityViewFilterableSectionProps<T> = {
  appliedFilterCount: number;
  totalCount: number;
  filteredItems: T[];
  itemLabelPlural: string;
  filtersTitle: string;
  isModalOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  emptyMessage: string;
  filteredEmptyMessage: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  filters: ReactNode;
  children?: ReactNode;
};

export function EntityViewFilterableSection<T>({
  appliedFilterCount,
  totalCount,
  filteredItems,
  itemLabelPlural,
  filtersTitle,
  isModalOpen,
  onOpenFilters,
  onCloseFilters,
  onApplyFilters,
  onClearFilters,
  emptyMessage,
  filteredEmptyMessage,
  getItemKey,
  renderItem,
  filters,
  children
}: EntityViewFilterableSectionProps<T>) {
  return (
    <section className="grid gap-[0.85rem]">
      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={onOpenFilters} onClear={onClearFilters}>
        {children}
      </ViewFiltersActionsBar>

      <p className="pms-status-muted">
        Exibindo {filteredItems.length} de {totalCount} {itemLabelPlural}.
      </p>

      <section className="grid gap-[0.75rem]">
        {filteredItems.length ? (
          filteredItems.map((item) => <div key={getItemKey(item)}>{renderItem(item)}</div>)
        ) : (
          <article className="pms-empty-state">{appliedFilterCount ? filteredEmptyMessage : emptyMessage}</article>
        )}
      </section>

      <ViewFiltersModal title={filtersTitle} open={isModalOpen} onClose={onCloseFilters} onApply={onApplyFilters} onClear={onClearFilters}>
        {filters}
      </ViewFiltersModal>
    </section>
  );
}