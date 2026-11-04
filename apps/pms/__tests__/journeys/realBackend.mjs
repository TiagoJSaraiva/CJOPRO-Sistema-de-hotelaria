// Sobe a API real sem ler .env: as credenciais vêm de scripts/journeys.mjs, que
// já validou o destino local. O index.ts de produção aplica .env.local com
// override e poderia apontar a jornada para outro banco.
import { createApp } from "../../../backend-service/src/app.ts";

const app = createApp({ documentation: "disabled" });
const port = Number(process.env.PORT);

await app.listen({ port, host: "127.0.0.1" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}
