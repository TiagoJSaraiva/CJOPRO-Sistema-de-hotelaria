import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listCommercialAgreements,
  listCommercialAgreementHistory,
  listCommercialPartners,
  listConsumptionPoints,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import {
  activateCommercialAgreementRevisionAction,
  archiveCommercialAgreementAction,
  createCommercialAgreementAction,
  createCommercialAgreementRevisionAction,
  terminateCommercialAgreementRevisionAction,
} from "../commercialActions";
import { ConsumptionStatusMessage } from "../_components/ConsumptionStatusMessage";
import { commercialAgreementsGuide } from "../usageGuides";

const modelLabel = {
  fixed_rent: "Aluguel fixo",
  revenue_share: "Comissão sobre vendas",
  hybrid: "Híbrido",
} as const;
const statusLabel = {
  draft: "Rascunho",
  scheduled: "Agendado",
  current: "Vigente",
  expired: "Expirado",
  terminated: "Encerrado",
  superseded: "Substituído",
} as const;
const recipientLabel = {
  hotel: "Hotel",
  partner: "Parceiro",
  both: "Hotel e parceiro",
} as const;

function AgreementFields({
  points,
  defaults,
}: {
  points: Awaited<ReturnType<typeof listConsumptionPoints>>;
  defaults?: {
    starts_on: string;
    ends_on: string | null;
    commercial_model: "fixed_rent" | "revenue_share" | "hybrid";
    fixed_rent: number | null;
    rent_frequency: "monthly" | "quarterly" | "yearly" | null;
    commission_percentage: number | null;
    minimum_guarantee: number | null;
    payment_recipient: "hotel" | "partner" | "both";
    notes: string | null;
    point_ids: string[];
  };
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="pms-field">
          Início
          <input
            type="date"
            name="starts_on"
            required
            defaultValue={defaults?.starts_on}
            className="pms-field-input"
          />
        </label>
        <label className="pms-field">
          Término opcional
          <input
            type="date"
            name="ends_on"
            defaultValue={defaults?.ends_on || ""}
            className="pms-field-input"
          />
        </label>
        <label className="pms-field">
          Modelo comercial
          <select
            name="commercial_model"
            required
            defaultValue={defaults?.commercial_model || "fixed_rent"}
            className="pms-field-input"
          >
            <option value="fixed_rent">Aluguel fixo</option>
            <option value="revenue_share">Comissão</option>
            <option value="hybrid">Híbrido</option>
          </select>
        </label>
        <label className="pms-field">
          Aluguel fixo
          <input
            type="number"
            min={0}
            step="0.01"
            name="fixed_rent"
            defaultValue={defaults?.fixed_rent ?? ""}
            className="pms-field-input"
          />
        </label>
        <label className="pms-field">
          Periodicidade
          <select
            name="rent_frequency"
            defaultValue={defaults?.rent_frequency || ""}
            className="pms-field-input"
          >
            <option value="">Não aplicável</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </label>
        <label className="pms-field">
          Comissão (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.0001"
            name="commission_percentage"
            defaultValue={defaults?.commission_percentage ?? ""}
            className="pms-field-input"
          />
        </label>
        <label className="pms-field">
          Mínimo garantido
          <input
            type="number"
            min={0}
            step="0.01"
            name="minimum_guarantee"
            defaultValue={defaults?.minimum_guarantee ?? ""}
            className="pms-field-input"
          />
        </label>
        <label className="pms-field">
          Recebedor
          <select
            name="payment_recipient"
            required
            defaultValue={defaults?.payment_recipient || "hotel"}
            className="pms-field-input"
          >
            <option value="hotel">Hotel</option>
            <option value="partner">Parceiro</option>
            <option value="both">Ambos</option>
          </select>
        </label>
      </div>
      <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 font-semibold">Pontos abrangidos</legend>
        {points
          .filter((point) => !point.archived_at)
          .map((point) => (
            <label key={point.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="point_ids"
                value={point.id}
                defaultChecked={defaults?.point_ids.includes(point.id)}
              />
              {point.name}
            </label>
          ))}
      </fieldset>
      <label className="pms-field">
        Observações
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={defaults?.notes || ""}
          className="pms-field-input"
        />
      </label>
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">
          Como funcionam os termos?
        </summary>
        <p>
          Aluguel usa valor e periodicidade; comissão usa o percentual sobre a
          venda líquida operacional; híbrido soma aluguel e comissão e aplica o
          mínimo garantido quando ele for maior. O recebedor controla quais
          modos poderão ser usados nas ofertas.
        </p>
      </details>
    </>
  );
}

export default async function CommercialAgreementsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    q?: string;
    model?: string;
    effective?: string;
    history?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params?.status;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canReadCommercial)
    return (
      <DashboardAccessDeniedCard
        title="Acordos comerciais"
        message="Sem permissão para consultar acordos comerciais."
      />
    );
  const [agreements, partners, points] = await Promise.all([
    listCommercialAgreements(true),
    listCommercialPartners(),
    listConsumptionPoints(true),
  ]);
  const query = params?.q?.trim().toLocaleLowerCase("pt-BR") || "";
  const visibleAgreements = agreements.filter((agreement) => {
    const latest = agreement.revisions[0];
    return (
      (!query ||
        agreement.internal_number.toLocaleLowerCase("pt-BR").includes(query) ||
        agreement.partner.trade_name
          .toLocaleLowerCase("pt-BR")
          .includes(query)) &&
      (!params?.model || latest?.commercial_model === params.model) &&
      (!params?.effective || latest?.effective_status === params.effective)
    );
  });
  const selectedHistory = params?.history
    ? await listCommercialAgreementHistory(params.history)
    : [];
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="agreements"
      usageGuide={commercialAgreementsGuide}
      tabs={[
        {
          key: "points",
          label: "Pontos de consumo",
          href: "/dashboard/consumption/points",
          isVisible: access.canRead,
        },
        {
          key: "offers",
          label: "Ofertas",
          href: "/dashboard/consumption/offers",
          isVisible: access.canRead,
        },
        {
          key: "partners",
          label: "Parceiros",
          href: "/dashboard/consumption/partners",
          isVisible: access.canReadCommercial,
        },
        {
          key: "agreements",
          label: "Acordos",
          href: "/dashboard/consumption/agreements",
          isVisible: access.canReadCommercial,
        },
      ]}
      statusContent={<ConsumptionStatusMessage status={status} />}
    >
      <div className="grid gap-5">
        {access.canManageAgreements ? (
          <form
            action={createCommercialAgreementAction}
            className="pms-surface-card grid gap-3"
            data-usage-guide="commercial-agreement-form"
          >
            <div>
              <h2 className="m-0 text-xl font-semibold">Novo acordo</h2>
              <p className="mb-0 text-sm text-slate-600">
                O acordo nasce como rascunho para revisão antes da ativação.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="pms-field">
                Parceiro
                <select name="partner_id" required className="pms-field-input">
                  <option value="">Selecione</option>
                  {partners
                    .filter(
                      (partner) => partner.is_active && !partner.archived_at,
                    )
                    .map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.trade_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="pms-field">
                Número interno
                <input
                  name="internal_number"
                  required
                  maxLength={80}
                  className="pms-field-input"
                />
              </label>
            </div>
            <AgreementFields points={points} />
            <button type="submit" className="pms-button-primary">
              Criar rascunho do acordo
            </button>
          </form>
        ) : null}
        <section
          className="grid gap-3"
          data-usage-guide="commercial-agreement-list"
        >
          <h2 className="m-0 text-xl font-semibold">Acordos e revisões</h2>
          <form
            method="get"
            className="pms-surface-card grid gap-3 md:grid-cols-4"
          >
            <label className="pms-field">
              Buscar
              <input
                name="q"
                defaultValue={params?.q}
                placeholder="Número ou parceiro"
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Modelo
              <select
                name="model"
                defaultValue={params?.model || ""}
                className="pms-field-input"
              >
                <option value="">Todos</option>
                <option value="fixed_rent">Aluguel</option>
                <option value="revenue_share">Comissão</option>
                <option value="hybrid">Híbrido</option>
              </select>
            </label>
            <label className="pms-field">
              Estado
              <select
                name="effective"
                defaultValue={params?.effective || ""}
                className="pms-field-input"
              >
                <option value="">Todos</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="pms-button-secondary self-end">
              Aplicar filtros
            </button>
          </form>
          {visibleAgreements.map((agreement) => (
            <article key={agreement.id} className="pms-surface-card grid gap-3">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="m-0 text-lg font-semibold">
                    {agreement.internal_number} · {agreement.partner.trade_name}
                  </h3>
                  <p className="m-0 text-sm text-slate-600">
                    {agreement.current_revision
                      ? `${modelLabel[agreement.current_revision.commercial_model]} · ${statusLabel[agreement.current_revision.effective_status]}`
                      : "Sem revisão vigente"}
                    {agreement.archived_at ? " · Arquivado" : ""}
                  </p>
                </div>
                {access.canManageAgreements ? (
                  <form action={archiveCommercialAgreementAction}>
                    <input type="hidden" name="id" value={agreement.id} />
                    <input
                      type="hidden"
                      name="archived"
                      value={agreement.archived_at ? "false" : "true"}
                    />
                    <button type="submit" className="pms-button-secondary">
                      {agreement.archived_at ? "Restaurar" : "Arquivar"}
                    </button>
                  </form>
                ) : null}
              </header>
              <div className="grid gap-2">
                {agreement.revisions.map((revision) => (
                  <section
                    key={revision.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <strong>Revisão {revision.version}</strong> ·{" "}
                        {statusLabel[revision.effective_status]}
                        <p className="m-0 text-sm">
                          {modelLabel[revision.commercial_model]} · recebedor:{" "}
                          {recipientLabel[revision.payment_recipient]} ·{" "}
                          {revision.starts_on} a{" "}
                          {revision.ends_on || "sem término"}
                        </p>
                        <p className="m-0 text-sm text-slate-600">
                          {revision.point_ids.length} ponto(s) · moeda{" "}
                          {revision.currency}
                        </p>
                      </div>
                      {access.canManageAgreements &&
                      revision.status === "draft" ? (
                        <details>
                          <summary className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 font-semibold">
                            Ativar
                          </summary>
                          <form
                            action={activateCommercialAgreementRevisionAction}
                            className="mt-2 grid gap-2"
                          >
                            <input
                              type="hidden"
                              name="revision_id"
                              value={revision.id}
                            />
                            <p className="m-0 max-w-md text-sm">
                              Confirme somente após revisar termos, recebedor,
                              vigência e pontos. A revisão ficará imutável.
                            </p>
                            <button
                              type="submit"
                              className="pms-button-primary"
                            >
                              Confirmar ativação
                            </button>
                          </form>
                        </details>
                      ) : null}
                      {access.canManageAgreements &&
                      revision.status === "activated" ? (
                        <details>
                          <summary className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 font-semibold">
                            Encerrar
                          </summary>
                          <form
                            action={terminateCommercialAgreementRevisionAction}
                            className="mt-2 grid gap-2"
                          >
                            <input
                              type="hidden"
                              name="revision_id"
                              value={revision.id}
                            />
                            <label className="pms-field">
                              Último dia de vigência
                              <input
                                type="date"
                                name="ends_on"
                                required
                                min={revision.starts_on}
                                className="pms-field-input"
                              />
                            </label>
                            <button
                              type="submit"
                              className="pms-button-primary"
                            >
                              Confirmar encerramento
                            </button>
                          </form>
                        </details>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
              {access.canManageAgreements && agreement.revisions.length ? (
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Criar nova revisão
                  </summary>
                  <form
                    action={createCommercialAgreementRevisionAction}
                    className="mt-3 grid gap-3"
                  >
                    <input
                      type="hidden"
                      name="agreement_id"
                      value={agreement.id}
                    />
                    <AgreementFields
                      points={points}
                      defaults={agreement.revisions[0]}
                    />
                    <button type="submit" className="pms-button-primary">
                      Salvar nova revisão em rascunho
                    </button>
                  </form>
                </details>
              ) : null}
              <div>
                <a
                  href={`/dashboard/consumption/agreements?history=${agreement.id}`}
                  className="text-sm font-semibold underline"
                >
                  Ver histórico
                </a>
                {params?.history === agreement.id ? (
                  <ol
                    className="mt-2 grid gap-1 text-sm"
                    aria-label="Histórico do acordo"
                  >
                    {selectedHistory.map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.created_at}>
                          {new Date(event.created_at).toLocaleString("pt-BR")}
                        </time>{" "}
                        · {event.action} · {event.actor_name || "Sistema"}
                      </li>
                    ))}
                    {!selectedHistory.length ? (
                      <li>Sem eventos registrados.</li>
                    ) : null}
                  </ol>
                ) : null}
              </div>
            </article>
          ))}
          {!visibleAgreements.length ? (
            <p className="pms-status-muted">
              Nenhum acordo comercial cadastrado.
            </p>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
