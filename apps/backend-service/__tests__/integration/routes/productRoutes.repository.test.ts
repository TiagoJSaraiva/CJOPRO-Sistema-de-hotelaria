import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerProductRoutes } from "../../../src/routes/productRoutes";
import type { ProductsRepository } from "../../../src/repositories/productsRepository";

const apps: ReturnType<typeof Fastify>[] = [];
const category = {
  id: "category-1",
  hotel_id: "hotel-1",
  name: "Frigobar",
  display_order: 0,
  is_active: true,
  archived_at: null,
};
const product = {
  id: "product-1",
  hotel_id: "hotel-1",
  name: "Água",
  category,
  description: null,
  internal_code: "AGUA",
  kind: "physical" as const,
  sales_unit: "unit" as const,
  unit_price: 8,
  status: "active" as const,
  archived_at: null,
};
function token(permissions: string[], hotelScoped = false) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments: [
      {
        roleId: "role-1",
        roleName: "Admin",
        roleType: hotelScoped ? "HOTEL_ROLE" : "SYSTEM_ROLE",
        hotelId: hotelScoped ? "hotel-1" : null,
        hotelName: hotelScoped ? "Hotel 1" : null,
      },
    ] as SessionPayload["roleAssignments"],
    iat: now,
    exp: now + 3600,
  });
}
function repository(): ProductsRepository {
  return {
    listProducts: vi.fn(async () => [product]),
    getProduct: vi.fn(async () => product),
    listCategories: vi.fn(async () => [category]),
    createProduct: vi.fn(async () => ({ result: "ok", item: product })),
    updateProduct: vi.fn(async () => ({ result: "ok", item: product })),
    setProductArchived: vi.fn(async () => ({ result: "ok", item: product })),
    createCategory: vi.fn(async () => ({ result: "ok", item: category })),
    updateCategory: vi.fn(async () => ({ result: "ok", item: category })),
    setCategoryArchived: vi.fn(async () => ({ result: "ok", item: category })),
    listProductHistory: vi.fn(async () => []),
  };
}
async function appWith(repo: ProductsRepository) {
  const app = Fastify();
  registerProductRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});
describe("product catalog routes", () => {
  it("requires an active hotel before listing products", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: "/admin/products",
      headers: { authorization: `Bearer ${token([PERMISSIONS.PRODUCT_READ])}` },
    });
    expect(response.statusCode).toBe(400);
    expect(repo.listProducts).not.toHaveBeenCalled();
  });
  it("creates a valid product inside the active hotel", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: {
        authorization: `Bearer ${token([PERMISSIONS.PRODUCT_CREATE], true)}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: {
        name: "Água",
        category_id: "category-1",
        kind: "physical",
        sales_unit: "unit",
        unit_price: 8,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(repo.createProduct).toHaveBeenCalledWith(
      "hotel-1",
      "user-1",
      expect.objectContaining({ category_id: "category-1" }),
    );
  });
  it("rejects invalid product payload before repository access", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: {
        authorization: `Bearer ${token([PERMISSIONS.PRODUCT_CREATE], true)}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: { name: "", unit_price: -1 },
    });
    expect(response.statusCode).toBe(400);
    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  it("rejects a hotel outside the signed-in user's scope", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: "/admin/products",
      headers: {
        authorization: `Bearer ${token([PERMISSIONS.PRODUCT_READ], true)}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-2",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(repo.listProducts).not.toHaveBeenCalled();
  });

  it("returns a conflict when the internal code is already used", async () => {
    const repo = repository();
    vi.mocked(repo.createProduct).mockResolvedValue({ result: "conflict" });
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/products",
      headers: {
        authorization: `Bearer ${token([PERMISSIONS.PRODUCT_CREATE], true)}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: {
        name: "Água",
        category_id: "category-1",
        internal_code: "AGUA",
        kind: "physical",
        sales_unit: "unit",
        unit_price: 8,
      },
    });
    expect(response.statusCode).toBe(409);
  });

  it("archives and restores products with the delete permission", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const headers = {
      authorization: `Bearer ${token([PERMISSIONS.PRODUCT_DELETE], true)}`,
      [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/products/product-1/archive",
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/products/product-1/restore",
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(repo.setProductArchived).toHaveBeenNthCalledWith(
      1,
      "product-1",
      "hotel-1",
      "user-1",
      true,
    );
    expect(repo.setProductArchived).toHaveBeenNthCalledWith(
      2,
      "product-1",
      "hotel-1",
      "user-1",
      false,
    );
  });

  it("lists categories and product history inside the active hotel", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const headers = {
      authorization: `Bearer ${token([PERMISSIONS.PRODUCT_READ], true)}`,
      [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
    };
    const categoriesResponse = await app.inject({
      method: "GET",
      url: "/admin/product-categories?include_archived=true",
      headers,
    });
    const historyResponse = await app.inject({
      method: "GET",
      url: "/admin/products/product-1/history",
      headers,
    });
    expect(categoriesResponse.statusCode).toBe(200);
    expect(historyResponse.statusCode).toBe(200);
    expect(repo.listCategories).toHaveBeenCalledWith("hotel-1", true);
    expect(repo.listProductHistory).toHaveBeenCalledWith(
      "product-1",
      "hotel-1",
    );
  });
});
