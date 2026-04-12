export function normalizeOptionalText(value: string | null | undefined): string | null {
  const parsed = (value || "").trim();
  return parsed.length ? parsed : null;
}
