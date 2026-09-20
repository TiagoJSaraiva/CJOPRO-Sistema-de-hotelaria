import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type TrainingClockAction,
} from "@hotel/shared";
import type { FastifyInstance } from "fastify";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createTrainingRepository,
  type TrainingRepository,
} from "../repositories/trainingRepository";

const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function localTrainingEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.LOCAL_TRAINING_ENABLED !== "true") return false;
  if (env.NODE_ENV === "production") {
    throw new Error("LOCAL_TRAINING_ENABLED não pode ser usado em produção.");
  }
  let url: URL;
  try {
    url = new URL(env.SUPABASE_URL || "");
  } catch {
    throw new Error("LOCAL_TRAINING_ENABLED exige SUPABASE_URL local válida.");
  }
  if (
    url.protocol !== "http:" ||
    !LOCAL_SUPABASE_HOSTS.has(url.hostname) ||
    url.port !== "54321"
  ) {
    throw new Error(
      "LOCAL_TRAINING_ENABLED aceita somente Supabase local em localhost:54321.",
    );
  }
  return true;
}

export function registerTrainingRoutes(
  app: FastifyInstance,
  repository: TrainingRepository = createTrainingRepository(),
) {
  app.get("/admin/training/environment", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.TRAINING_ENVIRONMENT_MANAGE,
    );
    if (!auth) return;
    const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!hotelId) return;
    return reply.send(await repository.getEnvironment(hotelId));
  });

  app.post<{ Body: TrainingClockAction }>(
    "/admin/training/clock/actions",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.TRAINING_ENVIRONMENT_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const result = await repository.actClock(
        hotelId,
        auth.session.id,
        request.body,
      );
      if (result.result === "ok" && "environment" in result) {
        return reply.send({ ok: true, environment: result.environment });
      }
      const invalid = [
        "reason_required",
        "at_required",
        "invalid_advance",
        "invalid_action",
        "invalid",
      ].includes(result.result);
      return reply.status(invalid ? 400 : 409).send({
        ...adminError(
          invalid ? ADMIN_ERROR_CODE.VALIDATION : ADMIN_ERROR_CODE.CONFLICT,
          invalid
            ? "Ação de relógio inválida."
            : "O relógio mudou; atualize a página e tente novamente.",
          result.result,
        ),
        ...("context" in result && result.context
          ? { context: result.context }
          : {}),
      });
    },
  );
}
