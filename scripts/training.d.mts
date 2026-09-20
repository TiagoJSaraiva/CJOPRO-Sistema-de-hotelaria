export const TRAINING_SCENARIOS: readonly (readonly [string, string])[];
export function assertTrainingLocalApiUrl(value: string): string;
export function parseTrainingArguments(argv: string[]): Record<string, unknown>;
