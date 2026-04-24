"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createProduct, deleteProduct, updateProduct } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateProductPage(): void {
  revalidatePath("/dashboard/products");
}

function redirectWithStatus(status: string): never {
  redirect(`/dashboard/products?status=${status}&r=${Date.now().toString(36)}`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_CREATE)) redirectWithStatus("forbidden");

  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) redirectWithStatus("create_missing_fields");

  try {
    await createProduct({
      name,
      category: String(formData.get("category") || "").trim() || null,
      unit_price: unitPrice,
      status: (String(formData.get("status") || "active").trim() as "active" | "inactive")
    });
  } catch {
    redirectWithStatus("create_error");
  }

  revalidateProductPage();
  redirectWithStatus("created");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_UPDATE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  if (!id || !name || !Number.isFinite(unitPrice)) redirectWithStatus("update_missing_fields");

  try {
    await updateProduct(id, {
      name,
      category: String(formData.get("category") || "").trim() || null,
      unit_price: unitPrice,
      status: (String(formData.get("status") || "active").trim() as "active" | "inactive")
    });
  } catch {
    redirectWithStatus("update_error");
  }

  revalidateProductPage();
  redirectWithStatus("updated");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_DELETE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("delete_missing_id");

  try {
    await deleteProduct(id);
  } catch {
    redirectWithStatus("delete_error");
  }

  revalidateProductPage();
  redirectWithStatus("deleted");
}
