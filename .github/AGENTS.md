# Instruções locais — GitHub Actions

Estas regras complementam o `AGENTS.md` raiz. Consulte a
[estratégia de testes](../docs/testing-strategy.md#correspondência-com-o-ci).

- Mantenha `contents: read` e amplie permissões somente com justificativa.
- Fixe Actions de terceiros por SHA completo e mantenha comentário com a versão.
- Use Node e pnpm das fontes versionadas e instalação por `pnpm bootstrap`.
- Cache de dependências deve depender exclusivamente de `pnpm-lock.yaml`.
- Não adicione secrets, Supabase vinculado, banco hospedado ou deploy aos jobs de
  qualidade sem autorização e desenho específicos.
- Preserve timeouts, cancelamento por pull request, artifacts diagnósticos e
  cleanup `if: always()` quando aplicável.
- Um comando local documentado deve continuar equivalente ao comportamento de
  cada job.
