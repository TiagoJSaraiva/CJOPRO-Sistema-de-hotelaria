import { describe, expect, it } from "vitest";
import {
  isValidCountryCode,
  isValidCurrency,
  isValidEmail,
  isValidPhone,
  isValidSlug,
  isValidTimezone,
  isValidZipCodeByCountry,
  normalizeCountryCode,
  normalizeCurrency,
  normalizeEmail,
  normalizeSlug,
  sanitizePhone,
  suggestLocaleByCountry,
  validateTaxIdByCountry
} from "../../src/validation";

describe("validation", () => {
  it("sanitiza telefone removendo caracteres nao numericos", () => {
    expect(sanitizePhone("+55 (11) 98888-7777")).toBe("5511988887777");
  });

  it("valida telefone com 8 a 15 digitos", () => {
    expect(isValidPhone("11987654321")).toBe(true);
    expect(isValidPhone("1234567")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });

  it("normaliza e valida email", () => {
    expect(normalizeEmail("  ADMIN@Hotel.com ")).toBe("admin@hotel.com");
    expect(isValidEmail("admin@hotel.com")).toBe(true);
    expect(isValidEmail("admin@@hotel")).toBe(false);
  });

  it("normaliza slug removendo acentos e simbolos", () => {
    expect(normalizeSlug(" Hotel Sao Joao 5* ")).toBe("hotel-sao-joao-5");
  });

  it("valida slug em formato kebab-case", () => {
    expect(isValidSlug("hotel-sao-paulo")).toBe(true);
    expect(isValidSlug("Hotel_Sao_Paulo")).toBe(false);
  });

  it("normaliza e valida country code", () => {
    expect(normalizeCountryCode(" br ")).toBe("BR");
    expect(isValidCountryCode("br")).toBe(true);
    expect(isValidCountryCode("bra")).toBe(false);
  });

  it("normaliza e valida moeda", () => {
    expect(normalizeCurrency(" brl ")).toBe("BRL");
    expect(isValidCurrency("USD")).toBe(true);
    expect(isValidCurrency("")).toBe(false);
  });

  it("valida timezone conhecida e invalida vazia", () => {
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("")).toBe(false);
  });

  it("valida CEP por pais", () => {
    expect(isValidZipCodeByCountry("BR", "01001-000")).toBe(true);
    expect(isValidZipCodeByCountry("BR", "1234")).toBe(false);
    expect(isValidZipCodeByCountry("US", "90210")).toBe(true);
    expect(isValidZipCodeByCountry("US", "12")).toBe(false);
  });

  it("valida CNPJ para BR", () => {
    const result = validateTaxIdByCountry("BR", "04.252.011/0001-10");

    expect(result).toEqual({
      isValid: true,
      normalizedTaxId: "04252011000110",
      message: undefined
    });
  });

  it("retorna erro para CNPJ invalido em BR", () => {
    const result = validateTaxIdByCountry("Brasil", "11.111.111/1111-11");

    expect(result.isValid).toBe(false);
    expect(result.normalizedTaxId).toBe("11111111111111");
    expect(result.message).toBe("CNPJ invalido para o pais informado.");
  });

  it("aceita tax id livre para paises fora de BR", () => {
    const result = validateTaxIdByCountry("PT", "  PT12345  ");

    expect(result).toEqual({
      isValid: true,
      normalizedTaxId: "PT12345"
    });
  });

  it("sugere locale para BR, PT e US", () => {
    expect(suggestLocaleByCountry("br")).toEqual({
      timezone: "America/Sao_Paulo",
      currency: "BRL"
    });

    expect(suggestLocaleByCountry("Portugal")).toEqual({
      timezone: "Europe/Lisbon",
      currency: "EUR"
    });

    expect(suggestLocaleByCountry("United States")).toEqual({
      timezone: "America/New_York",
      currency: "USD"
    });
  });

  it("retorna objeto vazio quando nao ha sugestao de locale", () => {
    expect(suggestLocaleByCountry("AR")).toEqual({});
  });
});
