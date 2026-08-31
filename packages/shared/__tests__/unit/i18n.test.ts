import { describe, it, expect } from "vitest";
import {
  translateRoomStatus,
  translateReservationSource,
  translateReservationStatus,
} from "../../src/i18n";

describe("i18n - Translation Functions", () => {
  describe("translateRoomStatus", () => {
    it("should translate 'available' to 'Disponível'", () => {
      expect(translateRoomStatus("available")).toBe("Disponível");
    });

    it("should translate 'occupied' to 'Ocupado'", () => {
      expect(translateRoomStatus("occupied")).toBe("Ocupado");
    });

    it("should translate 'maintenance' to 'Manutenção'", () => {
      expect(translateRoomStatus("maintenance")).toBe("Manutenção");
    });

    it("should translate 'blocked' to 'Bloqueado'", () => {
      expect(translateRoomStatus("blocked")).toBe("Bloqueado");
    });

    it("should return original value for unknown status", () => {
      const unknownStatus = "unknown" as any;
      expect(translateRoomStatus(unknownStatus)).toBe("unknown");
    });

    it("should preserve enum value (never change it)", () => {
      const status = "available" as const;
      const translated = translateRoomStatus(status);
      expect(translated).toBe("Disponível");
      expect(status).toBe("available");
    });
  });

  describe("translateReservationSource", () => {
    it("should translate 'front_desk' to 'Recepção'", () => {
      expect(translateReservationSource("front_desk")).toBe("Recepção");
    });

    it("should translate 'website' to 'Website'", () => {
      expect(translateReservationSource("website")).toBe("Website");
    });

    it("should translate 'phone' to 'Telefone'", () => {
      expect(translateReservationSource("phone")).toBe("Telefone");
    });

    it("should translate 'agency' to 'Agência'", () => {
      expect(translateReservationSource("agency")).toBe("Agência");
    });

    it("should return original value for unknown source", () => {
      const unknownSource = "unknown" as any;
      expect(translateReservationSource(unknownSource)).toBe("unknown");
    });

    it("should preserve enum value (never change it)", () => {
      const source = "front_desk" as const;
      const translated = translateReservationSource(source);
      expect(translated).toBe("Recepção");
      expect(source).toBe("front_desk");
    });
  });

  describe("translateReservationStatus", () => {
    it("should translate 'pending' to 'Pendente'", () => {
      expect(translateReservationStatus("pending")).toBe("Pendente");
    });

    it("should translate 'confirmed' to 'Confirmada'", () => {
      expect(translateReservationStatus("confirmed")).toBe("Confirmada");
    });

    it("should translate 'checked_in' to 'Check in realizado'", () => {
      expect(translateReservationStatus("checked_in")).toBe(
        "Check in realizado",
      );
    });

    it("should translate 'checked_out' to 'Check out realizado'", () => {
      expect(translateReservationStatus("checked_out")).toBe(
        "Check out realizado",
      );
    });

    it("should translate 'canceled' to 'Cancelada'", () => {
      expect(translateReservationStatus("canceled")).toBe("Cancelada");
    });

    it("should translate 'no_show' to 'No show'", () => {
      expect(translateReservationStatus("no_show")).toBe("No show");
    });

    it("should return original value for unknown status", () => {
      const unknownStatus = "unknown" as any;
      expect(translateReservationStatus(unknownStatus)).toBe("unknown");
    });

    it("should preserve enum value (never change it)", () => {
      const status = "pending" as const;
      const translated = translateReservationStatus(status);
      expect(translated).toBe("Pendente");
      expect(status).toBe("pending");
    });
  });

  describe("Enum Value Preservation (Critical)", () => {
    it("should never mutate original enum values across all translation functions", () => {
      const roomStatuses = [
        "available",
        "occupied",
        "maintenance",
        "blocked",
      ] as const;
      const reservationSources = [
        "front_desk",
        "website",
        "phone",
        "agency",
      ] as const;
      const reservationStatuses = [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "canceled",
        "no_show",
      ] as const;

      // Apply translations
      roomStatuses.forEach(translateRoomStatus);
      reservationSources.forEach(translateReservationSource);
      reservationStatuses.forEach(translateReservationStatus);

      // Verify values remain unchanged
      expect(roomStatuses).toEqual([
        "available",
        "occupied",
        "maintenance",
        "blocked",
      ]);
      expect(reservationSources).toEqual([
        "front_desk",
        "website",
        "phone",
        "agency",
      ]);
      expect(reservationStatuses).toEqual([
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "canceled",
        "no_show",
      ]);
    });

    it("should always return pt-BR labels that are different from enum values", () => {
      // This ensures we can easily verify UI is translating correctly
      expect(translateRoomStatus("available")).not.toBe("available");
      expect(translateReservationSource("front_desk")).not.toBe("front_desk");
      expect(translateReservationStatus("pending")).not.toBe("pending");
    });
  });
});
