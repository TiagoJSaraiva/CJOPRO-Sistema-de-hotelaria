# Workflow do banco de dados

## Decisão arquitetural

O schema versionado em `supabase/migrations/` é a fonte de verdade do banco de
dados. O PostgreSQL/Supabase local é o ambiente de desenvolvimento e validação;
o projeto Supabase hospedado é um destino de implantação.

Alterações normais de schema não devem ser feitas primeiro no Dashboard ou no
SQL Editor remoto. Elas devem nascer como migrations no repositório, ser
recriadas e testadas localmente e, somente depois de revisadas, ser enviadas ao
projeto hospedado com `db push`.

A migration `supabase/migrations/20260825062029_remote_schema.sql` é o baseline
importado do banco remoto. Não a edite para mudanças futuras. Crie sempre uma
nova migration incremental.

## Preparação do ambiente local

Pré-requisitos:

- Docker Desktop aberto e com o engine em execução;
- dependências instaladas com `pnpm install`;
- Supabase CLI executado pelo projeto com `pnpm exec supabase`.

Inicie e inspecione o ambiente:

```powershell
pnpm exec supabase start
pnpm exec supabase status
```

O comando `status` mostra a URL e as chaves exclusivamente locais. Configure o
backend em arquivos `.env` ignorados pelo Git. Nunca copie credenciais remotas
para migrations, seeds, documentação ou commits.

Para interromper os serviços locais preservando seus dados:

```powershell
pnpm exec supabase stop
```

## Mudança normal de schema

1. Atualize a branch e verifique se não há migrations novas de outra mudança.
2. Inicie o Supabase local.
3. Crie uma migration com nome descritivo:

   ```powershell
   pnpm exec supabase migration new add_nome_da_mudanca
   ```

4. Edite somente o novo arquivo SQL em `supabase/migrations/`. Escreva SQL
   explícito para tabelas, colunas, constraints, índices, enums, funções,
   triggers e políticas que façam parte da mudança.
5. Recrie o banco local a partir de toda a cadeia versionada:

   ```powershell
   pnpm exec supabase db reset --local
   ```

   `db reset --local` é destrutivo apenas para os dados locais. Seu sucesso é a
   principal prova de que o banco pode ser reconstruído do zero.
6. Execute as verificações da aplicação afetadas pela mudança:

   ```powershell
   pnpm typecheck
   pnpm test
   ```

7. Revise o SQL e o diff antes de fazer commit:

   ```powershell
   git diff -- supabase/migrations supabase/seed.sql
   ```

8. Inclua a migration no mesmo commit das adaptações de backend, tipos e testes
   que dependem dela.

## Prototipação visual ou via SQL local

É permitido experimentar no Studio local ou executar SQL no banco local. Essas
alterações não são permanentes enquanto não virarem uma migration.

Depois de experimentar, gere e revise a diferença:

```powershell
pnpm exec supabase db diff --local -f nome_da_mudanca
pnpm exec supabase db reset --local
```

Prefira criar a migration antes de alterar o banco. Use `db diff` como ferramenta
de captura e conferência, não como substituto da revisão humana do SQL gerado.

## Publicação no Supabase hospedado

Publicar é uma ação separada do desenvolvimento local. Antes de publicar:

- a migration deve estar revisada e versionada;
- `db reset --local` deve concluir com sucesso;
- typecheck e testes relevantes devem passar;
- mudanças destrutivas ou transformações de dados devem ter backup e plano de
  reversão;
- o responsável deve confirmar que o CLI está vinculado ao projeto correto.

Confira o histórico e visualize o que será aplicado:

```powershell
pnpm exec supabase migration list
pnpm exec supabase db push --linked --dry-run
```

Somente após a revisão, publique:

```powershell
pnpm exec supabase db push --linked
pnpm exec supabase migration list
```

Um agente de IA não deve executar `db push --linked` sem autorização explícita
do usuário na tarefa atual. Também não deve executar `db reset --linked`.

## Seeds e dados

- `supabase/seed.sql` deve conter apenas dados sintéticos de desenvolvimento ou
  dados de referência deliberadamente versionáveis.
- Nunca versionar dados pessoais de hóspedes, hashes reais de usuários,
  tokens, senhas ou dumps de produção.
- Alterações de schema pertencem a migrations; dados locais reproduzíveis
  pertencem ao seed.
- Correções pontuais em dados hospedados exigem script revisável, backup e
  autorização específica. Não devem ser feitas silenciosamente pelo Dashboard.

## Drift e alterações emergenciais no remoto

Se o banco hospedado tiver sido alterado fora das migrations, pare novas
publicações. Capture o estado remoto em uma nova migration:

```powershell
pnpm exec supabase db pull -f reconcile_remote_drift
```

Revise cuidadosamente o arquivo gerado e confirme que ele contém apenas a
mudança esperada. Em seguida, valide novamente com `db reset --local`. Não edite
o baseline para esconder drift e não mantenha mudanças divergentes apenas no
banco remoto.

## Regras de segurança para automação e IA

- Usar flags explícitas `--local` e `--linked` em comandos que possam gerar
  ambiguidade sobre o alvo.
- É permitido criar migrations e executar start, status, diff, reset e testes
  contra o ambiente local.
- Exigir autorização explícita antes de alterar o banco hospedado.
- Nunca executar `db reset --linked`.
- Não apagar ou reescrever migrations já aplicadas; corrigir com uma nova
  migration.
- Não registrar credenciais no terminal, código, migrations ou Git.
- Em DDL destrutivo (`DROP`, redução de tipo, remoção de coluna ou constraint),
  apresentar impacto, estratégia de migração dos dados e rollback antes de
  qualquer publicação.

