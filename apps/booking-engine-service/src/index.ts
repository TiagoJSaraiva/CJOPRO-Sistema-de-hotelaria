import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3333);

async function bootstrap() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok", service: "booking-engine-service" }));

  app.get("/", async () => ({
    message: "Booking engine service base scaffold"
  }));

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Booking engine base rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
