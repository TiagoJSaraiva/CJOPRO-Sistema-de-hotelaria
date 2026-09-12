import { createBookingApp } from "./app.js";
import { createBookingRepository } from "./repository.js";

const app = createBookingApp({ repository: createBookingRepository() });
const port = Number(process.env.PORT || 3333);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
