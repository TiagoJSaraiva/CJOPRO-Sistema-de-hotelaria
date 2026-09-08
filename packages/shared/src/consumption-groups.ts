import type {
  AdminConsumptionOperationalContext,
  ConsumptionBillingMode,
} from "./admin";
type Offer = AdminConsumptionOperationalContext["offers"][number];
export function authorizedConsumptionModes(
  offer: Offer,
  canReceive: boolean,
): ConsumptionBillingMode[] {
  return offer.available
    ? offer.allowed_modes.filter(
        (mode) =>
          (mode !== "hotel_immediate" || canReceive) &&
          (mode !== "partner_direct" ||
            (offer.provider_type === "partner" &&
              !!offer.partner_id &&
              !!offer.agreement_id)),
      )
    : [];
}
export function suggestedConsumptionMode(
  offer: Offer,
  canReceive: boolean,
): ConsumptionBillingMode | "" {
  const modes = authorizedConsumptionModes(offer, canReceive);
  return offer.default_mode && modes.includes(offer.default_mode)
    ? offer.default_mode
    : (["stay_folio", "hotel_immediate", "partner_direct"] as const).find(
        (mode) => modes.includes(mode),
      ) || "";
}
export function groupConsumptionOffers(
  offers: Offer[],
  choices: Record<string, ConsumptionBillingMode | "">,
): { key: string; mode: ConsumptionBillingMode; offers: Offer[] }[] {
  const groups = new Map<
    string,
    { key: string; mode: ConsumptionBillingMode; offers: Offer[] }
  >();
  for (const offer of offers) {
    const mode = choices[offer.id];
    if (!mode) continue;
    const key =
      mode === "partner_direct"
        ? `${mode}:${offer.partner_id}:${offer.agreement_id}`
        : mode;
    const group = groups.get(key) || { key, mode, offers: [] };
    group.offers.push(offer);
    groups.set(key, group);
  }
  return [...groups.values()];
}
