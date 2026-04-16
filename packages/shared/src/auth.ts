import type { AdminRoleType } from "./admin";

export const AUTH_ERROR_CODE = {
  MISSING_FIELDS: "AUTH_MISSING_FIELDS",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  TOKEN_INVALID_OR_EXPIRED: "AUTH_TOKEN_INVALID_OR_EXPIRED",
  FORBIDDEN: "AUTH_FORBIDDEN",
  UNKNOWN: "AUTH_UNKNOWN"
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

export const AUTH_ERROR_MESSAGE: Record<AuthErrorCode, string> = {
  [AUTH_ERROR_CODE.MISSING_FIELDS]: "Email e senha sao obrigatorios.",
  [AUTH_ERROR_CODE.INVALID_CREDENTIALS]: "Credenciais invalidas.",
  [AUTH_ERROR_CODE.ACCOUNT_LOCKED]: "Conta temporariamente bloqueada por tentativas de login invalidas.",
  [AUTH_ERROR_CODE.TOKEN_MISSING]: "Token ausente.",
  [AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED]: "Token invalido ou expirado.",
  [AUTH_ERROR_CODE.FORBIDDEN]: "Sem permissao para executar esta operacao.",
  [AUTH_ERROR_CODE.UNKNOWN]: "Falha ao autenticar."
};

export const LOGIN_PAGE_ERROR_PARAM = {
  MISSING_FIELDS: "missing_fields",
  INVALID_CREDENTIALS: "invalid_credentials"
} as const;

export type LoginPageErrorParam = (typeof LOGIN_PAGE_ERROR_PARAM)[keyof typeof LOGIN_PAGE_ERROR_PARAM];

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  roleAssignments: AuthUserRoleAssignment[];
};

export type SessionPayload = AuthUser & {
  iat: number;
  exp: number;
};

export type AuthUserRoleAssignment = {
  roleId: string;
  roleName: string;
  roleType: AdminRoleType;
  hotelId: string | null;
  hotelName: string | null;
  permissions?: string[];
};

export type ActiveHotelOption = {
  hotelId: string | null;
  label: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginSuccessResponse = {
  token: string;
  expiresIn: number;
  user: AuthUser;
};

export type LoginResult = LoginSuccessResponse;

export type MeSuccessResponse = {
  user: AuthUser;
};

export type AuthErrorResponse = {
  code: AuthErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export const ACTIVE_HOTEL_HEADER_NAME = "x-active-hotel-id";
export const ACTIVE_HOTEL_GLOBAL_VALUE = "__global__";
