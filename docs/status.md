# Status do projeto

Onde o trabalho está agora. Este arquivo é sobrescrito a cada etapa; o histórico fica no
Git. Leia também o [plano em andamento](plans/2026-11-debug-real-stack.md) e as
[decisões](decisions/README.md) da área antes de planejar.

**Atualizado em:** 2026-11-07

## Etapa atual

Fase 4 da depuração no sistema real, com novas features congeladas. Os defeitos com decisão
tomada foram corrigidos, e o Next foi atualizado para a 16.4.5. Falta decidir a atualização das
dependências apontadas pela auditoria de segurança antes das rodadas finais.

## Próximos passos

1. Decidir e corrigir o QA-099, para `pnpm check:ci` passar.
2. Rodar as três rodadas seguidas, a última com `JOURNEY_REAL_RESET=true`, além de
   `pnpm check:ci` e `pnpm test:db`.
3. Passada manual do usuário, procurando o que está confuso, não o que está quebrado.
4. Primeira feature depois da depuração: editor de versões de tarifa ([decisão](decisions/0009-tarifas-so-consulta.md)).

## Decisões pendentes

- QA-099: quais dependências atualizar para a auditoria de segurança passar.

## Defeitos abertos

| ID     | Sev | Situação                                                                               |
| ------ | --- | -------------------------------------------------------------------------------------- |
| QA-099 | S2  | Auditoria de segurança falha por dependências antigas; decidir o escopo da atualização |
| QA-098 | S4  | Regras do React Compiler desligadas no lint; avaliar depois da depuração               |
| QA-092 | S4  | [Limite aceito](decisions/0015-datas-em-utc-limite-aceito.md)                          |
| QA-093 | S4  | Observar nas três rodadas: falha única de `db reset`, sem causa confirmada             |
| QA-097 | S4  | Observar nas três rodadas: login da primeira jornada falhou uma vez                    |
| QA-008 | S4  | Observar: tempos limite do E2E com a máquina sob carga                                 |
| QA-028 | S4  | Observar: erro único de JSON no servidor Next                                          |

Detalhes no [registro de bugs](qa/bug-ledger.md).

## Como validar

Consulte [quando rodar cada suíte](testing-strategy.md#quando-rodar-cada-suíte).

## Limites conhecidos

- As migrations de novembro existem só no banco local: o Supabase hospedado não foi alterado.
- O caminho completo da reserva retida do site não tem jornada (RES-12 parcial).
