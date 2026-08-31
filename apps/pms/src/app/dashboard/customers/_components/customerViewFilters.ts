import type { AdminCustomer } from "@hotel/shared";

export type CustomerViewFilters = {
  search: string;
  documentType: string;
  birthFrom: string;
  birthTo: string;
};

export const DEFAULT_CUSTOMER_VIEW_FILTERS: CustomerViewFilters = {
  search: "",
  documentType: "",
  birthFrom: "",
  birthTo: "",
};

function parseDateStart(value: string): number | null {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const parts = raw.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const timestamp = new Date(year, month - 1, day).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseDateEnd(value: string): number | null {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const parts = raw.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const timestamp = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function countAppliedCustomerFilters(
  filters: CustomerViewFilters,
): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.documentType.trim()) total += 1;
  if (filters.birthFrom.trim()) total += 1;
  if (filters.birthTo.trim()) total += 1;

  return total;
}

export function applyCustomerViewFilters(
  customers: AdminCustomer[],
  filters: CustomerViewFilters,
): AdminCustomer[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const documentType = filters.documentType.trim().toLocaleLowerCase();
  const birthFrom = parseDateStart(filters.birthFrom);
  const birthTo = parseDateEnd(filters.birthTo);

  return customers.filter((customer) => {
    if (search) {
      const haystack =
        `${customer.full_name} ${customer.document_number} ${customer.email || ""} ${customer.mobile_phone || ""} ${customer.phone || ""}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (
      documentType &&
      customer.document_type.toLocaleLowerCase() !== documentType
    ) {
      return false;
    }

    if (birthFrom !== null || birthTo !== null) {
      const birthAt = new Date(`${customer.birth_date}T00:00:00`).getTime();

      if (Number.isNaN(birthAt)) {
        return false;
      }

      if (birthFrom !== null && birthAt < birthFrom) {
        return false;
      }

      if (birthTo !== null && birthAt > birthTo) {
        return false;
      }
    }

    return true;
  });
}
