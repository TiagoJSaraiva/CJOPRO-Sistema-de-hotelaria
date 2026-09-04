import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listCommercialPartnerHistory,
  listCommercialPartners,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getConsumptionAccess } from "../access";
import {
  archiveCommercialPartnerAction,
  archiveCommercialPartnerContactAction,
  createCommercialPartnerAction,
  createCommercialPartnerContactAction,
  updateCommercialPartnerAction,
} from "../commercialActions";
import { ConsumptionStatusMessage } from "../_components/ConsumptionStatusMessage";
import { commercialPartnersGuide } from "../usageGuides";

export default async function CommercialPartnersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    q?: string;
    lifecycle?: string;
    history?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params?.status;
  const access = getConsumptionAccess(await getUserFromSession());
  if (!access.canReadCommercial)
    return (
      <DashboardAccessDeniedCard
        title="Parceiros comerciais"
        message="Sem permissão para consultar parceiros comerciais."
      />
    );
  const partners = await listCommercialPartners(true);
  const query = params?.q?.trim().toLocaleLowerCase("pt-BR") || "";
  const visiblePartners = partners.filter((partner) => {
    const matchesQuery =
      !query ||
      [partner.trade_name, partner.legal_name, partner.tax_id]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(query));
    const matchesLifecycle =
      !params?.lifecycle ||
      (params.lifecycle === "active" &&
        partner.is_active &&
        !partner.archived_at) ||
      (params.lifecycle === "inactive" &&
        !partner.is_active &&
        !partner.archived_at) ||
      (params.lifecycle === "archived" && Boolean(partner.archived_at));
    return matchesQuery && matchesLifecycle;
  });
  const selectedHistory = params?.history
    ? await listCommercialPartnerHistory(params.history)
    : [];
  return (
    <DashboardEntityPageShell
      title="Vendas e consumo"
      activeTabKey="partners"
      usageGuide={commercialPartnersGuide}
      tabs={[
        {
          key: "launch",
          label: "Lançar consumo",
          href: "/dashboard/consumption/launch",
          isVisible: access.canPost,
        },
        {
          key: "history",
          label: "Histórico",
          href: "/dashboard/consumption/history",
          isVisible: access.canRead,
        },
        {
          key: "adjustments",
          label: "Ajustes",
          href: "/dashboard/consumption/adjustments",
          isVisible: access.canApproveAdjustments,
        },
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
        {access.canManagePartners ? (
          <form
            action={createCommercialPartnerAction}
            className="pms-surface-card grid gap-3"
            data-usage-guide="commercial-partner-form"
          >
            <div>
              <h2 className="m-0 text-xl font-semibold">Novo parceiro</h2>
              <p className="mb-0 text-sm text-slate-600">
                Cadastre a empresa que opera comercialmente dentro do hotel.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="pms-field">
                Nome comercial
                <input
                  name="trade_name"
                  required
                  maxLength={160}
                  className="pms-field-input"
                />
              </label>
              <label className="pms-field">
                Razão social
                <input
                  name="legal_name"
                  required
                  maxLength={200}
                  className="pms-field-input"
                />
              </label>
              <label className="pms-field">
                Documento fiscal
                <input
                  name="tax_id"
                  maxLength={40}
                  className="pms-field-input"
                />
              </label>
              <label className="pms-field">
                E-mail
                <input name="email" type="email" className="pms-field-input" />
              </label>
              <label className="pms-field">
                Telefone
                <input
                  name="phone"
                  maxLength={40}
                  className="pms-field-input"
                />
              </label>
            </div>
            <label className="pms-field">
              Observações
              <textarea
                name="notes"
                maxLength={2000}
                className="pms-field-input"
              />
            </label>
            <button type="submit" className="pms-button-primary">
              Criar parceiro
            </button>
          </form>
        ) : null}
        <section
          className="grid gap-3"
          data-usage-guide="commercial-partner-list"
        >
          <h2 className="m-0 text-xl font-semibold">Parceiros cadastrados</h2>
          <form
            method="get"
            className="pms-surface-card grid gap-3 md:grid-cols-3"
          >
            <label className="pms-field">
              Buscar
              <input
                name="q"
                defaultValue={params?.q}
                placeholder="Nome, razão social ou documento"
                className="pms-field-input"
              />
            </label>
            <label className="pms-field">
              Situação
              <select
                name="lifecycle"
                defaultValue={params?.lifecycle || ""}
                className="pms-field-input"
              >
                <option value="">Todas</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="archived">Arquivados</option>
              </select>
            </label>
            <button type="submit" className="pms-button-secondary self-end">
              Aplicar filtros
            </button>
          </form>
          {visiblePartners.map((partner) => (
            <article key={partner.id} className="pms-surface-card grid gap-3">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="m-0 text-lg font-semibold">
                    {partner.trade_name}
                  </h3>
                  <p className="m-0 text-sm text-slate-600">
                    {partner.legal_name} ·{" "}
                    {partner.is_active ? "Ativo" : "Inativo"}
                    {partner.archived_at ? " · Arquivado" : ""}
                  </p>
                </div>
                {access.canManagePartners ? (
                  <form action={archiveCommercialPartnerAction}>
                    <input type="hidden" name="id" value={partner.id} />
                    <input
                      type="hidden"
                      name="archived"
                      value={partner.archived_at ? "false" : "true"}
                    />
                    <button className="pms-button-secondary" type="submit">
                      {partner.archived_at ? "Restaurar" : "Arquivar"}
                    </button>
                  </form>
                ) : null}
              </header>
              <p className="m-0 text-sm">
                {partner.tax_id || "Sem documento fiscal"} ·{" "}
                {partner.email || partner.phone || "Sem canal geral"}
              </p>
              <details>
                <summary className="cursor-pointer font-semibold">
                  Contatos ({partner.contacts.length})
                </summary>
                {partner.contacts.length ? (
                  <ul>
                    {partner.contacts.map((contact) => (
                      <li key={contact.id}>
                        {contact.name} · {contact.purpose} ·{" "}
                        {contact.email || contact.phone}
                        {contact.archived_at ? " · Arquivado" : ""}
                        {access.canManagePartners ? (
                          <form
                            action={archiveCommercialPartnerContactAction}
                            className="ml-2 inline"
                          >
                            <input type="hidden" name="id" value={contact.id} />
                            <input
                              type="hidden"
                              name="archived"
                              value={contact.archived_at ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              className="text-sm font-semibold underline"
                            >
                              {contact.archived_at ? "Restaurar" : "Arquivar"}
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">
                    Nenhum contato cadastrado.
                  </p>
                )}
                {access.canManagePartners && !partner.archived_at ? (
                  <form
                    action={createCommercialPartnerContactAction}
                    className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-2"
                  >
                    <input type="hidden" name="partner_id" value={partner.id} />
                    <label className="pms-field">
                      Nome
                      <input name="name" required className="pms-field-input" />
                    </label>
                    <label className="pms-field">
                      Função
                      <input name="role" className="pms-field-input" />
                    </label>
                    <label className="pms-field">
                      Finalidade
                      <select name="purpose" className="pms-field-input">
                        <option value="general">Geral</option>
                        <option value="operational">Operacional</option>
                        <option value="financial">Financeira</option>
                      </select>
                    </label>
                    <label className="pms-field">
                      E-mail
                      <input
                        name="email"
                        type="email"
                        className="pms-field-input"
                      />
                    </label>
                    <label className="pms-field">
                      Telefone
                      <input name="phone" className="pms-field-input" />
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="is_primary" />
                      Contato principal
                    </label>
                    <button type="submit" className="pms-button-primary">
                      Adicionar contato
                    </button>
                  </form>
                ) : null}
              </details>
              {access.canManagePartners && !partner.archived_at ? (
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Editar cadastro
                  </summary>
                  <form
                    action={updateCommercialPartnerAction}
                    className="mt-2 grid gap-2 md:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={partner.id} />
                    <label className="pms-field">
                      Nome comercial
                      <input
                        name="trade_name"
                        defaultValue={partner.trade_name}
                        required
                        className="pms-field-input"
                      />
                    </label>
                    <label className="pms-field">
                      Razão social
                      <input
                        name="legal_name"
                        defaultValue={partner.legal_name}
                        required
                        className="pms-field-input"
                      />
                    </label>
                    <label className="pms-field">
                      Documento
                      <input
                        name="tax_id"
                        defaultValue={partner.tax_id || ""}
                        className="pms-field-input"
                      />
                    </label>
                    <label className="pms-field">
                      E-mail
                      <input
                        name="email"
                        type="email"
                        defaultValue={partner.email || ""}
                        className="pms-field-input"
                      />
                    </label>
                    <label className="pms-field">
                      Telefone
                      <input
                        name="phone"
                        defaultValue={partner.phone || ""}
                        className="pms-field-input"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={partner.is_active}
                      />
                      Ativo
                    </label>
                    <button type="submit" className="pms-button-primary">
                      Salvar parceiro
                    </button>
                  </form>
                </details>
              ) : null}
              <div>
                <a
                  href={`/dashboard/consumption/partners?history=${partner.id}`}
                  className="text-sm font-semibold underline"
                >
                  Ver histórico
                </a>
                {params?.history === partner.id ? (
                  <ol
                    className="mt-2 grid gap-1 text-sm"
                    aria-label="Histórico do parceiro"
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
          {!visiblePartners.length ? (
            <p className="pms-status-muted">
              Nenhum parceiro comercial cadastrado.
            </p>
          ) : null}
        </section>
      </div>
    </DashboardEntityPageShell>
  );
}
