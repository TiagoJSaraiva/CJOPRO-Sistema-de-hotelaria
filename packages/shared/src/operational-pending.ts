import { Type, type Static } from "typebox";
import { PERMISSIONS } from "./permissions";
const nullableText = Type.Union([Type.String(), Type.Null()]);
export const OperationalPendingSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    source: Type.Union([
      Type.Literal("maintenance"),
      Type.Literal("consumption"),
      Type.Literal("governance"),
    ]),
    kind: Type.String(),
    entity_id: Type.String({ format: "uuid" }),
    title: Type.String(),
    href: Type.String(),
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warning"),
      Type.Literal("critical"),
    ]),
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("claimed"),
      Type.Literal("resolved"),
    ]),
    assigned_to: nullableText,
    assignee_name: nullableText,
    version: Type.Integer(),
    opened_at: Type.String(),
    resolved_at: nullableText,
    resolution_reason: nullableText,
    read: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const OperationalPendingListSchema = Type.Object({
  items: Type.Array(OperationalPendingSchema),
  total: Type.Integer(),
  summary: Type.Object({
    open: Type.Integer(),
    claimed: Type.Integer(),
    resolved: Type.Integer(),
    unread: Type.Integer(),
  }),
  sync: Type.Object({
    last_success_at: nullableText,
    error_message: nullableText,
  }),
});
export const OperationalPendingQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.String({ pattern: "^[1-9][0-9]{0,5}$" })),
    source: Type.Optional(
      Type.Union([
        Type.Literal("maintenance"),
        Type.Literal("consumption"),
        Type.Literal("governance"),
      ]),
    ),
    kind: Type.Optional(Type.String({ maxLength: 60 })),
    severity: Type.Optional(
      Type.Union([
        Type.Literal("info"),
        Type.Literal("warning"),
        Type.Literal("critical"),
      ]),
    ),
    status: Type.Optional(
      Type.Union([
        Type.Literal("open"),
        Type.Literal("claimed"),
        Type.Literal("resolved"),
      ]),
    ),
    assignee: Type.Optional(
      Type.Union([Type.Literal("me"), Type.Literal("unassigned")]),
    ),
    read: Type.Optional(
      Type.Union([Type.Literal("read"), Type.Literal("unread")]),
    ),
  },
  { additionalProperties: false },
);
export const OperationalPendingActionSchema = Type.Object(
  {
    ids: Type.Array(Type.String({ format: "uuid" }), {
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    }),
    action: Type.Union([
      Type.Literal("read"),
      Type.Literal("unread"),
      Type.Literal("claim"),
      Type.Literal("release"),
    ]),
    expected_version: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);
export type OperationalPending = Static<typeof OperationalPendingSchema>;
export type OperationalPendingList = Static<
  typeof OperationalPendingListSchema
>;
export type OperationalPendingQuery = Static<
  typeof OperationalPendingQuerySchema
>;
export type OperationalPendingAction = Static<
  typeof OperationalPendingActionSchema
>;
export const OPERATIONAL_PENDING_PERMISSIONS = [
  PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.COMMERCIAL_PARTNERS_READ,
  PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
  PERMISSIONS.PARTNER_SETTLEMENTS_READ,
  PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
  PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE,
  PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE,
  PERMISSIONS.MAINTENANCE_READ,
  PERMISSIONS.MAINTENANCE_EXECUTE,
  PERMISSIONS.MAINTENANCE_TRIAGE,
  PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
  PERMISSIONS.MAINTENANCE_SLA_MANAGE,
  PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
  PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
  PERMISSIONS.GOVERNANCE_READ,
  PERMISSIONS.GOVERNANCE_EXECUTE,
  PERMISSIONS.GOVERNANCE_INSPECT,
  PERMISSIONS.GOVERNANCE_ASSIGN,
];
