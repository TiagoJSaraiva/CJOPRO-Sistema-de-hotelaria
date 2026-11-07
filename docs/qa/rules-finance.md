# Regras de negócio do domínio financeiro

Para aprovação do responsável pelo produto. Cada regra diz o que o sistema promete e como a
promessa é provada no sistema real.

**Situação:** `provada` tem teste automatizado no banco ou no HTTP real; `parcial` tem
prova só em parte do caminho; `a provar` ainda não tem prova contra o sistema real.

Fontes: [operações financeiras](../operations-finance.md),
[arquitetura](../architecture.md), [gestão de consumo](../consumption-management.md) e
lições [6](../training/lesson-06-consumption-account.md),
[9](../training/lesson-09-cash-close.md) e
[10](../training/lesson-10-partner-settlement.md).

## Conta da estadia

| ID     | Regra                                                                                                                                          | Prova                              | Situação |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| FIN-01 | Toda mutação financeira incrementa a versão da conta; escrita com versão antiga é recusada                                                     | rotas da conta; jornada da lição 6 | parcial  |
| FIN-02 | O pagamento em lote é atômico, alocado pelo servidor, e nunca excede o saldo                                                                   | rotas da conta; HTTP real          | parcial  |
| FIN-03 | Subcontas distribuem integralmente os débitos entre hóspede, acompanhantes e empresa                                                           | `finance_rules`                    | provada  |
| FIN-04 | Correção reduz valor e nunca altera a comanda; exige aprovação de outra pessoa                                                                 | rotas da conta                     | parcial  |
| FIN-05 | Correção já paga só termina depois do reembolso do hotel ou da confirmação externa do parceiro                                                 | fila de decisão nas rotas          | parcial  |
| FIN-06 | O checkout exige hóspede e acompanhantes quitados, nenhum crédito ou correção pendente; só o saldo empresarial autorizado pode virar recebível | HTTP real; pgTAP de saída          | parcial  |
| FIN-07 | Dano aceito como exceção exige ciência explícita no checkout                                                                                   | `finance_rules`; jornada de saída  | provada  |
| FIN-08 | O fechamento original é imutável: correções e contas complementares vêm depois, sem reabrir a estadia                                          | pgTAP de saída                     | parcial  |
| FIN-09 | Financeiro consulta a conta do hotel ativo, sem os termos comerciais, e não a opera                                                            | rotas da conta; jornada da lição 6 | provada  |

## Caixa

| ID     | Regra                                                                                                                       | Prova                                          | Situação |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- |
| FIN-10 | Cada caixa aceita uma sessão ativa, de um operador; só esse operador lança movimentos                                       | pgTAP de finanças                              | provada  |
| FIN-11 | Só dinheiro altera o valor físico esperado; os outros meios entram apenas na conciliação                                    | jornada da lição 9                             | parcial  |
| FIN-12 | Movimentos e contagens são imutáveis; retirada não deixa o esperado negativo                                                | pgTAP de finanças                              | parcial  |
| FIN-13 | Na contagem cega, o esperado não vem na resposta nem na tela até o dinheiro ser informado                                   | jornada da lição 9                             | provada  |
| FIN-14 | Diferença dentro da tolerância configurada em cada caixa fecha direto; acima dela fica pendente                             | jornada da lição 9, com tolerância de R$ 5,00  | provada  |
| FIN-15 | Diferença pendente exige decisão de outra pessoa, que aprova ou pede recontagem                                             | jornada da lição 9                             | parcial  |
| FIN-16 | Aprovar uma diferença não gera ajuste financeiro; ajuste é operação separada e justificada                                  | `finance_rules`                                | provada  |
| FIN-17 | A sessão seguinte de um caixa parte do valor contado na anterior; outro valor exige justificativa, registrada na abertura   | pgTAP de continuidade do caixa                 | provada  |
| FIN-38 | Dinheiro recebido ou devolvido entra na sessão aberta de quem opera; sem ela, é recusado em todos os caminhos               | pgTAP de dinheiro e sessão; jornada da lição 6 | provada  |
| FIN-39 | Dinheiro antigo sem sessão é assumido por quem está com ele, na própria sessão, com justificativa; a data original não muda | pgTAP de dinheiro e sessão                     | provada  |
| FIN-40 | Depois de entrar no caixa, valor, meio e situação da transação não mudam, e ela não é apagada                               | pgTAP de dinheiro e sessão                     | provada  |
| FIN-41 | Recebimentos de empresa e de consumo pós-checkout entram nas transações e, em dinheiro, no caixa                            | pgTAP de dinheiro e sessão                     | provada  |
| FIN-42 | A pendência de fechamento diário vai para quem prepara ou aprova; quem só opera caixa recebe as pendências de sessão        | pgTAP de destino das pendências                | provada  |
| FIN-18 | Sessão sem movimentos pode ser cancelada                                                                                    | pgTAP de fechamento                            | provada  |

## Fechamento diário

| ID     | Regra                                                                                                                                                                    | Prova                                      | Situação |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------- |
| FIN-19 | A data do fechamento é a data civil no fuso do hotel                                                                                                                     | `finance_rules`; jornada da lição 9        | provada  |
| FIN-20 | Preparar grava projeção e impressão digital; mudança posterior obriga a preparar de novo                                                                                 | jornada da lição 9                         | provada  |
| FIN-21 | Quem prepara não aprova; aprovar uma projeção que mudou é recusado                                                                                                       | jornada da lição 9                         | provada  |
| FIN-22 | Sessão aberta, dinheiro sem sessão e evento financeiro incompleto bloqueiam o fechamento                                                                                 | jornada da lição 9                         | parcial  |
| FIN-23 | Dia sem movimento também se fecha, como "Dia sem movimentação", com a mesma segregação                                                                                   | jornada da lição 9                         | provada  |
| FIN-24 | A obrigação começa no primeiro caixa ativo e inclui todas as datas faltantes                                                                                             | `finance_rules`; `hotel_school_foundation` | provada  |
| FIN-36 | Um dia fechado não volta a ser preparado; o fechamento e o aprovador ficam intactos                                                                                      | pgTAP de fechamento                        | provada  |
| FIN-25 | Lançamento tardio fica na próxima data aberta, a partir da atual, e referencia a data e o fechamento originais; o que já está no dia fechado só muda por novo lançamento | `finance_rules`                            | provada  |

## Apurações de parceiros

| ID     | Regra                                                                                                                     | Prova               | Situação |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------- |
| FIN-26 | Só se apura mês encerrado; mês sem venda aparece se houver aluguel ou mínimo garantido vigente                            | jornada da lição 10 | parcial  |
| FIN-27 | Comissão incide na venda líquida; no híbrido, vale o maior entre aluguel mais comissão e mínimo garantido                 | jornada da lição 10 | parcial  |
| FIN-28 | Aluguel trimestral divide por três, anual por doze; vigência parcial conta os dias civis do mês                           | `finance_rules`     | provada  |
| FIN-29 | Recalcular só substitui rascunho ou item em revisão, e incrementa a versão                                                | jornada da lição 10 | provada  |
| FIN-30 | Quem prepara não aprova; fonte, acordo ou correção alterados obrigam nova confirmação                                     | jornada da lição 10 | parcial  |
| FIN-31 | Correção ou reembolso pendente impede a aprovação                                                                         | `finance_rules`     | provada  |
| FIN-32 | Contestação atinge um componente e retém só esse valor; o restante pode ser liquidado em parte                            | jornada da lição 10 | provada  |
| FIN-33 | Contestação aceita mantém o valor fora do saldo liquidável; ajuste posterior referencia a apuração original               | jornada da lição 10 | provada  |
| FIN-37 | Quem abre a contestação não a decide                                                                                      | jornada da lição 10 | provada  |
| FIN-34 | Dinheiro de apuração e de fornecedor exige uma sessão de caixa aberta, informada na baixa; estorno é sempre compensatório | HTTP real parcial   | parcial  |
| FIN-35 | O cálculo guarda o snapshot da regra usada; revisões comerciais não são reescritas                                        | jornada da lição 10 | parcial  |

## Papéis

| Ação                            | Recepção | Caixa | Financeiro        | Gerente |
| ------------------------------- | -------- | ----- | ----------------- | ------- |
| Operar a conta da estadia       | sim      | não   | não               | sim     |
| Consultar a conta da estadia    | sim      | não   | sim               | sim     |
| Operar sessão de caixa          | sim      | sim   | não               | não     |
| Decidir diferença de caixa      | não      | não   | sim               | sim     |
| Preparar o fechamento diário    | não      | não   | sim               | não     |
| Aprovar o fechamento diário     | não      | não   | não               | sim     |
| Preparar apuração de parceiro   | não      | não   | sim               | não     |
| Aprovar apuração de parceiro    | não      | não   | não               | sim     |
| Abrir contestação de parceiro   | não      | não   | sim               | sim     |
| Decidir contestação de parceiro | não      | não   | sim, se não abriu | sim     |
| Liquidar apuração de parceiro   | não      | não   | sim               | não     |
| Registrar nota de fornecedor    | não      | não   | sim               | não     |
| Aprovar nota de fornecedor      | não      | não   | não               | sim     |
| Pagar nota de fornecedor        | não      | não   | sim               | não     |

A matriz reflete `supabase/seed.sql`; a segregação entre pessoas é verificada no banco: em
diferença de caixa, fechamento, apuração e contestação, quem abre ou prepara não decide.
