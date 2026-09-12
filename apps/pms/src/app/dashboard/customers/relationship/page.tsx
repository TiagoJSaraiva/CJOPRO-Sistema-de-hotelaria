import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import {
  listCustomers,
  requestOperationsFinanceEndpoint,
} from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { createGuestPreferenceAction } from "./actions";

type Preference = {
  id: string;
  category: string;
  value: string;
  source: string;
  consent_version: string;
  valid_until?: string | null;
  revoked_at?: string | null;
};
type Relationship = {
  customer: { id: string; full_name: string };
  preferences: Preference[];
  reservations: unknown[];
  stays: unknown[];
};

const guide: UsageGuideDefinition = {
  id: "guest-relationship-stage6",
  title: "Relacionamento com o hóspede",
  steps: [
    {
      id: "declared",
      target: "guest-declared-preferences",
      title: "Registre somente o que foi declarado",
      description:
        "Informe a origem, o consentimento e a vigência; o histórico nunca vira preferência automática.",
    },
  ],
};

export default async function CustomerRelationshipPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.GUEST_RELATIONSHIP_READ))
    return (
      <DashboardAccessDeniedCard
        title="Relacionamento"
        message="Sem permissão para consultar o relacionamento do hóspede."
      />
    );
  const params = await searchParams;
  const customers = await listCustomers();
  const customerId = params.customerId || customers[0]?.id;
  const relationship = customerId
    ? await requestOperationsFinanceEndpoint<Relationship>(
        `customers/${customerId}/relationship`,
        "GET",
      )
    : null;
  const canManage = user.permissions.includes(
    PERMISSIONS.GUEST_RELATIONSHIP_MANAGE,
  );
  return (
    <DashboardEntityPageShell
      title="Clientes"
      activeTabKey="relationship"
      tabs={[
        {
          key: "view",
          label: "Ver clientes",
          href: "/dashboard/customers/view",
          isVisible: true,
        },
        {
          key: "relationship",
          label: "Relacionamento",
          href: "/dashboard/customers/relationship",
          isVisible: true,
        },
      ]}
      usageGuide={guide}
      status={params.status}
    >
      <section className="pms-surface-card">
        <form method="get" className="flex flex-wrap gap-3">
          <label className="pms-field">
            Hóspede
            <select
              className="pms-field-input"
              name="customerId"
              defaultValue={customerId}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          </label>
          <button className="pms-button-secondary" type="submit">
            Consultar
          </button>
        </form>
      </section>
      {relationship ? (
        <section
          className="pms-surface-card"
          data-usage-guide="guest-declared-preferences"
        >
          <h2>{relationship.customer.full_name}</h2>
          <p>
            {relationship.reservations?.length || 0} reserva(s) ·{" "}
            {relationship.stays?.length || 0} estadia(s)
          </p>
          {(relationship.preferences || []).map((item) => (
            <p key={item.id}>
              <strong>{item.category}</strong>: {item.value} · origem{" "}
              {item.source} · consentimento {item.consent_version}
              {item.valid_until ? ` · válida até ${item.valid_until}` : ""}
              {item.revoked_at ? " · revogada" : ""}
            </p>
          ))}
          {canManage ? (
            <form
              action={createGuestPreferenceAction}
              className="grid gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="customer_id" value={customerId} />
              <label className="pms-field">
                Categoria
                <select className="pms-field-input" name="category">
                  <option value="room">Quarto</option>
                  <option value="service">Serviço</option>
                  <option value="food">Alimentação</option>
                  <option value="accessibility">Acessibilidade</option>
                  <option value="communication">Comunicação</option>
                  <option value="other">Outra</option>
                </select>
              </label>
              <label className="pms-field">
                Origem
                <select className="pms-field-input" name="source">
                  <option value="guest">Informada pelo hóspede</option>
                  <option value="staff">Informada pela equipe</option>
                </select>
              </label>
              <label className="pms-field md:col-span-2">
                Preferência declarada
                <textarea
                  className="pms-field-input"
                  name="value"
                  minLength={2}
                  required
                />
              </label>
              <label className="pms-field">
                Versão do consentimento
                <input
                  className="pms-field-input"
                  name="consent_version"
                  required
                />
              </label>
              <label className="pms-field">
                Vigência opcional
                <input
                  className="pms-field-input"
                  type="date"
                  name="valid_until"
                />
              </label>
              <button className="pms-button-primary" type="submit">
                Registrar preferência
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        <p>Nenhum hóspede cadastrado.</p>
      )}
    </DashboardEntityPageShell>
  );
}
