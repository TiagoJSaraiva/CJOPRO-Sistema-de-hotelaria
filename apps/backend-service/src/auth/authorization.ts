import { AUTH_ERROR_CODE, type PermissionName } from "@hotel/shared";
import { getAuthError, getSessionFromRequest, type SessionPayload } from "./session";

type AuthorizedRequest = { headers: { authorization?: string } };
type AuthorizedReply = { status: (statusCode: number) => { send: (payload: unknown) => unknown } };

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

  return session;
}
