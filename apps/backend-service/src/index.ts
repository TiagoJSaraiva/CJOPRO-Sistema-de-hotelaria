import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT || 3334);
const app = createApp();

async function bootstrap() {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
