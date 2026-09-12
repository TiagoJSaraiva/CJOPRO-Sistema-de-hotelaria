# Instruções locais — booking engine

Estas regras complementam o `AGENTS.md` raiz. Consulte o
[mapa do monorepo](../../docs/development-guide.md#mapa-do-monorepo).

- Este serviço expõe a API pública de reserva, pré-chegada e hub neutro de
  canais. A persistência ocorre apenas por RPCs transacionais no Supabase; não
  replique regras de preço ou inventário no listener HTTP.
- Preserve o baixo acoplamento: contratos compartilháveis pertencem a
  `@hotel/shared`, não a cópias locais.
- Mantenha o bootstrap em `src/index.ts` pequeno e a lógica testável fora do
  listener HTTP.
- Injete relógio e repositório nos testes; não use tempo ou rede não controlados.
- Preserve respostas públicas genéricas, CORS restrito, hashes de tokens,
  rate-limit persistente e validação HMAC dos canais.
- Valide mudanças com testes do workspace, typecheck e build.
