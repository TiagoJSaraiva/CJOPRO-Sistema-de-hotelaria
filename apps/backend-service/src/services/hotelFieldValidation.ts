const intlWithSupportedValues = Intl as unknown as {
  supportedValuesOf?: (key: string) => string[];
};

const SUPPORTED_TIMEZONES = new Set(intlWithSupportedValues.supportedValuesOf?.("timeZone") || []);
const SUPPORTED_CURRENCIES = new Set((intlWithSupportedValues.supportedValuesOf?.("currency") || []).map((value) => value.toUpperCase()));

export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(value: string): boolean {
  return /^\d{8,15}$/.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase());
}

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCurrency(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeCurrency(value);

  if (!SUPPORTED_CURRENCIES.size) {
    return /^[A-Z]{3}$/.test(normalized);
  }

  return SUPPORTED_CURRENCIES.has(normalized);
}

export function isValidTimezone(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim();

  if (!SUPPORTED_TIMEZONES.size) {
    return /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(normalized);
  }

  return SUPPORTED_TIMEZONES.has(normalized);
}

export function normalizeZipCode(value: string): string {
  return value.trim();
}

export function isValidZipCodeByCountry(country: string, zipCode: string): boolean {
  const normalizedCountry = normalizeCountryCode(country);
  const normalizedZip = normalizeZipCode(zipCode);

  if (normalizedCountry === "BR") {
    return /^\d{5}-?\d{3}$/.test(normalizedZip);
  }

  return normalizedZip.length >= 3;
}
