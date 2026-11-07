# Plano: depurar tudo antes de novas features

Plano aceito pelo usuário em 2026-11-04. O andamento fica em [status](../status.md).

## Objetivo

Validar que o que já foi construído funciona antes de implementar novas features. As lições
de `docs/training` continuam sendo o critério de certo e errado, mas passam a ser executadas
automaticamente contra o sistema real. O usuário fica com as decisões de negócio e com a
avaliação de clareza.

## Fases

| Fase | Conteúdo                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 0    | Congelar features, obter a linha de base e criar o registro único de bugs                                   |
| 1    | Criar `pnpm test:journeys`, com navegador, PMS, site, backend e Supabase local                              |
| 2    | Varreduras: perfis e páginas, contratos, invariantes de dados e relógio                                     |
| 3    | Escrever regras por domínio, com aprovação do usuário, e roteiros dos fluxos sem lição                      |
| 4    | Depurar por domínio: registrar tudo, agrupar por causa, escrever o teste que falha e corrigir a classe toda |
| 5    | Automatizar a lição 11 e fazer a passada manual do usuário                                                  |

Severidades: S1 para dinheiro, dados ou isolamento; S2 para fluxo bloqueado; S3 para
informação errada; S4 para clareza.

Mudar uma regra aprovada é decisão explícita do usuário, nunca efeito colateral de uma correção.

## Critérios de saída

- Todas as jornadas e invariantes passam em 3 execuções seguidas a partir do reset.
- A varredura de perfis e páginas e a validação de contratos não acusam nada.
- Nenhum bug S1 ou S2 está aberto, e os S3 e S4 restantes foram aceitos pelo usuário.
- Toda página tem um dono: uma jornada ou uma exclusão justificada.
- `pnpm check:ci` e `pnpm test:db` passam.

## Ajuste de 2026-11-07

Na restauração rápida do banco, se adotada, a última das três rodadas usa sempre o reset real,
para manter o critério "a partir do reset".
