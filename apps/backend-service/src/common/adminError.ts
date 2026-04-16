import { ADMIN_ERROR_CODE, type AdminErrorCode, type AdminErrorResponse } from "@hotel/shared";

export { ADMIN_ERROR_CODE };

export function adminError(code: AdminErrorCode, message: string, details?: string): AdminErrorResponse {
  return {
    code,
    message,
    ...(details ? { details } : {})
  };
}
