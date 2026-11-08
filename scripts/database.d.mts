export function assertLocalApiUrl(value: string): string;
export function supabaseCliEnvironment(
  baseEnvironment?: Record<string, string | undefined>,
  directory?: string,
): Record<string, string | undefined>;
export function cleanSupabaseCliTemp(directory?: string): number;
