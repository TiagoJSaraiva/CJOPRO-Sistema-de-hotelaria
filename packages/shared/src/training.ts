import { Type, type Static } from "typebox";

const strict = { additionalProperties: false } as const;

export const TrainingClockModeSchema = Type.Union([
  Type.Literal("live"),
  Type.Literal("frozen"),
]);

export const TrainingEnvironmentSchema = Type.Object(
  {
    hotel_id: Type.String({ format: "uuid" }),
    scenario_key: Type.Union([Type.String(), Type.Null()]),
    scenario_version: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    clock_mode: TrainingClockModeSchema,
    frozen_at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    operational_now: Type.String({ format: "date-time" }),
    real_now: Type.String({ format: "date-time" }),
    version: Type.Integer({ minimum: 1 }),
    updated_by: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    updated_at: Type.String({ format: "date-time" }),
  },
  { ...strict, $id: "TrainingEnvironment" },
);

export const TrainingClockActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("freeze"),
      Type.Literal("set"),
      Type.Literal("advance"),
      Type.Literal("resume"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    at: Type.Optional(Type.String({ format: "date-time" })),
    amount: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
    unit: Type.Optional(
      Type.Union([Type.Literal("hours"), Type.Literal("days")]),
    ),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
  },
  { ...strict, $id: "TrainingClockAction" },
);

export type TrainingEnvironment = Static<typeof TrainingEnvironmentSchema>;
export type TrainingClockAction = Static<typeof TrainingClockActionSchema>;
