import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  isValidCountryCode,
  isValidCurrency,
  isValidEmail,
  isValidPhone,
  isValidSlug,
  isValidTimezone,
  isValidZipCodeByCountry,
  normalizeCountryCode,
  normalizeCurrency,
  normalizeEmail,
  normalizeSlug,
  normalizeZipCode,
  sanitizePhone,
  suggestLocaleByCountry,
  validateTaxIdByCountry,
  type AdminHotelCreateInput,
  type AdminHotelUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorized } from "../auth/authorization";
import { normalizeOptionalText } from "../common/text";
import { createHotelsRepository, type HotelsRepository } from "../repositories/hotelsRepository";

export function registerHotelRoutes(app: FastifyInstance, repository: HotelsRepository = createHotelsRepository()): void {
  app.get("/admin/hotels", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.HOTEL_READ)) {
      return;
    }

    const data = await repository.listHotels().catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) {
      return reply.status(500).send({ message: "Falha ao consultar hoteis." });
    }

    return reply.send({ items: data });
  });

  app.post<{ Body: AdminHotelCreateInput }>("/admin/hotels", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.HOTEL_CREATE)) {
      return;
    }

    const name = request.body?.name?.trim();
    const legalName = request.body?.legal_name?.trim();
    const taxId = request.body?.tax_id?.trim();
    const slug = normalizeSlug(request.body?.slug || "");
    const email = normalizeEmail(request.body?.email || "");
    const phone = sanitizePhone(request.body?.phone || "");
    const addressLine = request.body?.address_line?.trim();
    const addressNumber = request.body?.address_number?.trim();
    const district = request.body?.district?.trim();
    const city = request.body?.city?.trim();
    const state = request.body?.state?.trim();
    const country = normalizeCountryCode(request.body?.country || "");
    const zipCode = normalizeZipCode(request.body?.zip_code || "");

    if (
      !name ||
      !legalName ||
      !taxId ||
      !email ||
      !phone ||
      !addressLine ||
      !addressNumber ||
      !district ||
      !city ||
      !state ||
      !country ||
      !zipCode ||
      !slug
    ) {
      return reply.status(400).send({ message: "Campos obrigatorios ausentes no cadastro inicial do hotel." });
    }

    if (!isValidCountryCode(country)) {
      return reply.status(400).send({ message: "Country invalido. Use codigo ISO de 2 letras (ex.: BR, US, PT)." });
    }

    if (!isValidEmail(email)) {
      return reply.status(400).send({ message: "Email invalido." });
    }

    if (!isValidPhone(phone)) {
      return reply.status(400).send({ message: "Telefone invalido. Informe entre 8 e 15 digitos." });
    }

    if (!isValidSlug(slug)) {
      return reply.status(400).send({ message: "Slug invalido. Use apenas letras minusculas, numeros e hifen." });
    }

    if (!isValidZipCodeByCountry(country, zipCode)) {
      return reply.status(400).send({ message: "CEP/Zip code invalido para o pais informado." });
    }

    const localeSuggestion = suggestLocaleByCountry(country);
    const timezone = request.body?.timezone?.trim() || localeSuggestion.timezone;
    const currency = normalizeCurrency(request.body?.currency || localeSuggestion.currency || "");

    if (!timezone || !currency) {
      return reply
        .status(400)
        .send({ message: "Timezone e currency sao obrigatorios (podem ser inferidos automaticamente pelo country)." });
    }

    if (!isValidTimezone(timezone)) {
      return reply.status(400).send({ message: "Timezone invalido." });
    }

    if (!isValidCurrency(currency)) {
      return reply.status(400).send({ message: "Moeda invalida." });
    }

    const taxIdValidation = validateTaxIdByCountry(country, taxId);

    if (!taxIdValidation.isValid) {
      return reply.status(400).send({ message: taxIdValidation.message || "Tax ID invalido para o pais informado." });
    }

    const payload = {
      name,
      legal_name: legalName,
      tax_id: taxIdValidation.normalizedTaxId,
      slug,
      email,
      phone,
      address_line: addressLine,
      address_number: addressNumber,
      address_complement: normalizeOptionalText(request.body?.address_complement),
      district,
      city,
      state,
      country,
      zip_code: zipCode,
      timezone,
      currency,
      is_active: true
    };

    const createResult = await repository.createHotel(payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!createResult) {
      return reply.status(500).send({ message: "Falha ao criar hotel." });
    }

    if (createResult.result === "conflict") {
      return reply.status(409).send({ message: "Slug ja utilizado por outro hotel." });
    }

    if (!createResult.item) {
      return reply.status(500).send({ message: "Falha ao criar hotel." });
    }

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: AdminHotelUpdateInput }>("/admin/hotels/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.HOTEL_UPDATE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do hotel e obrigatorio para atualizacao." });
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.name !== undefined) {
      const parsedName = request.body.name.trim();

      if (!parsedName) {
        return reply.status(400).send({ message: "Nome do hotel nao pode ficar vazio." });
      }

      payload.name = parsedName;
    }

    if (request.body?.legal_name !== undefined) {
      const parsedLegalName = normalizeOptionalText(request.body.legal_name);

      if (!parsedLegalName) {
        return reply.status(400).send({ message: "Razao social nao pode ficar vazia." });
      }

      payload.legal_name = parsedLegalName;
    }

    if (request.body?.slug !== undefined) {
      const parsedSlug = normalizeSlug(request.body.slug);

      if (!parsedSlug) {
        return reply.status(400).send({ message: "Slug nao pode ficar vazio." });
      }

      if (!isValidSlug(parsedSlug)) {
        return reply.status(400).send({ message: "Slug invalido. Use apenas letras minusculas, numeros e hifen." });
      }

      payload.slug = parsedSlug;
    }

    if (request.body?.email !== undefined) {
      const parsedEmail = normalizeOptionalText(normalizeEmail(request.body.email || ""));

      if (!parsedEmail) {
        return reply.status(400).send({ message: "Email nao pode ficar vazio." });
      }

      if (!isValidEmail(parsedEmail)) {
        return reply.status(400).send({ message: "Email invalido." });
      }

      payload.email = parsedEmail;
    }

    if (request.body?.phone !== undefined) {
      const parsedPhone = normalizeOptionalText(sanitizePhone(request.body.phone || ""));

      if (!parsedPhone) {
        return reply.status(400).send({ message: "Telefone nao pode ficar vazio." });
      }

      if (!isValidPhone(parsedPhone)) {
        return reply.status(400).send({ message: "Telefone invalido. Informe entre 8 e 15 digitos." });
      }

      payload.phone = parsedPhone;
    }

    if (request.body?.address_line !== undefined) {
      payload.address_line = normalizeOptionalText(request.body.address_line);
    }

    if (request.body?.address_number !== undefined) {
      payload.address_number = normalizeOptionalText(request.body.address_number);
    }

    if (request.body?.address_complement !== undefined) {
      payload.address_complement = normalizeOptionalText(request.body.address_complement);
    }

    if (request.body?.district !== undefined) {
      payload.district = normalizeOptionalText(request.body.district);
    }

    if (request.body?.city !== undefined) {
      payload.city = normalizeOptionalText(request.body.city);
    }

    if (request.body?.state !== undefined) {
      payload.state = normalizeOptionalText(request.body.state);
    }

    if (request.body?.country !== undefined) {
      const parsedCountry = normalizeOptionalText(request.body.country);

      if (!parsedCountry) {
        return reply.status(400).send({ message: "Country nao pode ficar vazio." });
      }

      const normalizedCountry = normalizeCountryCode(parsedCountry);

      if (!isValidCountryCode(normalizedCountry)) {
        return reply.status(400).send({ message: "Country invalido. Use codigo ISO de 2 letras." });
      }

      payload.country = normalizedCountry;
    }

    if (request.body?.zip_code !== undefined) {
      const parsedZipCode = normalizeOptionalText(request.body.zip_code);
      const parsedCountry = normalizeOptionalText((payload.country as string | null | undefined) || request.body?.country);

      if (!parsedZipCode) {
        return reply.status(400).send({ message: "CEP/Zip code nao pode ficar vazio." });
      }

      if (parsedCountry && !isValidZipCodeByCountry(parsedCountry, parsedZipCode)) {
        return reply.status(400).send({ message: "CEP/Zip code invalido para o pais informado." });
      }

      payload.zip_code = parsedZipCode;
    }

    if (request.body?.timezone !== undefined) {
      const parsedTimezone = normalizeOptionalText(request.body.timezone);

      if (!parsedTimezone) {
        return reply.status(400).send({ message: "Timezone nao pode ficar vazio." });
      }

      if (!isValidTimezone(parsedTimezone)) {
        return reply.status(400).send({ message: "Timezone invalido." });
      }

      payload.timezone = parsedTimezone;
    }

    if (request.body?.currency !== undefined) {
      const parsedCurrency = normalizeOptionalText(request.body.currency);

      if (!parsedCurrency) {
        return reply.status(400).send({ message: "Moeda nao pode ficar vazia." });
      }

      const normalizedCurrency = normalizeCurrency(parsedCurrency);

      if (!isValidCurrency(normalizedCurrency)) {
        return reply.status(400).send({ message: "Moeda invalida." });
      }

      payload.currency = normalizedCurrency;
    }

    if (request.body?.is_active !== undefined) {
      payload.is_active = request.body.is_active;
    }

    if (request.body?.tax_id !== undefined) {
      const parsedTaxId = normalizeOptionalText(request.body.tax_id);
      const countryForValidation = normalizeOptionalText(request.body?.country);

      if (!parsedTaxId) {
        return reply.status(400).send({ message: "Tax ID nao pode ficar vazio." });
      }

      if (!countryForValidation) {
        return reply.status(400).send({ message: "Ao atualizar tax_id, informe tambem o campo country." });
      }

      const taxIdValidation = validateTaxIdByCountry(countryForValidation, parsedTaxId);

      if (!taxIdValidation.isValid) {
        return reply.status(400).send({ message: taxIdValidation.message || "Tax ID invalido para o pais informado." });
      }

      payload.tax_id = taxIdValidation.normalizedTaxId;
    }

    if (!Object.keys(payload).length) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    const updateResult = await repository.updateHotel(id, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) {
      return reply.status(500).send({ message: "Falha ao atualizar hotel." });
    }

    if (updateResult.result === "not-found") {
      return reply.status(404).send({ message: "Hotel nao encontrado." });
    }

    if (updateResult.result === "conflict") {
      return reply.status(409).send({ message: "Slug ja utilizado por outro hotel." });
    }

    if (!updateResult.item) {
      return reply.status(500).send({ message: "Falha ao atualizar hotel." });
    }

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/hotels/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.HOTEL_DELETE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do hotel e obrigatorio para exclusao." });
    }

    const deleteResult = await repository.deleteHotel(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!deleteResult) {
      return reply.status(500).send({ message: "Falha ao excluir hotel." });
    }

    if (deleteResult === "not-found") {
      return reply.status(404).send({ message: "Hotel nao encontrado." });
    }

    return reply.send({ ok: true });
  });
}
