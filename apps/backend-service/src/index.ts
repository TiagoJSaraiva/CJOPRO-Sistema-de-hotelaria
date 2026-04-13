import "dotenv/config";
import { createApp } from "./app";
import { getRequiredSessionSecret } from "./auth/session";

const port = Number(process.env.PORT || 3334);
const app = createApp();

function validateRuntimeConfig(): void {
  getRequiredSessionSecret();
}

async function bootstrap() {
  validateRuntimeConfig();
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
