import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import {
  getInventoryOverview,
  listInventoryAuditEvents,
  listInventoryCounts,
  listInventoryLocations,
  listInventoryMovements,
  listProducts,
} from "../../../../lib/adminApi";
import { getInventoryAccess } from "../access";
import { inventoryGuide } from "../usageGuides";
import {
  archiveInventoryLocationAction,
  createInventoryCountAction,
  createInventoryLocationAction,
  createInventoryPositionAction,
  finishInventoryCountAction,
  postInventoryDocumentAction,
  reorderInventoryLocationsAction,
  transferInventoryAction,
  updateInventoryCountAction,
  updateInventoryPolicyAction,
  updateInventoryPositionAction,
} from "../actions";

export type InventoryTab = "overview" | "movements" | "counts" | "settings";
const tabs = [
  {
    key: "overview",
    label: "Visão geral",
    href: "/dashboard/inventory/overview",
  },
  {
    key: "movements",
    label: "Movimentações",
    href: "/dashboard/inventory/movements",
  },
  { key: "counts", label: "Contagens", href: "/dashboard/inventory/counts" },
  {
    key: "settings",
    label: "Configurações",
    href: "/dashboard/inventory/settings",
  },
];
function statusText(status?: string) {
  const labels: Record<string, string> = {
    created: "Registro criado.",
    updated: "Alteração salva.",
    enabled: "Controle ativado.",
    posted: "Movimento registrado.",
    transferred: "Transferência concluída.",
    concurrent: "O saldo mudou; atualize e reconte os itens afetados.",
    "in-use": "O local ainda possui saldo ou vínculos operacionais ativos.",
    ineligible:
      "Somente produtos físicos próprios vendidos por unidade ou porção podem ser controlados.",
    conflict: "A operação conflita com o estado atual do estoque.",
    invalid: "Revise os campos informados.",
    forbidden: "Ação não autorizada.",
  };
  return status ? labels[status] || status : null;
}
const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function InventoryWorkspace({
  tab,
  status,
}: {
  tab: InventoryTab;
  status?: string;
}) {
  const access = getInventoryAccess(await getUserFromSession());
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Estoque"
        message="Sem permissão para consultar o estoque do hotel ativo."
      />
    );
  const [overview, locations, products] = await Promise.all([
    getInventoryOverview(),
    listInventoryLocations(true),
    listProducts(true),
  ]);
  const activeLocations = locations.filter(
    (item) => item.is_active && !item.archived_at,
  );
  const controlledProducts = new Set(
    overview.items.map((item) => item.product.id),
  );
  const eligibleProducts = products.filter(
    (item) =>
      item.provider.type === "hotel" &&
      item.kind === "physical" &&
      ["unit", "portion"].includes(item.sales_unit) &&
      !item.archived_at,
  );
  const message = statusText(status);
  const movementsContent =
    tab === "movements"
      ? await InventoryMovements({
          access,
          positions: overview.items,
          locations: activeLocations,
        })
      : null;
  const countsContent =
    tab === "counts"
      ? await InventoryCounts({
          canCount: access.canCount,
          locations: activeLocations,
        })
      : null;
  return (
    <DashboardEntityPageShell
      title="Estoque"
      activeTabKey={tab}
      tabs={tabs.map((item) => ({
        ...item,
        isVisible: item.key !== "counts" || access.canCount,
      }))}
      usageGuide={inventoryGuide}
      statusContent={
        message ? (
          <p role="status" className="pms-status-muted">
            {message}
          </p>
        ) : null
      }
    >
      {tab === "overview" ? (
        <section className="grid gap-4" data-usage-guide="inventory-overview">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="pms-surface-card">
              <strong>{overview.items.length}</strong>
              <p className="mb-0">posições controladas</p>
            </article>
            <article className="pms-surface-card">
              <strong>
                {
                  overview.items.filter(
                    (item) => item.quantity < item.minimum_quantity,
                  ).length
                }
              </strong>
              <p className="mb-0">abaixo do mínimo</p>
            </article>
            <article className="pms-surface-card">
              <strong>
                {overview.items.filter((item) => item.quantity < 0).length}
              </strong>
              <p className="mb-0">saldos negativos</p>
            </article>
          </div>
          {overview.items.map((item) => (
            <article key={item.id} className="pms-surface-card grid gap-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="m-0 text-lg font-semibold">
                    {item.product.name}
                  </h2>
                  <p className="mb-0 text-sm text-slate-600">
                    {item.location.name}
                  </p>
                </div>
                <strong
                  className={
                    item.quantity < 0
                      ? "text-red-700"
                      : item.quantity < item.minimum_quantity
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }
                >
                  {item.quantity} em saldo
                </strong>
              </div>
              <p className="m-0 text-sm">
                Mínimo {item.minimum_quantity} · Ideal {item.ideal_quantity} ·
                Reposição sugerida {item.suggested_replenishment}
                {access.canReadCosts
                  ? ` · Custo médio ${money(item.average_unit_cost)} · Valor ${money(item.inventory_value)}`
                  : ""}
              </p>
              {access.canManage ? (
                <form
                  action={updateInventoryPositionAction}
                  className="grid gap-2 md:grid-cols-4"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <label className="pms-field">
                    Mínimo
                    <input
                      className="pms-field-input"
                      name="minimum_quantity"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={item.minimum_quantity}
                    />
                  </label>
                  <label className="pms-field">
                    Ideal
                    <input
                      className="pms-field-input"
                      name="ideal_quantity"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={item.ideal_quantity}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      name="is_active"
                      type="checkbox"
                      defaultChecked={item.is_active}
                    />{" "}
                    Ativa
                  </label>
                  <button className="pms-button-secondary" type="submit">
                    Salvar limites
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {!overview.items.length ? (
            <p className="pms-status-muted">
              Nenhum produto é controlado. Ative uma posição em Configurações.
            </p>
          ) : null}
        </section>
      ) : null}
      {movementsContent}
      {countsContent}
      {tab === "settings" ? (
        <InventorySettings
          access={access}
          policy={overview.settings.negative_stock_policy}
          locations={locations}
          products={eligibleProducts.filter(
            (item) =>
              !controlledProducts.has(item.id) ||
              activeLocations.some(
                (location) =>
                  !overview.items.some(
                    (position) =>
                      position.product.id === item.id &&
                      position.location.id === location.id,
                  ),
              ),
          )}
        />
      ) : null}
    </DashboardEntityPageShell>
  );
}

async function InventoryMovements({
  access,
  positions,
  locations,
}: {
  access: ReturnType<typeof getInventoryAccess>;
  positions: Awaited<ReturnType<typeof getInventoryOverview>>["items"];
  locations: Awaited<ReturnType<typeof listInventoryLocations>>;
}) {
  const [history, audit] = await Promise.all([
    listInventoryMovements(),
    listInventoryAuditEvents(),
  ]);
  return (
    <section className="grid gap-4">
      <section
        className="pms-surface-card grid gap-3"
        data-usage-guide="inventory-movement-form"
      >
        <h2 className="m-0 text-xl font-semibold">Registrar movimento</h2>
        {access.canPost ? (
          <form
            action={postInventoryDocumentAction}
            className="grid gap-3 md:grid-cols-3"
          >
            <label className="pms-field">
              Tipo
              <select name="kind" className="pms-field-input">
                <option value="receipt">Entrada</option>
                <option value="adjustment">Ajuste</option>
                <option value="loss">Perda</option>
                <option value="internal_use">Consumo interno</option>
              </select>
            </label>
            <label className="pms-field">
              Posição
              <select name="position_id" required className="pms-field-input">
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product.name} · {item.location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Quantidade
              <input
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Direção do ajuste
              <select name="direction" className="pms-field-input">
                <option value="in">Entrada</option>
                <option value="out">Saída</option>
              </select>
            </label>
            {access.canReadCosts ? (
              <label className="pms-field">
                Custo unitário
                <input
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="pms-field-input"
                />
              </label>
            ) : null}
            <label className="pms-field">
              Referência
              <input
                name="reference_code"
                maxLength={120}
                className="pms-field-input"
              />
            </label>
            <label className="pms-field md:col-span-2">
              Motivo
              <input
                name="reason"
                minLength={3}
                required
                className="pms-field-input"
              />
            </label>
            <button type="submit" className="pms-button-primary">
              Registrar
            </button>
          </form>
        ) : (
          <p>Sem permissão para registrar movimentos.</p>
        )}
        {access.canPost ? (
          <form
            action={transferInventoryAction}
            className="grid gap-3 border-t pt-4 md:grid-cols-3"
          >
            <h3 className="md:col-span-3 m-0 text-lg font-semibold">
              Transferir entre locais
            </h3>
            <label className="pms-field">
              Produto
              <select name="product_id" className="pms-field-input">
                {Array.from(
                  new Map(
                    positions.map((item) => [item.product.id, item.product]),
                  ).values(),
                ).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Origem
              <select name="source_location_id" className="pms-field-input">
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Destino
              <select
                name="destination_location_id"
                className="pms-field-input"
              >
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Quantidade
              <input
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Motivo
              <input
                name="reason"
                required
                minLength={3}
                className="pms-field-input"
              />
            </label>
            <button className="pms-button-secondary" type="submit">
              Transferir
            </button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-2">
        <h2 className="m-0 text-xl font-semibold">Razão de movimentos</h2>
        {history.items.map((item) => (
          <article className="pms-surface-card" key={item.id}>
            <strong>{item.product_name}</strong> · {item.location_name}
            <p className="m-0">
              {item.kind}: {item.quantity_delta > 0 ? "+" : ""}
              {item.quantity_delta} · saldo {item.quantity_before} →{" "}
              {item.quantity_after}
            </p>
            <small>
              {new Date(item.occurred_at).toLocaleString("pt-BR")}
              {access.canReadCosts ? ` · ${money(item.total_cost)}` : ""}
            </small>
          </article>
        ))}
      </section>
      <section className="grid gap-2" data-usage-guide="inventory-audit">
        <h2 className="m-0 text-xl font-semibold">Auditoria do estoque</h2>
        {audit.items.map((item) => (
          <article className="pms-surface-card" key={item.id}>
            <strong>{item.action}</strong> · {item.entity_type}
            <p className="m-0 text-sm">
              {item.actor_name || "Sistema"} ·{" "}
              {new Date(item.created_at).toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
        {!audit.items.length ? (
          <p className="pms-status-muted">Nenhum evento de auditoria.</p>
        ) : null}
      </section>
    </section>
  );
}

async function InventoryCounts({
  canCount,
  locations,
}: {
  canCount: boolean;
  locations: Awaited<ReturnType<typeof listInventoryLocations>>;
}) {
  const counts = await listInventoryCounts();
  return (
    <section className="grid gap-4" data-usage-guide="inventory-counts">
      {canCount ? (
        <form
          action={createInventoryCountAction}
          className="pms-surface-card grid gap-3 md:grid-cols-3"
        >
          <label className="pms-field">
            Local
            <select name="location_id" className="pms-field-input">
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Observações
            <input name="notes" className="pms-field-input" />
          </label>
          <button className="pms-button-primary" type="submit">
            Abrir contagem
          </button>
        </form>
      ) : (
        <p>Sem permissão para realizar contagens.</p>
      )}
      {counts.map((count) => (
        <article key={count.id} className="pms-surface-card grid gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold">{count.location.name}</h2>
            <p className="m-0">
              {count.status === "draft"
                ? "Rascunho"
                : count.status === "completed"
                  ? "Concluída"
                  : "Cancelada"}
            </p>
          </div>
          {count.items.map((item) => (
            <form
              action={updateInventoryCountAction}
              key={item.id}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="count_id" value={count.id} />
              <input type="hidden" name="item_id" value={item.id} />
              <label className="pms-field">
                {item.product_name} · esperado {item.expected_quantity}
                <input
                  name="counted_quantity"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={item.counted_quantity ?? ""}
                  disabled={!canCount || count.status !== "draft"}
                  className="pms-field-input"
                />
              </label>
              {canCount && count.status === "draft" ? (
                <button className="pms-button-secondary" type="submit">
                  Salvar contagem
                </button>
              ) : null}
            </form>
          ))}
          {canCount && count.status === "draft" ? (
            <form action={finishInventoryCountAction} className="flex gap-2">
              <input type="hidden" name="id" value={count.id} />
              <button
                name="action"
                value="complete"
                className="pms-button-primary"
                type="submit"
              >
                Concluir
              </button>
              <button
                name="action"
                value="cancel"
                className="pms-button-secondary"
                type="submit"
              >
                Cancelar
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function InventorySettings({
  access,
  policy,
  locations,
  products,
}: {
  access: ReturnType<typeof getInventoryAccess>;
  policy: "allow_with_warning" | "block";
  locations: Awaited<ReturnType<typeof listInventoryLocations>>;
  products: Awaited<ReturnType<typeof listProducts>>;
}) {
  const orderedLocations = locations.filter((item) => !item.archived_at);
  return (
    <section className="grid gap-4" data-usage-guide="inventory-settings">
      {access.canManage ? (
        <>
          <form
            action={updateInventoryPolicyAction}
            className="pms-surface-card grid gap-3"
          >
            <h2 className="m-0 text-xl font-semibold">Saldo insuficiente</h2>
            <label className="pms-field">
              Política
              <select
                name="policy"
                defaultValue={policy}
                className="pms-field-input"
              >
                <option value="allow_with_warning">Permitir com aviso</option>
                <option value="block">Bloquear consumo</option>
              </select>
            </label>
            <button className="pms-button-primary" type="submit">
              Salvar política
            </button>
          </form>
          <form
            action={createInventoryLocationAction}
            className="pms-surface-card grid gap-3 md:grid-cols-2"
          >
            <h2 className="md:col-span-2 m-0 text-xl font-semibold">
              Novo local
            </h2>
            <label className="pms-field">
              Nome
              <input name="name" required className="pms-field-input" />
            </label>
            <label className="pms-field">
              Código
              <input name="internal_code" className="pms-field-input" />
            </label>
            <label className="pms-field md:col-span-2">
              Descrição
              <input name="description" className="pms-field-input" />
            </label>
            <button className="pms-button-primary" type="submit">
              Criar local
            </button>
          </form>
          <form
            action={createInventoryPositionAction}
            className="pms-surface-card grid gap-3 md:grid-cols-3"
          >
            <h2 className="md:col-span-3 m-0 text-xl font-semibold">
              Ativar produto em local
            </h2>
            <label className="pms-field">
              Produto
              <select name="product_id" className="pms-field-input">
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Local
              <select name="location_id" className="pms-field-input">
                {locations
                  .filter((item) => !item.archived_at && item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="pms-field">
              Saldo inicial
              <input
                name="initial_quantity"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Mínimo
              <input
                name="minimum_quantity"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Ideal
              <input
                name="ideal_quantity"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                className="pms-field-input"
              />
            </label>
            {access.canReadCosts ? (
              <label className="pms-field">
                Custo médio inicial
                <input
                  name="average_unit_cost"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="pms-field-input"
                />
              </label>
            ) : null}
            <button className="pms-button-primary" type="submit">
              Ativar controle
            </button>
          </form>
        </>
      ) : (
        <p>Sem permissão para alterar configurações.</p>
      )}
      <section className="grid gap-2">
        <h2 className="m-0 text-xl font-semibold">Locais</h2>
        {locations.map((item) => {
          const index = orderedLocations.findIndex(
            (ordered) => ordered.id === item.id,
          );
          const move = (offset: number) => {
            const ids = orderedLocations.map((ordered) => ordered.id);
            const target = index + offset;
            if (index < 0 || target < 0 || target >= ids.length) return ids;
            const current = ids[index]!;
            ids[index] = ids[target]!;
            ids[target] = current;
            return ids;
          };
          return (
            <article
              className="pms-surface-card flex flex-wrap items-center justify-between gap-3"
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                <p className="m-0 text-sm">
                  {item.position_count} posições · saldo total{" "}
                  {item.total_quantity}
                </p>
              </div>
              {access.canManage ? (
                <div className="flex flex-wrap gap-2">
                  {!item.archived_at && index > 0 ? (
                    <form action={reorderInventoryLocationsAction}>
                      {move(-1).map((locationId) => (
                        <input
                          key={locationId}
                          type="hidden"
                          name="ids"
                          value={locationId}
                        />
                      ))}
                      <button className="pms-button-secondary" type="submit">
                        Subir
                      </button>
                    </form>
                  ) : null}
                  {!item.archived_at && index < orderedLocations.length - 1 ? (
                    <form action={reorderInventoryLocationsAction}>
                      {move(1).map((locationId) => (
                        <input
                          key={locationId}
                          type="hidden"
                          name="ids"
                          value={locationId}
                        />
                      ))}
                      <button className="pms-button-secondary" type="submit">
                        Descer
                      </button>
                    </form>
                  ) : null}
                  <form action={archiveInventoryLocationAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="archived"
                      value={item.archived_at ? "false" : "true"}
                    />
                    <button className="pms-button-secondary" type="submit">
                      {item.archived_at ? "Restaurar" : "Arquivar"}
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </section>
  );
}
