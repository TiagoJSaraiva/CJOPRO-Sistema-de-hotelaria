"use client";

import Link from "next/link";
import type { AdminCustomer } from "@hotel/shared";
import { deleteCustomerAction, updateCustomerAction } from "../actions";

type CustomerListItemProps = {
  customer: AdminCustomer;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function CustomerDataPreview({ customer }: { customer: AdminCustomer }) {
  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Nome:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.full_name}</p>
      </div>
      <div>
        <strong>Documento:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.document_type}: {customer.document_number}</p>
      </div>
      <div>
        <strong>Nascimento:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.birth_date}</p>
      </div>
      <div>
        <strong>Email:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.email || "-"}</p>
      </div>
      <div>
        <strong>Celular:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.mobile_phone || "-"}</p>
      </div>
      <div>
        <strong>Telefone:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.phone || "-"}</p>
      </div>
      <div>
        <strong>Nacionalidade:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.nationality || "-"}</p>
      </div>
      <div>
        <strong>Observacoes:</strong>
        <p className="m-0 mt-[0.2rem]">{customer.notes || "-"}</p>
      </div>
    </div>
  );
}

function CustomerEditForm({ customer }: { customer: AdminCustomer }) {
  return (
    <form action={updateCustomerAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={customer.id} />

      <div className="pms-field">
        <label htmlFor={`customer-name-${customer.id}`}>Nome completo</label>
        <input id={`customer-name-${customer.id}`} name="full_name" defaultValue={customer.full_name} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-document-number-${customer.id}`}>Numero do documento</label>
        <input id={`customer-document-number-${customer.id}`} name="document_number" defaultValue={customer.document_number} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-document-type-${customer.id}`}>Tipo do documento</label>
        <input id={`customer-document-type-${customer.id}`} name="document_type" defaultValue={customer.document_type} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-birth-date-${customer.id}`}>Nascimento</label>
        <input id={`customer-birth-date-${customer.id}`} name="birth_date" type="date" defaultValue={customer.birth_date} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-email-${customer.id}`}>Email</label>
        <input id={`customer-email-${customer.id}`} name="email" type="email" defaultValue={customer.email || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-mobile-${customer.id}`}>Celular</label>
        <input id={`customer-mobile-${customer.id}`} name="mobile_phone" defaultValue={customer.mobile_phone || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-phone-${customer.id}`}>Telefone</label>
        <input id={`customer-phone-${customer.id}`} name="phone" defaultValue={customer.phone || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-nationality-${customer.id}`}>Nacionalidade</label>
        <input id={`customer-nationality-${customer.id}`} name="nationality" defaultValue={customer.nationality || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`customer-notes-${customer.id}`}>Observacoes</label>
        <input id={`customer-notes-${customer.id}`} name="notes" defaultValue={customer.notes || ""} className="pms-field-input" />
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function CustomerListItem({ customer, canRead, canUpdate, canDelete, isViewing, isEditing }: CustomerListItemProps) {
  const viewHref = `/dashboard/customers/view?customerId=${customer.id}&mode=view`;
  const editHref = `/dashboard/customers/view?customerId=${customer.id}&mode=edit`;

  return (
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{customer.full_name}</h3>
          <p className="m-0 text-[#555]">{customer.document_type}: {customer.document_number}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              className={`rounded-lg border border-[#2d6cdf] px-[0.65rem] py-[0.45rem] no-underline ${
                isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
              }`}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              className={`rounded-lg border border-[#0f766e] px-[0.65rem] py-[0.45rem] no-underline ${
                isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
              }`}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <CustomerDataPreview customer={customer} /> : null}
      {isEditing ? <CustomerEditForm customer={customer} /> : null}
    </article>
  );
}