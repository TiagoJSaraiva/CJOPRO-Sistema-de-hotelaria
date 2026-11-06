begin;
select plan(31);

-- Dinheiro só entra com a sessão de caixa de quem recebe. Sem isso, a transação ficava sem sessão
-- e o fechamento do dia travava sem saída. Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '91000000-0000-4000-8000-000000000002'::uuid as stay,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  '80000000-0000-4000-8000-000000000010'::uuid as finance,
  '81200000-0000-4000-8000-000000000001'::uuid as register,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as day;

select ok(
  exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
    where ur.user_id='80000000-0000-4000-8000-000000000004' and p.name='operate_cash_register'),
  'a recepção opera o próprio caixa'
);

-- Conta da estadia.
select throws_ok(
  $$select public.create_stay_payment_batch(hotel,stay,reception,'[{"payment_method":"cash","amount":10}]'::jsonb,
    'a6000000-0000-4000-8000-000000000001',(select account_version from public.stays where id=stay),'regular','Sem sessão') from ctx$$,
  'P0001','cash_session_required','a conta recusa dinheiro de quem não tem sessão aberta'
);
select is(
  (select public.create_stay_payment_batch(hotel,stay,reception,'[{"payment_method":"pix","amount":10}]'::jsonb,
    'a6000000-0000-4000-8000-000000000002',(select account_version from public.stays where id=stay),'regular','Pix')->>'result' from ctx),
  'ok','pix não depende de sessão'
);
select is(
  (select public.open_cash_session(hotel,register,reception,jsonb_build_object(
    'opening_float',100,'idempotency_key','a6000000-0000-4000-8000-000000000003'))->>'result' from ctx),
  'ok','a recepção abre a própria sessão'
);
create temporary table sess on commit drop as
select s.id from public.cash_sessions s join ctx on s.operator_id=ctx.reception and s.status='open';
select is(
  (select public.create_stay_payment_batch(hotel,stay,reception,'[{"payment_method":"cash","amount":10}]'::jsonb,
    'a6000000-0000-4000-8000-000000000004',(select account_version from public.stays where id=stay),'regular','Com sessão')->>'result' from ctx),
  'ok','com sessão, a conta aceita dinheiro'
);
select is(
  (select cash_session_id from public.financial_transactions t join ctx on t.created_by=ctx.reception where lower(t.payment_method)='cash' and t.category='STAY_PAYMENT'),
  (select id from sess),'o pagamento fica na sessão de quem recebeu'
);
select is(
  (select expected_cash from public.cash_sessions where id=(select id from sess)),
  110::numeric,'o dinheiro entra no esperado'
);
select is(
  (select count(*)::int from public.cash_movements where cash_session_id=(select id from sess) and kind='receipt' and cash_delta=10),
  1,'o recebimento vira um movimento de caixa'
);
select throws_ok(
  $$select public.create_stay_refund(hotel,stay,manager,1,'cash','Reembolso sem sessão','a6000000-0000-4000-8000-000000000005',
    (select account_version from public.stays where id=stay),
    p_original_tender_id => (select tender.id from public.stay_payment_batch_tenders tender join public.stay_payment_batches batch on batch.id=tender.batch_id
      where batch.idempotency_key='a6000000-0000-4000-8000-000000000004')) from ctx$$,
  'P0001','cash_session_required','reembolso em dinheiro também exige sessão'
);

-- Lançamento manual.
insert into public.financial_transactions(id,hotel_id,type,category,amount,currency,description,status,payment_method,created_by)
select 'a6100000-0000-4000-8000-000000000001',hotel,'EXPENSE','MANUAL',7,'BRL','Conta futura','PENDING','cash',finance from ctx;
select is(
  (select count(*)::int from public.cash_movements where financial_transaction_id='a6100000-0000-4000-8000-000000000001'),
  0,'lançamento pendente não movimenta caixa'
);
select is(
  (select count(*)::int from ctx, jsonb_array_elements(public.daily_close_projection(hotel,day)->'blockers') b
    where b->>'entity_id'='a6100000-0000-4000-8000-000000000001'),
  0,'lançamento pendente não impede o fechamento'
);
select throws_ok(
  $$update public.financial_transactions set status='COMPLETED' where id='a6100000-0000-4000-8000-000000000001'$$,
  'P0001','cash_session_required','concluir em dinheiro sem sessão é recusado'
);
update public.financial_transactions set status='COMPLETED',cash_session_id=(select id from sess) where id='a6100000-0000-4000-8000-000000000001';
select is(
  (select cash_delta from public.cash_movements where financial_transaction_id='a6100000-0000-4000-8000-000000000001'),
  -7::numeric,'concluir na sessão movimenta o caixa uma vez'
);
select is(
  (select expected_cash from public.cash_sessions where id=(select id from sess)),
  103::numeric,'a despesa sai do esperado'
);
select throws_ok(
  $$update public.financial_transactions set amount=1 where id='a6100000-0000-4000-8000-000000000001'$$,
  'P0001','cash_transaction_immutable','o valor de um movimento em dinheiro não muda'
);
select throws_ok(
  $$update public.financial_transactions set payment_method='pix' where id='a6100000-0000-4000-8000-000000000001'$$,
  'P0001','cash_transaction_immutable','o meio de um movimento em dinheiro não muda'
);
select throws_ok(
  $$delete from public.financial_transactions where id='a6100000-0000-4000-8000-000000000001'$$,
  'P0001','cash_transaction_immutable','um movimento em dinheiro não é apagado'
);
select throws_ok(
  $$insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method)
    select hotel,'INCOME','MANUAL',1,'BRL','Sem autor','COMPLETED','cash' from ctx$$,
  'P0001','cash_session_required','dinheiro concluído sem sessão nunca é gravado'
);

-- Recebível de empresa e consumo pós-checkout: os pais vêm sem gatilhos, como em rpc_runtime_regressions.
set local session_replication_role = replica;
insert into public.corporate_receivables (id,hotel_id,corporate_account_id,authorization_id,stay_id,amount,currency,due_on,version)
select 'a6200000-0000-4000-8000-000000000001',hotel,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),100,'BRL',current_date,1 from ctx;
insert into public.post_checkout_consumption_cases (id,hotel_id,stay_id,status,occurred_at,report,created_by,version)
select 'a6300000-0000-4000-8000-000000000001',hotel,gen_random_uuid(),'collection_pending',now(),'Relato',manager,1 from ctx;
insert into public.post_checkout_supplemental_accounts (id,hotel_id,case_id,amount,currency)
select 'a6310000-0000-4000-8000-000000000001',hotel,'a6300000-0000-4000-8000-000000000001',100,'BRL' from ctx;
select is(
  (select public.pay_corporate_receivable(hotel,'a6200000-0000-4000-8000-000000000001',finance,1,'[{"amount":40,"payment_method":"cash"}]','a6200000-0000-4000-8000-0000000000a1')->>'result' from ctx),
  'cash_session_required','recebível de empresa recusa dinheiro sem sessão'
);
select is(
  (select public.pay_post_checkout_consumption_case(hotel,'a6300000-0000-4000-8000-000000000001',finance,1,'[{"amount":40,"payment_method":"cash"}]','a6300000-0000-4000-8000-0000000000a1')->>'result' from ctx),
  'cash_session_required','pós-checkout recusa dinheiro sem sessão'
);
select is(
  (select public.pay_corporate_receivable(hotel,'a6200000-0000-4000-8000-000000000001',reception,1,'[{"amount":40,"payment_method":"cash"}]','a6200000-0000-4000-8000-0000000000a2')->>'result' from ctx),
  'ok','com sessão, o recebível aceita dinheiro'
);
select results_eq(
  $$select amount,cash_session_id,type::text from public.financial_transactions where category='CORPORATE_RECEIVABLE'$$,
  $$select 40::numeric(12,2),id,'INCOME'::text from sess$$,
  'o recebimento de empresa entra nas transações, na sessão de quem recebeu'
);
select is(
  (select public.pay_post_checkout_consumption_case(hotel,'a6300000-0000-4000-8000-000000000001',reception,1,'[{"amount":40,"payment_method":"cash"}]','a6300000-0000-4000-8000-0000000000a2')->>'result' from ctx),
  'ok','com sessão, o pós-checkout aceita dinheiro'
);
select results_eq(
  $$select amount,cash_session_id,type::text from public.financial_transactions where category='POST_CHECKOUT_CONSUMPTION'$$,
  $$select 40::numeric(12,2),id,'INCOME'::text from sess$$,
  'o recebimento pós-checkout entra nas transações, na sessão de quem recebeu'
);

-- Dia já travado: um pagamento antigo, gravado antes da regra, ainda sem sessão.
select is(
  (select public.create_stay_payment_batch(hotel,stay,manager,'[{"payment_method":"cash","amount":5}]'::jsonb,
    'a6000000-0000-4000-8000-000000000006',(select account_version from public.stays where id=stay),'regular','Antigo')->>'result' from ctx),
  'ok','prepara o pagamento antigo, sem gatilhos'
);
update public.financial_transactions t set business_date=ctx.day,paid_at=now(),status='COMPLETED'
from ctx where t.created_by=ctx.manager and lower(t.payment_method)='cash' and t.category='STAY_PAYMENT';
set local session_replication_role = origin;
create temporary table orphan on commit drop as
select t.id from public.financial_transactions t join ctx on t.created_by=ctx.manager where lower(t.payment_method)='cash' and t.category='STAY_PAYMENT';

select is(
  (select public.adopt_cash_transaction(hotel,(select id from orphan),finance,jsonb_build_object('reason','Sem sessão'))->>'result' from ctx),
  'cash_session_required','regularizar exige a sessão de quem assume o dinheiro'
);
select is(
  (select public.adopt_cash_transaction(hotel,(select id from orphan),reception,jsonb_build_object('reason','  '))->>'result' from ctx),
  'reason_required','regularizar exige justificativa'
);
select is(
  (select public.adopt_cash_transaction('10000000-0000-4000-8000-000000000002',(select id from orphan),reception,jsonb_build_object('reason','Outro hotel'))->>'result' from ctx),
  'not_found','outro hotel não enxerga a transação'
);
select is(
  (select public.adopt_cash_transaction(hotel,(select id from orphan),reception,jsonb_build_object('reason','Dinheiro guardado no cofre da recepção'))->>'result' from ctx),
  'ok','a sessão assume o dinheiro antigo'
);
select is(
  (select expected_cash from public.cash_sessions where id=(select id from sess)),
  108::numeric,'o esperado passa a incluir o dinheiro assumido'
);
select is(
  (select count(*)::int from ctx, jsonb_array_elements(public.daily_close_projection(hotel,day)->'blockers') b where b->>'kind'='cash_without_session'),
  0,'o dia deixa de estar travado por dinheiro sem sessão'
);

select * from finish();
rollback;
