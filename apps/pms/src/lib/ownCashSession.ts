import { PERMISSIONS, type CashRegisterListView } from "@hotel/shared";
import { requestOperationsFinanceEndpoint } from "./adminApi";

export function findOwnOpenCashSession(
  registers: CashRegisterListView["registers"],
  userId: string | undefined,
) {
  const register = registers.find(
    (item) =>
      item.active_session?.status === "open" &&
      item.active_session.operator_id === userId,
  );
  return register?.active_session
    ? { id: register.active_session.id, registerName: register.name }
    : null;
}

/** Sem a permissão ou se a consulta falhar, ninguém é levado a tentar receber dinheiro. */
export async function getOwnOpenCashSession(
  user: { id: string; permissions: string[] } | null,
) {
  if (!user?.permissions.includes(PERMISSIONS.CASH_MANAGEMENT_READ))
    return null;
  const data = await requestOperationsFinanceEndpoint<CashRegisterListView>(
    "cash-registers",
    "GET",
  ).catch(() => null);
  return data ? findOwnOpenCashSession(data.registers, user.id) : null;
}
