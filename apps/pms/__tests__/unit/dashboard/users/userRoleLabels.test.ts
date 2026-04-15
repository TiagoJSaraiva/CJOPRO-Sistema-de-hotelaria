import { describe, expect, it } from "vitest";
import { formatRoleOptionLabel, formatUserRoleAssignmentLabel } from "../../../../src/app/dashboard/users/_components/userRoleLabels";

describe("userRoleLabels", () => {
  it("formata role de sistema para o view de usuarios", () => {
    expect(
      formatUserRoleAssignmentLabel({
        role_name: "Administrador",
        role_type: "SYSTEM_ROLE",
        hotel_name: null,
        role_hotel_id: null,
        role_hotel_name: null
      })
    ).toBe("Sistema - Administrador");
  });

  it("formata role hotel generica com hotel do vinculo e sufixo", () => {
    expect(
      formatUserRoleAssignmentLabel({
        role_name: "Recepcionista",
        role_type: "HOTEL_ROLE",
        hotel_name: "Hotel Legal",
        role_hotel_id: null,
        role_hotel_name: null
      })
    ).toBe("Hotel Legal - Recepcionista (Genérico)");
  });

  it("formata role hotel especifica com o hotel da role", () => {
    expect(
      formatUserRoleAssignmentLabel({
        role_name: "Recepcionista",
        role_type: "HOTEL_ROLE",
        hotel_name: "Hotel do Vinculo",
        role_hotel_id: "hotel-1",
        role_hotel_name: "Hotel Central"
      })
    ).toBe("Hotel Central - Recepcionista");
  });

  it("formata a descricao da role respeitando contexto e genericidade", () => {
    expect(
      formatRoleOptionLabel({
        id: "role-1",
        name: "Recepcionista",
        role_type: "HOTEL_ROLE",
        hotel_id: null,
        hotel_name: null
      })
    ).toBe("Recepcionista (GENERICA)");

    expect(
      formatRoleOptionLabel(
        {
          id: "role-2",
          name: "Auditor",
          role_type: "HOTEL_ROLE",
          hotel_id: "hotel-2",
          hotel_name: "Hotel Praia"
        },
        "Hotel Praia"
      )
    ).toBe("Auditor (Hotel Praia)");
  });
});