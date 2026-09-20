# Lição 11 — Turno integrado final

## Objetivo e conceitos

Conduzir um turno do Hotel Aurora distribuindo trabalho entre as oito contas,
usando pendências como fila e preservando segregação, isolamento e trilhas.

## Preparação

```powershell
pnpm training reset --scenario integrated-shift
```

Registre a data operacional e prepare uma tabela com responsável, tarefa e
resultado. Todas as oito contas serão usadas.

## Estado inicial e missão

Há chegada, quarto retido, garantia, consumo, estoque, compra, caixa e apuração.
Encerre o turno sem ação pendente que possa ser concluída naquela data.

## Passos orientados

1. Recepção prepara a chegada e registra o consumo autorizado.
2. Governança atualiza quartos e frigobar, sem aprovar trabalho próprio.
3. Técnico executa a ordem do 103; supervisor inspeciona, libera e decide a
   garantia indicada.
4. Estoque/compras trata reposição, lote e recebimento; gerente aprova a compra.
5. Caixa opera e conta a sessão sem ver o esperado.
6. Financeiro trata diferença, contas, parceiro e prepara o dia.
7. Gerente revisa indicadores, aprova o fechamento e confere pendências.
8. Troque para Horizonte e confirme que nenhum dado do turno aparece.

Erros propositais: cada executor tenta aprovar a própria etapa; uma ação usa ID
do Horizonte; o gerente avança o relógio antes de concluir o turno. As duas
primeiras devem falhar; a terceira demonstra como novas pendências surgem sem
corromper as anteriores.

Verificação final: quarto pronto, chegada coerente, estoque conciliado, sessões
fechadas, fechamento aprovado e trilhas com atores distintos. O banco registra
eventos por módulo, versões otimistas e o instante operacional usado.

<details><summary>Solução</summary>

Siga a ordem das dependências: manutenção antes de governança, recebimento antes
da conta, sessão antes do fechamento. Use a pendência para abrir a origem; não a
marque como resolvida manualmente.

</details>

Para repetir: `pnpm training reset --scenario integrated-shift`.
