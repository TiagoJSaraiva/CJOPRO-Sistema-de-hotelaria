# Responsabilidades dos Ends

## apps/site (Next.js)

Responsabilidades:
- Renderizar o site institucional.
- Exibir conteúdo publico, paginas de marketing, contato com cliente, etc.
- Consumir APIs do backend quando necessario.

Restrições:
- Não deve haver logica de negócio principal.
- Não deve acessar banco de dados diretamente (operações centralizadas no backend em node).
- APIs internas do Next (route handlers) devem ser usadas apenas como BFF, proxy ou casos simples de composicão.

Motivações de escolha da stack:
- Superioridade em SEO a respeito de React puro
- Segurança (sem exposição de nada no frontend) e escalabilidade/solidez do react
- Deploy e infra muito simples usando vercel

## apps/pms (Next.js)

Responsabilidades:
- Renderizar o painel PMS e fluxos internos da operação.
- Gerenciar estado de interface e navegação do sistema.
- Consumir APIs do backend dedicado para operacoes de domínio.

Restrições:
- Não concentrar regras de negocio no Next.
- Não deve conter lógica de processamento de dados (como validação de domínio) por sí só. A interface deve ser "burra", não deve conter lógica além de validação básica, como por exemplo, validar dados inseridos em campo para garantir que sigam um padrão, como só possuir caracteres alfanuméricos.

## apps/backend-service (Node + Fastify)

Responsabilidades:
- Ser backend unico para lógica de negocio central.
- Expor APIs de domínio para PMS e site.
- Orquestrar acesso a banco, autenticação/autorização e integrações externas.

Restrições:
- Não renderiza interface ou fornece html.
- Não deve conter acoplamento com detalhes de UI dos frontends.

## apps/booking-engine-service (Node + Fastify)

Responsabilidades:
- Executar fluxo especifico do motor de reservas/simulacao.
- Expor endpoints do proprio contexto de booking engine.
- Integrar com backend-service quando necessaário por contrato definido.

Restrições:
- Não assumir nenhuma responsabilidades do PMS.

## packages/shared

Responsabilidades:
- Compartilhar tipos, contratos e utilitários puros entre os apps.

