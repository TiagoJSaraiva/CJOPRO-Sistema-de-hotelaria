# Lição 4 — Manutenção e governança do quarto 103

## Objetivo e conceitos

Conduzir o quarto 103 de uma retenção técnica até a prontidão. Concluir a ordem,
aprovar inspeção técnica, liberar o bloqueio e inspecionar o quarto são ações
distintas.

## Preparação

```powershell
pnpm training reset --scenario governance-maintenance
```

Contas em ordem: técnico, supervisor de manutenção, governança e gerente (como
segundo inspetor quando indicado). Use a data operacional congelada.

## Estado inicial e missão

O quarto 103 está bloqueado e ligado à ocorrência `MAN-001103`; a ordem da
fechadura está atribuída ao técnico. Torne o quarto pronto sem atalhos.

## Passos orientados

1. Como técnico, abra Manutenção e conclua checklist, diagnóstico e serviço.
2. Solicite inspeção; não tente inspecionar seu próprio trabalho.
3. Como supervisor, abra a ocorrência, confira evidências e aprove a inspeção.
4. Use **Liberar** com justificativa real. Confirme a mensagem de que uma
   inspeção final de governança foi criada.
5. Como governança, abra o cartão do 103, execute checklist e registre condição.
6. Troque de usuário para a inspeção final se quem executou não puder aprovar.

Erros propositais: liberar com ordem aberta; liberar sem justificativa; técnico
inspecionar a própria ordem. Todos devem falhar sem deixar o quarto parcialmente
liberado.

Verificação final: bloqueio liberado, ciclo de governança aprovado e quarto
pronto. No banco, conclusão, inspeção, liberação e criação do ciclo são
auditáveis; liberação e transição são atômicas.

<details><summary>Solução</summary>

No cartão **Retido pela manutenção**, use **Abrir ocorrência MAN-001103**. A
liberação técnica remove a retenção, mas somente a inspeção de governança torna
o quarto pronto.

</details>

Para repetir: `pnpm training reset --scenario governance-maintenance`.
