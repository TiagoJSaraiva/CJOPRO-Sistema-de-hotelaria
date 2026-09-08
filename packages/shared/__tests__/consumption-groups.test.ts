import { expect, it } from "vitest";
import {
  authorizedConsumptionModes,
  suggestedConsumptionMode,
  groupConsumptionOffers,
} from "../src/consumption-groups";
import type { AdminConsumptionOperationalContext } from "../src/admin";
type Offer = AdminConsumptionOperationalContext["offers"][number];
const offer = (id: string, extra: Partial<Offer> = {}): Offer =>
  ({
    id,
    available: true,
    provider_type: "hotel",
    allowed_modes: ["stay_folio", "hotel_immediate"],
    default_mode: "hotel_immediate",
    ...extra,
  }) as Offer;
it("respeita disponibilidade, permissão e preferência sem sugerir cortesia", () => {
  expect(suggestedConsumptionMode(offer("a"), true)).toBe("hotel_immediate");
  expect(suggestedConsumptionMode(offer("a"), false)).toBe("stay_folio");
  expect(
    authorizedConsumptionModes(offer("a", { available: false }), true),
  ).toEqual([]);
  expect(
    suggestedConsumptionMode(
      offer("a", { allowed_modes: ["partner_direct"] }),
      true,
    ),
  ).toBe("");
  expect(
    suggestedConsumptionMode(
      offer("a", {
        allowed_modes: ["partner_direct"],
        provider_type: "partner",
        partner_id: "p",
        agreement_id: "a",
      }),
      true,
    ),
  ).toBe("partner_direct");
});
it("agrupa cobrança do hotel e separa parceiros/acordos", () => {
  const offers = [
    offer("a"),
    offer("b"),
    offer("c", { partner_id: "p", agreement_id: "1" }),
    offer("d", { partner_id: "p", agreement_id: "2" }),
    offer("e"),
  ];
  const groups = groupConsumptionOffers(offers, {
    a: "stay_folio",
    b: "stay_folio",
    c: "partner_direct",
    d: "partner_direct",
    e: "",
  });
  expect(groups).toHaveLength(3);
  expect(groups[0]?.offers.map((item) => item.id)).toEqual(["a", "b"]);
});
