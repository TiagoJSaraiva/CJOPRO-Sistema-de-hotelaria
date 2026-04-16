"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminRoleType } from "@hotel/shared";
import { SelectionModal } from "../../_components/SelectionModal";

type RoleHotelPickerFieldProps = {
  hotels: AdminHotelOption[];
  roleType: AdminRoleType;
  defaultHotelId?: string | null;
  inputName?: string;
};

const GENERIC_HOTEL_OPTION_ID = "__generic_hotel_role__";

export function RoleHotelPickerField({
  hotels,
  roleType,
  defaultHotelId = null,
  inputName = "hotel_id"
}: RoleHotelPickerFieldProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(defaultHotelId || null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (roleType === ADMIN_ROLE_TYPES.SYSTEM) {
      setSelectedHotelId(null);
    }
  }, [roleType]);

  const selectedHotelName = useMemo(() => {
    if (roleType === ADMIN_ROLE_TYPES.SYSTEM) {
      return "Sistema";
    }

    if (!selectedHotelId) {
      return "Generica (qualquer hotel)";
    }

    return hotels.find((hotel) => hotel.id === selectedHotelId)?.name || "Generica (qualquer hotel)";
  }, [hotels, roleType, selectedHotelId]);

  const canSelectHotel = roleType === ADMIN_ROLE_TYPES.HOTEL;

  if (roleType === ADMIN_ROLE_TYPES.SYSTEM) {
    return <input type="hidden" name={inputName} value="" readOnly />;
  }

  return (
    <div className="grid gap-[0.45rem]">

      <div className="flex flex-wrap items-center gap-[0.55rem]">
        <span className="rounded-lg border border-[#d5dbe5] bg-[#fbfdff] px-[0.65rem] py-[0.45rem]">{selectedHotelName}</span>

        <button
          type="button"
          disabled={!canSelectHotel}
          onClick={() => setIsModalOpen(true)}
          className={`rounded-lg border border-[#2b6ad6] bg-white px-[0.6rem] py-[0.4rem] ${
            canSelectHotel ? "text-[#1c4eb0]" : "cursor-not-allowed text-[#7b8ba6]"
          }`}
        >
          Selecionar hotel
        </button>
      </div>

      <input type="hidden" name={inputName} value={selectedHotelId || ""} readOnly />

      <SelectionModal
        open={isModalOpen}
        title="Selecione um hotel"
        items={[
          { id: GENERIC_HOTEL_OPTION_ID, label: "Generica", description: "Pode ser vinculada em qualquer hotel." },
          ...hotels.map((hotel) => ({ id: hotel.id, label: hotel.name }))
        ]}
        emptyMessage="Nenhum hotel disponivel para selecao."
        onSelect={(id) => {
          setSelectedHotelId(id === GENERIC_HOTEL_OPTION_ID ? null : id);
          setIsModalOpen(false);
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
