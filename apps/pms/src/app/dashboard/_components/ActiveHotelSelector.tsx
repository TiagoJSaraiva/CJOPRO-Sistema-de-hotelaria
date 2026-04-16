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
    <label className="inline-flex items-center gap-[0.35rem] text-[0.88rem] text-[#3f3f3f]">
      Hotel
      <select
        name="hotelId"
        value={value}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className={`min-w-[200px] rounded-lg border border-[#d0d0d0] bg-white px-[0.55rem] py-[0.4rem] text-[#222] ${
          isPending ? "cursor-wait" : "cursor-pointer"
        }`}
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
