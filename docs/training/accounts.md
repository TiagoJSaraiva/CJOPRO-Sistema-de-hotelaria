# Contas e responsabilidades do Hotel Aurora

Todas as contas abaixo usam a senha local `Hotelaria123!`.

| Conta                                          | Responsabilidade                                        | Limite didático importante                                       |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `recepcao.aurora@hotelaria.local`              | hóspedes, reservas, chegada, prontidão e consumo rápido | não aprova caixa nem manutenção                                  |
| `governanca.aurora@hotelaria.local`            | limpeza, checklist, frigobar, avaria e inspeção         | não pode aprovar o próprio trabalho                              |
| `tecnico.aurora@hotelaria.local`               | diagnóstico e execução de ordens                        | não inspeciona o próprio serviço                                 |
| `supervisor.manutencao.aurora@hotelaria.local` | triagem, bloqueio, inspeção, garantia e preventivas     | não substitui a inspeção final de governança                     |
| `caixa.aurora@hotelaria.local`                 | abertura, movimentos e contagem                         | não vê o esperado antes de contar e não aprova diferença própria |
| `estoque.compras.aurora@hotelaria.local`       | posições, lotes, contagens, solicitação e recebimento   | não aprova a própria compra                                      |
| `financeiro.aurora@hotelaria.local`            | conferência, preparação, contas e liquidações           | prepara, mas não aprova o fechamento diário                      |
| `gerente.aurora@hotelaria.local`               | aprovações segregadas, visão gerencial e relógio        | deve preservar a separação de funções                            |

`admin@hotelaria.local` é administrador global. A conta
`gerente.horizonte@hotelaria.local` pertence ao Hotel Horizonte e existe para os
testes de isolamento. Uma resposta “acesso negado” nessa troca pode ser o
resultado correto, não um defeito.

## Regra de troca de usuário

Saia da sessão e entre com a conta indicada pela lição. Não simule segregação
mantendo uma sessão de gerente aberta: preparador, executor e aprovador são
gravados pelo identificador real do usuário.
