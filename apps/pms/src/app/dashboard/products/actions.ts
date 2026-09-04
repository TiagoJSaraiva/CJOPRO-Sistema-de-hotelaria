"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import {
  createProduct,
  setProductArchived,
  updateProduct,
  createProductCategory,
  updateProductCategory,
  archiveProductCategory,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateProductPage(): void {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/create");
  revalidatePath("/dashboard/products/view");
  revalidatePath("/dashboard/products/categories");
}

function redirectWithStatus(
  status: string,
  section: "create" | "view" | "categories" | "root" = "root",
): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/products?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/products/${section}?status=${status}&r=${nonce}`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  const categoryId = String(formData.get("category_id") || "").trim();
  const kind = String(formData.get("kind") || "");
  const salesUnit = String(formData.get("sales_unit") || "");
  const providerType = String(formData.get("provider_type") || "hotel");
  const partnerId = String(formData.get("commercial_partner_id") || "").trim();
  if (
    !name ||
    !categoryId ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    !["physical", "service"].includes(kind) ||
    !["unit", "portion", "person", "hour", "daily", "service"].includes(
      salesUnit,
    ) ||
    !["hotel", "partner"].includes(providerType) ||
    (providerType === "partner" && !partnerId)
  ) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createProduct({
      name,
      category_id: categoryId,
      description: String(formData.get("description") || "").trim() || null,
      internal_code: String(formData.get("internal_code") || "").trim() || null,
      kind: kind as "physical" | "service",
      sales_unit: salesUnit as
        "unit" | "portion" | "person" | "hour" | "daily" | "service",
      unit_price: unitPrice,
      status: String(formData.get("status") || "active").trim() as
        "active" | "inactive",
      provider_type: providerType as "hotel" | "partner",
      commercial_partner_id: providerType === "partner" ? partnerId : null,
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateProductPage();
  redirectWithStatus("created", "create");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  const categoryId = String(formData.get("category_id") || "").trim();
  const kind = String(formData.get("kind") || "");
  const salesUnit = String(formData.get("sales_unit") || "");
  if (
    !id ||
    !name ||
    !categoryId ||
    !Number.isFinite(unitPrice) ||
    !["physical", "service"].includes(kind) ||
    !["unit", "portion", "person", "hour", "daily", "service"].includes(
      salesUnit,
    )
  ) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateProduct(id, {
      name,
      category_id: categoryId,
      description: String(formData.get("description") || "").trim() || null,
      internal_code: String(formData.get("internal_code") || "").trim() || null,
      kind: kind as "physical" | "service",
      sales_unit: salesUnit as
        "unit" | "portion" | "person" | "hour" | "daily" | "service",
      unit_price: unitPrice,
      status: String(formData.get("status") || "active").trim() as
        "active" | "inactive",
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateProductPage();
  redirectWithStatus("updated", "view");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await setProductArchived(id, true);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateProductPage();
  redirectWithStatus("archived", "view");
}

export async function restoreProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("archive_missing_id", "view");

  try {
    await setProductArchived(id, false);
  } catch {
    redirectWithStatus("restore_error", "view");
  }

  revalidateProductPage();
  redirectWithStatus("restored", "view");
}

export async function createProductCategoryAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.PRODUCT_CREATE))
    redirectWithStatus("forbidden", "categories");
  const name = String(formData.get("name") || "").trim();
  const displayOrder = Number(formData.get("display_order") || "0");
  if (!name || !Number.isInteger(displayOrder) || displayOrder < 0)
    redirectWithStatus("create_missing_fields", "categories");
  try {
    await createProductCategory({
      name,
      display_order: displayOrder,
      is_active: true,
    });
  } catch {
    redirectWithStatus("create_error", "categories");
  }
  revalidateProductPage();
  redirect("/dashboard/products/categories?status=created");
}

export async function updateProductCategoryAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.PRODUCT_UPDATE))
    redirectWithStatus("forbidden", "categories");
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const displayOrder = Number(formData.get("display_order") || "0");
  if (!id || !name || !Number.isInteger(displayOrder) || displayOrder < 0)
    redirect("/dashboard/products/categories?status=update_missing_fields");
  try {
    await updateProductCategory(id, {
      name,
      display_order: displayOrder,
      is_active: formData.get("is_active") === "on",
    });
  } catch {
    redirect("/dashboard/products/categories?status=update_error");
  }
  revalidateProductPage();
  redirect("/dashboard/products/categories?status=updated");
}

export async function archiveProductCategoryAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.PRODUCT_DELETE))
    redirectWithStatus("forbidden", "categories");
  const id = String(formData.get("id") || "").trim();
  const archived = formData.get("archived") === "true";
  if (!id)
    redirect("/dashboard/products/categories?status=update_missing_fields");
  try {
    await archiveProductCategory(id, archived);
  } catch {
    redirect("/dashboard/products/categories?status=update_error");
  }
  revalidateProductPage();
  redirect("/dashboard/products/categories?status=updated");
}
