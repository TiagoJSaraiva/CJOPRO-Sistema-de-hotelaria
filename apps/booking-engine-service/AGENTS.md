# Instruções locais — booking engine

Estas regras complementam o `AGENTS.md` raiz. Consulte o
[mapa do monorepo](../../docs/development-guide.md#mapa-do-monorepo).

- Este serviço é um simulador determinístico e não acessa banco ou Supabase.
- Preserve o baixo acoplamento: contratos compartilháveis pertencem a
  `@hotel/shared`, não a cópias locais.
- Mantenha o bootstrap em `src/index.ts` pequeno e a lógica testável fora do
  listener HTTP.
- Não introduza tempo, aleatoriedade ou rede não controlados nos testes.
- Valide mudanças com testes do workspace, typecheck e build.
