# Instruções locais — backend

Estas regras complementam o `AGENTS.md` raiz. Consulte o
[guia de desenvolvimento](../../docs/development-guide.md) e o
[contrato OpenAPI](../../docs/openapi.json).

- Registre plugins de documentação antes das rotas e mantenha `createApp()`
  injetável e sem iniciar listeners durante testes.
- Declare body, params, query, headers e respostas das rotas com schemas TypeBox
  reutilizáveis de `@hotel/shared/api-contract`.
- Mantenha validações de negócio nos handlers e repositórios; erros de formato
  pertencem ao Fastify e devem usar os envelopes públicos canônicos.
- Preserve autenticação, cookies, `x-active-hotel-id`, autorização por permissão
  e isolamento entre hotéis em toda consulta e mutação.
- Injete repositórios em testes unitários e de integração. Supabase real pertence
  somente à suíte de banco configurada separadamente.
- Ao mudar uma operação HTTP, regenere com `pnpm api:openapi`, revise o diff e
  execute testes da rota, `pnpm api:openapi:check` e `pnpm check`.
