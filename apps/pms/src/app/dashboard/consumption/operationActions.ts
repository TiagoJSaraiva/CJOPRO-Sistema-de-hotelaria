"use server";

import type {
  AdminConsumptionOrder,
  AdminConsumptionOrderCreateInput,
} from "@hotel/shared";
import { postConsumptionOrder } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";
import { PERMISSIONS } from "@hotel/shared";

export type ConsumptionPostState = {
  receipt: AdminConsumptionOrder | null;
  error: string | null;
  conflict: boolean;
};

export async function postConsumptionOrderAction(
  input: AdminConsumptionOrderCreateInput,
): Promise<ConsumptionPostState> {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_POST))
    return {
      receipt: null,
      error: "Operação não autorizada.",
      conflict: false,
    };
  try {
    const receipt = await postConsumptionOrder(input);
    return receipt
      ? { receipt, error: null, conflict: false }
      : { receipt: null, error: "A comanda não foi criada.", conflict: false };
  } catch (cause) {
    const error = cause as Error & { statusCode?: number; details?: string };
    return {
      receipt: null,
      error:
        error.statusCode === 409
          ? "A configuração mudou enquanto a comanda estava aberta. O carrinho foi preservado; atualize o contexto e confirme novamente."
          : error.message || "Não foi possível lançar a comanda.",
      conflict: error.statusCode === 409,
    };
  }
}
