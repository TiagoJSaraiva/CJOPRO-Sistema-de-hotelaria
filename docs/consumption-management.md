# Fechamento gerencial de consumo

Este guia descreve a operação do painel gerencial e das apurações comerciais.
As telas e ações aparecem conforme as permissões do usuário e sempre usam o
hotel ativo.

## Interpretar o painel

Em **Vendas e consumo > Painel gerencial**, escolha período e dimensão. Venda
bruta representa o valor original dos itens; descontos incluem reduções
concluídas; cortesias preservam o bruto para análise, mas têm líquido zero;
estornos evidenciam valores revertidos. “Recebido pelo hotel” reúne fólio e
pagamento imediato. “Recebido por parceiros” reúne somente `partner_direct`.

Os cartões usam todo o recorte. A tabela pode ter paginação sem alterar esses
totais. Use o histórico para conferir comandas e o CSV para trabalhar o recorte
em outra ferramenta. O relatório é gerencial e não fiscal.

## Preparar e revisar uma apuração

1. Em **Apurações**, selecione um mês já encerrado.
2. Gere o demonstrativo do candidato. Meses sem venda ainda aparecem quando há
   aluguel ou mínimo garantido vigente.
3. Confira fontes, revisões e memória de cálculo. Recalcular substitui apenas um
   rascunho ou item em revisão e incrementa sua versão.
4. Envie para revisão. Uma pessoa diferente do preparador deve aprovar.
5. Se fontes, acordos ou correções mudarem, atualize e confirme novamente. Uma
   correção ou reembolso pendente impede a aprovação.

Aluguel trimestral é dividido por três e anual por doze. Vigências parciais são
apropriadas pelos dias civis do mês. Comissão incide na venda líquida. No
híbrido, prevalece o maior valor entre aluguel mais comissão e mínimo garantido.

## Registrar a quitação

Valor líquido positivo indica repasse do hotel ao parceiro; negativo indica
cobrança do parceiro pelo hotel. Informe exatamente o saldo, um meio, data e,
quando existir, a referência operacional. A baixa registra uma transação no PMS,
mas não movimenta conta bancária. Para corrigir uma baixa, use a reversão com
justificativa; o sistema mantém a transação original e cria outra compensatória.

Correções concluídas após a aprovação não reabrem o demonstrativo. A diferença
é reconhecida uma única vez no primeiro período posterior ainda aberto e aponta
para a correção e o fechamento original.

## Alertas

O painel completo e a página inicial sinalizam saldos próximos do checkout,
estoque abaixo do mínimo, acordos vencendo, meses ainda sem aprovação e
apurações aprovadas não quitadas. Os alertas são calculados em tempo real, não
possuem marcação de leitura e não enviam notificações externas.
