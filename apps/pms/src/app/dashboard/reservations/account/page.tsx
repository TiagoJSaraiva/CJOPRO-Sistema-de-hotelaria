import { redirect } from "next/navigation";
import { getStayAccount } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getReservationsCalendarAccess } from "../access";
import { PrintStatementButton } from "../_components/PrintStatementButton";
import { getConsumptionAccess } from "../../consumption/access";
import {
  createCorrectionRefundAction,
  reverseStayPaymentAction,
} from "../../consumption/accountActions";
import { stayAccountGuide } from "../../maintenance/usageGuides";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export default async function StayAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ stay_id?: string; status?: string }>;
}) {
  const params = await searchParams;
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);
  const consumptionAccess = getConsumptionAccess(user);
  if (!access.canAccess)
    return (
      <DashboardAccessDeniedCard
        title="Conta da estadia"
        message="Sem permissão para consultar a conta."
      />
    );
  if (!params?.stay_id) redirect("/dashboard/reservations/view");
  const account = await getStayAccount(params.stay_id).catch(() => null);
  if (!account)
    return (
      <DashboardAccessDeniedCard
        title="Conta da estadia"
        message="Conta não encontrada no hotel ativo."
      />
    );
  return (
    <DashboardEntityPageShell
      title="Conta da estadia"
      activeTabKey="account"
      usageGuide={stayAccountGuide}
      tabs={[
        {
          key: "calendar",
          label: "Calendário",
          href: "/dashboard/reservations/view",
          isVisible: true,
        },
        {
          key: "checkout",
          label: "Checkout",
          href: `/dashboard/reservations/checkout?room_number=${encodeURIComponent(account.room_number)}`,
          isVisible: account.stay_status === "checked_in",
        },
        {
          key: "account",
          label: "Conta",
          href: `/dashboard/reservations/account?stay_id=${account.stay_id}`,
          isVisible: true,
        },
      ]}
    >
      <div className="grid gap-4">
        {params?.status ? (
          <p className="pms-alert-success" role="status">
            Situação: {params.status}.
          </p>
        ) : null}
        <section
          className="pms-surface-card grid gap-3"
          data-usage-guide="stay-account-summary"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="m-0">Quarto {account.room_number}</h2>
              <p className="m-0 text-sm text-slate-600">
                {account.reservation_code} ·{" "}
                {account.guest_name || "Hóspede não informado"}
              </p>
            </div>
            <span className="pms-status-pill">{account.status}</span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt>Hospedagem</dt>
              <dd className="m-0 font-semibold">
                {money(account.folio.lodging_total || 0, account.currency)}
              </dd>
            </div>
            <div>
              <dt>Consumo</dt>
              <dd className="m-0 font-semibold">
                {money(account.folio.consumption_total || 0, account.currency)}
              </dd>
            </div>
            <div>
              <dt>Saldo de checkout</dt>
              <dd className="m-0 font-semibold">
                {money(account.folio.checkout_balance || 0, account.currency)}
              </dd>
            </div>
          </dl>
        </section>
        <section
          className="pms-surface-card overflow-x-auto"
          data-usage-guide="stay-account-lines"
          tabIndex={0}
          aria-label="Lançamentos da conta"
        >
          <h2>Razão da conta</h2>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Grupo</th>
                <th>Descrição</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {account.folio.entries.map((entry) => (
                <tr className="border-t border-slate-200" key={entry.id}>
                  <td className="py-2">
                    {new Date(entry.posted_at).toLocaleString("pt-BR")}
                  </td>
                  <td>{entry.kind}</td>
                  <td>{entry.description}</td>
                  <td className="text-right">
                    {entry.direction === "credit" ? "− " : ""}
                    {money(entry.amount, entry.currency)}
                  </td>
                  <td className="text-right">
                    {money(entry.open_amount, entry.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="grid gap-3 lg:grid-cols-2">
          <article className="pms-surface-card">
            <h2>Comandas e ajustes</h2>
            <ul className="grid gap-2 pl-5">
              {account.consumption_orders.map((order) => (
                <li key={order.id}>
                  {order.point_name || "Consumo"} ·{" "}
                  {money(
                    order.effective_net_amount ?? order.net_amount,
                    account.currency,
                  )}{" "}
                  ·{" "}
                  {order.effective_status ||
                    order.billing_mode ||
                    order.disposition}
                </li>
              ))}
            </ul>
            {account.corrections.length ? (
              <ul className="grid gap-2 pl-5">
                {account.corrections.map((item) => (
                  <li key={item.id}>
                    Correção: −{money(item.net_reduction, account.currency)} ·{" "}
                    {item.status}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
          <article className="pms-surface-card">
            <h2>Pagamentos e reembolsos</h2>
            <ul className="grid gap-3 pl-5">
              {account.payment_batches.map((batch) => (
                <li key={batch.id}>
                  {money(batch.amount, batch.currency)} ·{" "}
                  {batch.tenders.map((item) => item.payment_method).join(" + ")}
                  {account.stay_status === "checked_in" &&
                  consumptionAccess.canReceivePayment ? (
                    <div className="mt-2 grid gap-2">
                      {batch.tenders.map((tender) => (
                        <form
                          action={reverseStayPaymentAction}
                          className="flex flex-wrap items-end gap-2"
                          key={tender.id}
                        >
                          <input
                            type="hidden"
                            name="stay_id"
                            value={account.stay_id}
                          />
                          <input
                            type="hidden"
                            name="original_tender_id"
                            value={tender.id}
                          />
                          <input
                            type="hidden"
                            name="payment_method"
                            value={tender.payment_method}
                          />
                          <label className="pms-field">
                            <span>
                              Valor a estornar ({tender.payment_method})
                            </span>
                            <input
                              className="pms-field-input"
                              type="number"
                              name="amount"
                              min="0.01"
                              max={tender.amount}
                              step="0.01"
                              defaultValue={tender.amount}
                              required
                            />
                          </label>
                          <button className="pms-button-secondary">
                            Estornar pagamento
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {account.refunds.length ? (
              <ul className="grid gap-2 pl-5">
                {account.refunds.map((refund) => (
                  <li key={refund.id}>
                    Reembolso {money(refund.amount, refund.currency)} ·{" "}
                    {refund.payment_method}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </section>
        {consumptionAccess.canReceivePayment
          ? account.corrections
              .filter((item) => item.status === "awaiting_refund")
              .map((correction) => (
                <form
                  action={createCorrectionRefundAction}
                  className="pms-surface-card grid gap-3"
                  key={correction.id}
                  data-usage-guide="stay-account-refund"
                >
                  <input type="hidden" name="stay_id" value={account.stay_id} />
                  <input
                    type="hidden"
                    name="correction_id"
                    value={correction.id}
                  />
                  <input
                    type="hidden"
                    name="amount"
                    value={
                      correction.refundable_amount || correction.net_reduction
                    }
                  />
                  <h2 className="m-0">Concluir reembolso</h2>
                  <p className="m-0">
                    Reembolso pendente de{" "}
                    {money(
                      correction.refundable_amount || correction.net_reduction,
                      account.currency,
                    )}
                    . O fechamento permanecerá bloqueado até o registro.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="pms-field">
                      <span>Meio</span>
                      <select className="pms-field-input" name="payment_method">
                        <option value="pix">PIX</option>
                        <option value="cash">Dinheiro</option>
                        <option value="credit_card">Cartão de crédito</option>
                        <option value="debit_card">Cartão de débito</option>
                        <option value="bank_transfer">Transferência</option>
                      </select>
                    </label>
                    <label className="pms-field">
                      <span>Referência</span>
                      <input
                        className="pms-field-input"
                        name="reference_code"
                      />
                    </label>
                  </div>
                  <button className="pms-button-primary">
                    Registrar reembolso
                  </button>
                </form>
              ))
          : null}
        {account.checkout_record ? (
          <section
            className="pms-surface-card grid gap-3 print:border-0 print:shadow-none"
            data-usage-guide="stay-account-statement"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="m-0">Fechamento original</h2>
                <p className="m-0 text-sm">
                  {new Date(
                    account.checkout_record.checked_out_at,
                  ).toLocaleString("pt-BR")}{" "}
                  · versão {account.checkout_record.account_version}
                </p>
              </div>
              <PrintStatementButton />
            </div>
            <p className="m-0">
              Hospedagem{" "}
              {money(account.checkout_record.lodging_total, account.currency)} ·
              consumos{" "}
              {money(
                account.checkout_record.consumption_total,
                account.currency,
              )}{" "}
              · pagamentos{" "}
              {money(account.checkout_record.payment_total, account.currency)}
            </p>
            {account.corrections.some(
              (item) =>
                item.requested_at > account.checkout_record!.checked_out_at,
            ) ? (
              <div>
                <h3>Correções após checkout</h3>
                <ul>
                  {account.corrections
                    .filter(
                      (item) =>
                        item.requested_at >
                        account.checkout_record!.checked_out_at,
                    )
                    .map((item) => (
                      <li key={item.id}>
                        {item.reason} · −
                        {money(item.net_reduction, account.currency)} ·{" "}
                        {item.status}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <small>Extrato operacional sem valor fiscal.</small>
          </section>
        ) : null}
      </div>
    </DashboardEntityPageShell>
  );
}
