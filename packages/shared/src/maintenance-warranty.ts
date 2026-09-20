import { Type, type Static } from "typebox";

const strict = { additionalProperties: false } as const;
const uuid = () => Type.String({ format: "uuid" });

export const MaintenanceWarrantyDecisionResultSchema = Type.Union([
  Type.Literal("claim_submitted"),
  Type.Literal("renewed"),
  Type.Literal("replaced"),
  Type.Literal("retired"),
  Type.Literal("expiry_acknowledged"),
]);

export const MaintenanceWarrantyDecisionInputSchema = Type.Object(
  {
    result: MaintenanceWarrantyDecisionResultSchema,
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    expected_location_version: Type.Integer({ minimum: 1 }),
    occurrence_id: Type.Optional(uuid()),
    replacement_location_id: Type.Optional(uuid()),
    new_warranty_ends_on: Type.Optional(Type.String({ format: "date" })),
    supersedes_id: Type.Optional(uuid()),
  },
  { ...strict, $id: "MaintenanceWarrantyDecisionInput" },
);

export const MaintenanceWarrantyDecisionSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    location_id: uuid(),
    warranty_ends_on: Type.String({ format: "date" }),
    result: MaintenanceWarrantyDecisionResultSchema,
    reason: Type.String(),
    occurrence_id: Type.Union([uuid(), Type.Null()]),
    replacement_location_id: Type.Union([uuid(), Type.Null()]),
    new_warranty_ends_on: Type.Union([
      Type.String({ format: "date" }),
      Type.Null(),
    ]),
    supersedes_id: Type.Union([uuid(), Type.Null()]),
    decided_by: uuid(),
    decided_by_name: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.String({ format: "date-time" }),
  },
  { ...strict, $id: "MaintenanceWarrantyDecision" },
);

export const MaintenanceWarrantyOccurrenceSchema = Type.Object(
  {
    id: uuid(),
    code: Type.String(),
    title: Type.String(),
  },
  { ...strict, $id: "MaintenanceWarrantyOccurrence" },
);

export type MaintenanceWarrantyDecisionInput = Static<
  typeof MaintenanceWarrantyDecisionInputSchema
>;
export type MaintenanceWarrantyDecision = Static<
  typeof MaintenanceWarrantyDecisionSchema
>;
export type MaintenanceWarrantyOccurrence = Static<
  typeof MaintenanceWarrantyOccurrenceSchema
>;
