"use client";

import type { AdminProduct } from "@hotel/shared";
import { deleteProductAction, updateProductAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type ProductListItemProps = {
  product: AdminProduct;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function ProductDataPreview({ product }: { product: AdminProduct }) {
  const createdAt = product.created_at ? new Date(product.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = product.updated_at ? new Date(product.updated_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Nome:</strong>
        <p className="m-0 mt-[0.2rem]">{product.name}</p>
      </div>
      <div>
        <strong>Categoria:</strong>
        <p className="m-0 mt-[0.2rem]">{product.category || "-"}</p>
      </div>
      <div>
        <strong>Preco unitario:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {product.unit_price.toFixed(2)}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{product.status}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p className="m-0 mt-[0.2rem]">{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p className="m-0 mt-[0.2rem]">{updatedAt}</p>
      </div>
    </div>
  );
}

function ProductEditForm({ product }: { product: AdminProduct }) {
  return (
    <form action={updateProductAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={product.id} />

      <div className="pms-field">
        <label htmlFor={`product-name-${product.id}`}>Nome</label>
        <input id={`product-name-${product.id}`} name="name" defaultValue={product.name} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`product-category-${product.id}`}>Categoria</label>
        <input id={`product-category-${product.id}`} name="category" defaultValue={product.category || ""} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`product-price-${product.id}`}>Preco unitario</label>
        <input id={`product-price-${product.id}`} name="unit_price" type="number" min={0} step="0.01" defaultValue={product.unit_price} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`product-status-${product.id}`}>Status</label>
        <select id={`product-status-${product.id}`} name="status" defaultValue={product.status} className="pms-field-input">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function ProductListItem({ product, canRead, canUpdate, canDelete, isViewing, isEditing }: ProductListItemProps) {
  const viewHref = `/dashboard/products/view?productId=${product.id}&mode=view`;
  const editHref = `/dashboard/products/view?productId=${product.id}&mode=edit`;

  return (
    <DashboardEntityListItemFrame
      title={product.name}
      subtitle={`R$ ${product.unit_price.toFixed(2)} | ${product.status}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={product.id}
          deleteAction={deleteProductAction}
        />
      }
    >
      {isViewing ? <ProductDataPreview product={product} /> : null}
      {isEditing ? <ProductEditForm product={product} /> : null}
    </DashboardEntityListItemFrame>
  );
}