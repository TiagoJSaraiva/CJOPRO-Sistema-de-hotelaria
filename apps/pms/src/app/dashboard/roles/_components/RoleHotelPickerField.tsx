"use client";

import { useMemo, useState } from "react";
import type { AdminHotelOption } from "@hotel/shared";
import { SelectionModal } from "../../_components/SelectionModal";

type RoleHotelPickerFieldProps = {
  hotels: AdminHotelOption[];
  defaultHotelId?: string | null;
  inputName?: string;
};

const GLOBAL_HOTEL_OPTION_ID = "__global_role__";

export function RoleHotelPickerField({ hotels, defaultHotelId = null, inputName = "hotel_id" }: RoleHotelPickerFieldProps) {
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(defaultHotelId || null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedHotelName = useMemo(() => {
    if (!selectedHotelId) {
      return "GLOBAL";
    }

    return hotels.find((hotel) => hotel.id === selectedHotelId)?.name || "GLOBAL";
  }, [hotels, selectedHotelId]);

  return (
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <label>Hotel associado</label>

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ border: "1px solid #d5dbe5", borderRadius: "8px", background: "#fbfdff", padding: "0.45rem 0.65rem" }}>{selectedHotelName}</span>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{ border: "1px solid #2b6ad6", color: "#1c4eb0", background: "#fff", borderRadius: "8px", padding: "0.4rem 0.6rem", cursor: "pointer" }}
        >
          Selecionar hotel
        </button>
      </div>

      <input type="hidden" name={inputName} value={selectedHotelId || ""} readOnly />

      <SelectionModal
        open={isModalOpen}
        title="Selecione um hotel"
        items={[
          { id: GLOBAL_HOTEL_OPTION_ID, label: "GLOBAL", description: "Role sem vinculacao com hotel." },
          ...hotels.map((hotel) => ({ id: hotel.id, label: hotel.name }))
        ]}
        emptyMessage="Nenhum hotel disponivel para selecao."
        onSelect={(id) => {
          setSelectedHotelId(id === GLOBAL_HOTEL_OPTION_ID ? null : id);
          setIsModalOpen(false);
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
