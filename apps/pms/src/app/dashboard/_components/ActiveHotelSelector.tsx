"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ACTIVE_HOTEL_GLOBAL_VALUE, type ActiveHotelOption } from "@hotel/shared";

type ActiveHotelSelectorProps = {
  options: ActiveHotelOption[];
  initialHotelId: string | null;
  onChangeAction: (formData: FormData) => Promise<void>;
};

function toSelectValue(hotelId: string | null): string {
  return hotelId || ACTIVE_HOTEL_GLOBAL_VALUE;
}

function fromSelectValue(value: string): string | null {
  return value === ACTIVE_HOTEL_GLOBAL_VALUE ? null : value;
}

export function ActiveHotelSelector({ options, initialHotelId, onChangeAction }: ActiveHotelSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(toSelectValue(initialHotelId));

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        value: toSelectValue(option.hotelId),
        label: option.label
      })),
    [options]
  );

  const handleChange = (nextValue: string) => {
    setValue(nextValue);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("hotelId", toSelectValue(fromSelectValue(nextValue)));
      await onChangeAction(formData);
      router.refresh();
    });
  };

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "#3f3f3f", fontSize: "0.88rem" }}>
      Hotel
      <select
        name="hotelId"
        value={value}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        style={{
          minWidth: "200px",
          border: "1px solid #d0d0d0",
          background: "#fff",
          borderRadius: "8px",
          padding: "0.4rem 0.55rem",
          cursor: isPending ? "wait" : "pointer",
          color: "#222"
        }}
      >
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
