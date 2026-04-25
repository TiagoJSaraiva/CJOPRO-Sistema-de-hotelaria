"use client";

import { useMemo } from "react";
import type { AdminCustomer } from "@hotel/shared";
import { deleteCustomerAction, updateCustomerAction } from "../actions";
import {
  DEFAULT_CUSTOMER_VIEW_FILTERS,
  applyCustomerViewFilters,
  countAppliedCustomerFilters,
  type CustomerViewFilters
} from "./customerViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type CustomersViewFilterableSectionProps = {
  customers: AdminCustomer[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function CustomersViewFilterableSection({ customers, canUpdate, canDelete, children }: CustomersViewFilterableSectionProps) {
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
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">{customer.full_name}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">
            {customer.document_type}: {customer.document_number}
          </p>

          {canUpdate ? (
            <form action={updateCustomerAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={customer.id} />
              <input name="full_name" defaultValue={customer.full_name} required className="pms-field-input" />
              <input name="document_number" defaultValue={customer.document_number} required className="pms-field-input" />
              <input name="document_type" defaultValue={customer.document_type} required className="pms-field-input" />
              <input name="birth_date" type="date" defaultValue={customer.birth_date} required className="pms-field-input" />
              <input name="email" type="email" defaultValue={customer.email || ""} className="pms-field-input" />
              <input name="mobile_phone" defaultValue={customer.mobile_phone || ""} className="pms-field-input" />
              <input name="phone" defaultValue={customer.phone || ""} className="pms-field-input" />
              <input name="nationality" defaultValue={customer.nationality || ""} className="pms-field-input" />
              <input name="notes" defaultValue={customer.notes || ""} className="pms-field-input" />
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteCustomerAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={customer.id} />
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