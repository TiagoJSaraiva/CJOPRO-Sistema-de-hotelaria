import { AUTH_ERROR_CODE, type PermissionName } from "@hotel/shared";
import { getAuthError, getSessionFromRequest, type SessionPayload } from "./session";
import { canAccessGlobalScope, resolveActiveHotelContext } from "./activeHotel";
import { adminError, ADMIN_ERROR_CODE } from "../common/adminError";

type AuthorizedRequest = { headers: Record<string, string | string[] | undefined> & { authorization?: string } };
type AuthorizedReply = { status: (statusCode: number) => { send: (payload: unknown) => unknown } };

export type AuthorizedWithScope = {
  session: SessionPayload;
  activeHotelId: string | null;
};

export function hasPermission(user: SessionPayload, permission: PermissionName): boolean {
  return user.permissions.includes(permission);
}

export function ensureAuthorized(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
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

  const context = resolveActiveHotelContext(session, request.headers);

  if (!context.ok) {
    reply.status(context.statusCode).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, context.message));
    return null;
  }

  return session;
}

export function ensureAuthorizedAny(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
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

  const context = resolveActiveHotelContext(session, request.headers);

  if (!context.ok) {
    reply.status(context.statusCode).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, context.message));
    return null;
  }

  return session;
}

export function ensureAuthorizedWithScope(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
  permission: PermissionName
): AuthorizedWithScope | null {
  const session = ensureAuthorized(request, reply, permission);

  if (!session) {
    return null;
  }

  const context = resolveActiveHotelContext(session, request.headers);

  if (!context.ok) {
    reply.status(context.statusCode).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, context.message));
    return null;
  }

  return {
    session,
    activeHotelId: context.activeHotelId
  };
}

export function ensureAuthorizedAnyWithScope(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
  permissions: PermissionName[]
): AuthorizedWithScope | null {
  const session = ensureAuthorizedAny(request, reply, permissions);

  if (!session) {
    return null;
  }

  const context = resolveActiveHotelContext(session, request.headers);

  if (!context.ok) {
    reply.status(context.statusCode).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, context.message));
    return null;
  }

  return {
    session,
    activeHotelId: context.activeHotelId
  };
}

export function ensureAuthorizedSystem(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
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

  if (!canAccessGlobalScope(session)) {
    reply.status(403).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, "Acesso global de sistema obrigatorio para esta operacao."));
    return null;
  }

  return session;
}

export function ensureAuthorizedAnySystem(
  request: AuthorizedRequest,
  reply: AuthorizedReply,
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

  if (!canAccessGlobalScope(session)) {
    reply.status(403).send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, "Acesso global de sistema obrigatorio para esta operacao."));
    return null;
  }

  return session;
}
