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
  requestOperationsFinanceEndpoint,
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
  configureLotTrackingAction,
  createMinibarCompositionAction,
  createMinibarRouteAction,
  discardLotAction,
  versionMinibarCompositionAction,
} from "../actions";

export type InventoryTab =
  "overview" | "movements" | "counts" | "settings" | "lots" | "minibar";
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
  { key: "lots", label: "Lotes e validade", href: "/dashboard/inventory/lots" },
  { key: "minibar", label: "Frigobares", href: "/dashboard/inventory/minibar" },
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
  const lots =
    tab === "lots"
      ? await requestOperationsFinanceEndpoint<{
          lots: Array<Record<string, unknown>>;
        }>("inventory/lots", "GET")
      : null;
  const minibar =
    tab === "minibar"
      ? await requestOperationsFinanceEndpoint<{
          items: Array<Record<string, unknown>>;
        }>("minibar/compositions", "GET")
      : null;
  const minibarBoard =
    tab === "minibar"
      ? await requestOperationsFinanceEndpoint<{
          version: number;
          items: Array<Record<string, unknown>>;
        }>("minibar/replenishment-board", "GET")
      : null;
  return (
    <DashboardEntityPageShell
      title="Estoque"
      activeTabKey={tab}
      tabs={tabs.map((item) => ({
        ...item,
        isVisible:
          (item.key !== "counts" || access.canCount) &&
          (item.key !== "lots" || access.canManageLots || access.canRead) &&
          (item.key !== "minibar" ||
            access.canManageMinibar ||
            access.canReplenishMinibar),
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
      {tab === "lots" ? (
        <InventoryLots
          access={access}
          positions={overview.items}
          products={eligibleProducts}
          data={lots?.lots || []}
        />
      ) : null}
      {tab === "minibar" ? (
        <MinibarInventory
          access={access}
          products={eligibleProducts}
          locations={activeLocations}
          compositions={minibar?.items || []}
          board={minibarBoard || { version: 0, items: [] }}
        />
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

function InventoryLots({
  access,
  positions,
  products,
  data,
}: {
  access: ReturnType<typeof getInventoryAccess>;
  positions: Array<{
    id: string;
    quantity: number;
    product: { id: string; name: string };
    location: { name: string };
  }>;
  products: Array<{ id: string; name: string }>;
  data: Array<Record<string, unknown>>;
}) {
  return (
    <section className="grid gap-4" data-usage-guide="inventory-lots">
      <article className="pms-surface-card">
        <h2 className="mt-0">Rastreabilidade por produto</h2>
        <p>
          Ao ativar lotes, distribua todo o saldo atual da posição. Saídas
          futuras seguem FEFO.
        </p>
        {access.canManageLots ? (
          <form
            action={configureLotTrackingAction}
            className="grid gap-3 md:grid-cols-3"
          >
            <label className="pms-field">
              Produto
              <select className="pms-field-input" name="product_id">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Posição
              <select className="pms-field-input" name="position_id">
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product.name} · {p.location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Modo
              <select className="pms-field-input" name="mode">
                <option value="none">Sem lotes</option>
                <option value="lot">Lote</option>
                <option value="lot_expiry">Lote e validade</option>
              </select>
            </label>
            <label className="pms-field">
              Código do lote
              <input className="pms-field-input" name="lot_code" />
            </label>
            <label className="pms-field">
              Validade
              <input
                className="pms-field-input"
                name="expires_on"
                type="date"
              />
            </label>
            <label className="pms-field">
              Saldo distribuído
              <input
                className="pms-field-input"
                name="quantity"
                type="number"
                min="0"
                step="1"
              />
            </label>
            <label className="pms-field">
              Alerta antes (dias)
              <input
                className="pms-field-input"
                name="expiry_alert_days"
                type="number"
                min="1"
                max="365"
                defaultValue="30"
              />
            </label>
            <button className="pms-button-primary self-end">
              Salvar rastreabilidade
            </button>
          </form>
        ) : null}
      </article>
      <article className="pms-surface-card">
        <h2 className="mt-0">Lotes e validade</h2>
        <div className="grid gap-2">
          {data.length ? (
            data.map((l) => (
              <div className="rounded border p-3" key={String(l.id)}>
                <strong>
                  {String(l.product_name)} · {String(l.lot_code)}
                </strong>
                <p>
                  Validade: {String(l.expires_on || "não informada")} · situação{" "}
                  {String(l.status)}
                </p>
                {Array.isArray(l.balances)
                  ? l.balances.map((b: Record<string, unknown>) => (
                      <div
                        key={String(b.id)}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <span>
                          {String(b.location_name)}: {String(b.quantity)}
                        </span>
                        {access.canManageLots && Number(b.quantity) > 0 ? (
                          <form
                            action={discardLotAction}
                            className="flex gap-2"
                          >
                            <input
                              type="hidden"
                              name="lot_id"
                              value={String(l.id)}
                            />
                            <input
                              type="hidden"
                              name="position_id"
                              value={String(b.position_id)}
                            />
                            <input
                              type="hidden"
                              name="version"
                              value={String(b.version)}
                            />
                            <input
                              className="pms-field-input"
                              name="quantity"
                              type="number"
                              min="1"
                              max={Number(b.quantity)}
                              placeholder="Qtd."
                              required
                            />
                            <input
                              className="pms-field-input"
                              name="reason"
                              minLength={3}
                              placeholder="Motivo do descarte"
                              required
                            />
                            <button className="pms-button-secondary">
                              Descartar
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))
                  : null}
              </div>
            ))
          ) : (
            <p>Nenhum lote cadastrado.</p>
          )}
        </div>
      </article>
    </section>
  );
}

function MinibarInventory({
  access,
  products,
  locations,
  compositions,
  board,
}: {
  access: ReturnType<typeof getInventoryAccess>;
  products: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  compositions: Array<Record<string, unknown>>;
  board: { version: number; items: Array<Record<string, unknown>> };
}) {
  const rooms = [
    ...new Map(
      board.items.map((i) => [String(i.room_id), String(i.room_number)]),
    ).entries(),
  ];
  return (
    <section className="grid gap-4" data-usage-guide="inventory-minibar">
      <article className="pms-surface-card">
        <h2 className="mt-0">Composição por tipo de quarto</h2>
        {access.canManageMinibar ? (
          <form
            action={createMinibarCompositionAction}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="pms-field">
              Tipo do quarto
              <input className="pms-field-input" name="room_type" required />
            </label>
            <label className="pms-field">
              Nome
              <input className="pms-field-input" name="name" required />
            </label>
            <button className="pms-button-primary">Criar composição</button>
          </form>
        ) : null}
        <div className="mt-4 grid gap-3">
          {compositions.map((c) => (
            <article className="rounded border p-3" key={String(c.id)}>
              <strong>
                {String(c.room_type)} · {String(c.name)}
              </strong>
              {access.canManageMinibar ? (
                <form
                  action={versionMinibarCompositionAction}
                  className="mt-2 grid gap-2 md:grid-cols-4"
                >
                  <input type="hidden" name="id" value={String(c.id)} />
                  <select className="pms-field-input" name="product_id">
                    {products.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select className="pms-field-input" name="source_location_id">
                    {locations.map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="pms-field-input"
                    name="ideal_quantity"
                    type="number"
                    min="0"
                    placeholder="Quantidade ideal"
                    required
                  />
                  <button className="pms-button-secondary">
                    Ativar nova versão
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </article>
      <article className="pms-surface-card">
        <h2 className="mt-0">Rota de reposição</h2>
        <p>
          {board.items.length} necessidades encontradas. A separação respeita
          lotes e saldo do abastecedor.
        </p>
        {access.canReplenishMinibar && rooms.length ? (
          <form action={createMinibarRouteAction}>
            <input type="hidden" name="board_version" value={board.version} />
            <fieldset className="grid gap-2">
              <legend>Quartos da rota</legend>
              {rooms.map(([id, number]) => (
                <label key={id} className="flex gap-2">
                  <input type="checkbox" name="room_ids" value={id} />
                  {number}
                </label>
              ))}
            </fieldset>
            <button className="pms-button-primary mt-3">Criar rota</button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
