# Lição 2 — Reserva, garantia e chegada

## Objetivo e conceitos

Preparar uma reserva confirmada para chegada, conferir garantia e prontidão e
entender por que quarto disponível não é necessariamente quarto pronto.

## Preparação

```powershell
pnpm training reset --scenario reservations-arrival
pnpm training verify --scenario reservations-arrival
```

Use a data operacional exibida pelo relógio. Contas: recepção para execução e
gerente somente se uma exceção autorizada for necessária.

## Estado inicial e missão

A reserva `LOCAL-AUR-001` chega na data operacional, ainda sem check-in. Sua
missão é validar hóspede, período, garantia, atribuição e prontidão antes da
chegada.

## Passos orientados

1. Em Reservas, localize `LOCAL-AUR-001` no calendário e abra os detalhes.
2. Confira hóspede, quantidade, datas, tarifa e saldo.
3. Registre ou valide a garantia permitida para a reserva.
4. Escolha um quarto compatível e confira a prontidão da Governança.
5. Conclua a pré-chegada e efetue o check-in somente quando não houver bloqueio.
6. Troque para gerente apenas se a interface pedir uma decisão segregada.

Erro proposital: tente selecionar um quarto bloqueado. A interface deve impedir
ou explicar a manutenção; não use override para contornar interdição.

Verificação final: estadia em andamento, quarto ocupado e trilha de chegada. No
banco mudam atribuição, garantia, timestamps e estado da estadia, preservando a
tarifa contratada.

<details><summary>Solução</summary>

Use um quarto da mesma categoria que esteja disponível **e pronto**. Resolva a
origem da falta de prontidão em Governança em vez de forçar a chegada.

</details>

Para repetir: `pnpm training reset --scenario reservations-arrival` e
`pnpm training verify --scenario reservations-arrival`.
