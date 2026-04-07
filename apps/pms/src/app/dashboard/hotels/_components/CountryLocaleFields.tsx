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

  return (
    <>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor="create-country">Pais</label>
        <select
          id="create-country"
          name="country"
          value={countryCode}
          onChange={handleCountryChange}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor="create-timezone">Timezone</label>
        <input
          id="create-timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor="create-currency">Moeda</label>
        <input
          id="create-currency"
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>
    </>
  );
}
