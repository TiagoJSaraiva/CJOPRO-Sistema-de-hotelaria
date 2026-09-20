# Solução de problemas do curso

## Docker ou Supabase não inicia

Abra o Docker Desktop, aguarde o engine e execute `pnpm db:start`. Se as portas
54321 ou 54322 estiverem ocupadas, encerre o processo conflitante. Não altere o
script para apontar a um projeto remoto.

## A página Treinamento local não aparece

Confirme `LOCAL_TRAINING_ENABLED=true` no backend e no PMS, reinicie ambos,
selecione Hotel Aurora e use `gerente.aurora@hotelaria.local`.

## A data da tela não é a esperada

Execute `pnpm training clock show`. Se o cenário ou modo estiver diferente,
restaure a lição. Não use `resume` durante um exercício.

## Um botão não aparece

A interface é condicionada por função e estado. Confira a conta indicada na
lição, o hotel ativo e se a etapa anterior foi concluída. Isso normalmente é uma
proteção de segregação, não falta de carregamento.

## O quarto 103 continua retido

Abra a ocorrência pelo cartão. Todas as ordens não canceladas devem estar
concluídas e inspeções técnicas obrigatórias aprovadas. Depois da liberação,
conclua a inspeção final na Governança.

## O alerta de garantia continua aberto

A decisão precisa corresponder à vigência atual. Renovação muda a data; uma
correção deve substituir a decisão anterior. Atualize a página após salvar.

## O seletor de posição está vazio

Posição é produto + local. Quem possui permissão usa **Ativar produto em local**;
os demais devem solicitar a ação ao responsável de estoque.

## Não consigo fechar o dia

Leia os impedimentos do fechamento: feche/cancele todas as sessões e associe
movimentos em dinheiro a uma sessão. Financeiro prepara e outra pessoa — o
gerente — aprova. Se a projeção mudou, prepare novamente.
