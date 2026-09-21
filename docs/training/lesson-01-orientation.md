# Lição 1 — Orientação, papéis e pendências

## Objetivo e conceitos

Reconhecer hotel ativo, permissões, pendências e segregação. Uma pendência é um
trabalho detectado: **Marcar lida** só controla leitura; **Assumir** registra
responsabilidade; **Abrir contexto** leva à origem que resolve o problema.

## Preparação

```powershell
pnpm training reset --scenario orientation
pnpm training verify --scenario orientation
```

Anote a data de `pnpm training clock show`. Use primeiro
`recepcao.aurora@hotelaria.local` e depois
`gerente.horizonte@hotelaria.local`.

## Estado inicial e missão

Aurora possui oito contas e pendências de áreas diferentes. Sua missão é abrir
cada contexto sem assumir trabalho de outra função e provar o isolamento com o
Horizonte.

## Passos orientados

1. Confirme **Hotel Aurora** no seletor e identifique a função da conta.
2. Abra Pendências e compare título, severidade, estado de leitura e responsável.
3. Marque uma pendência como lida e observe que ela não foi resolvida.
4. Assuma uma pendência compatível com recepção.
5. Abra seu contexto e identifique a ação de negócio necessária.
6. Troque para o gerente do Horizonte e tente localizar dados do Aurora.

Erro proposital: procurar o quarto 103 no Horizonte. Resultado correto: ele não
aparece. Verificação final: o item lido continua aberto; somente o item assumido
mostra responsável.

No banco mudam o recibo de leitura e, se usado, o responsável da pendência. A
entidade operacional de origem não muda até a ação correta.

<details><summary>Solução</summary>

Leitura é pessoal; atribuição é operacional. Volte ao Aurora e use **Abrir
contexto** para descobrir se a origem é caixa, garantia, manutenção ou outra
jornada. O isolamento do Horizonte é intencional.

</details>

Para repetir: `pnpm training reset --scenario orientation` e
`pnpm training verify --scenario orientation`.
