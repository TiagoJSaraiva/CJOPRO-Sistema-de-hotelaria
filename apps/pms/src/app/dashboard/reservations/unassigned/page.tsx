import { PERMISSIONS } from "@hotel/shared";
import {
  listCustomers,
  requestOperationsFinanceEndpoint,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { whenForbidden } from "../../../../lib/whenForbidden";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import { formatMoney } from "../_components/OperationalPanelPrimitives";
import { reservationOperationsTabs } from "../stage6Tabs";
import {
  assignReservationRoomAction,
  cancelUnassignedReservationAction,
  linkReservationCustomerAction,
} from "./actions";
import { UnassignedGuarantee, UnassignedSettlement } from "./UnassignedPanels";

type Accommodation = {
  id: string;
  room_type: string;
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  version: number;
};
type Item = {
  id: string;
  code: string;
  version: number;
  lifecycle_status: "hold" | "confirmed" | "canceled" | "no_show";
  source: string | null;
  guest_count: number;
  customer_id: string | null;
  customer_name: string | null;
  contact: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  closure_balance: number;
  cancel_penalty: number;
  accommodations: Accommodation[];
};
type Candidate = { room_id: string; room_number: string; readiness: string };
type CashRegisterList = {
  registers: Array<{
    kind: string;
    name: string;
    active_session?: { id: string } | null;
  }>;
};

const SOURCE_LABEL: Record<string, string> = {
  agency: "Canal de reserva",
  website: "Site do hotel",
  front_desk: "Recepção",
};
const STATUS_LABEL: Record<Item["lifecycle_status"], string> = {
  hold: "Pré-reserva",
  confirmed: "Confirmada",
  canceled: "Cancelada",
  no_show: "No-show",
};
const READINESS_LABEL: Record<string, string> = {
  ready: "pronto",
  not_ready: "aguardando liberação",
  blocked: "interditado",
};

const guide: UsageGuideDefinition = {
  id: "reservations-unassigned",
  title: "Reservas sem quarto",
  steps: [
    {
      id: "queue",
      target: "unassigned-queue",
      title: "Veja o que falta em cada reserva",
      description:
        "Reservas de canal e do site chegam sem cliente e sem quarto. Sem quarto não há estadia, então elas ainda não aparecem no calendário.",
    },
    {
      id: "identify",
      target: "unassigned-identify",
      title: "Identifique o hóspede",
      description:
        "O canal não envia documento nem nascimento. Escolha um cliente do hotel ou cadastre com o documento em mãos. O contato enviado pelo canal serve só de referência.",
    },
    {
      id: "assign",
      target: "unassigned-assign",
      title: "Aloque o quarto",
      description:
        "A lista traz só quartos da categoria reservada, livres no período. Pré-reserva precisa do adiantamento antes de receber quarto.",
    },
  ],
};

const fieldClass = "pms-field-input";

function formatDate(value: string) {
  return value.split("-").reverse().join("/");
}

async function roomCandidates(
  item: Item,
  accommodation: Accommodation,
): Promise<Candidate[]> {
  const result = await requestOperationsFinanceEndpoint<{
    candidates?: Candidate[];
  }>(`reservations/${item.id}/room-assignments/simulate`, "POST", {
    accommodation_id: accommodation.id,
  });
  return result.candidates || [];
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE))
    return (
      <DashboardAccessDeniedCard
        title="Reservas sem quarto"
        message="Sem permissão para alocar quartos."
      />
    );
  const canCreateCustomer = user.permissions.includes(
    PERMISSIONS.CUSTOMER_CREATE,
  );
  const canManageGuarantees = user.permissions.includes(
    PERMISSIONS.RESERVATION_GUARANTEES_MANAGE,
  );
  const [data, customers, cashRegisters] = await Promise.all([
    requestOperationsFinanceEndpoint<{ items: Item[] }>(
      "reservations/unassigned",
      "GET",
    ),
    listCustomers(),
    canManageGuarantees &&
    user.permissions.includes(PERMISSIONS.CASH_MANAGEMENT_READ)
      ? requestOperationsFinanceEndpoint<CashRegisterList>(
          "cash-registers",
          "GET",
        ).catch(whenForbidden(null))
      : Promise.resolve(null),
  ]);
  const register = cashRegisters?.registers
    .filter((candidate) => candidate.kind === "reception")
    .find((candidate) => candidate.active_session);
  const cashSession = register?.active_session
    ? { id: register.active_session.id, registerName: register.name }
    : null;

  const items = data.items || [];
  const candidates = new Map<string, Candidate[]>();
  await Promise.all(
    items
      .filter(
        (item) => item.lifecycle_status === "confirmed" && item.customer_id,
      )
      .flatMap((item) =>
        item.accommodations.map(async (accommodation) => {
          candidates.set(
            accommodation.id,
            await roomCandidates(item, accommodation),
          );
        }),
      ),
  );

  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="unassigned"
      tabs={reservationOperationsTabs(user)}
      usageGuide={guide}
      status={(await searchParams).status}
    >
      <section className="grid gap-3" data-usage-guide="unassigned-queue">
        {items.length === 0 ? (
          <p className="pms-surface-card m-0">
            Nenhuma reserva aguarda quarto ou acerto.
          </p>
        ) : null}
        {items.map((item) => {
          const closed =
            item.lifecycle_status === "canceled" ||
            item.lifecycle_status === "no_show";
          return (
            <article className="pms-surface-card grid gap-3" key={item.id}>
              <header>
                <h2 className="m-0">{item.code}</h2>
                <p className="m-0 text-sm">
                  {STATUS_LABEL[item.lifecycle_status]} ·{" "}
                  {SOURCE_LABEL[item.source || ""] || "Origem não informada"} ·{" "}
                  {item.guest_count} hóspede(s)
                </p>
                {item.contact ? (
                  <p className="m-0 text-sm">
                    Contato informado: {item.contact.full_name}
                    {item.contact.email ? ` · ${item.contact.email}` : ""}
                    {item.contact.phone ? ` · ${item.contact.phone}` : ""}
                  </p>
                ) : null}
              </header>

              {closed ? (
                <UnassignedSettlement
                  reservationId={item.id}
                  balance={item.closure_balance}
                  canSettle={canManageGuarantees}
                  cashSession={cashSession}
                />
              ) : (
                <>
                  <div data-usage-guide="unassigned-identify">
                    <h3 className="m-0 mb-2">1. Hóspede</h3>
                    {item.customer_id ? (
                      <p className="m-0 text-sm">
                        Identificado: <strong>{item.customer_name}</strong>
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        <form
                          action={linkReservationCustomerAction}
                          className="grid gap-2 md:grid-cols-3"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="version"
                            value={item.version}
                          />
                          <label className="pms-field md:col-span-2">
                            <span>Cliente do hotel</span>
                            <select
                              className={fieldClass}
                              name="customer_id"
                              required
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Selecione
                              </option>
                              {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                  {customer.full_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="pms-button-primary self-end"
                            type="submit"
                          >
                            Vincular cliente
                          </button>
                        </form>
                        {canCreateCustomer ? (
                          <details>
                            <summary>Cadastrar novo cliente</summary>
                            <form
                              action={linkReservationCustomerAction}
                              className="mt-2 grid gap-2 md:grid-cols-2"
                            >
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="version"
                                value={item.version}
                              />
                              <label className="pms-field md:col-span-2">
                                <span>Nome completo</span>
                                <input
                                  className={fieldClass}
                                  name="full_name"
                                  required
                                  minLength={2}
                                  defaultValue={item.contact?.full_name || ""}
                                />
                              </label>
                              <label className="pms-field">
                                <span>Tipo de documento</span>
                                <select
                                  className={fieldClass}
                                  name="document_type"
                                  defaultValue="cpf"
                                >
                                  <option value="cpf">CPF</option>
                                  <option value="passport">Passaporte</option>
                                  <option value="rg">RG</option>
                                </select>
                              </label>
                              <label className="pms-field">
                                <span>Número do documento</span>
                                <input
                                  className={fieldClass}
                                  name="document_number"
                                  required
                                  minLength={3}
                                />
                              </label>
                              <label className="pms-field">
                                <span>Data de nascimento</span>
                                <input
                                  className={fieldClass}
                                  name="birth_date"
                                  type="date"
                                  required
                                />
                              </label>
                              <label className="pms-field">
                                <span>E-mail (opcional)</span>
                                <input
                                  className={fieldClass}
                                  name="email"
                                  type="email"
                                  defaultValue={item.contact?.email || ""}
                                />
                              </label>
                              <button
                                className="pms-button-primary justify-self-start"
                                type="submit"
                              >
                                Cadastrar e vincular
                              </button>
                            </form>
                          </details>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div data-usage-guide="unassigned-assign">
                    <h3 className="m-0 mb-2">2. Quarto</h3>
                    {item.lifecycle_status === "hold" ? (
                      <div className="grid gap-2">
                        <p className="m-0 text-sm">
                          Pré-reserva: registre o adiantamento para confirmar
                          antes de alocar o quarto.
                        </p>
                        {canManageGuarantees ? (
                          <UnassignedGuarantee
                            reservationId={item.id}
                            canManagePrearrival={user.permissions.includes(
                              PERMISSIONS.PREARRIVAL_MANAGE,
                            )}
                            publicSiteUrl={
                              process.env.PUBLIC_SITE_URL ||
                              "http://localhost:3000"
                            }
                            cashSession={cashSession}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    {item.accommodations.map((accommodation) => {
                      const rooms = candidates.get(accommodation.id) || [];
                      return (
                        <div className="grid gap-2" key={accommodation.id}>
                          <p className="m-0 text-sm">
                            {accommodation.room_type} ·{" "}
                            {formatDate(accommodation.checkin_date)} a{" "}
                            {formatDate(accommodation.checkout_date)} ·{" "}
                            {accommodation.adults} adulto(s),{" "}
                            {accommodation.children} criança(s)
                          </p>
                          {item.lifecycle_status !==
                          "confirmed" ? null : !item.customer_id ? (
                            <p className="m-0 text-sm">
                              Identifique o hóspede para alocar o quarto.
                            </p>
                          ) : rooms.length === 0 ? (
                            <p className="m-0 text-sm">
                              Nenhum quarto dessa categoria está livre no
                              período.
                            </p>
                          ) : (
                            <form
                              action={assignReservationRoomAction}
                              className="grid gap-2 md:grid-cols-3"
                            >
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="accommodation_id"
                                value={accommodation.id}
                              />
                              <input
                                type="hidden"
                                name="version"
                                value={accommodation.version}
                              />
                              <label className="pms-field">
                                <span>Quarto</span>
                                <select
                                  className={fieldClass}
                                  name="room_id"
                                  required
                                >
                                  {rooms.map((room) => (
                                    <option
                                      key={room.room_id}
                                      value={room.room_id}
                                    >
                                      {room.room_number} (
                                      {READINESS_LABEL[room.readiness] ||
                                        "situação não informada"}
                                      )
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="pms-field">
                                <span>Motivo da alocação</span>
                                <input
                                  className={fieldClass}
                                  name="reason"
                                  required
                                  minLength={3}
                                  defaultValue="Alocação da recepção"
                                />
                              </label>
                              <button
                                className="pms-button-primary self-end"
                                type="submit"
                              >
                                Alocar quarto
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canManageGuarantees ? (
                    <details>
                      <summary>Cancelar reserva</summary>
                      <form
                        action={cancelUnassignedReservationAction}
                        className="mt-2 grid gap-2"
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="version"
                          value={item.version}
                        />
                        <p className="m-0 text-sm">
                          Multa do plano: {formatMoney(item.cancel_penalty)}.
                          Adiantamento recebido:{" "}
                          {formatMoney(item.closure_balance)}.
                        </p>
                        <label className="pms-field">
                          <span>Motivo</span>
                          <input
                            className={fieldClass}
                            name="reason"
                            required
                            minLength={3}
                            maxLength={500}
                          />
                        </label>
                        <button
                          className="pms-button-primary justify-self-start"
                          type="submit"
                        >
                          Confirmar cancelamento
                        </button>
                      </form>
                    </details>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </section>
    </DashboardEntityPageShell>
  );
}
