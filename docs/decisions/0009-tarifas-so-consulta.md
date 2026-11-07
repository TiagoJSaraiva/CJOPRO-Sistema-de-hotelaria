# 0009: Tarifas só em consulta por enquanto

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** decisão do usuário
- **Áreas:** tarifas

## Decisão

O formulário de criação de plano sai da tela, os códigos são traduzidos, e o S3 fica aceito (QA-082).
O editor de versões de tarifa é a **primeira feature depois da depuração**.

## Motivo

A tela criava plano em rascunho, mas não criava nem ativava versão, então o plano não podia ser
vendido. O editor é grande demais para o congelamento.

## Alternativas recusadas

- Construir o editor agora: feature nova durante o congelamento.
- Manter o formulário: prometeria algo que a tela não entrega.

## Consequências

Criar plano e publicar versão pela tela continua fora do sistema (TAR-05).

## Prova

- [Jornada de tarifas e temporadas](../../apps/pms/__tests__/journeys/flow-seasons-rates.spec.ts)
