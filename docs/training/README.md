# Curso operacional do Hotel Aurora

Este curso transforma o ambiente local em um hotel-escola reproduzível. Cada
lição começa com um reset completo, congela o relógio operacional e usa apenas
dados sintéticos. O Hotel Aurora é a escola; o Hotel Horizonte serve para provar
que usuários e dados de hotéis diferentes não se misturam.

## Antes de começar

1. Leia a [preparação do ambiente](setup.md).
2. Consulte as [contas e responsabilidades](accounts.md).
3. Entenda o [relógio e a restauração dos cenários](clock-and-reset.md).
4. Mantenha o [glossário](glossary.md) aberto durante os exercícios.

Senha local compartilhada por todas as contas didáticas: `Hotelaria123!`. Ela
nunca deve ser usada fora do ambiente local.

## Currículo

| Lição                                                      | Cenário                  | Resultado operacional                               |
| ---------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| [1. Orientação](lesson-01-orientation.md)                  | `orientation`            | reconhecer hotel ativo, função e pendências         |
| [2. Reservas e chegada](lesson-02-reservations-arrival.md) | `reservations-arrival`   | preparar e realizar uma chegada                     |
| [3. Canais de reserva](lesson-03-channels.md)              | `channels`               | distinguir site direto, conexão, mapeamento e inbox |
| [4. Quarto 103](lesson-04-governance-maintenance.md)       | `governance-maintenance` | conduzir manutenção até inspeção de governança      |
| [5. Garantia](lesson-05-warranty.md)                       | `warranty`               | registrar uma decisão auditável de garantia         |
| [6. Consumos e conta](lesson-06-consumption-account.md)    | `consumption-account`    | classificar consumo e conferir pagador              |
| [7. Estoque e frigobar](lesson-07-inventory.md)            | `inventory-procurement`  | operar posição, lote, contagem e reposição          |
| [8. Compras](lesson-08-procurement.md)                     | `inventory-procurement`  | solicitar, aprovar, receber e conferir compra       |
| [9. Caixa e fechamento](lesson-09-cash-close.md)           | `cash-close`             | contar às cegas e fechar um dia, inclusive zerado   |
| [10. Parceiros](lesson-10-partner-settlement.md)           | `partner-settlement`     | preparar e contestar uma apuração                   |
| [11. Turno integrado](lesson-11-integrated-shift.md)       | `integrated-shift`       | coordenar as oito funções do hotel                  |

As soluções ficam recolhidas no final de cada lição. O objetivo não é decorar
cliques, mas explicar por que cada função pode ou não executar uma ação.

Uma lição só está pronta quando o comando de preparação cria todos os dados e
permissões necessários, cada link de contexto abre a entidade correta, as ações
descritas podem ser concluídas e o resultado final pode ser conferido na
interface. Os verificadores SQL protegem o estado inicial, mas não substituem a
jornada HTTP e visual ponta a ponta.

Se algo divergir do esperado, consulte [solução de problemas](troubleshooting.md).
