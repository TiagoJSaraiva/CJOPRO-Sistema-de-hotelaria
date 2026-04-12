import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerHotelRoutes } from "./routes/hotelRoutes";
import { registerPermissionRoutes } from "./routes/permissionRoutes";
import { registerRoleRoutes } from "./routes/roleRoutes";
import { registerUserRoutes } from "./routes/userRoutes";

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

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
