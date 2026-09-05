import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getConsumptionOrder,
  listConsumptionOrders,
  listConsumptionPoints,
  listInventoryLocations,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { billingModeLabel } from "../_components/BillingModeFields";
import { consumptionHistoryGuide } from "../usageGuides";
import { requestConsumptionCorrectionAction } from "../accountActions";
import { consumptionTabs } from "../tabs";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    value,
  );
}

export default async function ConsumptionHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = (await searchParams) || {};
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Histórico de consumo"
        message="Sem permissão para consultar comandas."
      />
    );
  const [history, points, selected, inventoryLocations] = await Promise.all([
    listConsumptionOrders({
      search: params.search,
      from: params.from,
      to: params.to,
      point_id: params.point_id,
      billing_mode: params.billing_mode,
      disposition: params.disposition,
      provider_type: params.provider_type,
      cursor: params.cursor,
    }),
    listConsumptionPoints(false),
    params.id ? getConsumptionOrder(params.id) : Promise.resolve(null),
    listInventoryLocations().catch(() => []),
  ]);
  const tabs = consumptionTabs(access);
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="history"
      tabs={tabs}
      usageGuide={consumptionHistoryGuide}
    >
      <div className="grid gap-5">
        <form
          className="pms-surface-card grid gap-3 md:grid-cols-3 xl:grid-cols-6"
          data-usage-guide="consumption-history-filters"
        >
          <label className="pms-field md:col-span-2">
            Estadia, quarto ou reserva
            <input
              className="pms-field-input"
              name="search"
              defaultValue={params.search}
            />
          </label>
          <label className="pms-field">
            De
            <input
              className="pms-field-input"
              type="datetime-local"
              name="from"
              defaultValue={params.from}
            />
          </label>
          <label className="pms-field">
            Até
            <input
              className="pms-field-input"
              type="datetime-local"
              name="to"
              defaultValue={params.to}
            />
          </label>
          <label className="pms-field">
            Ponto
            <select
              className="pms-field-input"
              name="point_id"
              defaultValue={params.point_id || ""}
            >
              <option value="">Todos</option>
              {points.map((point) => (
                <option value={point.id} key={point.id}>
                  {point.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Cobrança
            <select
              className="pms-field-input"
              name="billing_mode"
              defaultValue={params.billing_mode || ""}
            >
              <option value="">Todas</option>
              <option value="stay_folio">Fólio</option>
              <option value="hotel_immediate">Pagamento imediato</option>
              <option value="partner_direct">Parceiro direto</option>
            </select>
          </label>
          <label className="pms-field">
            Disposição
            <select
              className="pms-field-input"
              name="disposition"
              defaultValue={params.disposition || ""}
            >
              <option value="">Todas</option>
              <option value="charged">Cobrado</option>
              <option value="courtesy">Cortesia</option>
              <option value="legacy_unclassified">Migrado</option>
            </select>
          </label>
          <label className="pms-field">
            Fornecedor
            <select
              className="pms-field-input"
              name="provider_type"
              defaultValue={params.provider_type || ""}
            >
              <option value="">Todos</option>
              <option value="hotel">Hotel</option>
              <option value="partner">Parceiro</option>
            </select>
          </label>
          <button className="pms-button-secondary self-end" type="submit">
            Filtrar
          </button>
        </form>

        {selected ? (
          <section
            className="pms-surface-card grid gap-4"
            data-usage-guide="consumption-order-detail"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm uppercase text-slate-500">
                  Comanda {selected.id.slice(0, 8)}
                </p>
                <h2 className="m-0 text-xl">
                  Quarto {selected.room_number || "—"} ·{" "}
                  {selected.reservation_code || "Histórico legado"}
                </h2>
              </div>
              <a
                className="pms-button-secondary"
                href="/dashboard/consumption/history"
              >
                Fechar ficha
              </a>
            </div>
            {selected.is_legacy ? (
              <p className="rounded-lg bg-amber-50 p-3 font-medium text-amber-900">
                Migrado sem forma de cobrança — este registro não representa
                dívida.
              </p>
            ) : null}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm text-slate-600">Ponto</dt>
                <dd className="m-0 font-semibold">
                  {selected.point_name || "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Cobrança</dt>
                <dd className="m-0 font-semibold">
                  {selected.disposition === "courtesy"
                    ? "Cortesia"
                    : selected.billing_mode
                      ? billingModeLabel(selected.billing_mode)
                      : "Não classificada"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Operador</dt>
                <dd className="m-0 font-semibold">
                  {selected.operator_name || "Sistema"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Horários</dt>
                <dd className="m-0 text-sm">
                  Consumido{" "}
                  {new Date(selected.occurred_at).toLocaleString("pt-BR")}
                  <br />
                  Lançado {new Date(selected.posted_at).toLocaleString("pt-BR")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Situação efetiva</dt>
                <dd className="m-0 font-semibold">
                  {selected.effective_status || "active"}
                </dd>
              </div>
            </dl>
            <ul className="m-0 grid gap-2 p-0">
              {selected.items.map((item) => (
                <li
                  className="rounded-lg border border-slate-200 p-3"
                  key={item.id}
                >
                  <div className="flex justify-between gap-3">
                    <strong>
                      {item.effective_quantity ?? item.quantity} ×{" "}
                      {item.product_name}
                    </strong>
                    <strong>
                      {money(
                        item.effective_net_amount ?? item.net_amount,
                        selected.currency,
                      )}
                    </strong>
                  </div>
                  <p className="mb-0 text-sm text-slate-600">
                    {item.category_name} ·{" "}
                    {item.partner_name || "Fornecido pelo hotel"} · unitário{" "}
                    {money(item.charged_unit_price, selected.currency)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="text-right">
              <span className="mr-3 text-sm text-slate-600">
                Bruto {money(selected.gross_amount, selected.currency)} ·
                Desconto {money(selected.discount_amount, selected.currency)}
              </span>
              <strong className="text-xl">
                Líquido{" "}
                {money(
                  selected.effective_net_amount ?? selected.net_amount,
                  selected.currency,
                )}
              </strong>
            </div>
            {!selected.is_legacy && selected.stay_id && access.canPost ? (
              <form
                action={requestConsumptionCorrectionAction}
                className="grid gap-3 rounded-lg border border-slate-200 p-4"
                data-usage-guide="consumption-correction-form"
              >
                <input type="hidden" name="order_id" value={selected.id} />
                <input type="hidden" name="stay_id" value={selected.stay_id} />
                <input
                  type="hidden"
                  name="expected_version"
                  value={selected.account_version || 0}
                />
                <h3 className="m-0 text-base">Solicitar ajuste redutor</h3>
                {selected.items.map((item) => (
                  <div className="grid gap-2 sm:grid-cols-5" key={item.id}>
                    <input type="hidden" name="order_item_id" value={item.id} />
                    <span className="self-end font-medium">
                      {item.product_name}
                    </span>
                    <label className="pms-field">
                      <span>Nova quantidade</span>
                      <input
                        className="pms-field-input"
                        type="number"
                        min="0"
                        max={item.effective_quantity ?? item.quantity}
                        step={item.sales_unit === "hour" ? "0.001" : "1"}
                        name="resulting_quantity"
                        defaultValue={item.effective_quantity ?? item.quantity}
                        required
                      />
                    </label>
                    <label className="pms-field">
                      <span>Desconto adicional</span>
                      <input
                        className="pms-field-input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="additional_discount"
                        defaultValue="0"
                        required
                      />
                    </label>
                    {item.inventory_controlled ? (
                      <>
                        <label className="pms-field">
                          <span>Quantidade devolvida</span>
                          <input
                            className="pms-field-input"
                            type="number"
                            min="0"
                            step="1"
                            name="restock_quantity"
                            defaultValue="0"
                          />
                        </label>
                        <label className="pms-field">
                          <span>Local de retorno</span>
                          <select
                            className="pms-field-input"
                            name="restock_location_id"
                            defaultValue=""
                          >
                            <option value="">Sem retorno físico</option>
                            {inventoryLocations
                              .filter(
                                (location) =>
                                  location.is_active && !location.archived_at,
                              )
                              .map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.name}
                                  {location.id === item.inventory_location_id
                                    ? " (origem)"
                                    : ""}
                                </option>
                              ))}
                          </select>
                        </label>
                      </>
                    ) : (
                      <>
                        <input
                          type="hidden"
                          name="restock_quantity"
                          value="0"
                        />
                        <input
                          type="hidden"
                          name="restock_location_id"
                          value=""
                        />
                      </>
                    )}
                  </div>
                ))}
                <label className="pms-field">
                  <span>Motivo</span>
                  <textarea
                    className="pms-field-input"
                    name="reason"
                    minLength={3}
                    required
                  />
                </label>
                <button
                  className="pms-button-secondary"
                  name="kind"
                  value="partial_adjustment"
                >
                  Enviar para aprovação
                </button>
              </form>
            ) : null}
            {!selected.is_legacy && selected.stay_id && access.canVoid ? (
              <form
                action={requestConsumptionCorrectionAction}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-red-200 p-4"
              >
                <input type="hidden" name="order_id" value={selected.id} />
                <input type="hidden" name="stay_id" value={selected.stay_id} />
                <input
                  type="hidden"
                  name="expected_version"
                  value={selected.account_version || 0}
                />
                <label className="pms-field flex-1">
                  <span>Motivo da anulação integral</span>
                  <input
                    className="pms-field-input"
                    name="reason"
                    minLength={3}
                    required
                  />
                </label>
                <button
                  className="pms-button-secondary"
                  name="kind"
                  value="full_void"
                >
                  Anular comanda
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section
          className="pms-surface-card overflow-x-auto"
          data-usage-guide="consumption-history-list"
        >
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2">Quando</th>
                <th className="p-2">Estadia</th>
                <th className="p-2">Ponto</th>
                <th className="p-2">Cobrança</th>
                <th className="p-2">Total</th>
                <th className="p-2">Operador</th>
                <th className="p-2">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((order) => (
                <tr className="border-b border-slate-100" key={order.id}>
                  <td className="p-2">
                    {new Date(order.occurred_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2">
                    {order.room_number
                      ? `Quarto ${order.room_number}`
                      : "Legado"}
                    <br />
                    <span className="text-sm text-slate-500">
                      {order.reservation_code}
                    </span>
                  </td>
                  <td className="p-2">{order.point_name || "—"}</td>
                  <td className="p-2">
                    {order.is_legacy
                      ? "Migrado sem forma de cobrança"
                      : order.disposition === "courtesy"
                        ? "Cortesia"
                        : order.billing_mode
                          ? billingModeLabel(order.billing_mode)
                          : "—"}
                  </td>
                  <td className="p-2 font-semibold">
                    {money(
                      order.effective_net_amount ?? order.net_amount,
                      order.currency,
                    )}
                  </td>
                  <td className="p-2">{order.operator_name || "Sistema"}</td>
                  <td className="p-2">
                    <a
                      className="pms-button-secondary"
                      href={`/dashboard/consumption/history?id=${order.id}`}
                    >
                      Ver recibo
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.items.length === 0 ? (
            <p>Nenhuma comanda encontrada.</p>
          ) : null}
        </section>
        {history.next_cursor ? (
          <a
            className="pms-button-secondary w-fit"
            href={`/dashboard/consumption/history?cursor=${encodeURIComponent(history.next_cursor)}`}
          >
            Próxima página
          </a>
        ) : null}
      </div>
    </DashboardEntityPageShell>
  );
}
