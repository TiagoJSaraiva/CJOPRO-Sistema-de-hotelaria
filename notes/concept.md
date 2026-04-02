**IFSP PROJETO 1**



O projeto realizado será um sistema de hotelaria, feito tendo dinamismo de funcionamento como prioridade para se encaixar em quaisquer regra de negócio de diferentes hotelarias. O Sistema deve cobrir soluções para todos os requisitos de uma agência de hospedagem.

Inicialmente, na primeira parte da matéria de projeto, a prioridade é orquestrar o seguinte fluxo no sistema:



1 - fluxo do cliente

2 - fluxo do recepcionista

3 - fluxo da administração



**Detalhes**

Arquitetura do projeto:

* Repositórios separados para cada face do projeto, com baixo acoplamento (sem código compartilhado). Protocolo de nome de atributos de objetos trocados entre aplicações documentado em **./API\_CONTRACT.txt**

Faces do projeto:
-**Website institucional www.nomedoprojeto.com**: Site para venda do produto, com informações sobre funcionamento e contrato.
-**Sistema PMS app.nomedoprojeto.com**: Site para uso pelos clientes.
-**Simulador de booking www.simulador-reservas.com**: Cria reservas automáticamente para os sistemas

Arquitetura de cada face:

PMS:
- Usa polling para adquirir reservas

