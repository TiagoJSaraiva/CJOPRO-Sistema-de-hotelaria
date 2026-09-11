import { PERMISSIONS } from "@hotel/shared";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../lib/auth";
import {
  listInventoryLocations,
  listProducts,
  requestOperationsFinanceEndpoint,
} from "../../../lib/adminApi";
import {
  actPurchaseOrderAction,
  actProcurementInvoiceAction,
  actReplenishmentAction,
  createProcurementInvoiceAction,
  createPurchaseOrderAction,
  createReplenishmentAction,
  payProcurementInstallmentAction,
  receivePurchaseOrderAction,
  reconcileProcurementAction,
  saveProcurementPolicyAction,
} from "./actions";
import { procurementGuide } from "./usageGuide";

type Board = {
  policy: {
    configuration_required: boolean;
    currency: string;
    price_tolerance_percent: number;
    price_tolerance_amount: number;
    quantity_tolerance_percent: number;
    quantity_tolerance_amount: number;
  } | null;
  replenishments: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
};
const label = (value: unknown) => String(value ?? "—").replaceAll("_", " ");
export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.PROCUREMENT_READ))
    return (
      <DashboardAccessDeniedCard
        title="Compras"
        message="Sem permissão para consultar compras do hotel ativo."
      />
    );
  const [board, products, locations, { status }] = await Promise.all([
    requestOperationsFinanceEndpoint<Board>("procurement/board", "GET"),
    listProducts(true),
    listInventoryLocations(false),
    searchParams,
  ]);
  const physical = products.filter(
    (p) => p.kind === "physical" && !p.archived_at,
  );
  const canRequest = user.permissions.includes(PERMISSIONS.PROCUREMENT_REQUEST);
  const canApprove = user.permissions.includes(PERMISSIONS.PROCUREMENT_APPROVE);
  const canReceive = user.permissions.includes(PERMISSIONS.PROCUREMENT_RECEIVE);
  const canReviewInvoices = user.permissions.includes(
    PERMISSIONS.PROCUREMENT_INVOICES_REVIEW,
  );
  const canSettle = user.permissions.includes(
    PERMISSIONS.SUPPLIER_PAYABLES_SETTLE,
  );
  return (
    <DashboardEntityPageShell
      title="Compras e reposição"
      activeTabKey="board"
      tabs={[
        {
          key: "board",
          label: "Visão operacional",
          href: "/dashboard/procurement",
          isVisible: true,
        },
      ]}
      usageGuide={procurementGuide}
      status={status}
    >
      <div className="grid gap-4">
        <section
          className="pms-surface-card"
          data-usage-guide="procurement-shortages"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="mt-0">Solicitações de reposição</h2>
              <p>
                Uma ruptura mantém um único episódio ativo até a recuperação do
                saldo.
              </p>
            </div>
            <form action={reconcileProcurementAction}>
              <button className="pms-button-secondary">
                Atualizar rupturas
              </button>
            </form>
          </div>
          {canRequest ? (
            <form
              action={createReplenishmentAction}
              className="grid gap-3 md:grid-cols-3"
            >
              <label className="pms-field">
                Produto
                <select className="pms-field-input" name="product_id" required>
                  {physical.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Destino
                <select className="pms-field-input" name="location_id" required>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Quantidade
                <input
                  className="pms-field-input"
                  name="requested_quantity"
                  type="number"
                  min="1"
                  required
                />
              </label>
              <label className="pms-field">
                Prioridade
                <select className="pms-field-input" name="priority">
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </label>
              <label className="pms-field">
                Necessidade
                <input className="pms-field-input" name="need_by" type="date" />
              </label>
              <label className="pms-field">
                Motivo
                <input
                  className="pms-field-input"
                  name="reason"
                  minLength={3}
                  required
                />
              </label>
              <button className="pms-button-primary md:col-span-3 md:w-fit">
                Criar solicitação
              </button>
            </form>
          ) : null}
          <div className="mt-4 grid gap-2">
            {board.replenishments.map((r) => (
              <article className="rounded border p-3" key={String(r.id)}>
                <strong>{String(r.product_name)}</strong> ·{" "}
                {String(r.location_name)} · {label(r.status)} ·{" "}
                {String(r.requested_quantity)} un.
                {canRequest || canApprove ? (
                  <form
                    action={actReplenishmentAction}
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="id" value={String(r.id)} />
                    <input
                      type="hidden"
                      name="version"
                      value={String(r.version)}
                    />
                    {r.status === "draft" && canRequest ? (
                      <button
                        className="pms-button-secondary"
                        name="action"
                        value="submit"
                      >
                        Enviar
                      </button>
                    ) : null}
                    {r.status === "submitted" && canApprove ? (
                      <button
                        className="pms-button-primary"
                        name="action"
                        value="approve"
                      >
                        Aprovar
                      </button>
                    ) : null}
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        {canApprove ? (
          <section
            className="pms-surface-card"
            data-usage-guide="procurement-policy"
          >
            <h2 className="mt-0">Alçadas e tolerâncias</h2>
            <p>
              {board.policy?.configuration_required
                ? "Configure antes de submeter compras."
                : "Política ativa para novas compras."}
            </p>
            <form
              action={saveProcurementPolicyAction}
              className="grid gap-3 md:grid-cols-4"
            >
              <label className="pms-field">
                Moeda
                <input
                  className="pms-field-input"
                  name="currency"
                  defaultValue={board.policy?.currency || "BRL"}
                  required
                />
              </label>
              <label className="pms-field">
                2ª alçada a partir de
                <input
                  className="pms-field-input"
                  name="second_tier_from"
                  type="number"
                  min="0.01"
                  defaultValue="5000"
                  required
                />
              </label>
              <label className="pms-field">
                Cotações base
                <input
                  className="pms-field-input"
                  name="base_quotes"
                  type="number"
                  min="0"
                  defaultValue="1"
                  required
                />
              </label>
              <label className="pms-field">
                Cotações altas
                <input
                  className="pms-field-input"
                  name="high_quotes"
                  type="number"
                  min="0"
                  defaultValue="3"
                  required
                />
              </label>
              <label className="pms-field">
                Tolerância preço %
                <input
                  className="pms-field-input"
                  name="price_tolerance_percent"
                  type="number"
                  step="0.01"
                  defaultValue={board.policy?.price_tolerance_percent || 0}
                />
              </label>
              <label className="pms-field">
                Tolerância preço fixa
                <input
                  className="pms-field-input"
                  name="price_tolerance_amount"
                  type="number"
                  step="0.01"
                  defaultValue={board.policy?.price_tolerance_amount || 0}
                />
              </label>
              <label className="pms-field">
                Tolerância quantidade %
                <input
                  className="pms-field-input"
                  name="quantity_tolerance_percent"
                  type="number"
                  step="0.01"
                  defaultValue={board.policy?.quantity_tolerance_percent || 0}
                />
              </label>
              <label className="pms-field">
                Tolerância quantidade fixa
                <input
                  className="pms-field-input"
                  name="quantity_tolerance_amount"
                  type="number"
                  step="0.001"
                  defaultValue={board.policy?.quantity_tolerance_amount || 0}
                />
              </label>
              <button className="pms-button-primary md:col-span-4 md:w-fit">
                Salvar política
              </button>
            </form>
          </section>
        ) : null}
        <section
          className="pms-surface-card"
          data-usage-guide="procurement-orders"
        >
          <h2 className="mt-0">Pedidos de compra</h2>
          {canRequest && board.suppliers.length ? (
            <form
              action={createPurchaseOrderAction}
              className="grid gap-3 md:grid-cols-3"
            >
              <label className="pms-field">
                Fornecedor
                <select className="pms-field-input" name="supplier_id">
                  {board.suppliers.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Produto
                <select className="pms-field-input" name="product_id">
                  {physical.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Destino
                <select className="pms-field-input" name="location_id">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pms-field">
                Quantidade
                <input
                  className="pms-field-input"
                  name="quantity"
                  type="number"
                  min="1"
                  required
                />
              </label>
              <label className="pms-field">
                Preço unitário
                <input
                  className="pms-field-input"
                  name="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <label className="pms-field">
                Impostos
                <input
                  className="pms-field-input"
                  name="tax_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
              <input
                type="hidden"
                name="currency"
                value={board.policy?.currency || "BRL"}
              />
              <label className="pms-field">
                Previsão
                <input
                  className="pms-field-input"
                  name="expected_on"
                  type="date"
                />
              </label>
              <label className="pms-field md:col-span-2">
                Referência da cotação
                <input className="pms-field-input" name="quote_reference" />
              </label>
              {[2, 3].map((index) => (
                <div className="contents" key={index}>
                  <label className="pms-field">
                    Fornecedor da cotação {index}
                    <select
                      className="pms-field-input"
                      name={`quote_supplier_${index}`}
                      defaultValue=""
                    >
                      <option value="">Não informada</option>
                      {board.suppliers
                        .filter((s) => String(s.id) !== "")
                        .map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {String(s.name)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="pms-field">
                    Valor da cotação {index}
                    <input
                      className="pms-field-input"
                      name={`quote_amount_${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </label>
                  <label className="pms-field">
                    Referência {index}
                    <input
                      className="pms-field-input"
                      name={`quote_reference_${index}`}
                    />
                  </label>
                </div>
              ))}
              <button className="pms-button-primary md:col-span-3 md:w-fit">
                Criar pedido
              </button>
            </form>
          ) : (
            <p>
              Cadastre uma organização com papel de fornecedor e configure a
              política para criar pedidos.
            </p>
          )}
          <div className="mt-4 grid gap-2">
            {board.orders.map((o) => (
              <article className="rounded border p-3" key={String(o.id)}>
                <strong>{String(o.supplier_name)}</strong> · {label(o.status)} ·{" "}
                {Number(o.total_amount).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: String(o.currency),
                })}
                <form
                  action={actPurchaseOrderAction}
                  className="mt-2 flex gap-2"
                >
                  <input type="hidden" name="id" value={String(o.id)} />
                  <input
                    type="hidden"
                    name="version"
                    value={String(o.version)}
                  />
                  {o.status === "draft" && canRequest ? (
                    <button
                      className="pms-button-secondary"
                      name="action"
                      value="submit"
                    >
                      Enviar
                    </button>
                  ) : null}
                  {o.status === "pending_approval" && canApprove ? (
                    <button
                      className="pms-button-primary"
                      name="action"
                      value="approve"
                    >
                      Aprovar
                    </button>
                  ) : null}
                  {o.status === "approved" && canRequest ? (
                    <button
                      className="pms-button-secondary"
                      name="action"
                      value="issue"
                    >
                      Emitir
                    </button>
                  ) : null}
                </form>
                {canReceive &&
                ["issued", "partially_received"].includes(String(o.status)) &&
                Array.isArray(o.lines)
                  ? o.lines.map((line: Record<string, unknown>) => (
                      <form
                        action={receivePurchaseOrderAction}
                        className="mt-3 grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-4"
                        key={String(line.id)}
                      >
                        <input type="hidden" name="id" value={String(o.id)} />
                        <input
                          type="hidden"
                          name="version"
                          value={String(o.version)}
                        />
                        <input
                          type="hidden"
                          name="order_line_id"
                          value={String(line.id)}
                        />
                        <p className="md:col-span-4 m-0 text-sm">
                          {String(line.product_name)} · pedido{" "}
                          {String(line.quantity)} · recebido{" "}
                          {String(line.received_quantity)}
                        </p>
                        <label className="pms-field">
                          Aceita
                          <input
                            className="pms-field-input"
                            name="accepted_quantity"
                            type="number"
                            min="0"
                            step="1"
                            required
                          />
                        </label>
                        <label className="pms-field">
                          Recusada
                          <input
                            className="pms-field-input"
                            name="rejected_quantity"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue="0"
                            required
                          />
                        </label>
                        <label className="pms-field">
                          Custo unitário
                          <input
                            className="pms-field-input"
                            name="unit_cost"
                            type="number"
                            min="0"
                            step="0.0001"
                            defaultValue={Number(line.unit_price)}
                            required
                          />
                        </label>
                        <label className="pms-field">
                          Referência
                          <input
                            className="pms-field-input"
                            name="reference_code"
                          />
                        </label>
                        <label className="pms-field">
                          Lote
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
                        <label className="pms-field md:col-span-2">
                          Evidência privada
                          <input
                            className="pms-field-input"
                            name="evidence_path"
                          />
                        </label>
                        <button className="pms-button-primary md:col-span-4 md:w-fit">
                          Registrar recebimento
                        </button>
                      </form>
                    ))
                  : null}
              </article>
            ))}
          </div>
        </section>
        <section
          className="pms-surface-card"
          data-usage-guide="procurement-invoices"
        >
          <h2 className="mt-0">Notas e contas a pagar</h2>
          {canReviewInvoices ? (
            <form
              action={createProcurementInvoiceAction}
              className="mb-4 grid gap-3 md:grid-cols-3"
            >
              <label className="pms-field">
                Pedido
                <select
                  className="pms-field-input"
                  name="purchase_order_id"
                  required
                >
                  {board.orders
                    .filter((o) =>
                      ["partially_received", "received", "closed"].includes(
                        String(o.status),
                      ),
                    )
                    .map((o) => (
                      <option key={String(o.id)} value={String(o.id)}>
                        {String(o.supplier_name)} · {String(o.id).slice(0, 8)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="pms-field">
                Número da nota
                <input
                  className="pms-field-input"
                  name="invoice_number"
                  required
                />
              </label>
              <label className="pms-field">
                Emissão
                <input
                  className="pms-field-input"
                  name="issued_on"
                  type="date"
                  required
                />
              </label>
              <label className="pms-field">
                Vencimento
                <input
                  className="pms-field-input"
                  name="due_dates"
                  type="date"
                  required
                />
              </label>
              <label className="pms-field">
                Valor total
                <input
                  className="pms-field-input"
                  name="total_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label className="pms-field">
                Evidência privada
                <input className="pms-field-input" name="evidence_path" />
              </label>
              <button className="pms-button-primary md:col-span-3 md:w-fit">
                Registrar nota
              </button>
            </form>
          ) : null}
          <div className="grid gap-2">
            {board.invoices.length ? (
              board.invoices.map((i) => (
                <article className="rounded border p-3" key={String(i.id)}>
                  <strong>Nota {String(i.invoice_number)}</strong> ·{" "}
                  {label(i.status)} ·{" "}
                  {Number(i.total_amount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  {canReviewInvoices &&
                  ["draft", "exception"].includes(String(i.status)) ? (
                    <form
                      action={actProcurementInvoiceAction}
                      className="mt-2 grid gap-2 md:grid-cols-3"
                    >
                      <input type="hidden" name="id" value={String(i.id)} />
                      <input
                        type="hidden"
                        name="version"
                        value={String(i.version)}
                      />
                      <label className="pms-field md:col-span-2">
                        Justificativa
                        <input
                          className="pms-field-input"
                          name="reason"
                          minLength={3}
                          required
                        />
                      </label>
                      <button
                        className="pms-button-primary self-end"
                        name="action"
                        value={
                          i.status === "exception"
                            ? "accept_exception"
                            : "approve"
                        }
                      >
                        {i.status === "exception"
                          ? "Aceitar exceção"
                          : "Aprovar nota"}
                      </button>
                    </form>
                  ) : null}
                  {Array.isArray(i.due_dates)
                    ? i.due_dates.map((due: Record<string, unknown>) => (
                        <div
                          className="mt-2 rounded bg-slate-50 p-2"
                          key={String(due.id)}
                        >
                          <p className="m-0 text-sm">
                            Vence {String(due.due_on)} · pago{" "}
                            {String(due.paid_amount)} de {String(due.amount)}
                          </p>
                          {canSettle &&
                          Number(due.paid_amount) < Number(due.amount) &&
                          ["approved", "partially_paid"].includes(
                            String(i.status),
                          ) ? (
                            <form
                              action={payProcurementInstallmentAction}
                              className="mt-2 grid gap-2 md:grid-cols-4"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={String(due.id)}
                              />
                              <input
                                type="hidden"
                                name="invoice_version"
                                value={String(i.version)}
                              />
                              <label className="pms-field">
                                Meio
                                <input
                                  className="pms-field-input"
                                  name="payment_method"
                                  defaultValue="bank_transfer"
                                  required
                                />
                              </label>
                              <label className="pms-field">
                                Valor
                                <input
                                  className="pms-field-input"
                                  name="amount"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  max={
                                    Number(due.amount) - Number(due.paid_amount)
                                  }
                                  required
                                />
                              </label>
                              <label className="pms-field">
                                Referência
                                <input
                                  className="pms-field-input"
                                  name="reference_code"
                                />
                              </label>
                              <label className="pms-field">
                                Sessão de caixa, se dinheiro
                                <input
                                  className="pms-field-input"
                                  name="cash_session_id"
                                />
                              </label>
                              <label className="pms-field">
                                Segundo meio
                                <input
                                  className="pms-field-input"
                                  name="payment_method_2"
                                  placeholder="Opcional"
                                />
                              </label>
                              <label className="pms-field">
                                Valor no segundo meio
                                <input
                                  className="pms-field-input"
                                  name="amount_2"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                />
                              </label>
                              <label className="pms-field">
                                Referência do segundo meio
                                <input
                                  className="pms-field-input"
                                  name="reference_code_2"
                                />
                              </label>
                              <button className="pms-button-secondary md:col-span-4 md:w-fit">
                                Registrar pagamento
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    : null}
                </article>
              ))
            ) : (
              <p>Nenhuma nota registrada.</p>
            )}
          </div>
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
