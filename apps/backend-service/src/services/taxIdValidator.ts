type TaxIdValidationResult = {
  isValid: boolean;
  normalizedTaxId: string;
  message?: string;
};

type LocaleSuggestion = {
  timezone?: string;
  currency?: string;
};

function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCnpj(cnpj: string): boolean {
  const value = normalizeDigits(cnpj);

  if (value.length !== 14) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const calculateDigit = (base: string, startWeight: number): number => {
    let sum = 0;
    let weight = startWeight;

    for (const char of base) {
      sum += Number(char) * weight;
      weight -= 1;

      if (weight < 2) {
        weight = 9;
      }
    }

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(value.slice(0, 12), 5);
  const secondDigit = calculateDigit(`${value.slice(0, 12)}${firstDigit}`, 6);

  return value.endsWith(`${firstDigit}${secondDigit}`);
}

export function validateTaxIdByCountry(country: string, taxId: string): TaxIdValidationResult {
  const normalizedCountry = normalizeCountry(country);

  if (normalizedCountry === "BR" || normalizedCountry === "BRAZIL" || normalizedCountry === "BRASIL") {
    const normalizedTaxId = normalizeDigits(taxId);
    const isValid = isValidCnpj(normalizedTaxId);

    return {
      isValid,
      normalizedTaxId,
      message: isValid ? undefined : "CNPJ invalido para o pais informado."
    };
  }

  return {
    isValid: true,
    normalizedTaxId: taxId.trim()
  };
}

export function suggestLocaleByCountry(country: string): LocaleSuggestion {
  const normalizedCountry = normalizeCountry(country);

  if (normalizedCountry === "BR" || normalizedCountry === "BRAZIL" || normalizedCountry === "BRASIL") {
    return {
      timezone: "America/Sao_Paulo",
      currency: "BRL"
    };
  }

  if (normalizedCountry === "PT" || normalizedCountry === "PORTUGAL") {
    return {
      timezone: "Europe/Lisbon",
      currency: "EUR"
    };
  }

  if (normalizedCountry === "US" || normalizedCountry === "USA" || normalizedCountry === "UNITED STATES") {
    return {
      timezone: "America/New_York",
      currency: "USD"
    };
  }

  return {};
}
