# Gestão avançada de manutenção

Este guia descreve a operação de manutenção preventiva, SLA, fornecedores,
notificações e indicadores. O schema e as funções PostgreSQL continuam sendo a
fonte de verdade das regras transacionais.

## Permissões

- `manage_maintenance_plans`: cria, edita, pausa, retoma e desativa planos;
  também decide competências adiadas.
- `manage_maintenance_sla`: mantém políticas e consulta sua precedência.
- `manage_maintenance_suppliers`: mantém fornecedores, contatos, contratos e
  documentos.
- `read_maintenance_analytics`: consulta indicadores e exportações.
- `read_maintenance_finance`: complementa as permissões acima para revelar
  termos comerciais, custos, recuperações e resultado líquido.

As permissões operacionais existentes continuam controlando execução,
checklists, bloqueios e inspeção. Nenhuma permissão nova é atribuída
automaticamente a roles hospedadas.

## Preventivas

Um plano possui um único alvo, responsável interno, categoria, recorrência,
instruções e checklist. A agenda aceita recorrência diária, semanal, mensal e
anual. Dias inexistentes são normalizados para o último dia do mês, inclusive em
anos bissextos.

O ciclo automático cria uma competência única por plano e data local. A geração
bem-sucedida cria atomicamente ocorrência preventiva, ordem, checklist e evento.
Se a execução anterior permanecer aberta, a competência fica `deferred`; um
gestor deve gerar, ignorar ou reagendar com justificativa. Pausar ou desativar o
plano não cancela ocorrências já emitidas.

Itens obrigatórios incompletos impedem a conclusão da ordem. A recomendação de
bloqueio não altera inventário até a confirmação explícita de um usuário com a
permissão operacional correspondente.

## SLA e alertas

A precedência é: categoria e prioridade, prioridade, padrão do hotel. A política
efetiva é copiada para a ocorrência e não muda retroativamente. Resposta termina
na triagem; resolução operacional termina quando todas as ordens não canceladas
foram concluídas e, quando exigido, aprovadas.

Alertas são criados em 75% do prazo, no vencimento e a cada 24 horas de violação.
Contratos e garantias alertam 30, 7 e 0 dias antes do vencimento. A caixa do PMS
permite filtrar, abrir o contexto, marcar como lida ou não lida, dispensar e
marcar todas como lidas.

## Automação local e produção

`pg_cron` agenda `process_maintenance_management_cycle()` a cada 15 minutos. A
função usa locks e chaves únicas, processa cada hotel segundo seu fuso e grava
uma linha em `maintenance_automation_runs`. O endpoint de reprocessamento manual
usa a mesma operação idempotente.

Para validar localmente:

```text
pnpm db:reset
pnpm db:types
pnpm test:db
```

Nunca execute `db reset --linked`. Publicação no Supabase hospedado exige
autorização específica.

## Indicadores e exportações

O dashboard aceita período, categoria, prioridade, alvo, plano, fornecedor e
situação. CSV contém o recorte detalhado e PDF contém o resumo executivo e seus
filtros. Sem `read_maintenance_finance`, valores e colunas financeiras não são
consultados nem incluídos na resposta ou nos arquivos.

Os documentos de fornecedores e contratos são privados, limitados a JPEG, PNG,
WebP e PDF de até 10 MB. O navegador recebe somente URLs assinadas; remoções
exigem motivo e preservam os metadados de auditoria.
