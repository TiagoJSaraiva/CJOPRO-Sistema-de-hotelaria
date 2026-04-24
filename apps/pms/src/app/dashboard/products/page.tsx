import { getUserFromSession } from "../../../lib/auth";
import { listProducts } from "../../../lib/adminApi";
import { getProductsAccess } from "./access";
import { createProductAction, deleteProductAction, updateProductAction } from "./actions";

type ProductsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await getUserFromSession();
  const access = getProductsAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Produtos</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const products = access.canRead ? await listProducts() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Produtos</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
        <article className="pms-surface-card">
          <h3 className="mt-0">Criar produto</h3>
          <form key={searchParams?.r} action={createProductAction} className="grid gap-[0.65rem] md:grid-cols-2">
            <input name="name" placeholder="Nome" required className="pms-field-input" />
            <input name="category" placeholder="Categoria" className="pms-field-input" />
            <input name="unit_price" type="number" min={0} step="0.01" placeholder="Preco unitario" required className="pms-field-input" />
            <select name="status" defaultValue="active" className="pms-field-input">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
              Criar produto
            </button>
          </form>
        </article>
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {products.map((product) => (
            <article key={product.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">{product.name}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">R$ {product.unit_price.toFixed(2)} | {product.status}</p>

              {access.canUpdate ? (
                <form action={updateProductAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
                  <input type="hidden" name="id" value={product.id} />
                  <input name="name" defaultValue={product.name} required className="pms-field-input" />
                  <input name="category" defaultValue={product.category || ""} className="pms-field-input" />
                  <input name="unit_price" type="number" min={0} step="0.01" defaultValue={product.unit_price} required className="pms-field-input" />
                  <select name="status" defaultValue={product.status} className="pms-field-input">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                    Salvar
                  </button>
                </form>
              ) : null}

              {access.canDelete ? (
                <form action={deleteProductAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={product.id} />
                  <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                    Apagar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
