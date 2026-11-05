// Sobe a API real para as jornadas. Não lê .env: as credenciais vêm de
// scripts/journeys.mjs, que já validou o destino local, enquanto o index.ts de
// produção aplica .env.local com override e poderia apontar para outro banco.
//
// O backend também registra o que o navegador não enxerga. Os componentes de servidor
// do Next chamam esta API diretamente, então uma falha aqui pode virar uma tela vazia
// sem nenhum erro no navegador. Cada evento vai para JOURNEY_BACKEND_LOG, lido por
// apps/pms/__tests__/journeys/support.ts.
import { appendFileSync, writeFileSync } from "node:fs";
import { API_COMPONENT_SCHEMAS } from "@hotel/shared/api-contract";
import Value from "typebox/value";
import { createApp } from "../../src/app.ts";

const app = createApp({ documentation: "disabled" });
const port = Number(process.env.PORT);
const logPath = process.env.JOURNEY_BACKEND_LOG;

const schemaContext = Object.fromEntries(
  API_COMPONENT_SCHEMAS.map((schema) => [schema.$id, schema]),
);

function record(event) {
  if (logPath) appendFileSync(logPath, `${JSON.stringify(event)}\n`);
}

if (logPath) writeFileSync(logPath, "");

// Valida o corpo antes de o Fastify serializar: depois disso, campos fora do schema
// já teriam sido removidos em silêncio.
app.addHook("preSerialization", async (request, reply, payload) => {
  const responses = request.routeOptions.schema?.response;
  if (!responses) return payload;
  const schema =
    responses[reply.statusCode] ?? responses[String(reply.statusCode)];
  if (!schema) return payload;
  // Normaliza como o JSON que o cliente receberia (Date vira texto, por exemplo).
  const body = JSON.parse(JSON.stringify(payload));
  if (!Value.Check(schemaContext, schema, body)) {
    const errors = [...Value.Errors(schemaContext, schema, body)]
      .slice(0, 10)
      .map((error) => {
        const extra = error.params?.additionalProperties;
        const detail = extra
          ? `tem campos fora do contrato: ${extra.join(", ")}`
          : error.message;
        return `${error.instancePath || "/"} ${detail}`;
      });
    record({
      kind: "contract",
      route: `${request.method} ${request.routeOptions.url}`,
      status: reply.statusCode,
      errors,
    });
  }
  return payload;
});

app.addHook("onResponse", async (request, reply) => {
  if (reply.statusCode >= 400) {
    record({
      kind: "http",
      status: reply.statusCode,
      route: `${request.method} ${request.routeOptions.url ?? request.url}`,
      url: request.url,
    });
  }
});

await app.listen({ port, host: "127.0.0.1" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}
