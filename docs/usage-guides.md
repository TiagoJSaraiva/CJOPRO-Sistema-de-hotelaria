# Guias de uso nas features do PMS

Toda nova `feat` com impacto visível no PMS deve planejar e entregar orientação
na própria interface. O objetivo é explicar a tarefa e as decisões menos óbvias
sem exigir que o usuário consulte documentação externa.

## Seção obrigatória no planejamento

O planejamento deve conter uma seção **Guia de uso** antes da execução e
registrar:

1. público e tarefa que o guia ajuda a concluir;
2. páginas, estados e permissões afetados;
3. passos do tour e ajudas contextuais necessárias;
4. alvos estáveis usados para ligar conteúdo e interface;
5. comportamento por teclado, foco, leitor de tela e viewport móvel;
6. testes unitários, funcionais, visuais e de acessibilidade aplicáveis.

Features sem impacto na interface devem manter a seção e justificar
explicitamente **não aplicável**. Uma alteração interna não deve criar uma
interface artificial apenas para satisfazer esta política.

## Escolha do formato

- Use o tour quando a tarefa envolve uma sequência, diferentes regiões da
  página ou uma decisão que depende de contexto anterior.
- Use a ajuda contextual “?” para um conceito isolado que possa gerar erro ou
  tenha consequência operacional relevante.
- Combine os dois quando o fluxo e alguns campos críticos precisarem de níveis
  diferentes de explicação.
- Não adicione ajuda para repetir um rótulo, placeholder ou texto já evidente.

O tour é aberto somente pelo botão **Guia desta página**. Ele é explicativo: não
preenche campos, envia formulários ou altera dados. Cada abertura começa no
primeiro passo; progresso e conclusão não são persistidos.

## Contrato de implementação

As páginas usam uma definição tipada com identificador, título e passos. Cada
passo possui identificador, alvo, título e descrição. O elemento destacado deve
ser marcado com `data-usage-guide`; classes CSS, posição no DOM e texto visível
não são seletores estáveis.

- Identificadores e alvos são únicos dentro da definição.
- Um passo só é fornecido quando sua informação e ação estão autorizadas.
- Alvos ausentes por estado ou permissão são ignorados sem revelar conteúdo.
- Sem passos disponíveis, o acionador não é exibido.
- Textos são curtos, em português do Brasil e orientados ao resultado.
- O conteúdo explica consequências e diferenças importantes, não detalhes de
  implementação.

A ajuda contextual contém apenas texto. Deve abrir por hover e foco, funcionar
por clique ou toque, fechar com Escape e manter associação acessível com o
acionador.

## Proteção e aceite

Componentes reutilizáveis exigem testes de estado, teclado, foco, alvos ausentes
e responsividade. Cada página guiada deve possuir um teste funcional que abra o
tour e confirme a associação com um alvo real. Superfícies representativas
também entram nas suítes visual e axe em desktop e mobile.

Mudanças de guia seguem as validações de UI do
[guia de contribuição](../CONTRIBUTING.md) e da
[qualidade visual e acessibilidade](ui-quality.md). A feature só está concluída
quando guia, testes e conteúdo chegam no mesmo diff.
