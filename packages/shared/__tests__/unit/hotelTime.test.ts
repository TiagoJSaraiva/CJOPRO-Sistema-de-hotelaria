import { describe, expect, it } from "vitest";
import {
  hotelLocalInputToInstant,
  formatHotelInstant,
  instantToHotelDate,
  instantToHotelLocalInput,
} from "../../src/hotelTime";

const SAO_PAULO = "America/Sao_Paulo";
const NEW_YORK = "America/New_York";

describe("hotelLocalInputToInstant", () => {
  it("interpreta o texto no fuso do hotel", () => {
    expect(hotelLocalInputToInstant("2026-11-04T19:30", SAO_PAULO)).toBe(
      "2026-11-04T22:30:00.000Z",
    );
    expect(hotelLocalInputToInstant("2026-11-04T19:30", "UTC")).toBe(
      "2026-11-04T19:30:00.000Z",
    );
    expect(hotelLocalInputToInstant("2026-11-04T19:30", "Asia/Tokyo")).toBe(
      "2026-11-04T10:30:00.000Z",
    );
  });

  it("aceita segundos e atravessa a virada do dia em UTC", () => {
    expect(hotelLocalInputToInstant("2026-11-04T22:15:30", SAO_PAULO)).toBe(
      "2026-11-05T01:15:30.000Z",
    );
  });

  it("respeita o horário de verão de cada data", () => {
    expect(hotelLocalInputToInstant("2026-01-15T12:00", NEW_YORK)).toBe(
      "2026-01-15T17:00:00.000Z",
    );
    expect(hotelLocalInputToInstant("2026-07-15T12:00", NEW_YORK)).toBe(
      "2026-07-15T16:00:00.000Z",
    );
  });

  it("devolve um instante válido nos horários da troca de horário de verão", () => {
    // 02:30 não existe em 08/03/2026; 01:30 existe duas vezes em 01/11/2026.
    expect(hotelLocalInputToInstant("2026-03-08T02:30", NEW_YORK)).toMatch(
      /^2026-03-08T0[67]:30:00\.000Z$/,
    );
    expect(hotelLocalInputToInstant("2026-11-01T01:30", NEW_YORK)).toMatch(
      /^2026-11-01T0[56]:30:00\.000Z$/,
    );
  });

  it.each([
    "",
    "2026-11-04",
    "2026-11-04T25:00",
    "2026-11-04T10:60",
    "2026-02-31T10:00",
    "2026-13-01T10:00",
    "2026-11-04T22:30:00.000Z",
    "2026-11-04T19:30-03:00",
    "ontem",
  ])("recusa %j", (text) => {
    expect(hotelLocalInputToInstant(text, SAO_PAULO)).toBeNull();
  });

  it("recusa fuso inválido", () => {
    expect(
      hotelLocalInputToInstant("2026-11-04T19:30", "Marte/Base"),
    ).toBeNull();
  });
});

describe("instantToHotelLocalInput", () => {
  it("mostra o instante na hora do hotel", () => {
    expect(
      instantToHotelLocalInput("2026-11-04T22:30:00.000Z", SAO_PAULO),
    ).toBe("2026-11-04T19:30");
    expect(
      instantToHotelLocalInput("2026-11-05T01:30:00+00:00", SAO_PAULO),
    ).toBe("2026-11-04T22:30");
  });

  it("mostra meia-noite como 00, não como 24", () => {
    expect(
      instantToHotelLocalInput("2026-11-05T03:00:00.000Z", SAO_PAULO),
    ).toBe("2026-11-05T00:00");
  });

  it.each([null, undefined, "", "inválido"])(
    "devolve vazio para %j",
    (value) => {
      expect(instantToHotelLocalInput(value, SAO_PAULO)).toBe("");
    },
  );

  it("devolve vazio para fuso inválido", () => {
    expect(
      instantToHotelLocalInput("2026-11-04T22:30:00.000Z", "Marte/Base"),
    ).toBe("");
  });

  it.each([SAO_PAULO, "UTC", "Asia/Tokyo", NEW_YORK])(
    "ida e volta não desloca o horário em %s",
    (timeZone) => {
      const stored = "2026-11-04T22:30:00.000Z";
      let current = stored;
      for (let save = 0; save < 3; save += 1) {
        current = hotelLocalInputToInstant(
          instantToHotelLocalInput(current, timeZone),
          timeZone,
        ) as string;
      }
      expect(current).toBe(stored);
    },
  );
});

describe("instantToHotelDate", () => {
  it("usa o dia do hotel, não o dia em UTC", () => {
    expect(instantToHotelDate("2026-11-05T01:30:00.000Z", SAO_PAULO)).toBe(
      "2026-11-04",
    );
    expect(instantToHotelDate("2026-11-05T01:30:00.000Z", "UTC")).toBe(
      "2026-11-05",
    );
  });

  it("devolve vazio para valores inválidos", () => {
    expect(instantToHotelDate(null, SAO_PAULO)).toBe("");
    expect(instantToHotelDate("inválido", SAO_PAULO)).toBe("");
    expect(instantToHotelDate("2026-11-05T01:30:00Z", "Marte/Base")).toBe("");
  });
});

describe("formatHotelInstant", () => {
  it("formata o instante na hora do hotel", () => {
    expect(formatHotelInstant("2026-05-12T15:30:00.000Z", "Asia/Tokyo")).toBe(
      "13/05/2026, 00:30:00",
    );
    expect(
      formatHotelInstant("2026-05-12T15:30:00.000Z", "America/Sao_Paulo"),
    ).toBe("12/05/2026, 12:30:00");
  });

  it("não inventa data para valor ausente, inválido ou fuso desconhecido", () => {
    expect(formatHotelInstant(null, "Asia/Tokyo")).toBe("—");
    expect(formatHotelInstant("não é data", "Asia/Tokyo")).toBe("—");
    expect(
      formatHotelInstant("2026-05-12T15:30:00.000Z", "Fuso/Inexistente"),
    ).toBe("—");
  });
});

describe("formatHotelInstant com formato parcial", () => {
  it("mantém o fuso do hotel mesmo com opções de formato", () => {
    expect(
      formatHotelInstant("2026-05-12T15:30:00.000Z", "Asia/Tokyo", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    ).toBe("13/05/2026");
    expect(
      formatHotelInstant("2026-05-12T15:30:00.000Z", "Asia/Tokyo", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).toBe("00:30");
  });
});
