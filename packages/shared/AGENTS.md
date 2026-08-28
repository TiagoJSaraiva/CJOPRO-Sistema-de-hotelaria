# Instruções locais — shared

Estas regras complementam o `AGENTS.md` raiz. Consulte os fluxos de
[API e banco](../../docs/development-guide.md#fluxos-comuns).

- O pacote deve permanecer independente das aplicações consumidoras.
- Preserve os exports públicos `@hotel/shared` e `@hotel/shared/api-contract`;
  mudanças incompatíveis exigem adaptação simultânea de todos os consumidores.
- Derive tipos estáticos dos schemas TypeBox e verifique compatibilidade com os
  tipos públicos existentes, evitando contratos duplicados.
- `src/database.types.ts` é gerado exclusivamente por `pnpm db:types`; não use
  casts para esconder drift de tabela, coluna, enum, join ou RPC.
- Ao alterar contratos, execute testes do shared, build dos consumidores,
  `pnpm api:openapi` e `pnpm check`.
