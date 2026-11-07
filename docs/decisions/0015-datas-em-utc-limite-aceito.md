# 0015: Datas em UTC: limite aceito

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** relógio

## Decisão

Fica como está a comparação de datas previstas de estadia na sessão em UTC. É um limite conhecido, a rever
se surgir hotel fora da faixa de UTC-12 a UTC+11 (QA-092).

## Motivo

A data é gravada ao meio-dia UTC, o que mantém o dia certo dentro da faixa, e todos os fusos do Brasil
estão nela.

## Alternativas recusadas

- Corrigir agora: sem efeito prático nos hotéis atuais, e exige mais uma migration e testes.

## Consequências

Um hotel fora da faixa veria o dia errado.

## Prova

- [Registro de bugs](../qa/bug-ledger.md)
- [Contrato temporal](../training/time-contract.md)
