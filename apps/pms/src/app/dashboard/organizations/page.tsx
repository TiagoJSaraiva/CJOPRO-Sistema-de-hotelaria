import { PERMISSIONS } from "@hotel/shared";
import Link from "next/link";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../_components/UsageGuide";
import { getUserFromSession } from "../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import { actOrganizationAction, createOrganizationAction } from "./actions";
const guide: UsageGuideDefinition = {
  id: "organizations",
  title: "Organizações e papéis",
  steps: [
    {
      id: "identity",
      target: "organization-identity",
      title: "Centralize a identidade",
      description:
        "O mesmo cadastro pode atuar como fornecedor, parceiro ou empresa pagadora sem misturar seus fluxos.",
    },
    {
      id: "roles",
      target: "organization-roles",
      title: "Consulte por papel",
      description:
        "Contratos, crédito e saldos continuam protegidos pelas permissões de cada módulo.",
    },
  ],
};
type Org = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  currency: string;
  active: boolean;
  version: number;
  roles: Record<string, string>;
};
type Overview = Org & {
  conflicts?: Array<{
    id: string;
    role_type: string;
    divergent_values: Record<string, unknown>;
  }>;
  commercial_agreements?: unknown[] | null;
  partner_settlements?: unknown[] | null;
  maintenance_contracts?: unknown[] | null;
  purchase_orders?: unknown[] | null;
  corporate_authorizations?: unknown[] | null;
};
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.BUSINESS_ORGANIZATIONS_READ))
    return (
      <DashboardAccessDeniedCard
        title="Organizações"
        message="Sem permissão para consultar organizações."
      />
    );
  const params = await searchParams;
  const items = await requestOperationsFinanceEndpoint<Org[]>(
    "business-organizations",
    "GET",
  );
  const overview = params.id
    ? await requestOperationsFinanceEndpoint<Overview>(
        `business-organizations/${params.id}/overview`,
        "GET",
      )
    : null;
  const canManage = user.permissions.includes(
    PERMISSIONS.BUSINESS_ORGANIZATIONS_MANAGE,
  );
  return (
    <DashboardEntityPageShell
      title="Organizações"
      activeTabKey="list"
      tabs={[
        {
          key: "list",
          label: "Cadastros",
          href: "/dashboard/organizations",
          isVisible: true,
        },
      ]}
      usageGuide={guide}
      status={params.status}
    >
      <div className="grid gap-4">
        {canManage ? (
          <section
            className="pms-surface-card"
            data-usage-guide="organization-identity"
          >
            <h2 className="mt-0">Nova organização</h2>
            <form
              action={createOrganizationAction}
              className="grid gap-3 md:grid-cols-3"
            >
              <label className="pms-field">
                Razão social
                <input
                  className="pms-field-input"
                  name="legal_name"
                  minLength={2}
                  required
                />
              </label>
              <label className="pms-field">
                Nome comercial
                <input className="pms-field-input" name="trade_name" />
              </label>
              <label className="pms-field">
                Documento fiscal
                <input className="pms-field-input" name="tax_id" />
              </label>
              <label className="pms-field">
                Moeda
                <input
                  className="pms-field-input"
                  name="currency"
                  defaultValue="BRL"
                  required
                />
              </label>
              <label className="pms-field">
                E-mail
                <input className="pms-field-input" name="email" type="email" />
              </label>
              <label className="pms-field">
                Telefone
                <input className="pms-field-input" name="phone" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="stock_supplier" />
                Fornecedor de estoque
              </label>
              <button className="pms-button-primary md:col-span-3 md:w-fit">
                Cadastrar
              </button>
            </form>
          </section>
        ) : null}
        <section
          className="pms-surface-card"
          data-usage-guide="organization-roles"
        >
          <h2 className="mt-0">Identidades e papéis</h2>
          <div className="grid gap-2">
            {items.map((o) => (
              <article className="rounded border p-3" key={o.id}>
                <strong>{o.trade_name || o.legal_name}</strong>
                <p className="mb-1 text-sm">
                  {o.legal_name} · {o.tax_id || "sem documento"}
                </p>
                <p className="m-0 text-sm">
                  Papéis: {Object.keys(o.roles || {}).join(", ") || "nenhum"}
                </p>
                <Link
                  className="pms-button-secondary mt-2 inline-flex"
                  href={`/dashboard/organizations?id=${o.id}`}
                >
                  Visão consolidada
                </Link>
              </article>
            ))}
          </div>
        </section>
        {overview ? (
          <section
            className="pms-surface-card"
            data-usage-guide="organization-overview"
          >
            <h2 className="mt-0">
              Visão consolidada de {overview.trade_name || overview.legal_name}
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                ["Acordos comerciais", overview.commercial_agreements],
                ["Apurações de parceiro", overview.partner_settlements],
                ["Contratos de manutenção", overview.maintenance_contracts],
                ["Pedidos de compra", overview.purchase_orders],
                [
                  "Autorizações empresariais",
                  overview.corporate_authorizations,
                ],
              ]
                .filter((entry) => entry[1] !== null && entry[1] !== undefined)
                .map(([title, values]) => (
                  <article className="rounded border p-3" key={String(title)}>
                    <strong>{String(title)}</strong>
                    <p className="m-0 text-sm">
                      {Array.isArray(values) ? values.length : 0} registro(s)
                      autorizado(s)
                    </p>
                  </article>
                ))}
            </div>
            {overview.conflicts?.length ? (
              <div className="mt-4 grid gap-2">
                <h3 className="m-0">Divergências cadastrais</h3>
                {overview.conflicts.map((conflict) => (
                  <article
                    className="rounded border border-amber-300 bg-amber-50 p-3"
                    key={conflict.id}
                  >
                    <strong>{conflict.role_type}</strong>
                    <p className="text-sm">
                      {JSON.stringify(conflict.divergent_values)}
                    </p>
                    {canManage ? (
                      <form
                        action={actOrganizationAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={overview.id} />
                        <input
                          type="hidden"
                          name="version"
                          value={overview.version}
                        />
                        <input
                          type="hidden"
                          name="action"
                          value="resolve_conflict"
                        />
                        <input
                          type="hidden"
                          name="conflict_id"
                          value={conflict.id}
                        />
                        <label className="pms-field">
                          Decisão
                          <input
                            className="pms-field-input"
                            name="reason"
                            minLength={3}
                            required
                          />
                        </label>
                        <button className="pms-button-secondary">
                          Marcar revisada
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
            {canManage ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <form
                  action={actOrganizationAction}
                  className="rounded border p-3 grid gap-2"
                >
                  <h3 className="m-0">Consolidar cadastro</h3>
                  <input type="hidden" name="id" value={overview.id} />
                  <input
                    type="hidden"
                    name="version"
                    value={overview.version}
                  />
                  <input type="hidden" name="action" value="merge" />
                  <label className="pms-field">
                    Destino
                    <select
                      className="pms-field-input"
                      name="target_id"
                      required
                    >
                      {items
                        .filter((item) => item.id !== overview.id)
                        .map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.trade_name || item.legal_name}
                          </option>
                        ))}
                    </select>
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
                  <button className="pms-button-secondary">Consolidar</button>
                </form>
                <form
                  action={actOrganizationAction}
                  className="rounded border p-3 grid gap-2"
                >
                  <h3 className="m-0">Separar um papel</h3>
                  <input type="hidden" name="id" value={overview.id} />
                  <input
                    type="hidden"
                    name="version"
                    value={overview.version}
                  />
                  <input type="hidden" name="action" value="split" />
                  <label className="pms-field">
                    Papel
                    <select
                      className="pms-field-input"
                      name="role_choice"
                      required
                    >
                      {Object.entries(overview.roles).map(([role, id]) => (
                        <option
                          value={`${role.replace("_id", "")}:${id}`}
                          key={role}
                        >
                          {role}
                        </option>
                      ))}
                    </select>
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
                  <button className="pms-button-secondary">Separar</button>
                </form>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </DashboardEntityPageShell>
  );
}
