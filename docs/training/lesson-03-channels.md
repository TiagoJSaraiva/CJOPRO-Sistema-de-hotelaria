# Lição 3 — Site direto e canais de reserva

## Objetivo e conceitos

Distinguir o site direto do hotel de uma conexão externa, mapear códigos sem
digitar IDs internos e encaminhar eventos sem mapeamento para revisão.

## Preparação

```powershell
pnpm training reset --scenario channels
pnpm training verify --scenario channels
```

Use `gerente.aurora@hotelaria.local`. A data é a mostrada em Treinamento local.

## Estado inicial e missão

O site direto ainda pode estar não publicado e nenhuma conexão oficial existe.
Crie o simulador neutro `HospedaLink Sandbox`, configure um mapeamento e importe
uma amostra.

## Passos orientados

1. Abra Reservas → **Canais de reserva** e leia a diferença entre os dois blocos.
2. Revise apresentação, termos e versão de consentimento do site direto.
3. Crie a conexão com provedor `HospedaLink Sandbox` e código `AURORA-DEMO`.
4. Copie imediatamente o segredo mostrado uma única vez; não o versione.
5. Selecione a categoria interna e um plano ativo autorizado para canal.
6. Copie a amostra CSV, mantenha uma linha válida e adicione outra com código
   externo desconhecido.
7. Importe e confira a caixa de entrada.

Erro proposital: evento com categoria externa sem mapeamento. Resultado esperado:
fica em revisão, sem criar reserva silenciosamente. No banco mudam conexão,
mapeamento e eventos; códigos externos continuam texto do provedor fictício.

<details><summary>Solução</summary>

Crie o mapeamento ausente com os seletores internos e reprocesse o evento. O
site direto não precisa dessa tradução porque já usa o catálogo do Aurora.

</details>

Para repetir: `pnpm training reset --scenario channels` e
`pnpm training verify --scenario channels`.
