# Contrato temporal do hotel-escola

## Matriz de tempo

| Usa tempo operacional por hotel                | Continua no tempo real                       |
| ---------------------------------------------- | -------------------------------------------- |
| reservas, chegada, checkout e prontidão        | emissão e expiração de sessão                |
| validade comercial, holds e pré-chegada        | rate limiting e bloqueio de login            |
| governança, realocação e manutenção visível    | validade de URL assinada e upload            |
| SLA, garantia, preventiva e agenda             | `created_at` e eventos técnicos de auditoria |
| lotes, validade, compras e contas              | duração de execução e telemetria             |
| sessão de caixa, data operacional e fechamento | saúde, locks e timeouts de infraestrutura    |
| reconciliação, pendências e indicadores        | segurança criptográfica                      |

`hotel_operational_now(hotel_id)` e `hotel_operational_date(hotel_id)` são as
fontes de verdade para novas regras operacionais. Overrides `p_now` explícitos
continuam tendo precedência em testes e reconciliações.

## Auditoria de usos diretos

A busca abrangeu `now()`, `current_date` e `new Date()` nas jornadas do curso.
Os usos foram classificados assim:

- relógio operacional aplicado à abertura de sessão, data de fechamento,
  reconciliação de pendências, alertas de garantia e contexto de governança;
- funções que já recebem `p_now` permanecem testáveis e a reconciliação passa o
  instante operacional resolvido por hotel;
- datas de seed continuam relativas ao reset real e a fixture congela o relógio
  imediatamente depois, mantendo os exercícios coerentes;
- timestamps de criação, autenticação e trilhas imutáveis permanecem reais de
  propósito;
- JavaScript usado apenas para formatar datas ou gerar chaves não altera regras
  de negócio.

Qualquer nova regra que compare prazo, “hoje” ou disponibilidade deve receber
`hotel_id` e usar o helper operacional. Usar `now()` diretamente exige registrar
por que o caso pertence à coluna de tempo real.
