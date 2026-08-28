# Qualidade visual e acessibilidade do PMS

## Escopo automatizado

O Chromium valida quatro superfícies em desktop (1440 × 960) e no viewport Pixel 5: login, calendário com painel de reserva aberto, checkout concluído e financeiro filtrado. O backend mockado e o relógio fixo tornam os dados, datas e estados reproduzíveis sem banco ou Supabase.

Comandos na raiz:

- `pnpm test:visual`: compara os oito estados com os baselines da plataforma atual.
- `pnpm test:a11y`: audita as mesmas superfícies, inclusive painel, menu e modal abertos.
- `pnpm test:visual:update`: atualiza somente snapshots alterados da plataforma atual.
- `pnpm test:e2e`: executa o conjunto funcional, visual e de acessibilidade completo.

## Política de baselines

Os snapshots ficam em `apps/pms/__tests__/e2e/__screenshots__/{platform}/{projectName}`. `win32` representa o desenvolvimento local e `linux`, o runner Ubuntu 24.04 do CI. Uma execução normal nunca cria nem atualiza imagens: baseline ausente ou divergente é falha.

Use `pnpm test:visual:update` apenas depois de confirmar que a alteração visual é intencional. Antes de versionar:

1. inspecione lado a lado a referência, a imagem atual e o diff;
2. confirme conteúdo, alinhamento, espaçamento, contraste e estados responsivos;
3. execute novamente `pnpm test:visual` sem a opção de atualização;
4. inclua na revisão a justificativa para cada baseline modificado.

Duas atualizações consecutivas sem mudança de UI não devem alterar arquivos. Nunca use atualização automática de snapshots no CI.

## Auditoria axe

A fixture compartilhada executa `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` e `wcag22aa`. Qualquer violação bloqueia a suíte; não há elementos excluídos nem regras desativadas. O JSON integral de cada estado é anexado ao relatório Playwright e preservado nos artefatos de falha.

Para diagnosticar, localize o `id`, os seletores em `nodes[].target`, o HTML e o `failureSummary` no JSON. Corrija a causa na interface e repita `pnpm test:a11y`; não diminua o conjunto de tags para tornar a execução verde. A automação cobre apenas problemas detectáveis por regras programáticas e não equivale a uma certificação de acessibilidade.

## Checklist manual

- Percorrer toda a superfície com Tab e Shift+Tab, sem armadilhas ou saltos inesperados.
- Acionar links, botões, menus e modais apenas com teclado; validar Escape e retorno do foco.
- Confirmar que o foco permanece visível em fundo claro e colorido.
- Usar o link “Pular para o conteúdo” e conferir landmarks e nomes de navegação com leitor de tela.
- Aplicar zoom de 200% e verificar leitura, reflow, rolagem e ausência de conteúdo encoberto.
- Conferir mensagens de erro, labels, ordem de leitura e mudanças de estado anunciadas.
- Repetir a revisão nos viewports desktop e mobile.

## Artefatos de falha

O relatório HTML fica em `node_modules/.cache/pms-playwright-report`. Resultados, traces, screenshots atual/diff e JSONs axe ficam em `node_modules/.cache/pms-playwright-results`; o baseline esperado permanece na pasta versionada. No GitHub Actions, os três conjuntos são enviados por sete dias somente quando o job falha.
