import type { AdminProduct, ProductKind, ProductStatus } from "@hotel/shared";

export type ProductViewFilters = {
  search: string;
  status: "all" | ProductStatus;
  kind: "all" | ProductKind;
  categoryId: string;
  archived: "all" | "active" | "archived";
  minPrice: string;
  maxPrice: string;
};

export const DEFAULT_PRODUCT_VIEW_FILTERS: ProductViewFilters = {
  search: "",
  status: "all",
  kind: "all",
  categoryId: "",
  archived: "active",
  minPrice: "",
  maxPrice: "",
};

export function countAppliedProductFilters(
  filters: ProductViewFilters,
): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.kind !== "all") total += 1;
  if (filters.categoryId) total += 1;
  if (filters.archived !== "active") total += 1;
  if (filters.minPrice.trim()) total += 1;
  if (filters.maxPrice.trim()) total += 1;

  return total;
}

export function applyProductViewFilters(
  products: AdminProduct[],
  filters: ProductViewFilters,
): AdminProduct[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const minPrice = Number(filters.minPrice || "");
  const maxPrice = Number(filters.maxPrice || "");

  return products.filter((product) => {
    if (search) {
      const haystack =
        `${product.name} ${product.internal_code || ""} ${product.category.name}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.status !== "all" && product.status !== filters.status) {
      return false;
    }
    if (filters.kind !== "all" && product.kind !== filters.kind) return false;
    if (filters.categoryId && product.category.id !== filters.categoryId)
      return false;
    if (filters.archived === "active" && product.archived_at) return false;
    if (filters.archived === "archived" && !product.archived_at) return false;

    if (
      filters.minPrice.trim() &&
      (!Number.isFinite(minPrice) || product.unit_price < minPrice)
    ) {
      return false;
    }

    if (
      filters.maxPrice.trim() &&
      (!Number.isFinite(maxPrice) || product.unit_price > maxPrice)
    ) {
      return false;
    }

    return true;
  });
}
