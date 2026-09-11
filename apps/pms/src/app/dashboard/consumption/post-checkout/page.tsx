import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listPostCheckoutConsumptionCases } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import { consumptionTabs } from "../tabs";
import { postCheckoutConsumptionGuide } from "../usageGuides";
import {
  actPostCheckoutCaseAction,
  addPostCheckoutEvidenceAction,
  createPostCheckoutCaseAction,
  payPostCheckoutCaseAction,
} from "./actions";

const labels: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Aguardando revisão",
  approved: "Aprovado",
  collection_pending: "Cobrança pendente",
  disputed: "Contestado",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
  waived: "Dispensado",
  rejected: "Rejeitado",
  canceled: "Cancelado",
};

export default async function PostCheckoutConsumptionPage() {
  const access = getConsumptionAccess(await getUserFromSession());
  if (
    !access.canReviewPostCheckout &&
    !access.canWaivePostCheckout &&
    !access.canReceivePayment
  )
    return (
      <DashboardAccessDeniedCard
        title="Consumo pós-saída"
        message="Sem permissão para revisar cobranças complementares."
      />
    );
  const response = await listPostCheckoutConsumptionCases();
  return (
    <DashboardEntityPageShell
      title="Consumo pós-saída"
      activeTabKey="post-checkout"
      tabs={consumptionTabs(access)}
      usageGuide={postCheckoutConsumptionGuide}
    >
      <div className="grid gap-5">
        {access.canReviewPostCheckout ? (
          <form
            action={createPostCheckoutCaseAction}
            className="pms-surface-card grid gap-3 md:grid-cols-2"
            data-usage-guide="post-checkout-create"
          >
            <h2 className="m-0 md:col-span-2">Registrar achado</h2>
            <label className="pms-field-label">
              Estadia encerrada
              <input
                className="pms-field-input"
                name="stay_id"
                required
                placeholder="UUID da estadia"
              />
            </label>
            <label className="pms-field-label">
              Horário estimado
              <input
                className="pms-field-input"
                name="occurred_at"
                type="datetime-local"
                required
              />
            </label>
            <label className="pms-field-label">
              Oferta
              <input
                className="pms-field-input"
                name="offer_id"
                required
                placeholder="UUID da oferta"
              />
            </label>
            <label className="pms-field-label">
              Quantidade
              <input
                className="pms-field-input"
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="1"
                required
              />
            </label>
            <label className="pms-field-label md:col-span-2">
              Relato
              <textarea
                className="pms-field-input"
                name="report"
                minLength={3}
                required
              />
            </label>
            <button className="pms-button-primary md:col-span-2">
              Criar caso
            </button>
          </form>
        ) : null}

        <section className="grid gap-3" data-usage-guide="post-checkout-review">
          <h2 className="m-0">Casos e contas complementares</h2>
          {response.items.map((item) => {
            const id = String(item.id);
            const status = String(item.status);
            const version = Number(item.version);
            const supplemental = (item.supplemental_account || {}) as Record<
              string,
              unknown
            >;
            const balance = Math.max(
              Number(supplemental.amount || 0) -
                Number(supplemental.paid_amount || 0),
              0,
            );
            return (
              <article className="pms-surface-card grid gap-3" key={id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{String(item.stay_code || item.stay_id)}</strong>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                    {labels[status] || status}
                  </span>
                </div>
                <p className="m-0 text-sm">
                  {String(item.report)} · saldo R$ {balance.toFixed(2)}
                </p>
                {access.canReviewPostCheckout &&
                [
                  "draft",
                  "submitted",
                  "collection_pending",
                  "disputed",
                  "partially_paid",
                ].includes(status) ? (
                  <form
                    action={actPostCheckoutCaseAction}
                    className="grid gap-2 md:grid-cols-[1fr_auto_auto]"
                  >
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="version" value={version} />
                    <input
                      className="pms-field-input"
                      name="reason"
                      minLength={3}
                      required
                      placeholder="Motivo ou registro do contato"
                    />
                    <select
                      className="pms-field-input"
                      name="action"
                      defaultValue={
                        status === "draft"
                          ? "submit"
                          : status === "submitted"
                            ? "approve"
                            : status === "disputed"
                              ? "resume_collection"
                              : "record_contact"
                      }
                    >
                      {status === "draft" ? (
                        <>
                          <option value="submit">Enviar para revisão</option>
                          <option value="cancel">Cancelar</option>
                        </>
                      ) : null}
                      {status === "submitted" ? (
                        <>
                          <option value="approve">Aprovar</option>
                          <option value="reject">Rejeitar</option>
                        </>
                      ) : null}
                      {["collection_pending", "partially_paid"].includes(
                        status,
                      ) ? (
                        <>
                          <option value="record_contact">
                            Registrar contato
                          </option>
                          <option value="dispute">Registrar contestação</option>
                        </>
                      ) : null}
                      {status === "disputed" ? (
                        <option value="resume_collection">
                          Retomar cobrança
                        </option>
                      ) : null}
                      {access.canWaivePostCheckout && status === "disputed" ? (
                        <option value="waive">Dispensar</option>
                      ) : null}
                    </select>
                    <button className="pms-button-secondary">Registrar</button>
                  </form>
                ) : null}
                {access.canReviewPostCheckout && status === "draft" ? (
                  <form
                    action={addPostCheckoutEvidenceAction}
                    className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <input type="hidden" name="id" value={id} />
                    <input
                      className="pms-field-input"
                      name="private_path"
                      required
                      placeholder="Referência privada da evidência"
                    />
                    <input
                      className="pms-field-input"
                      name="description"
                      minLength={3}
                      required
                      placeholder="Descrição da evidência"
                    />
                    <button className="pms-button-secondary">
                      Anexar referência
                    </button>
                  </form>
                ) : null}
                {access.canReceivePayment &&
                ["collection_pending", "partially_paid"].includes(status) ? (
                  <form
                    action={payPostCheckoutCaseAction}
                    className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                    data-usage-guide="post-checkout-collection"
                  >
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="version" value={version} />
                    <input
                      className="pms-field-input"
                      name="amount"
                      type="number"
                      min="0.01"
                      max={balance}
                      step="0.01"
                      required
                      placeholder="Valor"
                    />
                    <select
                      className="pms-field-input"
                      name="payment_method"
                      defaultValue="pix"
                    >
                      <option value="pix">Pix</option>
                      <option value="cash">Dinheiro</option>
                      <option value="credit_card">Cartão de crédito</option>
                      <option value="debit_card">Cartão de débito</option>
                    </select>
                    <input
                      className="pms-field-input"
                      name="reference_code"
                      placeholder="Referência"
                    />
                    <button className="pms-button-primary">Receber</button>
                  </form>
                ) : null}
              </article>
            );
          })}
          {!response.items.length ? (
            <p>Nenhum caso pós-saída registrado.</p>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
