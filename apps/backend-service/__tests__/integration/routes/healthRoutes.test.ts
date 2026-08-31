import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../../src/app";

describe("routes/health", () => {
  let app: FastifyInstance;
  let documentationApp: FastifyInstance;
  let openApiOnlyApp: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = "http://example.test";
    documentationApp = createApp({ documentation: "ui" });
    openApiOnlyApp = createApp({ documentation: "openapi" });
    if (previousAllowedOrigins === undefined)
      delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
    await Promise.all([app.ready(), documentationApp.ready()]);
  });

  afterAll(async () => {
    await Promise.all([
      app.close(),
      documentationApp.close(),
      openApiOnlyApp.close(),
    ]);
  });

  it("retorna status do servico", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "backend-service",
    });

    const malformedJson = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(malformedJson.statusCode).toBe(400);

    const [documentation, hiddenUi] = await Promise.all([
      documentationApp.inject({ method: "GET", url: "/docs/json" }),
      app.inject({ method: "GET", url: "/docs/json" }),
    ]);

    expect(documentation.statusCode).toBe(200);
    expect(documentation.json().openapi).toBe("3.0.3");
    expect(hiddenUi.statusCode).toBe(404);
  });
});
