"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import {
  failureStatus,
  operationOutcome,
} from "../_components/operationOutcome";

const text = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();
async function run(
  endpoint: string,
  method: "POST" | "PUT",
  body: unknown,
  path: string,
  status: string,
) {
  try {
    await requestOperationsFinanceEndpoint(endpoint, method, body);
  } catch (error) {
    redirect(`${path}?status=${failureStatus(error)}`);
  }
  revalidatePath(path);
  redirect(`${path}?status=${status}`);
}
export async function saveBookingConfigurationAction(form: FormData) {
  await run(
    "booking-configuration",
    "PUT",
    {
      published: form.get("published") === "on",
      primary_color: text(form, "primary_color"),
      introduction: text(form, "introduction"),
      guarantee_instructions: text(form, "guarantee_instructions"),
      terms: text(form, "terms"),
      consent_version: text(form, "consent_version"),
    },
    "/dashboard/reservations/channels",
    "booking-configuration-saved",
  );
}
export async function createBookingChannelWithSecretAction(
  _state: { message: string; secret?: string; failed?: boolean },
  form: FormData,
) {
  try {
    const result = await requestOperationsFinanceEndpoint<{
      secret?: string;
    }>("booking-channels", "POST", {
      name: text(form, "name"),
      code: text(form, "code"),
      active: true,
    });
    revalidatePath("/dashboard/reservations/channels");
    return {
      message:
        "Canal criado. Copie o segredo agora; ele não será exibido novamente.",
      secret: result.secret,
    };
  } catch (error) {
    return {
      message: operationOutcome(failureStatus(error))?.message ?? "",
      failed: true,
    };
  }
}
export async function saveBookingChannelMappingAction(form: FormData) {
  const channelId = text(form, "channel_id");
  await run(
    `booking-channels/${channelId}/mappings`,
    "POST",
    {
      external_room_code: text(form, "external_room_code"),
      room_type: text(form, "room_type"),
      external_rate_code: text(form, "external_rate_code"),
      rate_plan_id: text(form, "rate_plan_id"),
    },
    "/dashboard/reservations/channels",
    "channel-mapping-saved",
  );
}
export async function actBookingChannelEventAction(form: FormData) {
  const id = text(form, "id");
  await run(
    `booking-channel-events/${id}/actions`,
    "POST",
    {
      action: text(form, "action"),
      expected_version: Number(form.get("version")),
      reason: text(form, "reason"),
    },
    "/dashboard/reservations/channels",
    "channel-event-updated",
  );
}
function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}
export async function importBookingChannelCsvAction(form: FormData) {
  const lines = text(form, "csv_text").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  const rows = lines.map((line) => {
    const columns = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, columns[index] || ""]),
    );
    return {
      event_id: row.event_id,
      event_type: row.event_type,
      external_reservation_id: row.external_reservation_id,
      occurred_at: row.occurred_at,
      reservation: {
        room_code: row.room_code,
        rate_code: row.rate_code,
        checkin_date: row.checkin_date,
        checkout_date: row.checkout_date,
        adults: Number(row.adults),
        children: Number(row.children || 0),
        currency: row.currency,
        total: Number(row.total),
        guest_name: row.guest_name,
        guest_email: row.guest_email || undefined,
        guest_phone: row.guest_phone || undefined,
      },
    };
  });
  await run(
    "booking-channels/import",
    "POST",
    { channel_id: text(form, "channel_id"), rows },
    "/dashboard/reservations/channels",
    "channel-csv-imported",
  );
}
export async function actPrearrivalRequestAction(form: FormData) {
  const id = text(form, "id");
  await run(
    `prearrival-requests/${id}/actions`,
    "POST",
    {
      action: text(form, "action"),
      expected_version: Number(form.get("version")),
      reason: text(form, "reason"),
      next_action: text(form, "next_action") || undefined,
    },
    "/dashboard/reservations/prearrival",
    "prearrival-updated",
  );
}
export async function reconcileAnalyticsAction(form: FormData) {
  await run(
    "analytics/operations/reconcile",
    "POST",
    {
      from: text(form, "from") || undefined,
      to: text(form, "to") || undefined,
    },
    "/dashboard/reservations/analytics",
    "analytics-reconciled",
  );
}
