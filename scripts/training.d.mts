export const TRAINING_SCENARIOS: readonly (readonly [string, string])[];
export function assertTrainingLocalApiUrl(value: string): string;
export function parseTrainingArguments(argv: string[]): Record<string, unknown>;
export function baselineFingerprint(root?: string, day?: string): string;
export function hasUsableBaseline(): boolean;
export function createBaseline(): void;
export function restoreBaseline(): void;
export function baselineChecksums(): Record<string, string>;
export function resetScenario(
  key: string,
  yes: boolean,
  options?: { fast?: boolean },
): Promise<void>;
export function reusableLocalValidation(
  environment?: Record<string, string | undefined>,
): string | null;
