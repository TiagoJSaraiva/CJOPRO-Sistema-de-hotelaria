# Relógio operacional e restauração

O relógio operacional controla datas de negócio do curso. O relógio real segue
avançando para autenticação, sessões, rate limiting, URLs assinadas e auditoria.

## Comandos

```powershell
pnpm training clock show
pnpm training clock freeze
pnpm training clock set 2026-09-19T14:00:00-03:00
pnpm training clock advance 4 hours
pnpm training clock advance 1 days
pnpm training clock resume
```

`advance` funciona somente com relógio congelado. As ações exigem versão atual e
geram histórico imutável com justificativa. Pela interface, somente o gerente
do Aurora vê **Treinamento local**.

## Restaurar uma lição

```powershell
pnpm training reset --scenario cash-close
pnpm training verify --scenario cash-close
```

O comando valida Docker, Supabase e a URL local, executa o reset local, aplica
somente a fixture escolhida, registra nome e versão do cenário e congela o Aurora
no instante de preparação. Cada cenário é independente.

`verify --scenario` confere cenário, relógio, contas, permissões, isolamento e
os pré-requisitos da lição atualmente carregada. `verify --all` recria e
verifica todos os cenários; portanto, o último cenário fica carregado ao final.

Retomar o tempo real pode tornar prazos vencidos imediatamente. A página não
oferece reset porque essa operação destrói os dados locais; ela fica restrita ao
terminal, onde o alvo pode ser verificado antes da confirmação.

Veja também o [contrato temporal auditado](time-contract.md).
