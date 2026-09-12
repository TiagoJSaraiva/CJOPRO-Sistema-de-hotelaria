import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "../../docs/booking-openapi.json");
const paths = [
  ["/public/hotels/{slug}/booking-config", "get"],
  ["/public/hotels/{slug}/quotes", "post"],
  ["/public/hotels/{slug}/holds", "post"],
  ["/public/booking-access/{token}", "get"],
  ["/public/booking-access/{token}/prearrival", "post"],
  ["/public/booking-access/{token}/change-requests", "post"],
  ["/channels/{connectionId}/events", "post"],
  ["/channels/{connectionId}/inventory", "get"],
  ["/channels/{connectionId}/acknowledgements", "post"],
] as const;
const document = {
  openapi: "3.1.0",
  info: { title: "Hotel Booking API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3333" }],
  paths: Object.fromEntries(
    paths.map(([path, method]) => [
      path,
      {
        [method]: {
          operationId: `${method}${path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
          responses: { "200": { description: "Operação concluída" } },
        },
      },
    ]),
  ),
};
const next = `${JSON.stringify(document, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(output, "utf8").catch(() => "");
  if (current !== next) {
    console.error("docs/booking-openapi.json está desatualizado.");
    process.exitCode = 1;
  }
} else {
  await writeFile(output, next);
}
