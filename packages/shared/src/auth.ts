export const AUTH_ERROR_CODE = {
  MISSING_FIELDS: "AUTH_MISSING_FIELDS",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  TOKEN_INVALID_OR_EXPIRED: "AUTH_TOKEN_INVALID_OR_EXPIRED",
  UNKNOWN: "AUTH_UNKNOWN"
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

export const AUTH_ERROR_MESSAGE: Record<AuthErrorCode, string> = {
  [AUTH_ERROR_CODE.MISSING_FIELDS]: "Email e senha sao obrigatorios.",
  [AUTH_ERROR_CODE.INVALID_CREDENTIALS]: "Credenciais invalidas.",
  [AUTH_ERROR_CODE.TOKEN_MISSING]: "Token ausente.",
  [AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED]: "Token invalido ou expirado.",
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

export type MeSuccessResponse = {
  user: AuthUser;
};

export type AuthErrorResponse = {
  code: AuthErrorCode;
  message: string;
};
