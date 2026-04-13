import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3333);

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3333",
  "http://localhost:3334"
];

function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/$/, "");
}

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const values = fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
  return Array.from(new Set(values.map(normalizeOrigin)));
}

async function bootstrap() {
  const allowedOrigins = new Set(getAllowedOrigins());

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "booking-engine-service" }));

  app.get("/", async () => ({
    message: "Booking engine service base scaffold"
  }));

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Booking engine base rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
