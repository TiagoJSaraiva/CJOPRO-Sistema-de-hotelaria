"use client";

import { AUTH_ERROR_MESSAGE, LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";
import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, string> = {
  [LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS]: AUTH_ERROR_MESSAGE.AUTH_MISSING_FIELDS,
  [LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS]: AUTH_ERROR_MESSAGE.AUTH_INVALID_CREDENTIALS
};

export function LoginErrorMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error || !errorMessages[error]) {
    return null;
  }

  return <p style={{ color: "#b00020", marginBottom: "1rem" }}>{errorMessages[error]}</p>;
}
