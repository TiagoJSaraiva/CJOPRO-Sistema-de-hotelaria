# Lição 2 — Reserva, garantia e chegada

## Objetivo e conceitos

Preparar a reserva confirmada `LOCAL-AUR-001`, registrar seu sinal, coletar a
pré-chegada e realizar check-in. Quantidade significa **número de hóspedes**:
o titular responde pela reserva, mas os acompanhantes também ficam hospedados.

## Preparação

Mantenha PMS, backend, site público e Booking API locais em execução conforme o
[guia de desenvolvimento](../development-guide.md). O PMS usa `PUBLIC_SITE_URL`
para abrir o site público; localmente, o padrão é `http://localhost:3000`.

```powershell
pnpm training reset --scenario reservations-arrival
pnpm training verify --scenario reservations-arrival
```

O reset apaga e recria somente os dados locais. Este cenário começa às **14h no
fuso America/Sao_Paulo**, independentemente do horário real de execução.
Use a data operacional exibida no relógio. Entre como recepção; o gerente só
é necessário quando houver uma decisão segregada, não para esta chegada normal.

## Estado inicial e missão

`LOCAL-AUR-001` chega na data operacional, com dois adultos, duas noites em
Standard, quarto 101 atribuído, diária contratada de R$ 250 e total de R$ 500.
O sinal exigido é a **primeira diária (R$ 250)** e ainda não foi recebido.
O quarto 101 está pronto; o 103 possui um bloqueio de limpeza programada.

## Passos orientados

1. Em **Reservas → Calendário**, abra `LOCAL-AUR-001`.
2. Em **Dados da estadia** confira o titular e o quarto. Em **Preparação da
   chegada**, confira **Quantidade de hóspedes: 2**, dois adultos, categoria
   Standard e as duas diárias de R$ 250. Confira chegada hoje e saída dois dias
   depois. Antes do sinal, o valor contratado é R$ 500 e o saldo é R$ 500.
3. Confira **Garantia: primeira diária**, **Sinal exigido: R$ 250** e
   **Recebido: R$ 0**. Preencha **Sinal via PIX (R$)** com `250`, use a referência
   sintética `PIX-LESSON-02` e clique em **Registrar sinal via PIX**. Confira
   recebido de R$ 250 e restante de sinal zero. O sinal é um adiantamento:
   não precisa pagar os R$ 500 para executar esta lição. Não registre o mesmo
   PIX também como pagamento da estadia; o crédito será transferido no check-in.
4. Conserve o quarto **101**: ele é Standard, comporta duas pessoas e atende ao
   período contratado. Leia **Prontidão do quarto**: ocupação com chegada
   prevista, governança pronta e manutenção sem interdição. “Disponível”
   significa ausência de conflito de reserva; “pronto” significa que limpeza,
   inspeção e manutenção permitem receber hóspedes.
   Como erro proposital, encontre o **103** no calendário e tente selecionar uma
   data da faixa **Limpeza programada**. O bloqueio deve explicar o motivo e o
   período. Isso não troca o quarto da reserva. Não use exceção para contorná-lo.
5. No painel de `LOCAL-AUR-001`, clique em **Gerar link de pré-chegada** e em
   **Abrir pré-chegada**. Na página pública, preencha titular com dados
   exclusivamente sintéticos: nome `Ana Treinamento`, tipo de documento
   `treinamento`, número `LOCAL-ANA-02`, nascimento `1990-01-10`; informe
   acompanhante `Bruno Treinamento` e horário previsto `14:00`.
   Deixe o pedido especial vazio para o caminho principal. Clique em
   **Salvar pré-chegada**. Volte ao PMS e clique em
   **Atualizar dados da pré-chegada**; confira o envio, horário e as duas pessoas.
   O link vale 24 horas reais; regenerar revoga o anterior. O formulário não
   realiza check-in e não é obrigatório para toda chegada atendida pela recepção.
6. Confira o **Horário operacional**, a janela **14h–22h** e a prontidão.
   Clique em **Check-in** somente quando elegível. Se houver bloqueio,
   leia o motivo visível e resolva sua origem. Exceção gerencial não ignora
   a janela do hotel nem interdição de manutenção.

## Verificação final

Confira a estadia em andamento, ocupação do quarto 101 e timestamp de chegada
coerente com 14h no fuso do hotel. Na conta da estadia, confira o crédito
**Sinal da reserva transferido na chegada** de R$ 250 e saldo de R$ 250.
A diária continua R$ 250 e o total contratado continua R$ 500; a transferência
não é um segundo recebimento.

O verificador SQL protege o **estado inicial**. Depois do check-in não o use
como confirmação de conclusão: confira o resultado na interface.

<details><summary>Solução</summary>

A reserva permanece no 101. Registre um único sinal de R$ 250 via PIX, envie
titular e acompanhante pelo link, atualize o painel e faça check-in às 14h
operacionais. O 103 serve para observar o bloqueio explicado, não para a chegada.

</details>

Para repetir: `pnpm training reset --scenario reservations-arrival`, seguido de
`pnpm training verify --scenario reservations-arrival`. Isso remove o progresso local.
