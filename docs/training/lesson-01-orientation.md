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

1. No cabeçalho, confirme **Hotel ativo: Hotel Aurora** e o nome **Recepção
   Aurora**. Contas vinculadas a um único hotel não exibem seletor; a troca só
   aparece quando há mais de um contexto disponível.
2. Abra Pendências e localize **Saldo pendente no quarto 102**. Compare título,
   severidade, estado de leitura e responsável. A recepção não precisa enxergar
   as pendências de manutenção para concluir esta lição.
3. Marque esse item como lido e observe que ele continua aberto.
4. Assuma o mesmo item e confirme que você aparece como responsável.
5. Abra seu contexto: a conta da estadia `LOCAL-AUR-002`. Identifique o saldo
   e a ação de negócio necessária, mas não registre pagamento nesta lição.
   O saldo inicial é R$ 780,00 da estadia menos R$ 400,00 pagos: R$ 380,00.
6. Use **Sair** e entre explicitamente com
   `gerente.horizonte@hotelaria.local`. Confirme **Gerente Horizonte** e
   **Hotel ativo: Hotel Horizonte** no cabeçalho. Abra Pendências e tente
   localizar o saldo do quarto 102 ou outros dados do Aurora: eles não devem
   aparecer. A conta `gerente.aurora@hotelaria.local`, por outro lado, pertence
   ao Aurora e pode visualizar esse trabalho.

Erro proposital: procurar o quarto 103 no Horizonte. Resultado correto: ele não
aparece. Verificação final: o item lido continua aberto e o responsável é a
recepção; o saldo da estadia permanece até uma ação real na conta.

No banco mudam o recibo de leitura e, se usado, o responsável da pendência. A
entidade operacional de origem não muda até a ação correta.

### Ao explorar outras telas

O Histórico de consumo mostra duas águas minerais, R$ 16,00, para o quarto 102.
Esse lançamento sintético foi importado sem classificação de cobrança para a
lição 6: **Migrado/Legacy** descreve sua origem, **Cobrança não classificada**
indica que nenhum pagador foi definido, **Operador Sistema** indica que não houve
lançamento manual e **Ponto não informado** é um dado ausente do registro antigo.
Ele não representa dívida e não soma R$ 16,00 ao saldo de R$ 380,00. Classificar
e lançar novos consumos são tarefas da [lição 6](lesson-06-consumption-account.md).

Em **Clientes → Relacionamento**, selecione um hóspede para consultar o número de
reservas e estadias e as preferências que ele declarou. Categoria organiza o
assunto; origem informa quem comunicou a preferência; o texto descreve o pedido;
versão do consentimento registra a autorização usada; vigência opcional define
até quando a informação vale. Por exemplo, “quarto em andar silencioso” ajuda a
equipe a atender Bruno, mas não troca seu quarto nem garante disponibilidade.
Histórico de estadias e consumos não cria preferências automaticamente. Esta
consulta é opcional na primeira lição.

<details><summary>Solução</summary>

Leitura é pessoal; atribuição é operacional. Volte ao Aurora e use **Abrir
contexto** para conferir a conta do quarto 102, incluindo o saldo de R$ 380,00.
Não é preciso quitar o saldo:
isso pertence às lições de conta e caixa. O isolamento do Horizonte é
intencional. Se a recepção mostrar zero itens antes de começar, confirme o hotel
ativo, execute `pnpm training verify --scenario orientation` e confira se PMS e
backend continuam em execução. Se a verificação falhar, repita o reset local da
preparação; ele apaga o progresso didático anterior.

</details>

Para repetir: `pnpm training reset --scenario orientation` e
`pnpm training verify --scenario orientation`.
