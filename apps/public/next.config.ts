import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // As suítes acessam por 127.0.0.1; o Next 16 bloqueia recursos de dev de outra origem.
  allowedDevOrigins: ["127.0.0.1"],
  // O next dev 16 reescreveria um AGENTS.md aqui a cada execução; as regras ficam no AGENTS.md raiz.
  agentRules: false,
};
export default config;
