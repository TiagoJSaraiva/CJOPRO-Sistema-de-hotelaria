import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerHotelRoutes } from "./routes/hotelRoutes";
import { registerPermissionRoutes } from "./routes/permissionRoutes";
import { registerRoleRoutes } from "./routes/roleRoutes";
import { registerUserRoutes } from "./routes/userRoutes";

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

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  const allowedOrigins = new Set(getAllowedOrigins());

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    }
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "backend-service"
  }));

  registerAuthRoutes(app);
  registerHotelRoutes(app);
  registerUserRoutes(app);
  registerRoleRoutes(app);
  registerPermissionRoutes(app);

  return app;
}
