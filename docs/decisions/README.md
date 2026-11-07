# Decisões

Registro do que foi decidido, por quê e o que protege cada decisão. Serve para que nenhum
agente, nem o Codex nem o Claude, contradiga sem querer o que já foi combinado. As regras em
si continuam em [regras dos fluxos](../qa/rules-flows.md) e
[regras financeiras](../qa/rules-finance.md).

## Como usar

- **Antes de planejar:** leia as decisões da área.
- **Quando o usuário decidir algo:** crie um arquivo `NNNN-titulo.md` no mesmo diff da mudança.
- **Quando um pedido ou correção contrariar uma decisão:** pare e pergunte. Para mudar, crie uma
  decisão nova e marque a antiga como `substituída por`, com o link para a decisão nova.

Cada arquivo tem os campos Status, Data, Origem e Áreas e as seções Decisão, Motivo,
Alternativas recusadas, Consequências e Prova. O status é `aceita`, `a implementar` ou
`substituída por`. Uma decisão aceita precisa apontar para o que a protege, de preferência um
teste. `pnpm docs:check` confere tudo isso.

## Índice

| Nº   | Decisão                                                                                  | Áreas                  | Status |
| ---- | ---------------------------------------------------------------------------------------- | ---------------------- | ------ |
| 0001 | [Congelar features e depurar no sistema real](0001-depurar-no-sistema-real.md)           | processo, testes       | aceita |
| 0002 | [Commits pequenos, sem coautoria](0002-commits-pequenos-sem-coautoria.md)                | processo               | aceita |
| 0003 | [Regras financeiras e diferenças do mercado](0003-regras-financeiras-aprovadas.md)       | financeiro             | aceita |
| 0004 | [A recepção opera o próprio caixa](0004-recepcao-opera-o-proprio-caixa.md)               | caixa, recepção        | aceita |
| 0005 | [Financeiro consulta a conta sem operá-la](0005-financeiro-consulta-a-conta.md)          | financeiro, permissões | aceita |
| 0006 | [Corrigir a lição 6, sem criar fluxo de legado](0006-licao-6-sem-fluxo-de-legado.md)     | consumo, curso         | aceita |
| 0007 | [Cancelamento e no-show encerram tudo](0007-cancelamento-e-no-show.md)                   | reservas, financeiro   | aceita |
| 0008 | [Tela mínima de reservas sem quarto](0008-reservas-sem-quarto.md)                        | reservas, canais       | aceita |
| 0009 | [Tarifas só em consulta por enquanto](0009-tarifas-so-consulta.md)                       | tarifas                | aceita |
| 0010 | [Lançamento tardio não entra em dia fechado](0010-lancamento-tardio.md)                  | financeiro, caixa      | aceita |
| 0011 | [Cobrança de manutenção sai com ciência](0011-saida-com-ciencia.md)                      | saída, manutenção      | aceita |
| 0012 | [Janelas de entrada e saída viram aviso](0012-janelas-de-entrada-e-saida-viram-aviso.md) | recepção, reservas     | aceita |
| 0013 | [Gerente do Aurora cadastra temporadas](0013-gerente-do-aurora-cadastra-temporadas.md)   | permissões, tarifas    | aceita |
| 0014 | [Fechamento lista lançamentos tardios](0014-fechamento-lista-lancamentos-tardios.md)     | caixa                  | aceita |
| 0015 | [Datas em UTC: limite aceito](0015-datas-em-utc-limite-aceito.md)                        | relógio                | aceita |
| 0016 | [Varredura sobre o build de produção do PMS](0016-jornadas-em-build-de-producao.md)      | testes                 | aceita |
| 0017 | [Analytics do Supabase local desligado](0017-analytics-local-desligado.md)               | ambiente               | aceita |
| 0018 | [Restauração rápida do banco nas jornadas](0018-restauracao-rapida-do-banco.md)          | testes, banco          | aceita |
