import { PERMISSIONS, type BookingChannelReferenceData } from "@hotel/shared";
import { getUserFromSession } from "../../../../lib/auth";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import type { UsageGuideDefinition } from "../../_components/UsageGuide";
import {
  actBookingChannelEventAction,
  importBookingChannelCsvAction,
  saveBookingConfigurationAction,
  saveBookingChannelMappingAction,
} from "../stage6Actions";
import { reservationOperationsTabs } from "../stage6Tabs";
import { ChannelCreateForm } from "./ChannelCreateForm";
type Channel = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  mappings: unknown[];
};
type Config = {
  configuration?: {
    published: boolean;
    primary_color: string;
    introduction: string;
    guarantee_instructions: string;
    terms: string;
    consent_version: string;
  };
};
const guide: UsageGuideDefinition = {
  id: "channels-stage6",
  title: "Venda direta e canais",
  steps: [
    {
      id: "publish",
      target: "booking-publication",
      title: "Publique conscientemente",
      description:
        "O site fica oculto até a configuração ser marcada como publicada.",
    },
    {
      id: "inbox",
      target: "channel-inbox",
      title: "Resolva divergências",
      description:
        "Eventos sem mapeamento ou inventário ficam em revisão e nunca causam overbooking silencioso.",
    },
  ],
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.BOOKING_CHANNELS_MANAGE))
    return (
      <DashboardAccessDeniedCard
        title="Canais"
        message="Sem permissão para gerenciar conexões."
      />
    );
  const [channels, config, inbox, referenceData] = await Promise.all([
    requestOperationsFinanceEndpoint<{ items: Channel[] }>(
      "booking-channels",
      "GET",
    ),
    requestOperationsFinanceEndpoint<Config>("booking-configuration", "GET"),
    requestOperationsFinanceEndpoint<{
      items: Array<{
        id: string;
        channel_name: string;
        status: string;
        reason?: string;
        event_type: string;
        version: number;
      }>;
    }>("booking-channels/inbox", "GET"),
    requestOperationsFinanceEndpoint<BookingChannelReferenceData>(
      "booking-channels/reference-data",
      "GET",
    ),
  ]);
  const c = config.configuration;
  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="channels"
      tabs={reservationOperationsTabs(user)}
      usageGuide={guide}
      status={(await searchParams).status}
    >
      <section
        className="pms-surface-card"
        data-usage-guide="booking-publication"
      >
        <h2 className="mt-0">Venda direta</h2>
        <form
          action={saveBookingConfigurationAction}
          className="grid gap-3 md:grid-cols-2"
        >
          <label className="pms-field">
            Cor principal
            <input
              className="pms-field-input"
              name="primary_color"
              defaultValue={c?.primary_color || "#315F4D"}
              pattern="^#[0-9A-Fa-f]{6}$"
              required
            />
          </label>
          <label className="pms-field">
            Versão do consentimento
            <input
              className="pms-field-input"
              name="consent_version"
              defaultValue={c?.consent_version || "v1"}
              required
            />
          </label>
          <label className="pms-field">
            Apresentação
            <textarea
              className="pms-field-input"
              name="introduction"
              defaultValue={c?.introduction || ""}
            />
          </label>
          <label className="pms-field">
            Instruções de sinal
            <textarea
              className="pms-field-input"
              name="guarantee_instructions"
              defaultValue={c?.guarantee_instructions || ""}
            />
          </label>
          <label className="pms-field md:col-span-2">
            Termos
            <textarea
              className="pms-field-input"
              name="terms"
              defaultValue={
                c?.terms || "Revise as políticas antes de reservar."
              }
              required
            />
          </label>
          <label>
            <input
              type="checkbox"
              name="published"
              defaultChecked={c?.published}
            />{" "}
            Publicar hotel no site direto
          </label>
          <button className="pms-button-primary" type="submit">
            Salvar configuração
          </button>
        </form>
      </section>
      <section className="pms-surface-card">
        <h2>Nova conexão de canal</h2>
        <p>
          O site direto publica reservas do próprio hotel. Um canal externo
          envia reservas por um conector; aqui usamos somente o simulador
          fictício <strong>HospedaLink Sandbox</strong>, sem integração com OTA
          real.
        </p>
        <ChannelCreateForm />
        {(channels.items || []).map((item) => (
          <p key={item.id}>
            <strong>{item.name}</strong> · {item.active ? "ativo" : "inativo"} ·{" "}
            {item.mappings?.length || 0} mapeamento(s)
          </p>
        ))}
      </section>
      {channels.items?.length ? (
        <section className="pms-surface-card">
          <h2>Mapear categoria e tarifa</h2>
          <form
            action={saveBookingChannelMappingAction}
            className="grid gap-3 md:grid-cols-3"
          >
            <label className="pms-field">
              Canal externo
              <select className="pms-field-input" name="channel_id" required>
                {channels.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Código externo da categoria
              <input
                className="pms-field-input"
                name="external_room_code"
                placeholder="Ex.: STD"
                required
              />
            </label>
            <label className="pms-field">
              Categoria interna
              <select className="pms-field-input" name="room_type" required>
                <option value="">Selecione a categoria</option>
                {referenceData.room_types.map((roomType) => (
                  <option key={roomType.value} value={roomType.value}>
                    {roomType.label} ({roomType.room_count} quarto(s))
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Código externo da tarifa
              <input
                className="pms-field-input"
                name="external_rate_code"
                placeholder="Ex.: FLEX"
                required
              />
            </label>
            <label className="pms-field">
              Plano tarifário interno
              <select className="pms-field-input" name="rate_plan_id" required>
                <option value="">Selecione o plano</option>
                {referenceData.rate_plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.code} · v{plan.version}
                  </option>
                ))}
              </select>
            </label>
            <button className="pms-button-primary" type="submit">
              Salvar mapeamento
            </button>
          </form>
        </section>
      ) : null}
      {channels.items?.length ? (
        <section className="pms-surface-card">
          <h2>Importar CSV</h2>
          <p>
            Cole um CSV exportado pelo simulador. Ele entra primeiro na caixa de
            entrada para validação e nunca confirma conflito silenciosamente.
          </p>
          <form action={importBookingChannelCsvAction} className="grid gap-3">
            <label className="pms-field">
              Canal de origem
              <select className="pms-field-input" name="channel_id" required>
                {channels.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Conteúdo CSV
              <textarea
                className="pms-field-input min-h-32"
                name="csv_text"
                defaultValue={
                  "event_id,event_type,external_reservation_id,occurred_at,room_code,rate_code,checkin_date,checkout_date,adults,children,currency,total,guest_name,guest_email,guest_phone\nHL-001,create,RES-001,2026-09-19T12:00:00Z,STD,FLEX,2026-09-21,2026-09-23,2,0,BRL,500,Hóspede Exemplo,guest@example.invalid,+551100000000"
                }
                required
              />
            </label>
            <button className="pms-button-primary" type="submit">
              Importar para revisão
            </button>
          </form>
        </section>
      ) : null}
      <section className="pms-surface-card" data-usage-guide="channel-inbox">
        <h2>Caixa de entrada</h2>
        {(inbox.items || []).length === 0 ? (
          <p>
            Nenhum evento aguardando decisão. Eventos importados aparecem aqui
            quando precisam ser aplicados, mapeados ou rejeitados.
          </p>
        ) : (
          (inbox.items || []).map((item) => (
            <article key={item.id} className="border-t py-3">
              <p>
                <strong>{item.channel_name}</strong>: {item.event_type} ·{" "}
                {item.status} {item.reason ? `· ${item.reason}` : ""}
              </p>
              <form
                action={actBookingChannelEventAction}
                className="flex flex-wrap gap-2"
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="version" value={item.version} />
                <select className="pms-field-input" name="action">
                  <option value="apply">Aplicar</option>
                  <option value="resolve">Resolver conflito e aplicar</option>
                  <option value="reject">Rejeitar</option>
                </select>
                <input
                  className="pms-field-input"
                  name="reason"
                  minLength={3}
                  placeholder="Motivo da decisão"
                  required
                />
                <button className="pms-button-primary" type="submit">
                  Registrar decisão
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </DashboardEntityPageShell>
  );
}
