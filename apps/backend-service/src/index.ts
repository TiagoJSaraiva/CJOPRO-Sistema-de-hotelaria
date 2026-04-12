import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
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
  sanitizePhone
} from "./services/hotelFieldValidation";
import { suggestLocaleByCountry, validateTaxIdByCountry } from "./services/taxIdValidator";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  PERMISSIONS,
  createServerClient,
  type AdminHotelCreateInput,
  type AdminHotelUpdateInput,
  type AdminPermissionCreateInput,
  type AdminPermissionUpdateInput,
  type AdminRoleCreateInput,
  type AdminRoleUpdateInput,
  type AdminUserCreateInput,
  type AdminUserUpdateInput,
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
type UserCreateBody = Partial<AdminUserCreateInput>;
type UserUpdateBody = Partial<AdminUserUpdateInput>;
type RoleCreateBody = Partial<AdminRoleCreateInput>;
type RoleUpdateBody = Partial<AdminRoleUpdateInput>;
type PermissionCreateBody = Partial<AdminPermissionCreateInput>;
type PermissionUpdateBody = Partial<AdminPermissionUpdateInput>;

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "dev-auth-session-secret-change-me";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

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

function ensureAuthorizedAny(
  request: { headers: { authorization?: string } },
  reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } },
  permissions: PermissionName[]
): SessionPayload | null {
  const session = getSessionFromRequest(request);

  if (!session) {
    reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    return null;
  }

  const canAccess = permissions.some((permission) => hasPermission(session, permission));

  if (!canAccess) {
    reply.status(403).send(getAuthError(AUTH_ERROR_CODE.FORBIDDEN));
    return null;
  }

  return session;
}

function hashTemporaryPassword(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function matchesPasswordHash(plainTextPassword: string, storedPasswordHash: string | null | undefined): boolean {
  if (!storedPasswordHash) {
    return false;
  }

  const providedHash = Buffer.from(hashTemporaryPassword(plainTextPassword));
  const expectedHash = Buffer.from(storedPasswordHash);

  if (providedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(providedHash, expectedHash);
}

function mapAuthUserFromDb(item: any): AuthUser {
  const roleNames = new Set<string>();
  const permissionNames = new Set<PermissionName>();
  const validPermissions = new Set<PermissionName>(Object.values(PERMISSIONS));
  const roleAssignments: AuthUser["roleAssignments"] = [];

  if (Array.isArray(item.user_roles)) {
    for (const row of item.user_roles) {
      const roleId = normalizeOptionalText(row?.roles?.id);
      const roleName = normalizeOptionalText(row?.roles?.name);
      const roleHotelId = normalizeOptionalText(row?.roles?.hotel_id || row?.hotel_id || null);
      const roleHotelName = normalizeOptionalText(row?.roles?.hotels?.name);

      if (roleId && roleName) {
        roleAssignments.push({
          roleId,
          roleName,
          hotelId: roleHotelId,
          hotelName: roleHotelName
        });
      }

      if (roleName) {
        roleNames.add(roleName);
      }

      const rolePermissions = row?.roles?.role_permissions;

      if (!Array.isArray(rolePermissions)) {
        continue;
      }

      for (const permissionRow of rolePermissions) {
        const permissionName = normalizeOptionalText(permissionRow?.permissions?.name);

        if (!permissionName) {
          continue;
        }

        if (validPermissions.has(permissionName as PermissionName)) {
          permissionNames.add(permissionName as PermissionName);
        }
      }
    }
  }

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    tenantId: null,
    roles: Array.from(roleNames),
    permissions: Array.from(permissionNames),
    roleAssignments
  };
}

function normalizeRoleAssignments(value: unknown): Array<{ role_id: string; hotel_id: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Array<{ role_id: string; hotel_id: string | null }> = [];
  const seen = new Set<string>();

  for (const item of value) {
    const roleId = normalizeOptionalText((item as { role_id?: string })?.role_id);

    if (!roleId || seen.has(roleId)) {
      continue;
    }

    const hotelId = normalizeOptionalText((item as { hotel_id?: string | null })?.hotel_id || null);

    normalized.push({ role_id: roleId, hotel_id: hotelId });
    seen.add(roleId);
  }

  return normalized;
}

function normalizePermissionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const id = normalizeOptionalText(String(item || ""));

    if (!id || seen.has(id)) {
      continue;
    }

    normalized.push(id);
    seen.add(id);
  }

  return normalized;
}

function mapRoleOption(item: any): { id: string; name: string; hotel_id: string | null; hotel_name: string | null } {
  return {
    id: item.id,
    name: item.name,
    hotel_id: item.hotel_id || null,
    hotel_name: item.hotels?.name || null
  };
}

function mapAdminUser(item: any): {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  role_assignments: Array<{ role_id: string; role_name: string; hotel_id: string | null; hotel_name: string | null }>;
} {
  const roleAssignments = Array.isArray(item.user_roles)
    ? item.user_roles
        .map((row: any) => {
          const role = row.roles;

          if (!role?.id) {
            return null;
          }

          return {
            role_id: role.id,
            role_name: role.name,
            hotel_id: role.hotel_id || null,
            hotel_name: role.hotels?.name || null
          };
        })
        .filter(Boolean)
    : [];

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    is_active: !!item.is_active,
    last_login_at: item.last_login_at || null,
    created_at: item.created_at || null,
    role_assignments: roleAssignments
  };
}

function mapAdminRole(item: any): {
  id: string;
  name: string;
  hotel_id: string | null;
  hotel_name: string | null;
  permissions: Array<{ id: string; name: string }>;
} {
  const permissions = Array.isArray(item.role_permissions)
    ? item.role_permissions
        .map((row: any) => row.permissions)
        .filter((permission: any) => !!permission?.id)
        .map((permission: any) => ({ id: permission.id, name: permission.name }))
    : [];

  return {
    id: item.id,
    name: item.name,
    hotel_id: item.hotel_id || null,
    hotel_name: item.hotels?.name || null,
    permissions
  };
}

async function bootstrap() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "backend-service"
  }));

  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const email = normalizeOptionalText(normalizeEmail(request.body?.email || ""));
    const password = request.body?.password;

    if (!email || !password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.MISSING_FIELDS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.MISSING_FIELDS]
      };
      return reply.status(400).send(error);
    }

    const supabase = createServerClient();
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id,name,email,is_active,password_hash,user_roles(hotel_id,roles(id,name,hotel_id,hotels(name),role_permissions(permissions(name))))")
      .eq("email", email)
      .single();

    if (userError) {
      if (userError.code !== "PGRST116") {
        request.log.error(userError);
        return reply.status(500).send({ message: "Falha ao autenticar usuario." });
      }

      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };

      return reply.status(401).send(error);
    }

    if (!userRow?.is_active || !matchesPasswordHash(password, userRow.password_hash)) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };
      return reply.status(401).send(error);
    }

    const authUser = mapAuthUserFromDb(userRow);

    const { error: lastLoginError } = await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString(), failed_attempts: 0 })
      .eq("id", authUser.id);

    if (lastLoginError) {
      request.log.error(lastLoginError);
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      tenantId: authUser.tenantId,
      roles: authUser.roles,
      permissions: authUser.permissions,
      roleAssignments: authUser.roleAssignments,
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
        permissions: payload.permissions,
        roleAssignments: payload.roleAssignments
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
        permissions: payload.permissions,
        roleAssignments: payload.roleAssignments
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

  app.get("/admin/users/reference-data", async (request, reply) => {
    const session = ensureAuthorizedAny(request, reply, [PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE]);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const [{ data: hotels, error: hotelsError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("hotels").select("id,name").order("name", { ascending: true }),
      supabase.from("roles").select("id,name,hotel_id,hotels(name)").order("name", { ascending: true })
    ]);

    if (hotelsError || rolesError) {
      request.log.error(hotelsError || rolesError);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de usuarios." });
    }

    return reply.send({
      hotels: (hotels || []).map((item: any) => ({ id: item.id, name: item.name })),
      roles: (roles || []).map(mapRoleOption)
    });
  });

  app.get("/admin/users", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.USER_READ);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar usuarios." });
    }

    return reply.send({ items: (data || []).map(mapAdminUser) });
  });

  app.post<{ Body: UserCreateBody }>("/admin/users", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.USER_CREATE);

    if (!session) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);
    const email = normalizeOptionalText(normalizeEmail(request.body?.email || ""));
    const tempPassword = normalizeOptionalText(request.body?.password_hash);
    const roleAssignments = normalizeRoleAssignments(request.body?.role_assignments || []);

    if (!name || !email || !tempPassword) {
      return reply.status(400).send({ message: "Nome, email e senha temporaria sao obrigatorios." });
    }

    if (!isValidEmail(email)) {
      return reply.status(400).send({ message: "Email invalido." });
    }

    const supabase = createServerClient();

    if (roleAssignments.length) {
      const roleIds = roleAssignments.map((item) => item.role_id);
      const { data: roleRows, error: roleError } = await supabase
        .from("roles")
        .select("id,name,hotel_id,hotels(name)")
        .in("id", roleIds);

      if (roleError) {
        request.log.error(roleError);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map((roleRows || []).map((item: any) => [item.id, item]));

      if (roleMap.size !== roleIds.length) {
        return reply.status(400).send({ message: "Uma ou mais roles selecionadas nao existem." });
      }

      for (const assignment of roleAssignments) {
        const role = roleMap.get(assignment.role_id);

        if (!role) {
          return reply.status(400).send({ message: "Role selecionada nao existe." });
        }

        if (role.hotel_id && assignment.hotel_id && role.hotel_id !== assignment.hotel_id) {
          return reply.status(400).send({ message: "A role selecionada nao pertence ao hotel escolhido." });
        }
      }
    }

    const { data: createdUser, error: createError } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password_hash: hashTemporaryPassword(tempPassword),
        is_active: true
      })
      .select("id")
      .single();

    if (createError) {
      request.log.error(createError);

      if (createError.code === "23505") {
        return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
      }

      return reply.status(500).send({ message: "Falha ao criar usuario." });
    }

    if (roleAssignments.length) {
      const { error: userRolesError } = await supabase
        .from("user_roles")
        .insert(roleAssignments.map((item) => ({ user_id: createdUser.id, role_id: item.role_id })));

      if (userRolesError) {
        request.log.error(userRolesError);
        return reply.status(500).send({ message: "Usuario criado, mas falhou ao vincular papeis." });
      }
    }

    const { data: userWithRelations, error: userWithRelationsError } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .eq("id", createdUser.id)
      .single();

    if (userWithRelationsError) {
      request.log.error(userWithRelationsError);
      return reply.status(500).send({ message: "Falha ao consultar usuario criado." });
    }

    return reply.status(201).send({ item: mapAdminUser(userWithRelations) });
  });

  app.put<{ Params: HotelIdParams; Body: UserUpdateBody }>("/admin/users/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.USER_UPDATE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do usuario e obrigatorio para atualizacao." });
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.name !== undefined) {
      const parsedName = normalizeOptionalText(request.body.name);

      if (!parsedName) {
        return reply.status(400).send({ message: "Nome nao pode ficar vazio." });
      }

      payload.name = parsedName;
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

    if (request.body?.password_hash !== undefined) {
      const parsedPassword = normalizeOptionalText(request.body.password_hash);

      if (!parsedPassword) {
        return reply.status(400).send({ message: "Senha temporaria nao pode ficar vazia." });
      }

      payload.password_hash = hashTemporaryPassword(parsedPassword);
    }

    if (request.body?.is_active !== undefined) {
      payload.is_active = !!request.body.is_active;
    }

    const hasRoleAssignments = request.body?.role_assignments !== undefined;
    const roleAssignments = hasRoleAssignments ? normalizeRoleAssignments(request.body?.role_assignments) : [];

    if (!Object.keys(payload).length && !hasRoleAssignments) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    const supabase = createServerClient();

    if (hasRoleAssignments && roleAssignments.length) {
      const roleIds = roleAssignments.map((item) => item.role_id);
      const { data: roleRows, error: roleError } = await supabase
        .from("roles")
        .select("id,name,hotel_id,hotels(name)")
        .in("id", roleIds);

      if (roleError) {
        request.log.error(roleError);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map((roleRows || []).map((item: any) => [item.id, item]));

      if (roleMap.size !== roleIds.length) {
        return reply.status(400).send({ message: "Uma ou mais roles selecionadas nao existem." });
      }

      for (const assignment of roleAssignments) {
        const role = roleMap.get(assignment.role_id);

        if (!role) {
          return reply.status(400).send({ message: "Role selecionada nao existe." });
        }

        if (role.hotel_id && assignment.hotel_id && role.hotel_id !== assignment.hotel_id) {
          return reply.status(400).send({ message: "A role selecionada nao pertence ao hotel escolhido." });
        }
      }
    }

    if (Object.keys(payload).length) {
      const { error: updateError } = await supabase.from("users").update(payload).eq("id", id);

      if (updateError) {
        request.log.error(updateError);

        if (updateError.code === "23505") {
          return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
        }

        if (updateError.code === "PGRST116") {
          return reply.status(404).send({ message: "Usuario nao encontrado." });
        }

        return reply.status(500).send({ message: "Falha ao atualizar usuario." });
      }
    } else {
      const { data: userExists, error: userExistsError } = await supabase.from("users").select("id").eq("id", id).single();

      if (userExistsError || !userExists) {
        return reply.status(404).send({ message: "Usuario nao encontrado." });
      }
    }

    if (hasRoleAssignments) {
      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", id);

      if (deleteError) {
        request.log.error(deleteError);
        return reply.status(500).send({ message: "Falha ao atualizar papeis do usuario." });
      }

      if (roleAssignments.length) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(roleAssignments.map((item) => ({ user_id: id, role_id: item.role_id })));

        if (insertError) {
          request.log.error(insertError);
          return reply.status(500).send({ message: "Falha ao atualizar papeis do usuario." });
        }
      }
    }

    const { data: updatedUser, error: updatedUserError } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .eq("id", id)
      .single();

    if (updatedUserError || !updatedUser) {
      request.log.error(updatedUserError);
      return reply.status(500).send({ message: "Falha ao consultar usuario atualizado." });
    }

    return reply.send({ item: mapAdminUser(updatedUser) });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/users/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.USER_DELETE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do usuario e obrigatorio para exclusao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("users").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir usuario." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Usuario nao encontrado." });
    }

    return reply.send({ ok: true });
  });

  app.get("/admin/roles/reference-data", async (request, reply) => {
    const session = ensureAuthorizedAny(request, reply, [PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE]);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const [{ data: hotels, error: hotelsError }, { data: permissions, error: permissionsError }] = await Promise.all([
      supabase.from("hotels").select("id,name").order("name", { ascending: true }),
      supabase.from("permissions").select("id,name").order("name", { ascending: true })
    ]);

    if (hotelsError || permissionsError) {
      request.log.error(hotelsError || permissionsError);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de roles." });
    }

    return reply.send({
      hotels: (hotels || []).map((item: any) => ({ id: item.id, name: item.name })),
      permissions: (permissions || []).map((item: any) => ({ id: item.id, name: item.name }))
    });
  });

  app.get("/admin/roles", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.ROLE_READ);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar roles." });
    }

    return reply.send({ items: (data || []).map(mapAdminRole) });
  });

  app.post<{ Body: RoleCreateBody }>("/admin/roles", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.ROLE_CREATE);

    if (!session) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);
    const hotelId = normalizeOptionalText(request.body?.hotel_id || null);
    const permissionIds = normalizePermissionIds(request.body?.permission_ids || []);

    if (!name) {
      return reply.status(400).send({ message: "Nome da role e obrigatorio." });
    }

    const supabase = createServerClient();

    if (hotelId) {
      const { data: hotelExists, error: hotelError } = await supabase.from("hotels").select("id").eq("id", hotelId).single();

      if (hotelError || !hotelExists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (permissionIds.length) {
      const { data: permissionRows, error: permissionError } = await supabase.from("permissions").select("id").in("id", permissionIds);

      if (permissionError) {
        request.log.error(permissionError);
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if ((permissionRows || []).length !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    const { data: createdRole, error: createRoleError } = await supabase
      .from("roles")
      .insert({ name, hotel_id: hotelId })
      .select("id")
      .single();

    if (createRoleError) {
      request.log.error(createRoleError);

      if (createRoleError.code === "23505") {
        return reply.status(409).send({ message: "Nome de role ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao criar role." });
    }

    if (permissionIds.length) {
      const { error: rolePermissionError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: createdRole.id, permission_id: permissionId })));

      if (rolePermissionError) {
        request.log.error(rolePermissionError);
        return reply.status(500).send({ message: "Role criada, mas falhou ao vincular permissoes." });
      }
    }

    const { data: roleWithRelations, error: roleWithRelationsError } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .eq("id", createdRole.id)
      .single();

    if (roleWithRelationsError || !roleWithRelations) {
      request.log.error(roleWithRelationsError);
      return reply.status(500).send({ message: "Falha ao consultar role criada." });
    }

    return reply.status(201).send({ item: mapAdminRole(roleWithRelations) });
  });

  app.put<{ Params: HotelIdParams; Body: RoleUpdateBody }>("/admin/roles/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.ROLE_UPDATE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da role e obrigatorio para atualizacao." });
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.name !== undefined) {
      const parsedName = normalizeOptionalText(request.body.name);

      if (!parsedName) {
        return reply.status(400).send({ message: "Nome da role nao pode ficar vazio." });
      }

      payload.name = parsedName;
    }

    if (request.body?.hotel_id !== undefined) {
      payload.hotel_id = normalizeOptionalText(request.body.hotel_id || null);
    }

    const hasPermissionsPayload = request.body?.permission_ids !== undefined;
    const permissionIds = hasPermissionsPayload ? normalizePermissionIds(request.body?.permission_ids) : [];

    if (!Object.keys(payload).length && !hasPermissionsPayload) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    const supabase = createServerClient();

    if (payload.hotel_id) {
      const { data: hotelExists, error: hotelError } = await supabase.from("hotels").select("id").eq("id", payload.hotel_id).single();

      if (hotelError || !hotelExists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (hasPermissionsPayload && permissionIds.length) {
      const { data: permissionRows, error: permissionError } = await supabase.from("permissions").select("id").in("id", permissionIds);

      if (permissionError) {
        request.log.error(permissionError);
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if ((permissionRows || []).length !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    if (Object.keys(payload).length) {
      const { error: updateRoleError } = await supabase.from("roles").update(payload).eq("id", id);

      if (updateRoleError) {
        request.log.error(updateRoleError);

        if (updateRoleError.code === "23505") {
          return reply.status(409).send({ message: "Nome de role ja existente." });
        }

        if (updateRoleError.code === "PGRST116") {
          return reply.status(404).send({ message: "Role nao encontrada." });
        }

        return reply.status(500).send({ message: "Falha ao atualizar role." });
      }
    } else {
      const { data: roleExists, error: roleExistsError } = await supabase.from("roles").select("id").eq("id", id).single();

      if (roleExistsError || !roleExists) {
        return reply.status(404).send({ message: "Role nao encontrada." });
      }
    }

    if (hasPermissionsPayload) {
      const { error: deletePermissionsError } = await supabase.from("role_permissions").delete().eq("role_id", id);

      if (deletePermissionsError) {
        request.log.error(deletePermissionsError);
        return reply.status(500).send({ message: "Falha ao atualizar permissoes da role." });
      }

      if (permissionIds.length) {
        const { error: insertPermissionsError } = await supabase
          .from("role_permissions")
          .insert(permissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId })));

        if (insertPermissionsError) {
          request.log.error(insertPermissionsError);
          return reply.status(500).send({ message: "Falha ao atualizar permissoes da role." });
        }
      }
    }

    const { data: updatedRole, error: updatedRoleError } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .eq("id", id)
      .single();

    if (updatedRoleError || !updatedRole) {
      request.log.error(updatedRoleError);
      return reply.status(500).send({ message: "Falha ao consultar role atualizada." });
    }

    return reply.send({ item: mapAdminRole(updatedRole) });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/roles/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.ROLE_DELETE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da role e obrigatorio para exclusao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir role." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Role nao encontrada." });
    }

    return reply.send({ ok: true });
  });

  app.get("/admin/permissions", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_READ);

    if (!session) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name").order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar permissoes." });
    }

    return reply.send({ items: data ?? [] });
  });

  app.post<{ Body: PermissionCreateBody }>("/admin/permissions", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_CREATE);

    if (!session) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);

    if (!name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").insert({ name }).select("id,name").single();

    if (error) {
      request.log.error(error);

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Nome de permissao ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao criar permissao." });
    }

    return reply.status(201).send({ item: data });
  });

  app.put<{ Params: HotelIdParams; Body: PermissionUpdateBody }>("/admin/permissions/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_UPDATE);

    if (!session) {
      return;
    }

    const id = request.params.id;
    const name = normalizeOptionalText(request.body?.name);

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para atualizacao." });
    }

    if (!name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio para atualizacao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").update({ name }).eq("id", id).select("id,name").single();

    if (error) {
      request.log.error(error);

      if (error.code === "PGRST116") {
        return reply.status(404).send({ message: "Permissao nao encontrada." });
      }

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Nome de permissao ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao atualizar permissao." });
    }

    return reply.send({ item: data });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/permissions/:id", async (request, reply) => {
    const session = ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_DELETE);

    if (!session) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para exclusao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir permissao." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Permissao nao encontrada." });
    }

    return reply.send({ ok: true });
  });

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
