# Contrato temporal do hotel-escola

## Matriz de tempo

| Usa tempo operacional por hotel                | Continua no tempo real                       |
| ---------------------------------------------- | -------------------------------------------- |
| cotação direta, holds e calendário de reservas | emissão e expiração de sessão                |
| governança e prontidão                         | rate limiting e bloqueio de login            |
| alertas, indicadores e agenda de manutenção    | validade de URL assinada e upload            |
| garantia e automações de manutenção            | `created_at` e eventos técnicos de auditoria |
| sessão de caixa, data operacional e fechamento | saúde, locks e timeouts de infraestrutura    |
| reconciliação e pendências operacionais        | segurança criptográfica                      |
| lotes, recebimentos e compras                  | timestamps imutáveis de criação              |
| acordos, apurações, pagamentos e alertas       | logs técnicos e telemetria                   |

`hotel_operational_now(hotel_id)` e `hotel_operational_date(hotel_id)` são as
fontes de verdade para novas regras operacionais. Overrides `p_now` explícitos
continuam tendo precedência em testes e reconciliações.

## Auditoria de usos diretos

A busca abrangeu `now()`, `current_date` e `new Date()` nas jornadas do curso.
Os usos foram classificados assim:

- relógio operacional aplicado às cotações e holds do motor direto, calendário
  de reservas, abertura de sessão, data de fechamento, reconciliação de
  pendências, alertas de garantia e contexto de governança;
- funções que já recebem `p_now` permanecem testáveis e a reconciliação passa o
  instante operacional resolvido por hotel; backend de manutenção e agenda
  resolve esse instante antes de calcular atraso, janela e indicadores;
- datas de seed e fixtures são relativas ao instante operacional congelado,
  mantendo os exercícios coerentes mesmo quando repetidos em outro dia; o seed
  fixa o fuso do hotel na sessão, porque `current_date` em UTC fica um dia à frente
  das 21h à meia-noite em São Paulo;
- timestamps de criação, autenticação e trilhas imutáveis permanecem reais de
  propósito;
- JavaScript usado apenas para formatar datas ou gerar chaves não altera regras
  de negócio.

As jornadas de estoque, compras, contas e regras comerciais do curso resolvem
data e hora pelo hotel ativo. Campos com valor inicial de data/hora recebem o
instante operacional; timestamps técnicos de criação continuam reais.

Qualquer nova regra que compare prazo, “hoje” ou disponibilidade deve receber
`hotel_id` e usar o helper operacional. Usar `now()` diretamente exige registrar
por que o caso pertence à coluna de tempo real.

## Campos de data e hora

Um campo `datetime-local` é digitado na hora do hotel. O PMS consulta
`GET /admin/hotel-clock`, que devolve fuso, data e instante operacionais do hotel
ativo, e usa `hotelLocalInputToInstant` e `instantToHotelLocalInput` de
`@hotel/shared`. Em Server Action, `new Date(texto)` lê o fuso do servidor e não deve
ser usado; `readHotelInstant` já faz a conversão e recusa data inválida. O contrato
`date-time` recusa hora sem fuso com 400.

No navegador, as telas do painel usam `useHotelInputInstant`, e `new Date(texto)` leria o
fuso de quem preenche.

## Instantes exibidos

Telas do painel mostram instantes com `<HotelInstant value={...} />`, que funciona em
componentes de cliente e dentro de páginas de servidor. O layout resolve o fuso do hotel ativo
uma vez e o entrega por contexto. Formatar sem `timeZone` usa o fuso de quem renderiza: mostra
a hora errada e, com servidor e navegador em fusos diferentes, quebra a hidratação da página.
Sem hotel ativo vale `DEFAULT_DISPLAY_TIME_ZONE`; se o relógio falhar, a tela mostra "—" e os
campos recusam a data, em vez de assumir outro fuso. `hotelTimeGuard.test.ts` reprova o padrão
antigo em qualquer tela do painel.

Vencimento é uma data, sem hora: compare e formate como data, nunca como instante.
Pagamento e criação contam no dia do hotel, por
`getFinancialTransactionEffectiveDateKey`, e as regras de atraso exigem a data
operacional como referência.

## Transações financeiras

`paid_at` não tem mais valor padrão. Pagamento concluído sem data informada é
carimbado com `hotel_operational_now`, e `business_date` deriva de `paid_at` no fuso
do hotel ou, sem pagamento, de `hotel_operational_date`. Uma data de pagamento
informada mantém a própria data de negócio.

## Auditoria das funções do banco

Nenhuma função usa mais `current_date`. Os usos restantes de `now()` foram
classificados em novembro de 2026:

| Uso                                                                  | Situação                          |
| -------------------------------------------------------------------- | --------------------------------- |
| `updated_at`, `read_at`, `last_used_at`, sessão, link de pré-chegada | tempo real, por serem técnicos    |
| `feed_version` de canais e `generated_at` de painéis                 | tempo real, por serem técnicos    |
| `triaged_at`, `liability_decided_at`                                 | tempo real, coerentes com criação |
| `DEFAULT now()` em parâmetro `p_now`                                 | correto, o chamador informa       |

Decisão no checkout, vencimento de faturado, atraso de pedidos, `paid_at`, validação de
data futura e carimbos de ação, como `closed_at`, `approved_at` e `delivered_at`, usam
o relógio do hotel. Em produção os dois relógios coincidem. O efeito aparece no
hotel-escola, com o relógio em outro instante.

`operational_clock_stamps.test.sql` guarda essa classificação e reprova `now()` novo
fora da lista justificada, assim como coluna operacional com `DEFAULT now()`.

## Colunas operacionais sem valor informado

O padrão de uma coluna não enxerga o hotel da linha. Por isso, colunas que registram um
fato do hotel, como `stay_folio_entries.posted_at` e `cash_sessions.opened_at`, não têm
padrão: o gatilho `a0_stamp_operational_time` preenche o que não veio com
`hotel_operational_now`, e uma data informada continua valendo. Nova coluna desse tipo
deve receber o mesmo gatilho. `inventory_documents.posted_at` e
`inventory_movements.posted_at` continuam em tempo real, como instante técnico do
registro, e o fato fica em `occurred_at`.

## Chegada da lesson-02

O cenário `reservations-arrival` inicia às 14h locais do Aurora. Chegada e saída
previstas são convertidas do fuso do hotel para instantes; elegibilidade e
check-in transacional usam o relógio operacional e a mesma data local.
O timestamp efetivo da chegada e a postagem do crédito do sinal são operacionais;
eventos técnicos continuam com criação real. Links de pré-chegada expiram pelo
tempo real, mesmo quando o hotel-escola está congelado.

## Consumo após a chegada

Consulta e lançamento de consumo usam `hotel_operational_now(hotel_id)`.
O horário do consumo deve estar entre o check-in efetivo e esse instante,
inclusive nos limites. O contexto devolve `operational_now` separadamente de
`occurred_at`, que pode representar um consumo retroativo. Comanda e recebimento
imediato são postados no instante operacional; criação e auditoria técnica
continuam no tempo real. A entrega de pedidos usa a mesma referência operacional.
