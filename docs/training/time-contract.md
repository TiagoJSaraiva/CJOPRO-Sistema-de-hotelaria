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
- datas de seed continuam relativas ao reset real e a fixture congela o relógio
  imediatamente depois, mantendo os exercícios coerentes;
- timestamps de criação, autenticação e trilhas imutáveis permanecem reais de
  propósito;
- JavaScript usado apenas para formatar datas ou gerar chaves não altera regras
  de negócio.

Validades de lotes, compras, contas e regras comerciais ainda não ligadas às
jornadas locais continuam usando seus contratos históricos. Elas não devem ser
apresentadas como efeitos do relógio até receberem uma migration e testes
específicos.

Qualquer nova regra que compare prazo, “hoje” ou disponibilidade deve receber
`hotel_id` e usar o helper operacional. Usar `now()` diretamente exige registrar
por que o caso pertence à coluna de tempo real.
