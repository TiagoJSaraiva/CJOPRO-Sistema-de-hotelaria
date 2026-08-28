# Instruções locais — scripts

Estas regras complementam o `AGENTS.md` raiz. Consulte o
[catálogo de comandos](../docs/commands.md).

- Use somente APIs nativas do Node, salvo quando a tarefa autorizar uma nova
  dependência de tooling.
- Scripts públicos devem funcionar em Windows e Linux, localizar a raiz a partir
  de `import.meta.url` e não depender do diretório do shell.
- Ao chamar pnpm, reutilize `npm_execpath` quando disponível e forneça fallback
  seguro por plataforma.
- Falhas devem retornar código diferente de zero e explicar problema, alvo e ação
  corretiva sem imprimir secrets.
- Operações destrutivas devem validar caminhos e alvos antes de agir. Banco deve
  usar somente comandos locais guardados pelo orquestrador existente.
- Adicione o arquivo a `lint:scripts`, documente o comando e cubra sucesso e
  falhas representativas em cópia temporária.
