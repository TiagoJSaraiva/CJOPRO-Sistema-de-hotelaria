/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hotel/shared"],
  // As suítes acessam por 127.0.0.1; o Next 16 bloqueia recursos de dev de outra origem.
  allowedDevOrigins: ["127.0.0.1"],
  // O next dev 16 reescreveria um AGENTS.md aqui a cada execução; as regras ficam no AGENTS.md raiz.
  agentRules: false,
  // Só nas suítes: por padrão, `next dev` descarta rotas após 60 s e guarda 5 em buffer, e
  // revisitar uma rota recompila durante o teste. Não tem efeito em `next build`.
  ...(process.env.PMS_DEV_KEEP_ROUTES === "true"
    ? {
        onDemandEntries: {
          maxInactiveAge: 60 * 60 * 1000,
          pagesBufferLength: 500,
        },
      }
    : {}),
};

export default nextConfig;
