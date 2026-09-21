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

Aurora possui oito contas e pendências de áreas diferentes. A recepção começa
com **Saldo pendente no quarto 102**, da estadia sintética `LOCAL-AUR-002`,
aberta, não lida e sem responsável. Outras funções enxergam outros itens; a
lista é filtrada pelas permissões de quem entrou. Sua missão é acompanhar esse
saldo sem assumir trabalho de outra função e provar o isolamento com o Horizonte.

## Passos orientados

1. Confirme **Hotel Aurora** no seletor e identifique a função da conta.
2. Abra Pendências e localize **Saldo pendente no quarto 102**. Compare título,
   severidade, estado de leitura e responsável. A recepção não precisa enxergar
   as pendências de manutenção para concluir esta lição.
3. Marque esse item como lido e observe que ele continua aberto.
4. Assuma o mesmo item e confirme que você aparece como responsável.
5. Abra seu contexto: a conta da estadia `LOCAL-AUR-002`. Identifique o saldo
   e a ação de negócio necessária, mas não registre pagamento nesta lição.
6. Troque para o gerente do Horizonte e tente localizar dados do Aurora.

Erro proposital: procurar o quarto 103 no Horizonte. Resultado correto: ele não
aparece. Verificação final: o item lido continua aberto e o responsável é a
recepção; o saldo da estadia permanece até uma ação real na conta.

No banco mudam o recibo de leitura e, se usado, o responsável da pendência. A
entidade operacional de origem não muda até a ação correta.

<details><summary>Solução</summary>

Leitura é pessoal; atribuição é operacional. Volte ao Aurora e use **Abrir
contexto** para conferir a conta do quarto 102. Não é preciso quitar o saldo:
isso pertence às lições de conta e caixa. O isolamento do Horizonte é
intencional. Se a recepção mostrar zero itens antes de começar, confirme o hotel
ativo, execute `pnpm training verify --scenario orientation` e confira se PMS e
backend continuam em execução. Se a verificação falhar, repita o reset local da
preparação; ele apaga o progresso didático anterior.

</details>

Para repetir: `pnpm training reset --scenario orientation` e
`pnpm training verify --scenario orientation`.
