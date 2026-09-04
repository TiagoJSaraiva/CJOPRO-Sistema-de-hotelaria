import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const {
  redirectMock,
  revalidatePathMock,
  getUserFromSessionMock,
  createProductMock,
  updateProductMock,
  setProductArchivedMock,
  createProductCategoryMock,
  updateProductCategoryMock,
  archiveProductCategoryMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  getUserFromSessionMock: vi.fn(),
  createProductMock: vi.fn(),
  updateProductMock: vi.fn(),
  setProductArchivedMock: vi.fn(),
  createProductCategoryMock: vi.fn(),
  updateProductCategoryMock: vi.fn(),
  archiveProductCategoryMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: getUserFromSessionMock,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  setProductArchived: setProductArchivedMock,
  createProductCategory: createProductCategoryMock,
  updateProductCategory: updateProductCategoryMock,
  archiveProductCategory: archiveProductCategoryMock,
}));

import {
  createProductAction,
  createProductCategoryAction,
  deleteProductAction,
  restoreProductAction,
} from "../../../../src/app/dashboard/products/actions";

function productForm(): FormData {
  const formData = new FormData();
  formData.set("name", "Massagem relaxante");
  formData.set("category_id", "category-1");
  formData.set("internal_code", "SPA-050");
  formData.set("description", "Sessão de cinquenta minutos");
  formData.set("kind", "service");
  formData.set("sales_unit", "service");
  formData.set("unit_price", "180");
  formData.set("status", "active");
  return formData;
}

describe("dashboard/products/actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a hotel-provided service with the complete catalog payload", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PRODUCT_CREATE],
    });
    createProductMock.mockResolvedValueOnce({ id: "product-1" });

    await expect(createProductAction(productForm())).rejects.toThrow(
      /^REDIRECT:\/dashboard\/products\/create\?status=created&r=/,
    );
    expect(createProductMock).toHaveBeenCalledWith({
      name: "Massagem relaxante",
      category_id: "category-1",
      internal_code: "SPA-050",
      description: "Sessão de cinquenta minutos",
      kind: "service",
      sales_unit: "service",
      unit_price: 180,
      status: "active",
      provider_type: "hotel",
      commercial_partner_id: null,
    });
  });

  it("rejects an invalid item before calling the API", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PRODUCT_CREATE],
    });
    const formData = productForm();
    formData.set("sales_unit", "bottle");

    await expect(createProductAction(formData)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/products\/create\?status=create_missing_fields&r=/,
    );
    expect(createProductMock).not.toHaveBeenCalled();
  });

  it("creates a partner-provided item with an immutable provider reference", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PRODUCT_CREATE],
    });
    const formData = productForm();
    formData.set("provider_type", "partner");
    formData.set("commercial_partner_id", "partner-1");
    await expect(createProductAction(formData)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/products\/create\?status=created&r=/,
    );
    expect(createProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_type: "partner",
        commercial_partner_id: "partner-1",
      }),
    );
  });

  it("archives and restores an item with the existing delete permission", async () => {
    getUserFromSessionMock.mockResolvedValue({
      permissions: [PERMISSIONS.PRODUCT_DELETE],
    });
    setProductArchivedMock.mockResolvedValue({ id: "product-1" });
    const formData = new FormData();
    formData.set("id", "product-1");

    await expect(deleteProductAction(formData)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/products\/view\?status=archived&r=/,
    );
    await expect(restoreProductAction(formData)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/products\/view\?status=restored&r=/,
    );
    expect(setProductArchivedMock).toHaveBeenNthCalledWith(
      1,
      "product-1",
      true,
    );
    expect(setProductArchivedMock).toHaveBeenNthCalledWith(
      2,
      "product-1",
      false,
    );
  });

  it("creates an ordered category and revalidates every catalog surface", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PRODUCT_CREATE],
    });
    createProductCategoryMock.mockResolvedValueOnce({ id: "category-1" });
    const formData = new FormData();
    formData.set("name", "Bem-estar");
    formData.set("display_order", "2");

    await expect(createProductCategoryAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/products/categories?status=created",
    );
    expect(createProductCategoryMock).toHaveBeenCalledWith({
      name: "Bem-estar",
      display_order: 2,
      is_active: true,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/products/categories",
    );
  });
});
