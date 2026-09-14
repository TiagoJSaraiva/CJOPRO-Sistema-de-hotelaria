import Fastify from "fastify";
import { createHash } from "node:crypto";
import { PERMISSIONS } from "@hotel/shared";
import {
  API_COMPONENT_SCHEMAS,
  API_ROUTE_CONTRACTS,
} from "@hotel/shared/api-contract";
import { hashTemporaryPassword } from "../../src/auth/session";
import { registerAuthRoutes } from "../../src/routes/authRoutes";
import type {
  AuthRepository,
  AuthUserRow,
} from "../../src/repositories/authRepository";

export const MANAGER_PASSWORD = "Synthetic-session-test-123!";
// Match the local seed's operational roles without granting system permissions.
const excluded = new Set<string>([
  "read_commercial_partners",
  "manage_commercial_partners",
  "manage_commercial_agreements",
  "read_consumption_analytics",
  "read_partner_settlements",
  "prepare_partner_settlements",
  "approve_partner_settlements",
  "settle_partner_settlements",
]);
export const managerPermissions = Object.entries(PERMISSIONS)
  .filter(
    ([key, value]) =>
      !/^(HOTEL|USER|ROLE|PERMISSION)_/.test(key) && !excluded.has(value),
  )
  .map(([, value]) => value);

export async function createManagerAuthFixture() {
  const passwordHash = await hashTemporaryPassword(MANAGER_PASSWORD);
  const assignment = (
    hotelId: string,
    name: string,
    permissions: string[],
  ) => ({
    hotel_id: hotelId,
    hotels: { name },
    roles: {
      id: `role-${hotelId}`,
      name: `Gerente ${name}`,
      role_type: "HOTEL_ROLE" as const,
      hotel_id: hotelId,
      hotels: { name },
      role_permissions: permissions.map((permission) => ({
        permissions: { name: permission },
      })),
    },
  });
  const users: AuthUserRow[] = [
    ["aurora", "hotel-e2e", "Aurora"],
    ["horizonte", "hotel-horizonte", "Horizonte"],
  ].map(([account, hotelId, name]) => ({
    id: `manager-${account}`,
    name: `Gerente ${name} Teste`,
    email: `${account}@session.test`,
    is_active: true,
    password_hash: passwordHash,
    failed_attempts: 0,
    locked_until: null,
    user_roles: [assignment(hotelId!, name!, managerPermissions)],
  }));
  users.push({
    ...users[0]!,
    id: "manager-multi",
    email: "multi@session.test",
    user_roles: [
      assignment("hotel-e2e", "Aurora", managerPermissions),
      assignment("hotel-horizonte", "Horizonte", [PERMISSIONS.CUSTOMER_READ]),
    ],
  });
  // Deterministic, poorly compressible role metadata exercises the cookie guard.
  const oversizedAssignment = assignment(
    "hotel-e2e",
    "Aurora",
    managerPermissions,
  );
  oversizedAssignment.roles.name = Array.from({ length: 160 }, (_, index) =>
    createHash("sha256").update(`synthetic-role-${index}`).digest("hex"),
  ).join("");
  users.push({
    ...users[0]!,
    id: "manager-oversized",
    email: "oversized@session.test",
    user_roles: [oversizedAssignment],
  });
  const repository: AuthRepository = {
    findUserByEmail: async (email) =>
      users.find((user) => user.email === email) ?? null,
    markSuccessfulLogin: async () => {},
    markFailedLoginAttempt: async () => {},
    clearExpiredLoginLock: async () => {},
  };
  const app = Fastify({ logger: false });
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (route) => {
    const method = Array.isArray(route.method) ? route.method[0] : route.method;
    const contract = API_ROUTE_CONTRACTS[`${method} ${route.url}`];
    if (contract) route.schema = contract;
  });
  registerAuthRoutes(app, repository);
  await app.ready();
  return { app, users, repository };
}
