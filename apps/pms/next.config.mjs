/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hotel/shared"],
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
