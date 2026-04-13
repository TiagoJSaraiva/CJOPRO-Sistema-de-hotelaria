import { afterEach, vi } from "vitest";

process.env.AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "test-auth-session-secret-with-at-least-32-characters";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
