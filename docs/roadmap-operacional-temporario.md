# Roteiro operacional temporário

## Vigência e encerramento

Roteiro aprovado na conversa de 8 de setembro de 2026. Prioridade escolhida:
operação real do hotel. O levantamento foi baseado em commits, documentação,
telas e testes do repositório, sem sessão de uso com funcionários.

Este arquivo e o bloco `roadmap-operacional-temporario:start` até
`roadmap-operacional-temporario:end` do AGENTS.md são temporários. Somente após
concluir **e validar todas as etapas 1 a 6**, remover este arquivo e apenas esse
bloco. Nunca restaurar integralmente o AGENTS.md nem reverter commits completos.
Preservar alterações independentes. Antes da limpeza, transferir orientações
operacionais exclusivas daqui para a documentação permanente. Iniciar a etapa 6
ou concluir parcialmente qualquer etapa não autoriza a limpeza.

As etapas 2 a 6 são diretrizes de produto e exigem planejamento técnico próprio
e autorização de escopo antes da execução. Não implementar todo o roteiro por
inferência. Atualizar este acompanhamento em cada entrega validada.

## Acompanhamento

| Etapa                    | Situação             | Entregas                                                                                             | Decisões                                         | Validações                                                                                                               | Próximo trabalho                                  |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1 — Usabilidade          | Concluída e validada | Roteiro; ações e decisões de manutenção; busca de duplicidade; fila de comandas; central persistente | Fila persistente; comandas confirmadas por grupo | 310 verificações SQL; 8 testes HTTP; check, testes e cobertura aprovados; E2E Windows/Linux com reexecuções direcionadas | Planejar tecnicamente a etapa 2 quando solicitada |
| 2 — Operação integrada   | Não iniciada         | —                                                                                                    | Prioridade após etapa 1                          | —                                                                                                                        | Planejamento técnico                              |
| 3 — Manutenção planejada | Não iniciada         | —                                                                                                    | Aprofundar recursos existentes                   | —                                                                                                                        | Planejamento técnico                              |
| 4 — Consumo e saída      | Não iniciada         | —                                                                                                    | Completar atendimento e pagadores                | —                                                                                                                        | Planejamento técnico                              |
| 5 — Estoque e financeiro | Não iniciada         | —                                                                                                    | Fechar ciclos operacionais                       | —                                                                                                                        | Planejamento técnico                              |
| 6 — Expansão do PMS      | Não iniciada         | —                                                                                                    | Consolidar operação primeiro                     | —                                                                                                                        | Planejamento técnico e limpeza final              |

## Levantamento de design aprovado

### Registro das entregas da etapa 1

- Documentação temporária: roteiro e bloco delimitado no AGENTS.md preservados.
- Manutenção: ações contextualizadas, justificativas aparadas e obrigatórias,
  diagnóstico, inspeção, busca e comparação de duplicidades, proteção transacional
  contra ciclos e tradução do histórico. Migration incremental validada; testes
  de contratos, componentes, busca, rotas e banco cobrem as decisões.
- Consumo: organização por modo/parceiro/acordo, confirmação individual, recibos
  preservados e repetição idempotente com conteúdo congelado em resposta incerta.
  Testes de agrupamento, ações e fila aprovados; jornada dos dois recibos e axe
  aprovados em desktop e celular. O guia agora acompanha alvos que aparecem após
  carregamento ou mudança de estado, com teste para inclusão e remoção do alvo.
- Pendências: leitura pessoal, atribuição concorrente e devolução própria,
  encerramento pela origem, novos episódios na recorrência e reconciliação
  idempotente por hotel. A identidade parceiro/competência permanece estável ao
  aprovar uma apuração, preservando leitura e responsável. Migrações, contratos,
  tipos gerados, guias e diagramas permanentes entregues.
- Validações: 310 verificações SQL e 8 testes HTTP locais aprovados; `pnpm check`,
  `pnpm test`, documentação e OpenAPI aprovados. Cobertura completa aprovada e
  reconferida nos workspaces alterados após os ajustes finais: linhas 40,65%
  no consolidado e 42,28% no PMS, sem reduzir limiares. A rodada Windows teve
  31/32 cenários aprovados; o restante (espera pela rota de apuração) passou
  após ajuste em desktop e celular. No Linux, 31/32 passaram na rodada completa; o cenário de três páginas de manutenção excedeu o tempo e passou em desktop e celular após adequar seu limite a 90 segundos. Os 32 cenários foram aprovados em ambas as plataformas considerando essas reexecuções direcionadas. Não houve atualização de snapshots para contornar falhas funcionais ou axe.
- Os testes visuais identificaram dois campos de data de bloqueio sem rótulo;
  receberam rótulos visíveis e teste de componente. Tours acompanham conteúdo
  carregado depois da montagem. Tempos de inicialização de contratos nos testes
  de backend foram ajustados para V8; verificações e limites de cobertura mantidos.
- O banco de testes foi recriado exclusivamente no Supabase local. A checagem do
  seed usa suas identidades estáveis para não depender do instante em que o ciclo
  periódico gera preventivas. Nenhum serviço remoto foi alterado.

A principal oportunidade é conectar módulos em jornadas completas. Manutenção
já inclui preventivas, SLA, fornecedores, garantias, inspeções e financeiro.
Consumo já inclui catálogo, ofertas, parceiros, comandas, correções, pagamentos,
estoque e apuração. Evoluir a tomada de decisão e a coordenação entre equipes.

### 1. Melhorar usabilidade — prioridade imediata

- Traduzir ações como start, wait e complete para linguagem operacional e
  apresentar a próxima ação compatível com o estado atual.
- Substituir justificativas genéricas por motivo real, impedimento, diagnóstico,
  serviço executado e pendência de inspeção. Histórico deve servir à próxima equipe.
- Localizar e comparar ocorrências duplicadas por quarto, problema e data,
  substituindo a digitação de identificadores.
- Explicar incompatibilidades de cobrança entre itens e organizar a compra em
  grupos sem obrigar o atendente a reconstruí-la.
- Unificar a experiência de alertas, separando visualizado, assumido e resolvido.

Sucesso: uma pessoa que não configurou o sistema registra, encaminha e conclui
um atendimento entendendo as consequências das decisões.

### 2. Conectar recepção, governança e manutenção

- Governança por quarto: limpeza pendente, em andamento, inspeção e liberação,
  responsável e prioridade pela próxima chegada.
- Separar ocupação, limpeza e restrição de manutenção: vazio não significa limpo;
  reparado não significa pronto para receber.
- Vistoria integrada com frigobar, reposição e abertura de ocorrência.
- Mostrar reservas afetadas por interdição e conduzir realocação assistida com histórico.
- Passagem de turno com responsável, última atualização e próxima ação.

Jornada: saída → conferência de frigobar → limpeza → defeito → manutenção →
inspeção → liberação. Sucesso: recepção sabe se o quarto está pronto e quem
trata cada impedimento.

Referência: [Mews/Flexkeeping: limpeza, frigobar e reparos](https://help.mews.com/s/article/how-to-start-cleaning-the-room).

### 3. Manutenção: planejamento e qualidade

- Agenda por técnico/equipe, duração estimada, carga e janela de acesso ao quarto.
- Esperas por peça, fornecedor, acesso ou autorização com responsável pelo
  desbloqueio e próxima cobrança.
- Priorizar urgência técnica e impacto: hóspede presente, chegada próxima,
  quantidade de quartos afetados e indisponibilidade prolongada.
- Relacionar reincidências por quarto/equipamento.
- Apoiar reparar, substituir ou acionar garantia com falhas, custos e indisponibilidade.
- Registrar previsão comunicada, restrições de acesso e confirmação do atendimento.
- Separar tempo total de impacto e tempo de execução sem ocultar o efeito de
  esperas sobre o hóspede; o SLA atual usa horas corridas.

Sucesso: gestor identifica o que está parado, por quê, quem destrava e o que reincide.

### 4. Completar consumo e saída

- Pedido recebido, em preparo, pronto e entregue para restaurante/serviço de quarto;
  preservar lançamento rápido para recepção e frigobar.
- Conferência pré-checkout de consumos, pedidos e ajustes pendentes.
- Conta por pagador: hóspedes, acompanhantes e empresa. Atribuição de item já existe;
  divisão de responsabilidade é diferente do multimeios já disponível.
- Jornada de consumo descoberto após saída: revisão, evidências, contato e cobrança
  complementar; hoje novas comandas exigem estadia em andamento e correções posteriores reduzem valores.
- Correção orientada de quarto errado, com origem, destino e confirmação.
- Pacotes, café incluído, créditos e benefícios para evitar cobranças indevidas.

Sucesso: conta compreensível e correta, sem pendências evitáveis na saída.
Referência: [Cloudbeds: múltiplos fólios](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/360002778113-Manage-Split-Folio-in-reservation).

### 5. Estoque, caixa e parceiros

- Converter estoque crítico em solicitação de reposição acompanhada até recebimento.
- Compras: solicitação, aprovação, pedido, recebimento parcial/total e divergências.
- Composição de frigobar por quarto e roteiro de reposição.
- Lotes, validade e descarte para perecíveis.
- Caixa por turno: abertura, recebimentos, retiradas, fechamento e diferenças.
- Fechamento diário: revisar saídas, pagamentos, correções, consumos e divergências.
- Parceiros: vencimento, pagamento parcial, saldo e contestação; quitação atual é integral.
- Visão consolidada de empresas com múltiplos papéis, preservando distinções entre
  fornecedores de manutenção e parceiros comerciais.

Sucesso: falta de produto ou diferença financeira é acompanhada até resolução.

### 6. Expandir o restante do PMS

- Alteração de período, troca de quarto e extensão com disponibilidade e diferença
  de preço claras. Check-in, cancelamento e no-show já existem.
- Perfil de relacionamento: estadias, preferências informadas e solicitações.
- Pré-chegada: acompanhantes, horário, pedidos especiais e pendências.
- Tarifas flexíveis, não reembolsáveis e pacotes com refeições, evoluindo temporadas.
- Indicadores integrados de ocupação, indisponibilidade, consumo, perdas e
  reincidência, com acesso aos casos que explicam os números.
- Reserva direta e canais em frente própria: motor inspecionado ainda não oferece
  uma jornada funcional de reserva.

Prioridade: etapa 1 → governança da etapa 2 → etapas 3 e 4 → etapas 5 e 6.
Validar caminhos normais e exceções: reprovação, fornecedor atrasado, contestação,
troca de quarto, pagamento parcial e passagem de turno. Guias devem explicar
quando agir, quem assume e como reconhecer conclusão. Refinar prioridade com
tempo de liberação, espera no checkout, reincidência e pendências entre turnos.

## Plano técnico aprovado — etapa 1

### Entregas e limites

Quatro blocos validados e commits descritivos: documentação temporária,
manutenção, consumo, central de pendências. Sem push, publicação, acesso remoto
ou antecipação das etapas 2 a 6. Preservar permissões, hotel ativo, histórico e
regras financeiras. Cada bloco atualiza este acompanhamento.

### Manutenção

- Ações por estado: pendente atribuir/cancelar; atribuída iniciar/reatribuir/cancelar;
  execução pausar/esperar/concluir/reatribuir/cancelar; pausa/espera retomar/reatribuir/cancelar;
  inspeção aprovar/reprovar; concluída reabrir conforme autorização.
- Centralizar rótulos e seleção, mantendo servidor como autoridade. Conflitos
  atualizam o contexto e explicam a ação indisponível.
- Motivos obrigatórios e reais para pausa, cancelamento, reabertura; categoria e
  descrição para espera; diagnóstico e serviço para conclusão; observação para
  inspeção; destino e justificativa para duplicidade. Trim e limites existentes,
  validação na interface, backend e operação transacional incremental.
- Reutilizar campos; não reescrever histórico nem criar agenda, SLA ou equipe.
- Modal de duplicidade com busca por código/texto, quarto/alvo, período e situação;
  mostrar código, título, alvo, situação/data e link comparativo; excluir a própria
  ocorrência e destinos duplicados, impedir ciclos no servidor. Confirmar origem,
  destino e motivo; não transferir ordens/cobranças/evidências.
- Traduzir eventos do histórico com alternativa legível para desconhecidos.

### Consumo

- Preservar lançamento simples quando houver cobrança comum. Caso contrário,
  explicar incompatibilidade e oferecer Organizar cobranças.
- Sugerir modo padrão autorizado, depois fólio, imediato e parceiro. Seleção por
  item; agrupar por modo e também parceiro/acordo no direto. Preservar estadia,
  ponto, hóspede, horário e observações. Nunca sugerir cortesia automaticamente.
- Item sem modo bloqueia confirmação até remoção/resolução. Não dividir quantidade.
- Fila com itens, total, modo e estado; confirmar cada grupo na operação existente,
  solicitando meio/referência ou ciência de recebimento externo por grupo.
- Preservar recibos e grupos restantes em falha. Uma chave idempotente por grupo
  e conteúdo; resposta incerta exige repetir o mesmo pedido antes de editar.
- Conflito confirmado atualiza ofertas e exige revisão de grupos não lançados.
  Nunca reenviar/desfazer grupos concluídos automaticamente.
- Fila apenas na sessão da página; alertar abandono e orientar conferência do
  histórico após recarregar. Sem rascunho no banco, contrato de criação novo ou
  atomicidade conjunta de grupos.

### Pendências

- Central compartilhada com filtros de origem/tipo/prioridade/responsável/leitura/situação.
- Leitura individual; tratamento compartilhado aberta/assumida/resolvida;
  assumir e devolver apenas a própria atribuição, com versão e conflito 409.
- Abrir registra leitura, nunca assume/resolve. Resolução pela origem, sem botão
  manual; vigência encerrada é indicada como tal, sem alegar renovação.
- Cartões/atalhos comuns na inicial e páginas atuais; preservar URLs e caixa
  histórica, cuja dispensa não resolve pendência.
- Migration: hotel/tipo/entidade/episódio, responsável/versão/datas, leitura por
  usuário e eventos de criação/atribuição/devolução/resolução.
- Um episódio ativo por entidade/tipo; agrupar limiares SLA; apuração estável por
  parceiro/competência. Recorrência abre episódio sem leitura ou responsável anterior.
- Reconciliação idempotente: saldos, estoque, acordos/apurações; SLA resposta/resolução,
  preventivas adiadas, contratos/garantias. Reusar critérios, examinar hotel completo,
  nunca página/filtro do usuário; falha não significa condição resolvida.
- Ciclo existente de 15 minutos e ação explícita Atualizar pendências; exibir última
  atualização/falha. GET sem gravação.
- Contratos tipados de lista/resumo, leitura individual/lote, assumir/devolver com
  versão e reconciliação. Envelopes vigentes, endpoints antigos preservados.
- Permissões das fontes em lista, totais, links e ações; manutenção mantém alcance
  dos destinatários. Sem permissão genérica revelando tudo. Restringir financeiro
  e dados pessoais. Gerar OpenAPI/tipos pelas ferramentas e atualizar diagramas/guias.

### Guia de uso

Públicos: execução/triagem, recepção/pontos e gestores autorizados. Atualizar tour
de ocorrência, motivos e duplicidade; consumo incompatível → organização → revisão
por grupo → recibos; central leitura → responsabilidade → resolução na origem.
Ajudas contextuais para cancelamento, duplicidade e confirmação financeira.
Alvos data-usage-guide estáveis, somente estados/permissões renderizados; teclado,
contenção/retorno de foco, Escape, anúncios acessíveis e viewport móvel.

### Proteção e testes

Caracterizar legado antes de modificar: transições, histórico, duplicidade,
notificações e comandas. Cobrir matriz de estados/permissões, retomada, checklist,
inspeção por outra pessoa, vazio/conflito; busca vazia, própria/cíclica/outro hotel;
modos/parceiros/cortesia; grupo concluído seguido de falha, idempotência, resposta
incerta, mudança de preço; leituras independentes, disputa/devolução, resolução,
recorrência e reconciliação repetida/falha. Provar autenticação, autorização,
isolamento e ausência de vazamentos em listas, totais, histórico e erros.

Shared: regras/contratos; PMS: componentes/ações/estado/foco; backend: rotas e
repositórios controlados; banco local: migrations, transações, concorrência e
isolamento; Playwright: jornadas/tours/snapshots/axe desktop e mobile. Cada novo
arquivo/regra de produção exercitado. Documentação não executável validada por
conteúdo/links, sem teste unitário artificial.

Gerar artefatos e executar pnpm exec prettier . --write antes da validação final;
revisar efeitos fora de escopo. Aceite: pnpm docs:check, pnpm check, pnpm test,
pnpm test:coverage, pnpm api:openapi:check, pnpm test:db, pnpm test:e2e (inclui visual
e axe). Snapshots somente após inspeção; cobertura preservada/elevada, sem reduzir
limiares. Geração de tipos/testes recriam exclusivamente banco local, efeito a
comunicar antes da execução. Revisar diff e registrar validações em cada bloco.
