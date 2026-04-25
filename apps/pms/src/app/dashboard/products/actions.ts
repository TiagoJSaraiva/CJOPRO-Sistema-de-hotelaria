"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createProduct, deleteProduct, updateProduct } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateProductPage(): void {
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/create");
  revalidatePath("/dashboard/products/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/products?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/products/${section}?status=${status}&r=${nonce}`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PRODUCT_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createProduct({
      name,
      category: String(formData.get("category") || "").trim() || null,
      unit_price: unitPrice,
      status: (String(formData.get("status") || "active").trim() as "active" | "inactive")
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
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unitPrice = Number(formData.get("unit_price") || "0");
  if (!id || !name || !Number.isFinite(unitPrice)) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateProduct(id, {
      name,
      category: String(formData.get("category") || "").trim() || null,
      unit_price: unitPrice,
      status: (String(formData.get("status") || "active").trim() as "active" | "inactive")
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
    const fallback = user?.permissions.includes(PERMISSIONS.PRODUCT_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteProduct(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateProductPage();
  redirectWithStatus("deleted", "view");
}
