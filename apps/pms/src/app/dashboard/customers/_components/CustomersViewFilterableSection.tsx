"use client";

import { useMemo } from "react";
import type { AdminCustomer } from "@hotel/shared";
import {
  DEFAULT_CUSTOMER_VIEW_FILTERS,
  applyCustomerViewFilters,
  countAppliedCustomerFilters,
  type CustomerViewFilters
} from "./customerViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { CustomerListItem } from "./CustomerListItem";

type CustomersViewFilterableSectionProps = {
  customers: AdminCustomer[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeCustomerId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function CustomersViewFilterableSection({ customers, canRead, canUpdate, canDelete, activeCustomerId, mode, children }: CustomersViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<CustomerViewFilters>(DEFAULT_CUSTOMER_VIEW_FILTERS);

  const appliedFilterCount = countAppliedCustomerFilters(appliedFilters);
  const filteredCustomers = useMemo(() => applyCustomerViewFilters(customers, appliedFilters), [customers, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={customers.length}
      filteredItems={filteredCustomers}
      itemLabelPlural="clientes"
      filtersTitle="Filtros de clientes"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhum cliente cadastrado ate o momento."
      filteredEmptyMessage="Nenhum cliente corresponde aos filtros aplicados."
      getItemKey={(customer) => customer.id}
      renderItem={(customer) => (
        <CustomerListItem
          customer={customer}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeCustomerId === customer.id && mode === "view"}
          isEditing={activeCustomerId === customer.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field">
            <span>Nome, documento ou contato</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: maria, CPF, email"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo de documento</span>
            <input
              value={draftFilters.documentType}
              onChange={(event) => updateDraftFilter("documentType", event.target.value)}
              placeholder="Ex.: CPF"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Nascimento a partir de</span>
            <input type="date" value={draftFilters.birthFrom} onChange={(event) => updateDraftFilter("birthFrom", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Nascimento até</span>
            <input type="date" value={draftFilters.birthTo} onChange={(event) => updateDraftFilter("birthTo", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}