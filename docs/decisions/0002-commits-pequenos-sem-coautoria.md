# 0002: Commits pequenos, sem coautoria

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** processo

## Decisão

Agentes criam commits pequenos, um por assunto, na `main`, sem branch. Nenhum commit leva
`Co-Authored-By` nem outra declaração de coautoria. Permissão de commit não autoriza `push`, merge,
rebase nem deploy.

## Motivo

O histórico tinha commits enormes, juntando muitos módulos, o que dificulta revisar e reverter.

## Alternativas recusadas

- Agente só sugerir a mensagem, regra usada de 04/11 a 07/11: foi ela que gerou os commits enormes.

## Consequências

O commit `60aedc9` permanece grande, porque separá-lo reescreveria histórico já enviado.

## Prova

Instrução sem teste automatizado: [Commits durante implementações](../../AGENTS.md#commits-durante-implementações).
