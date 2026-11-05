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
| decisão no checkout, vencimento de faturado e atraso de pedidos      | a corrigir: QA-019                |
| `paid_at` em lote, reembolso e pagamento a fornecedor                | a corrigir: QA-019                |
| validação de data futura em estoque e manutenção                     | a corrigir: QA-019                |
| carimbo de ação, como `closed_at`, `approved_at` e `delivered_at`    | a corrigir: QA-020                |

Em produção os dois relógios coincidem. O efeito aparece no hotel-escola, com o
relógio em outro instante.

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
