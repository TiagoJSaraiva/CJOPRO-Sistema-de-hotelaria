# Instruções locais — Supabase

Estas regras complementam o `AGENTS.md` raiz. Antes de qualquer consulta ou
alteração, leia integralmente o [workflow do banco](../docs/database-workflow.md).

- `migrations` é a fonte de verdade; crie migrations incrementais e nunca edite
  o baseline `20260825062029_remote_schema.sql`.
- Migrations aplicadas não são reescritas. Correções usam uma nova migration.
- `seed.sql` contém somente IDs estáveis e dados sintéticos; schema não pertence
  ao seed.
- Novas tabelas, funções e fluxos precisam de pgTAP para constraints, RLS,
  permissões e isolamento relevantes.
- Valide com reset exclusivamente local, `pnpm db:types` e `pnpm test:db`.
- Nunca use `db reset --linked`. Consulta, diff ou publicação contra o projeto
  hospedado exige autorização explícita na tarefa atual.
