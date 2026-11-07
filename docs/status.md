# Status do projeto

Onde o trabalho está agora. Este arquivo é sobrescrito a cada etapa; o histórico fica no
Git. Leia também o [plano em andamento](plans/2026-11-debug-real-stack.md) e as
[decisões](decisions/README.md) da área antes de planejar.

**Atualizado em:** 2026-11-07

## Etapa atual

Fase 4 da depuração no sistema real, com novas features congeladas. A suíte de jornadas
foi acelerada de 2h para cerca de 30 min, e esta memória do projeto foi criada. Falta corrigir
os defeitos decididos antes das rodadas finais.

## Próximos passos

1. Corrigir QA-087, QA-085 e QA-091 conforme as decisões já tomadas, com o teste primeiro.
2. Decidir o que fazer com o QA-095.
3. Rodar as três rodadas seguidas, a última com `JOURNEY_REAL_RESET=true`, além de
   `pnpm check:ci` e `pnpm test:db`.
4. Passada manual do usuário, procurando o que está confuso, não o que está quebrado.
5. Primeira feature depois da depuração: editor de versões de tarifa ([decisão](decisions/0009-tarifas-so-consulta.md)).

## Decisões pendentes

Nenhuma.

## Defeitos abertos

| ID     | Sev | Situação                                                                            |
| ------ | --- | ----------------------------------------------------------------------------------- |
| QA-087 | S2  | [Decidido](decisions/0012-janelas-de-entrada-e-saida-viram-aviso.md), a implementar |
| QA-095 | S3  | Novo: tela não atualiza depois de ação muito rápida, só em produção                 |
| QA-085 | S4  | [Decidido](decisions/0013-gerente-do-aurora-cadastra-temporadas.md), a implementar  |
| QA-091 | S4  | [Decidido](decisions/0014-fechamento-lista-lancamentos-tardios.md), a implementar   |
| QA-092 | S4  | [Limite aceito](decisions/0015-datas-em-utc-limite-aceito.md)                       |
| QA-093 | S4  | Observar nas três rodadas: falha única de `db reset`, sem causa confirmada          |
| QA-008 | S4  | Observar: tempos limite do E2E com a máquina sob carga                              |
| QA-028 | S4  | Observar: erro único de JSON no servidor Next                                       |

Detalhes no [registro de bugs](qa/bug-ledger.md).

## Como validar

Consulte [quando rodar cada suíte](testing-strategy.md#quando-rodar-cada-suíte).

## Limites conhecidos

- As migrations de novembro existem só no banco local: o Supabase hospedado não foi alterado.
- O caminho completo da reserva retida do site não tem jornada (RES-12 parcial).
