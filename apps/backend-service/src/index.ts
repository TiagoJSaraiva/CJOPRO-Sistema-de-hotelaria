import Fastify from "fastify";
import cors from "@fastify/cors";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { suggestLocaleByCountry, validateTaxIdByCountry } from "./services/taxIdValidator";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  PERMISSIONS,
  createServerClient,
  type AdminHotelCreateInput,
  type AdminHotelUpdateInput,
  type HotelIdParams,
  type PermissionName,
  type AuthErrorResponse,
  type AuthUser,
  type LoginRequest,
  type LoginSuccessResponse,
  type MeSuccessResponse
} from "@hotel/shared";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3334);

type SessionUser = AuthUser;

type SessionPayload = SessionUser & {
  iat: number;
  exp: number;
};

type LoginBody = Partial<LoginRequest>;

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "dev-auth-session-secret-change-me";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const DEV_USER = {
  id: process.env.AUTH_USER_ID || randomUUID(),
  name: process.env.AUTH_USER_NAME || "Administrador",
  email: process.env.AUTH_USER_EMAIL || "admin@hotel.local",
  password: process.env.AUTH_USER_PASSWORD || "123456",
  tenantId: process.env.AUTH_USER_TENANT_ID || null,
  roles: (process.env.AUTH_USER_ROLES || "system_owner")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  permissions: (process.env.AUTH_USER_PERMISSIONS || 
    "create_hotel,read_hotel,update_hotel,delete_hotel,\
    create_user,read_user,update_user,delete_user,\
    create_permission,read_permission,update_permission,delete_permission,\
    create_role,read_role,update_role,delete_role") 
    // ISSO TUDO AQUI EM CIMA VAI SER REMOVIDO DEPOIS E SUBSTITUIDO POR AQUISIÇÕES DE DADOS DO DB, MAS POR ENQUANTO FICA ASSIM PRA FACILITAR O DESENVOLVIMENTO

    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signToken(payload: SessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!parsed.exp || parsed.exp <= nowInSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getAuthError(code: AuthErrorResponse["code"]): AuthErrorResponse {
  return {
    code,
    message: AUTH_ERROR_MESSAGE[code]
  };
}

function getSessionFromRequest(request: { headers: { authorization?: string } }): SessionPayload | null {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

function hasPermission(user: SessionPayload, permission: PermissionName): boolean {
  return user.permissions.includes(permission);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const parsed = (value || "").trim();
  return parsed.length ? parsed : null;
}

function ensureAuthorized(
  request: { headers: { authorization?: string } },
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  permission: PermissionName
): SessionPayload | null {
  const session = getSessionFromRequest(request);

  if (!session) {
    reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    return null;
  }

  if (!hasPermission(session, permission)) {
    reply.status(403).send(getAuthError(AUTH_ERROR_CODE.FORBIDDEN));
    return null;
  }

  return session;
}

async function bootstrap() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "backend-service"
  }));

  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    const password = request.body?.password;

    if (!email || !password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.MISSING_FIELDS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.MISSING_FIELDS]
      };
      return reply.status(400).send(error);
    }

    if (email !== DEV_USER.email || password !== DEV_USER.password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };
      return reply.status(401).send(error);
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      tenantId: DEV_USER.tenantId,
      roles: DEV_USER.roles,
      permissions: DEV_USER.permissions,
      iat: nowInSeconds,
      exp: nowInSeconds + SESSION_TTL_SECONDS
    };

    const token = signToken(payload);

    const response: LoginSuccessResponse = {
      token,
      expiresIn: SESSION_TTL_SECONDS,
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions
      }
    };

    return reply.send(response);
  });

  app.get("/auth/me", async (request, reply) => {
    const payload = getSessionFromRequest(request);

    if (!payload) {
      return reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    const response: MeSuccessResponse = {
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions
      }
    };

    return reply.send(response);
  });

  app.get("/admin/hotels", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.HOTEL_READ);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(
        "id,name,legal_name,tax_id,email,phone,address_line,address_number,address_complement,district,city,state,country,zip_code,timezone,currency,slug,is_active,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar hoteis." });
    }

    return reply.send({ items: data ?? [] });
  });

  app.post<{ Body: AdminHotelCreateInput }>("/admin/hotels", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.HOTEL_CREATE);

    if (!session) {
      return;
    }

    const name = request.body?.name?.trim();
    const legalName = request.body?.legal_name?.trim();
    const taxId = request.body?.tax_id?.trim();
    const slug = request.body?.slug?.trim().toLowerCase();
    const email = request.body?.email?.trim();
    const phone = request.body?.phone?.trim();
    const addressLine = request.body?.address_line?.trim();
    const addressNumber = request.body?.address_number?.trim();
    const district = request.body?.district?.trim();
    const city = request.body?.city?.trim();
    const state = request.body?.state?.trim();
    const country = request.body?.country?.trim();
    const zipCode = request.body?.zip_code?.trim();

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

    const localeSuggestion = suggestLocaleByCountry(country);
    const timezone = request.body?.timezone?.trim() || localeSuggestion.timezone;
    const currency = request.body?.currency?.trim().toUpperCase() || localeSuggestion.currency;

    if (!timezone || !currency) {
      return reply
        .status(400)
        .send({ message: "Timezone e currency sao obrigatorios (podem ser inferidos automaticamente pelo country)." });
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

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("hotels")
      .insert(payload)
      .select(
        "id,name,legal_name,tax_id,email,phone,address_line,address_number,address_complement,district,city,state,country,zip_code,timezone,currency,slug,is_active,created_at,updated_at"
      )
      .single();

    if (error) {
      request.log.error(error);

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Slug ja utilizado por outro hotel." });
      }

      return reply.status(500).send({ message: "Falha ao criar hotel." });
    }

    return reply.status(201).send({ item: data });
  });

  app.put<{ Params: HotelIdParams; Body: AdminHotelUpdateInput }>("/admin/hotels/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.HOTEL_UPDATE);

    if (!session) {
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
      const parsedSlug = request.body.slug.trim().toLowerCase();

      if (!parsedSlug) {
        return reply.status(400).send({ message: "Slug nao pode ficar vazio." });
      }

      payload.slug = parsedSlug;
    }

    if (request.body?.email !== undefined) {
      const parsedEmail = normalizeOptionalText(request.body.email);

      if (!parsedEmail) {
        return reply.status(400).send({ message: "Email nao pode ficar vazio." });
      }

      payload.email = parsedEmail;
    }

    if (request.body?.phone !== undefined) {
      const parsedPhone = normalizeOptionalText(request.body.phone);

      if (!parsedPhone) {
        return reply.status(400).send({ message: "Telefone nao pode ficar vazio." });
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
      payload.country = normalizeOptionalText(request.body.country);
    }

    if (request.body?.zip_code !== undefined) {
      payload.zip_code = normalizeOptionalText(request.body.zip_code);
    }

    if (request.body?.timezone !== undefined) {
      payload.timezone = normalizeOptionalText(request.body.timezone);
    }

    if (request.body?.currency !== undefined) {
      const parsedCurrency = normalizeOptionalText(request.body.currency);
      payload.currency = parsedCurrency ? parsedCurrency.toUpperCase() : null;
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

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("hotels")
      .update(payload)
      .eq("id", id)
      .select(
        "id,name,legal_name,tax_id,email,phone,address_line,address_number,address_complement,district,city,state,country,zip_code,timezone,currency,slug,is_active,created_at,updated_at"
      )
      .single();

    if (error) {
      request.log.error(error);

      if (error.code === "PGRST116") {
        return reply.status(404).send({ message: "Hotel nao encontrado." });
      }

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Slug ja utilizado por outro hotel." });
      }

      return reply.status(500).send({ message: "Falha ao atualizar hotel." });
    }

    return reply.send({ item: data });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/hotels/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.HOTEL_DELETE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do hotel e obrigatorio para exclusao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir hotel." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Hotel nao encontrado." });
    }

    return reply.send({ ok: true });
  });

  app.get("/admin/users", async (request, reply) => {
    const session = getSessionFromRequest(request);

    if (!session) {
      return reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    if (!hasPermission(session, PERMISSIONS.USER_READ)) {
      return reply.status(403).send(getAuthError(AUTH_ERROR_CODE.FORBIDDEN));
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar usuarios." });
    }

    return reply.send({ items: data ?? [] });
  });

  app.get("/admin/roles", async (request, reply) => {
    const session = getSessionFromRequest(request);

    if (!session) {
      return reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    if (!hasPermission(session, PERMISSIONS.ROLE_READ)) {
      return reply.status(403).send(getAuthError(AUTH_ERROR_CODE.FORBIDDEN));
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").select("id,name,hotel_id").order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar roles." });
    }

    return reply.send({ items: data ?? [] });
  });

  app.get("/admin/permissions", async (request, reply) => {
    const session = getSessionFromRequest(request);

    if (!session) {
      return reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    if (!hasPermission(session, PERMISSIONS.PERMISSION_READ)) {
      return reply.status(403).send(getAuthError(AUTH_ERROR_CODE.FORBIDDEN));
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name").order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar permissoes." });
    }

    return reply.send({ items: data ?? [] });
  });

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
