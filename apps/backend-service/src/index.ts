import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3334);

async function bootstrap() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "backend-service"
  }));

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
