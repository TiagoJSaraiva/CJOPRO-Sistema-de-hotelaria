# Regras dos fluxos sem lição

Roteiros dos fluxos que o curso não cobre: saída, cancelamento, no-show, reembolso,
reservas de canal e do site, tarifas, temporadas, preventiva e SLA. Cada regra diz o que o
sistema promete e como a promessa é provada no sistema real.

**Situação:** `provada` tem teste automatizado no banco ou no sistema real; `parcial` tem
prova só em parte do caminho; `decisão` depende de definição do responsável pelo produto.

As jornadas ficam em `apps/pms/__tests__/journeys/flow-*.spec.ts` e rodam com
`pnpm test:journeys`.

## Cancelamento e no-show

Roteiro: abrir a reserva no calendário, escolher **Cancelar** ou **No-show**, conferir multa
e saldo, informar o motivo e confirmar. Se sobrar saldo, registrar a devolução ou o
recebimento no mesmo painel.

| ID     | Regra                                                                                                        | Prova                          | Situação |
| ------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| RES-01 | Estadia, acomodação e reserva são encerradas juntas, e o quarto fica livre                                   | `reservation_closure`; jornada | provada  |
| RES-02 | No cancelamento, a multa do plano só vale depois do prazo limite, contado até o início da janela de check-in | `reservation_closure`          | provada  |
| RES-03 | No no-show, a multa do plano vale sempre; a ação só abre depois do limite de check-in                        | `reservation_closure`; jornada | provada  |
| RES-04 | Reserva sem plano, como a criada no calendário, é encerrada sem multa                                        | `reservation_closure`          | provada  |
| RES-05 | A hospedagem sai da conta; pagamento ou consumo na conta bloqueia o encerramento até o acerto                | `reservation_closure`          | provada  |
| RES-06 | O que passar da multa vira crédito a devolver; com várias estadias, o crédito só nasce na última             | `reservation_closure`          | provada  |
| RES-07 | A devolução e o recebimento da multa entram no financeiro e, em dinheiro, no caixa de quem opera             | `reservation_closure`; jornada | provada  |
| RES-08 | Os indicadores contam cancelamentos e no-shows no dia do hotel; pré-reserva vencida não é cancelamento       | `reservation_closure`          | provada  |

Com outra estadia ativa na reserva, a multa fica registrada e o adiantamento continua
valendo para ela. Na chegada dessa estadia, o adiantamento vai inteiro para a conta dela, e a
multa aparece como saldo a receber quando a última estadia terminar.

## Reservas de canal e do site

Roteiro: aplicar o evento do canal, abrir **Reservas > Sem quarto**, identificar o hóspede,
alocar o quarto e seguir pelo calendário.

| ID     | Regra                                                                                                 | Prova                              | Situação |
| ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| RES-09 | Reserva sem quarto aparece na fila do hotel ativo, com o contato enviado pela origem                  | `unassigned_reservations`; jornada | provada  |
| RES-10 | O cliente não é criado sozinho: a recepção escolhe um cliente ou cadastra com documento               | `unassigned_reservations`; jornada | provada  |
| RES-11 | Sem cliente, a alocação é recusada com explicação; com cliente, nasce a estadia e o pagador principal | `unassigned_reservations`; jornada | provada  |
| RES-12 | Pré-reserva só recebe quarto depois de confirmada pelo adiantamento                                   | `unassigned_reservations`; tela    | parcial  |

O caminho completo de uma pré-reserva do site, do adiantamento ao quarto, ainda não tem
jornada no sistema real.

## Saída e reembolso

Roteiro: abrir **Reservas > Checkout**, buscar o quarto, quitar a conta e confirmar. O estorno
fica na conta da estadia.

| ID     | Regra                                                                            | Prova                               | Situação |
| ------ | -------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| SAI-01 | Antes da data prevista a saída fica indisponível, com o motivo                   | jornada                             | provada  |
| SAI-02 | Com saldo em aberto a saída continua bloqueada                                   | jornada; `operational_clock_stamps` | provada  |
| SAI-03 | O pagamento entra no dia de negócio do hotel                                     | jornada; `operational_clock_stamps` | provada  |
| SAI-04 | A saída encerra a estadia na data do hotel e abre o ciclo de governança          | jornada                             | provada  |
| SAI-05 | O estorno parcial sobe o saldo no mesmo valor                                    | jornada                             | provada  |
| SAI-06 | Estornar mais que o pago é recusado e não altera o saldo                         | jornada                             | provada  |
| SAI-07 | Saída antecipada, ou depois da janela do dia previsto, tem caminho na operação   | nenhuma: não existe esse caminho    | decisão  |
| SAI-08 | Cobrança de manutenção em aberto não trava a saída, mas exige ciência registrada | jornada; `finance_rules`            | provada  |

## Tarifas e temporadas

| ID     | Regra                                                                         | Prova                     | Situação |
| ------ | ----------------------------------------------------------------------------- | ------------------------- | -------- |
| TAR-01 | A tela de planos só consulta e mostra a política da versão ativa em português | jornada; tela             | provada  |
| TAR-02 | O adicional de temporada vale do primeiro ao último dia, inclusive            | jornada                   | provada  |
| TAR-03 | Temporada desativada não muda o preço do calendário                           | jornada                   | provada  |
| TAR-04 | Duas temporadas ativas não se sobrepõem, e a recusa explica o motivo          | jornada                   | provada  |
| TAR-05 | Criar plano e publicar versão pela tela                                       | nenhuma: fora desta etapa | decisão  |
| TAR-06 | O site público usa a mesma regra de temporada ativa                           | leitura da cotação        | parcial  |

## Preventiva e SLA

| ID     | Regra                                                                                                | Prova                                 | Situação |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------- | -------- |
| MAN-01 | A competência vencida gera ocorrência, ordem e checklist, uma única vez                              | `maintenance_planning_flows`          | provada  |
| MAN-02 | Execução anterior aberta adia a competência e avisa o responsável; o gestor decide com justificativa | `maintenance_planning_flows`          | provada  |
| MAN-03 | Plano pausado não gera novas competências e não cancela as emitidas                                  | `maintenance_planning_flows`          | provada  |
| MAN-04 | A política mais específica vence: categoria e prioridade, depois prioridade                          | `maintenance_planning_flows`          | provada  |
| MAN-05 | O prazo é copiado na criação e não muda se a política mudar                                          | `maintenance_planning_flows`          | provada  |
| MAN-06 | Alertas em 75% do prazo, no vencimento e a cada 24 horas de violação, sem repetir                    | `maintenance_planning_flows`          | provada  |
| MAN-07 | O ciclo automático segue o relógio de cada hotel                                                     | `maintenance_planning_flows`          | provada  |
| MAN-08 | Criar e conduzir plano e política é do supervisor; o técnico consulta, e a recepção não acessa o SLA | jornada                               | provada  |
| MAN-09 | A resolução nunca vem antes da resposta, e prioridade repetida é recusada com o motivo               | `maintenance_planning_flows`; jornada | provada  |
