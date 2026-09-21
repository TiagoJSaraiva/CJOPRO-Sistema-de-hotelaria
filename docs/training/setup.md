# Preparação do ambiente de treinamento

## Requisitos

- Node.js e pnpm nas versões indicadas na raiz do repositório;
- Docker Desktop em execução;
- dependências instaladas com `pnpm bootstrap`;
- arquivos `.env` locais do backend e PMS;
- `LOCAL_TRAINING_ENABLED=true` nos dois aplicativos;
- `SUPABASE_URL=http://127.0.0.1:54321` no backend.

A capacidade de treinamento recusa produção, HTTPS, outra porta e qualquer host
que não seja `localhost` ou `127.0.0.1`. Ela não consulta nem altera o Supabase
hospedado.

## Iniciar

```powershell
pnpm db:start
pnpm training scenarios
pnpm training reset --scenario orientation --yes
pnpm training verify --scenario orientation
pnpm dev:pms-backend
```

O reset informa que os dados locais serão destruídos e exige digitar `RESETAR`.
Em CI ou automação local revisada, `--yes` pula apenas essa pergunta; todas as
guardas de destino continuam ativas.

Abra `http://localhost:3001`, entre com uma conta da
[matriz de funções](accounts.md) e selecione Hotel Aurora como hotel ativo.

## Verificação rápida

```powershell
pnpm training clock show
```

O JSON deve mostrar `scenario_key: "orientation"`, `clock_mode: "frozen"` e os
campos separados `operational_now` e `real_now`.

Antes de iniciar outra lição, execute o `reset` indicado nela e a respectiva
verificação. Para auditar todas as fixtures de uma vez, use
`pnpm training verify --all`; esse comando é demorado e destrutivo apenas para o
banco local, pois recria cada cenário em sequência.

## Segurança dos dados

Os cenários contêm somente nomes, documentos, empresas e contatos fictícios.
Não importe dados reais. Nunca use `--linked`, `db push` ou credenciais remotas
para executar este curso.
