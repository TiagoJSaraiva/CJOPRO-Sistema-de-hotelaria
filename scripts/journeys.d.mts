export const PRODUCTION_JOURNEYS: readonly string[];
export function buildJourneyEnvironment(
  credentials: { apiUrl: string; serviceRoleKey: string },
  baseEnvironment?: Record<string, string | undefined>,
): Record<string, string | undefined>;
export function parseJourneyArguments(argv: string[]): string[];
export function journeyPhases(
  argv: string[],
): Array<"development" | "production">;
