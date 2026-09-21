# Lição 10 — Parceiros, apuração, contestação e indicadores

## Objetivo e conceitos

Analisar produção atribuída a parceiro, preparar uma apuração, registrar
contestação e interpretar indicadores sem confundir valor bruto, comissão e
liquidação.

## Preparação

```powershell
pnpm training reset --scenario partner-settlement
pnpm training verify --scenario partner-settlement
```

Use financeiro para preparar e gerente para aprovar. A data operacional delimita
o período; todos os parceiros e valores são sintéticos.

## Missão e passos orientados

1. Abra Parceiros/Indicadores e confira acordo e revisão vigente.
2. Escolha o período e compare pedidos elegíveis, base, ajustes e comissão.
3. Prepare a apuração como financeiro.
4. Troque para gerente e aprove; a mesma conta que preparou não pode aprovar.
5. Volte ao financeiro, registre uma contestação com motivo verificável e
   observe o estado pendente.
6. Como gerente, resolva a contestação; volte ao financeiro para liquidar o
   saldo aprovado.

Erro proposital: aprovar a própria preparação ou uma impressão digital antiga.
O sistema deve rejeitar e preservar a apuração anterior.

Verificação final: apuração, contestação e decisão aparecem na trilha e nos
indicadores. No banco, revisões comerciais não são reescritas; o cálculo guarda
o snapshot da regra usada.

<details><summary>Solução</summary>

Use uma segunda conta para aprovação. Depois da aprovação, financeiro abre a
contestação, gerente a resolve e financeiro liquida. Se a projeção mudar antes
da aprovação, prepare novamente. Leia base e comissão separadamente.

</details>

Para repetir: `pnpm training reset --scenario partner-settlement` e
`pnpm training verify --scenario partner-settlement`.
