import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  ADMIN_ERROR_CODE,
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
} from "@hotel/shared";
import {
  API_COMPONENT_SCHEMAS,
  API_ROUTE_CONTRACTS,
} from "@hotel/shared/api-contract";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerHotelRoutes } from "./routes/hotelRoutes";
import { registerPermissionRoutes } from "./routes/permissionRoutes";
import { registerRoleRoutes } from "./routes/roleRoutes";
import { registerUserRoutes } from "./routes/userRoutes";
import { registerRoomRoutes } from "./routes/roomRoutes";
import { registerCustomerRoutes } from "./routes/customerRoutes";
import { registerReservationsCalendarRoutes } from "./routes/reservationsCalendarRoutes";
import { registerProductRoutes } from "./routes/productRoutes";
import { registerSeasonRoutes } from "./routes/seasonRoutes";
import { registerSeasonRoomRateRoutes } from "./routes/seasonRoomRateRoutes";
import { registerFinancialTransactionRoutes } from "./routes/financialTransactionRoutes";
import { registerStayOperationsRoutes } from "./routes/stayOperationsRoutes";
import { registerMaintenanceRoutes } from "./routes/maintenanceRoutes";
import { registerMaintenanceFinanceRoutes } from "./routes/maintenanceFinanceRoutes";
import { registerMaintenanceManagementRoutes } from "./routes/maintenanceManagementRoutes";

const DEFAULT_ALLOWED_ORIGINS = [
  // LOCALHOSTS PARA DESENVOLVIMENTO. DEPOIS COLOCAR AQUI AS URLS REAIS DOS SERVIÇOS HOSPEDADOS
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3333",
  "http://localhost:3334",
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

export type DocumentationMode = "disabled" | "openapi" | "ui";

export type CreateAppOptions = {
  documentation?: DocumentationMode;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
    pluginTimeout: 30_000,
    ajv: { customOptions: { removeAdditional: false } },
  });
  const allowedOrigins = new Set(getAllowedOrigins());
  const documentation = options.documentation ?? "disabled";

  for (const schema of API_COMPONENT_SCHEMAS) {
    app.addSchema(schema);
  }

  app.addHook("onRoute", (routeOptions) => {
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];
    const method = methods.find((value) => value !== "HEAD");
    if (!method) return;

    const contract = API_ROUTE_CONTRACTS[`${method} ${routeOptions.url}`];
    if (contract) {
      routeOptions.schema = { ...(routeOptions.schema || {}), ...contract };
    }
  });

  if (documentation !== "disabled") {
    app.register(swagger, {
      openapi: {
        openapi: "3.0.3",
        info: {
          title: "Hotelaria API",
          description: "Contrato HTTP do PMS e dos serviços administrativos.",
          version: "0.1.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "session-token",
            },
          },
        },
      },
    });

    if (documentation === "ui") {
      app.register(swaggerUi, {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
        staticCSP: true,
      });
    }
  }

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && "validation" in error) {
      if (request.url.startsWith("/auth/")) {
        return reply.status(400).send({
          code: AUTH_ERROR_CODE.MISSING_FIELDS,
          message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.MISSING_FIELDS],
        });
      }

      return reply.status(400).send({
        code: ADMIN_ERROR_CODE.VALIDATION,
        message: "Dados inválidos para a requisição.",
      });
    }

    return reply.send(error);
  });

  app.register(async (routes) => {
    routes.get("/health", async () => ({
      status: "ok",
      service: "backend-service",
    }));

    registerAuthRoutes(routes);
    registerHotelRoutes(routes);
    registerUserRoutes(routes);
    registerRoleRoutes(routes);
    registerPermissionRoutes(routes);
    registerRoomRoutes(routes);
    registerCustomerRoutes(routes);
    registerReservationsCalendarRoutes(routes);
    registerStayOperationsRoutes(routes);
    registerProductRoutes(routes);
    registerSeasonRoutes(routes);
    registerSeasonRoomRateRoutes(routes);
    registerFinancialTransactionRoutes(routes);
    registerMaintenanceRoutes(routes);
    registerMaintenanceFinanceRoutes(routes);
    registerMaintenanceManagementRoutes(routes);
  });

  return app;
}
