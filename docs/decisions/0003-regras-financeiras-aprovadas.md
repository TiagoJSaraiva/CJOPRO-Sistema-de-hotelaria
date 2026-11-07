# 0003: Regras financeiras e diferenças do mercado

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** decisão do usuário sobre as regras; **a confirmar:** as diferenças abaixo foram propostas pelo agente e não foram contestadas, sem aceite explícito de cada uma
- **Áreas:** financeiro

## Decisão

As regras de [regras financeiras](../qa/rules-finance.md) estão aprovadas. Diferenças do mercado
mantidas: o fechamento usa a data civil; fechar o dia exige duas pessoas, mesmo sem movimento;
impostos e documento fiscal ficam fora, e o relatório gerencial se declara não fiscal.

## Motivo

O usuário aprovou as regras condicionado à avaliação de que estavam boas na lógica e no mercado. A
data civil é mais simples que a virada por auditoria noturna, e o fiscal seria feature nova durante
o congelamento.

## Alternativas recusadas

- Data operacional que só vira na auditoria noturna: mais complexa, sem necessidade atual.
- Fechar com uma pessoa só: mais simples numa pousada, porém sem segregação de funções.

## Consequências

Um hotel real precisaria de ISS, taxa de serviço e NFS-e depois do congelamento.

## Prova

- [Regras do domínio](../../supabase/tests/database/finance_rules.test.sql)
