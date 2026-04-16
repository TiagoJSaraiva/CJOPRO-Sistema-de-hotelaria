"use client";

import { countries } from "countries-list";
import * as ct from "countries-and-timezones";
import { useMemo, useState } from "react";

type CountryLocaleFieldsProps = {
  defaultCountryCode?: string;
};

type CountryOption = {
  code: string;
  name: string;
  currency: string;
  timezone: string;
};

const COUNTRY_OPTIONS: CountryOption[] = Object.entries(countries)
  .map(([code, countryData]) => {
    const countryInfo = ct.getCountry(code);
    const timezone = countryInfo?.timezones?.[0] || "";
    const currency = Array.isArray(countryData.currency)
      ? countryData.currency[0] || ""
      : countryData.currency || "";

    return {
      code,
      name: countryData.name,
      currency,
      timezone
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const ALL_TIMEZONES = Array.from(new Set(COUNTRY_OPTIONS.map((option) => option.timezone).filter(Boolean))).sort((a, b) =>
  a.localeCompare(b)
);

const ALL_CURRENCIES = Array.from(new Set(COUNTRY_OPTIONS.map((option) => option.currency).filter(Boolean))).sort((a, b) =>
  a.localeCompare(b)
);

function findCountryOption(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((option) => option.code === code);
}

export function CountryLocaleFields({ defaultCountryCode = "BR" }: CountryLocaleFieldsProps) {
  const initialOption = useMemo(() => findCountryOption(defaultCountryCode) || COUNTRY_OPTIONS[0], [defaultCountryCode]);

  const [countryCode, setCountryCode] = useState(initialOption?.code || "BR");
  const [timezone, setTimezone] = useState(initialOption?.timezone || "");
  const [currency, setCurrency] = useState(initialOption?.currency || "");

  const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCode = event.target.value;
    const nextOption = findCountryOption(nextCode);

    setCountryCode(nextCode);
    setTimezone(nextOption?.timezone || "");
    setCurrency(nextOption?.currency || "");
  };

  const handleTimezoneBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = event.target.value.trim();

    if (!currentValue || ALL_TIMEZONES.includes(currentValue)) {
      event.target.setCustomValidity("");
      return;
    }

    event.target.setCustomValidity("Timezone invalido. Escolha um timezone existente.");
    event.target.reportValidity();
  };

  const handleCurrencyBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const currentValue = event.target.value.trim().toUpperCase();

    if (!currentValue || ALL_CURRENCIES.includes(currentValue)) {
      event.target.setCustomValidity("");
      return;
    }

    event.target.setCustomValidity("Moeda invalida. Informe um codigo de moeda existente.");
    event.target.reportValidity();
  };

  return (
    <>
      <div className="pms-field">
        <label htmlFor="create-country">Pais</label>
        <select
          id="create-country"
          name="country"
          value={countryCode}
          onChange={handleCountryChange}
          required
          className="pms-field-input"
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor="create-timezone">Timezone</label>
        <input
          id="create-timezone"
          name="timezone"
          list="timezone-options"
          required
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          onBlur={handleTimezoneBlur}
          className="pms-field-input"
        />
        <datalist id="timezone-options">
          {ALL_TIMEZONES.map((timezoneOption) => (
            <option key={timezoneOption} value={timezoneOption} />
          ))}
        </datalist>
      </div>

      <div className="pms-field">
        <label htmlFor="create-currency">Moeda</label>
        <input
          id="create-currency"
          name="currency"
          list="currency-options"
          required
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          onBlur={handleCurrencyBlur}
          className="pms-field-input"
        />
        <datalist id="currency-options">
          {ALL_CURRENCIES.map((currencyOption) => (
            <option key={currencyOption} value={currencyOption} />
          ))}
        </datalist>
      </div>
    </>
  );
}
