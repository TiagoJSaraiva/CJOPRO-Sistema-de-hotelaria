"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  AdminConsumptionOffer,
  AdminConsumptionPoint,
  AdminProduct,
  AdminCommercialAgreement,
  AdminInventoryLocation,
} from "@hotel/shared";
import {
  archiveConsumptionOfferAction,
  createConsumptionOffersAction,
  reorderConsumptionOffersAction,
  updateConsumptionOfferAction,
} from "../actions";
import { BillingModeFields, billingModeLabel } from "./BillingModeFields";

const reasonLabels: Record<string, string> = {
  point_inactive: "Ponto inativo",
  point_archived: "Ponto arquivado",
  offer_inactive: "Oferta inativa",
  offer_archived: "Oferta arquivada",
  product_inactive: "Produto inativo",
  product_archived: "Produto arquivado",
  category_inactive: "Categoria inativa",
  category_archived: "Categoria arquivada",
  partner_inactive: "Parceiro inativo",
  partner_archived: "Parceiro arquivado",
  agreement_missing: "Acordo não informado",
  agreement_draft: "Acordo em rascunho",
  agreement_scheduled: "Acordo com vigência futura",
  agreement_expired: "Acordo expirado",
  agreement_terminated: "Acordo encerrado",
  agreement_outside_point: "Acordo não abrange este ponto",
  billing_mode_incompatible: "Modo de cobrança incompatível com o recebedor",
  agreement_revision_missing: "Sem revisão vigente",
};

export function ConsumptionOffersManager({
  points,
  products,
  offers,
  agreements,
  canManage,
  inventoryLocations,
}: {
  points: AdminConsumptionPoint[];
  products: AdminProduct[];
  offers: AdminConsumptionOffer[];
  agreements: AdminCommercialAgreement[];
  canManage: boolean;
  inventoryLocations: AdminInventoryLocation[];
}) {
  const firstActivePoint = points.find((point) => !point.archived_at)?.id || "";
  const [creationPointId, setCreationPointId] = useState(firstActivePoint);
  const [policySource, setPolicySource] = useState<"inherit" | "override">(
    "inherit",
  );
  const [query, setQuery] = useState("");
  const [pointFilter, setPointFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [creationAgreementId, setCreationAgreementId] = useState("");
  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          products.map((product) => [product.category.id, product.category]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [products],
  );
  const existingProductIds = new Set(
    offers
      .filter((offer) => offer.point.id === creationPointId)
      .map((offer) => offer.product.id),
  );
  const selectableProducts = products.filter(
    (product) => !product.archived_at && !existingProductIds.has(product.id),
  );
  const agreementOptions = agreements.filter((agreement) =>
    agreement.revisions.some((revision) =>
      revision.point_ids.includes(creationPointId),
    ),
  );
  const selectedAgreement = agreementOptions.find(
    (agreement) => agreement.id === creationAgreementId,
  );
  const selectedAgreementRevision = selectedAgreement?.revisions[0];
  const allowPartnerDirect = Boolean(
    selectedAgreementRevision &&
    ["partner", "both"].includes(selectedAgreementRevision.payment_recipient),
  );
  const visibleOffers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return offers.filter((offer) => {
      if (pointFilter !== "all" && offer.point.id !== pointFilter) return false;
      if (
        categoryFilter !== "all" &&
        offer.product.category.id !== categoryFilter
      )
        return false;
      if (availabilityFilter === "available" && !offer.effective_available)
        return false;
      if (availabilityFilter === "unavailable" && offer.effective_available)
        return false;
      if (availabilityFilter === "archived" && !offer.archived_at) return false;
      if (!normalized) return true;
      return [
        offer.product.name,
        offer.product.internal_code,
        offer.product.category.name,
        offer.point.name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("pt-BR").includes(normalized),
        );
    });
  }, [availabilityFilter, categoryFilter, offers, pointFilter, query]);

  return (
    <div className="grid gap-5">
      {canManage ? (
        <form
          action={createConsumptionOffersAction}
          className="pms-surface-card grid gap-4"
          data-usage-guide="consumption-offer-form"
        >
          <div>
            <h2 className="m-0 text-xl font-semibold">Adicionar ofertas</h2>
            <p className="mb-0 text-sm text-slate-600">
              O preço exibido vem do catálogo e não pode ser alterado por ponto
              nesta etapa.
            </p>
          </div>
          <label className="pms-field">
            Ponto de consumo
            <select
              name="point_id"
              required
              value={creationPointId}
              onChange={(event) => setCreationPointId(event.target.value)}
              className="pms-field-input"
            >
              {points
                .filter((point) => !point.archived_at)
                .map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="grid max-h-64 gap-2 overflow-auto rounded-lg border border-slate-200 p-3">
            <legend className="px-1 font-semibold">Produtos do catálogo</legend>
            {selectableProducts.length ? (
              selectableProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex items-start gap-2 rounded-md p-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    name="product_ids"
                    value={product.id}
                  />
                  <span>
                    <strong>{product.name}</strong>
                    <small className="block text-slate-600">
                      {product.category.name} · R${" "}
                      {product.unit_price.toFixed(2)} ·{" "}
                      {product.provider.type === "hotel"
                        ? "Hotel"
                        : product.provider.partner.trade_name}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className="m-0 text-sm text-slate-600">
                Todos os produtos disponíveis já estão vinculados a este ponto.
              </p>
            )}
          </fieldset>
          <label className="pms-field">
            Acordo comercial para produtos de parceiro
            <select
              name="commercial_agreement_id"
              value={creationAgreementId}
              onChange={(event) => setCreationAgreementId(event.target.value)}
              className="pms-field-input"
            >
              <option value="">Não aplicável — itens do hotel</option>
              {agreementOptions.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.internal_number} · {agreement.partner.trade_name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Sobrescrever origem do estoque
            <select name="inventory_location_id" className="pms-field-input">
              <option value="">Herdar do ponto</option>
              {inventoryLocations
                .filter((item) => item.is_active && !item.archived_at)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 font-semibold">Política da oferta</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="policy_source"
                value="inherit"
                checked={policySource === "inherit"}
                onChange={() => setPolicySource("inherit")}
              />{" "}
              Herdar a política do ponto
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="policy_source"
                value="override"
                checked={policySource === "override"}
                onChange={() => setPolicySource("override")}
              />{" "}
              Sobrescrever para estas ofertas
            </label>
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer font-semibold">
                Ajuda sobre herança
              </summary>
              <p className="mb-0">
                Ofertas herdadas acompanham futuras mudanças do ponto. A
                sobrescrita permanece independente.
              </p>
            </details>
          </fieldset>
          {policySource === "override" ? (
            <BillingModeFields
              prefix="new-offer"
              allowPartnerDirect={allowPartnerDirect}
            />
          ) : null}
          <button
            type="submit"
            disabled={!creationPointId || !selectableProducts.length}
            className="pms-button-primary"
          >
            Vincular produtos selecionados
          </button>
        </form>
      ) : null}

      <section
        className="pms-surface-card grid gap-4"
        data-usage-guide="consumption-offer-list"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <label className="pms-field">
            Buscar
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Produto, código ou categoria"
              className="pms-field-input"
            />
          </label>
          <label className="pms-field">
            Ponto
            <select
              value={pointFilter}
              onChange={(event) => setPointFilter(event.target.value)}
              className="pms-field-input"
            >
              <option value="all">Todos</option>
              {points.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Categoria
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="pms-field-input"
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Disponibilidade
            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className="pms-field-input"
            >
              <option value="all">Todas</option>
              <option value="available">Disponíveis</option>
              <option value="unavailable">Indisponíveis</option>
              <option value="archived">Arquivadas</option>
            </select>
          </label>
        </div>
        <p role="status" className="m-0 text-sm text-slate-600">
          {visibleOffers.length} oferta(s) encontrada(s).
        </p>
        <div className="grid gap-3">
          {visibleOffers.map((offer) => {
            const pointOffers = offers.filter(
              (item) => item.point.id === offer.point.id && !item.archived_at,
            );
            const orderedIds = pointOffers.map((item) => item.id);
            const offerIndex = orderedIds.indexOf(offer.id);
            return (
              <article
                key={offer.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <header className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-lg font-semibold">
                      {offer.product.name}
                    </h3>
                    <p className="m-0 text-sm text-slate-600">
                      {offer.point.name} · {offer.product.category.name} · R${" "}
                      {offer.product.unit_price.toFixed(2)} ·{" "}
                      {offer.product.provider.type === "hotel"
                        ? "Hotel"
                        : offer.product.provider.partner.trade_name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.effective_available ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {offer.effective_available ? "Disponível" : "Indisponível"}
                  </span>
                </header>
                <p className="text-sm">
                  {offer.resolved_policy.source === "inherit"
                    ? "Herda do ponto"
                    : "Sobrescrita"}{" "}
                  · padrão:{" "}
                  {billingModeLabel(offer.resolved_policy.default_mode)}
                </p>
                <p className="text-sm">
                  Estoque:{" "}
                  {offer.inventory_location?.name ||
                    (offer.inventory_source === "point"
                      ? "origem do ponto"
                      : "sem controle/origem")}
                </p>
                {offer.commercial_agreement ? (
                  <p className="text-sm">
                    Acordo {offer.commercial_agreement.internal_number}
                    {offer.commercial_revision
                      ? ` · revisão ${offer.commercial_revision.version} · ${offer.commercial_revision.starts_on} a ${offer.commercial_revision.ends_on || "sem término"}`
                      : " · sem revisão aplicável"}
                  </p>
                ) : null}
                {!offer.effective_available ? (
                  <ul className="text-sm text-amber-900">
                    {offer.unavailable_reasons.map((reason) => (
                      <li key={reason}>{reasonLabels[reason] || reason}</li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href={`/dashboard/products/view?productId=${offer.product.id}&mode=view`}
                  className="text-sm font-semibold text-teal-700"
                >
                  Ver preço no catálogo
                </Link>
                {canManage ? (
                  <div className="mt-3 grid gap-3">
                    {!offer.archived_at ? (
                      <form
                        action={updateConsumptionOfferAction}
                        className="grid gap-3"
                      >
                        <input type="hidden" name="id" value={offer.id} />
                        <input
                          type="hidden"
                          name="commercial_agreement_id"
                          value={offer.commercial_agreement?.id || ""}
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="is_active"
                            defaultChecked={offer.is_active}
                          />{" "}
                          Oferta ativa
                        </label>
                        <label className="pms-field">
                          Origem do estoque
                          <select
                            name="inventory_location_id"
                            defaultValue={offer.inventory_location?.id || ""}
                            className="pms-field-input"
                          >
                            <option value="">Herdar do ponto</option>
                            {inventoryLocations
                              .filter(
                                (item) => item.is_active && !item.archived_at,
                              )
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="pms-field">
                          Política
                          <select
                            name="policy_source"
                            defaultValue={offer.policy.source}
                            className="pms-field-input"
                          >
                            <option value="inherit">Herdar do ponto</option>
                            <option value="override">Sobrescrever</option>
                          </select>
                        </label>
                        <BillingModeFields
                          allowedModes={offer.resolved_policy.allowed_modes}
                          defaultMode={offer.resolved_policy.default_mode}
                          prefix={offer.id}
                          allowPartnerDirect={Boolean(
                            offer.commercial_revision &&
                            ["partner", "both"].includes(
                              offer.commercial_revision.payment_recipient,
                            ),
                          )}
                        />
                        <button type="submit" className="pms-button-primary">
                          Salvar oferta
                        </button>
                      </form>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {!offer.archived_at ? (
                        <>
                          <form action={reorderConsumptionOffersAction}>
                            <input
                              type="hidden"
                              name="point_id"
                              value={offer.point.id}
                            />
                            <input
                              type="hidden"
                              name="ids"
                              value={orderedIds.join(",")}
                            />
                            <input type="hidden" name="id" value={offer.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              disabled={offerIndex === 0}
                              className="pms-button-secondary"
                            >
                              Subir
                            </button>
                          </form>
                          <form action={reorderConsumptionOffersAction}>
                            <input
                              type="hidden"
                              name="point_id"
                              value={offer.point.id}
                            />
                            <input
                              type="hidden"
                              name="ids"
                              value={orderedIds.join(",")}
                            />
                            <input type="hidden" name="id" value={offer.id} />
                            <input
                              type="hidden"
                              name="direction"
                              value="down"
                            />
                            <button
                              type="submit"
                              disabled={offerIndex === orderedIds.length - 1}
                              className="pms-button-secondary"
                            >
                              Descer
                            </button>
                          </form>
                        </>
                      ) : null}
                      <form action={archiveConsumptionOfferAction}>
                        <input type="hidden" name="id" value={offer.id} />
                        <input
                          type="hidden"
                          name="archived"
                          value={offer.archived_at ? "false" : "true"}
                        />
                        <button type="submit" className="pms-button-secondary">
                          {offer.archived_at ? "Restaurar" : "Arquivar"}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!visibleOffers.length ? (
            <p className="m-0 text-sm text-slate-600">
              Nenhuma oferta corresponde aos filtros.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
