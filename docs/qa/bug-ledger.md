# Registro de bugs da depuração

Lista única dos defeitos encontrados enquanto validamos o que já existe, antes de
novas features. Um defeito só é fechado com um teste automatizado que falhava
antes da correção. Consulte a [estratégia de testes](../testing-strategy.md).

## Como classificar

| Severidade | Significado                                                      |
| ---------- | ---------------------------------------------------------------- |
| S1         | dinheiro, perda de dados, autorização ou isolamento entre hotéis |
| S2         | fluxo bloqueado, sem alternativa dentro do sistema               |
| S3         | informação errada ou fluxo que exige contorno                    |
| S4         | clareza, texto ou inconsistência sem efeito no resultado         |

Categorias de causa: `contrato` (formatos divergentes entre camadas), `relógio`
(hora real usada como hora do hotel), `permissão`, `isolamento`, `dados`
(cenário ou seed), `regra` (regra de negócio incorreta ou indefinida),
`interface`, `teste` (o teste estava errado) e `documentação` (a lição diverge do
sistema).

## Abertos

| ID     | Sev | Categoria | Onde                                                   | Sintoma                                                                                                                                                                | Próximo passo                                                             |
| ------ | --- | --------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| QA-005 | S3  | interface | `apps/pms/src/app/globals.css`                         | `pms-button-primary` e `pms-button-secondary` são usadas em 38 arquivos e nunca foram definidas; os botões parecem texto e os snapshots aprovados congelaram o defeito | definir o estilo e revisar snapshots; verificar as demais classes sem CSS |
| QA-004 | S3  | regra     | `supabase/seed.sql`, `reservationsCalendarRoutes.ts`   | O 103 tem bloqueio em duas datas, mas `rooms.status = blocked` o recusa em qualquer data; a recusa por bloqueio também fala em manutenção quando o motivo é limpeza    | decidir a regra: status global ou bloqueio por período                    |
| QA-007 | S3  | relógio   | `apps/public/src/app/hotel/[slug]/booking-journey.tsx` | `tomorrow` usa data UTC: a partir das 21h em São Paulo, o site direto recusa a chegada no dia seguinte (cálculo confirmado; não reproduzido no navegador)              | calcular no fuso do hotel, com teste nos horários limite                  |
| QA-003 | S4  | contrato  | `apps/pms/src/app/api/reservations-calendar/simulate`  | O proxy transforma qualquer falha do backend em 400, inclusive 409 e 500, escondendo erros do detector das jornadas; as outras 18 rotas preservam o status             | preservar `statusCode`, como faz `reservations-calendar/booking`          |
| QA-006 | S4  | interface | painel de reservas do PMS                              | Rótulos sem acento (`Metodo`, `Cartao de credito`) e datas ou horas em formato técnico (`2026-11-04 → 2026-11-06`, `14:00:00–22:00:00`)                                | padronizar textos e formatação                                            |
| QA-008 | S4  | teste     | `apps/pms/__tests__/e2e`                               | 6 testes com mock falharam por tempo limite com a máquina sob carga e passaram sozinhos                                                                                | não rodar em paralelo com outras suítes; reavaliar os tempos limite no CI |

## Fechados

| ID     | Sev | Categoria    | Onde                                        | Sintoma                                                                                     | Proteção                                                                   |
| ------ | --- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| QA-001 | S3  | teste        | `apps/public/__tests__/e2e/booking.spec.ts` | Datas fixas no passado eram recusadas por `min={tomorrow}` e o E2E público passou a falhar  | o próprio E2E, agora com datas relativas                                   |
| QA-002 | S4  | documentação | `docs/training/lesson-02-*`                 | A lição citava "Preparação da chegada" e "Atualizar dados da pré-chegada", ausentes da tela | `lesson-02-reservations-arrival.spec.ts` procura os nomes corretos na tela |
