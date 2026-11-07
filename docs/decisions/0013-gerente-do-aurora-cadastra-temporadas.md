# 0013: Gerente do Aurora cadastra temporadas

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** permissões, tarifas

## Decisão

O gerente do Hotel Aurora recebe as mesmas permissões de cadastro de temporadas do gerente do Horizonte,
sem as de aprovação. A mudança é só nos dados sintéticos do seed.

## Motivo

Nenhuma conta do Aurora criava nem alterava temporadas (QA-085).

## Alternativas recusadas

- Manter e aceitar: a jornada seguiria dependendo do gerente de outro hotel.

## Consequências

A jornada de temporadas pode usar o gerente do Aurora. Hotéis já existentes no ambiente hospedado não
mudam: lá, as permissões são atribuídas em Papéis.

## Prova

- [Permissões do seed](../../supabase/tests/database/schema_and_seed.test.sql)
