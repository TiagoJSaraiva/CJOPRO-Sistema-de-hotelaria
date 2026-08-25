# Instruções para agentes

Antes de consultar ou alterar banco, schema, migrations, seeds, funções,
triggers, políticas ou dados, leia e siga integralmente
`docs/database-workflow.md`.

Resumo obrigatório:

- `supabase/migrations/` é a fonte de verdade do schema.
- Toda mudança nova deve ser uma migration incremental validada localmente.
- Não edite o baseline `20260825062029_remote_schema.sql` para mudanças futuras.
- Não altere o banco hospedado nem execute `db push --linked` sem autorização
  explícita do usuário na tarefa atual.
- Nunca execute `db reset --linked`.

