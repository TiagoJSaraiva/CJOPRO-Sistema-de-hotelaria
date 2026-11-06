begin;
select plan(23);

-- O hotel decide e registra pelo próprio relógio (docs/training/time-contract.md). Com o relógio à
-- frente do tempo real, cada ação abaixo deve carimbar a hora do hotel, não a do servidor.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '91000000-0000-4000-8000-000000000002'::uuid as stay,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  '81200000-0000-4000-8000-000000000001'::uuid as register,
  now()+interval '3 days' as op;

insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
select hotel,'frozen',op from ctx
on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,
  version=public.hotel_training_environments.version+1;

-- Conta da estadia: lote de pagamento e reembolso.
select is(
  (select public.create_stay_payment_batch(hotel,stay,manager,'[{"payment_method":"pix","amount":10}]'::jsonb,
    'a9600000-0000-4000-8000-000000000001',(select account_version from public.stays where id=stay),'regular','Pix')->>'result' from ctx),
  'ok','o lote de pagamento é aceito'
);
select is(
  (select t.paid_at from public.financial_transactions t join ctx on t.stay_id=ctx.stay and t.description='Pix'),
  (select op from ctx),'o lote carimba o pagamento na hora do hotel'
);
select is(
  (select t.business_date from public.financial_transactions t join ctx on t.stay_id=ctx.stay and t.description='Pix'),
  (select public.hotel_operational_date(hotel) from ctx),'o pagamento conta no dia do hotel, que é o dia que será fechado'
);
select is(
  (select e.posted_at from public.stay_folio_entries e join public.financial_transactions t on t.id=e.financial_transaction_id
   join ctx on t.stay_id=ctx.stay and t.description='Pix'),
  (select op from ctx),'o crédito do lote entra na conta na hora do hotel'
);
select is(
  (select public.create_stay_refund(hotel,stay,manager,1,'pix','Reembolso no relógio do hotel','a9600000-0000-4000-8000-000000000002',
    (select account_version from public.stays where id=stay),
    p_original_tender_id => (select tender.id from public.stay_payment_batch_tenders tender
      join public.stay_payment_batches batch on batch.id=tender.batch_id
      where batch.idempotency_key='a9600000-0000-4000-8000-000000000001'))->>'result' from ctx),
  'ok','o reembolso é aceito'
);
select is(
  (select t.paid_at from public.financial_transactions t join ctx on t.stay_id=ctx.stay and t.type='REFUND'),
  (select op from ctx),'o reembolso carimba a saída na hora do hotel'
);

-- Sessão de caixa, do início ao fim.
select is(
  (select public.open_cash_session(hotel,register,reception,jsonb_build_object(
    'opening_float',100,'idempotency_key','a9600000-0000-4000-8000-000000000003'))->>'result' from ctx),
  'ok','a sessão abre'
);
create temporary table sess on commit drop as
select s.id,s.version,s.opened_at from public.cash_sessions s join ctx on s.operator_id=ctx.reception and s.status='open';
select is((select opened_at from sess),(select op from ctx),'a abertura da sessão fica na hora do hotel');
select is(
  (select m.occurred_at from public.cash_movements m where m.cash_session_id=(select id from sess) limit 1),
  (select op from ctx),'o movimento de abertura fica na hora do hotel'
);
select is(
  (select public.act_cash_session(hotel,(select id from sess),reception,jsonb_build_object(
    'action','count','expected_version',(select version from sess),'counted_amount',100))->>'result' from ctx),
  'ok','a sessão fecha pela contagem'
);
select is(
  (select closed_at from public.cash_sessions where id=(select id from sess)),
  (select op from ctx),'o fechamento da sessão fica na hora do hotel'
);

-- Atraso de pedidos: o prazo já passou no relógio do hotel, embora ainda esteja no futuro real.
insert into public.consumption_service_orders(id,hotel_id,stay_id,reservation_id,point_id,mode,status,expected_at,idempotency_key,request_fingerprint,created_by)
select 'a9600000-0000-4000-8000-000000000004',hotel,stay,(select reservation_id from public.stays where id=stay),
  '81000000-0000-4000-8000-000000000001','restaurant','received',now()+interval '1 day',gen_random_uuid(),'relogio',manager from ctx;
select is(
  (select (public.list_consumption_service_orders(hotel)->'summary'->>'late')::int from ctx),
  1,'o pedido vencido no relógio do hotel aparece como atrasado'
);

-- Pedidos e saldo em aberto impediriam a saída.
update public.hotels set checkout_time_start=time '00:00',checkout_time_limit=time '23:59:59'
  where id=(select hotel from ctx);
delete from public.consumption_service_orders where id='a9600000-0000-4000-8000-000000000004';
select is(
  (select public.create_stay_payment_batch(hotel,stay,manager,'[{"payment_method":"pix","amount":371}]'::jsonb,
    'a9600000-0000-4000-8000-000000000009',(select account_version from public.stays where id=stay),'regular','Saldo final')->>'result' from ctx),
  'ok','o saldo da conta é quitado antes da saída'
);

-- Saída: a data válida é a do hotel. No dia real, com o hotel três dias à frente, a saída não vale.
update public.stays set checkin_date_expected=now()-interval '1 day',checkout_date_expected=now()
  where id=(select stay from ctx);
select is(
  (select public.checkout_stay_account_stage4(hotel,stay,manager,
    (select account_version from public.stays where id=stay),'[]'::jsonb,'a9600000-0000-4000-8000-000000000005',
    array[]::uuid[],array[]::uuid[],null)->>'result' from ctx),
  'checkout_date_invalid','a saída prevista para o dia real, com o hotel em outro dia, é recusada'
);
update public.stays set checkin_date_expected=(select op from ctx)-interval '1 day',checkout_date_expected=(select op from ctx)
  where id=(select stay from ctx);
select is(
  (select public.checkout_stay_account_stage4(hotel,stay,manager,
    (select account_version from public.stays where id=stay),'[]'::jsonb,'a9600000-0000-4000-8000-000000000006',
    array[]::uuid[],array[]::uuid[],null)->>'result' from ctx),
  'ok','a saída prevista para o dia do hotel é aceita'
);
select is(
  (select checkout_date_actual from public.stays where id=(select stay from ctx)),
  (select op from ctx),'a saída real fica na hora do hotel'
);

-- Data informada continua valendo: o carimbo só preenche o que não veio.
select is(
  (select public.hotel_operational_now(hotel) from ctx),(select op from ctx),'o relógio segue congelado'
);
insert into public.stay_folio_entries(id,hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by)
select 'a9600000-0000-4000-8000-000000000007',hotel,stay,(select reservation_id from public.stays where id=stay),
  'debit','adjustment',1,'BRL','Sem data','teste:relogio:1',manager from ctx;
select is(
  (select posted_at from public.stay_folio_entries where id='a9600000-0000-4000-8000-000000000007'),
  (select op from ctx),'lançamento sem data recebe a hora do hotel'
);
insert into public.stay_folio_entries(id,hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
select 'a9600000-0000-4000-8000-000000000008',hotel,stay,(select reservation_id from public.stays where id=stay),
  'debit','adjustment',1,'BRL','Com data','teste:relogio:2',manager,'2026-01-02 12:00:00+00' from ctx;
select is(
  (select posted_at from public.stay_folio_entries where id='a9600000-0000-4000-8000-000000000008'),
  '2026-01-02 12:00:00+00'::timestamptz,'lançamento com data mantém a data informada'
);

-- Hora real: o relógio à frente não muda o que é técnico.
select is(
  (select created_at from public.stay_folio_entries where id='a9600000-0000-4000-8000-000000000007'),
  now(),'a criação do registro continua no tempo real'
);

-- Tudo o que os passos acima gravaram: dentro da transação, now() é constante, então uma coluna de
-- instante igual a ele foi carimbada em hora real. Ficam de fora os carimbos técnicos do contrato.
create function pg_temp.real_time_stamps() returns text[] language plpgsql as $$
declare v_found text[]:=array[]::text[]; v record; v_hit boolean;
begin
  for v in
    select c.table_name,c.column_name from information_schema.columns c
    join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
    where c.table_schema='public' and c.data_type='timestamp with time zone'
      and c.column_name not in ('created_at','updated_at')
      and c.table_name||'.'||c.column_name not in (
        'operational_pending_reads.read_at','inventory_documents.posted_at','inventory_movements.posted_at',
        'hotel_training_environments.frozen_at','operational_pending.last_seen_at')
  loop
    execute format('select exists(select 1 from public.%I where %I=now())',v.table_name,v.column_name) into v_hit;
    if v_hit then v_found:=v_found||(v.table_name||'.'||v.column_name); end if;
  end loop;
  return v_found;
end $$;
select is(pg_temp.real_time_stamps(),array[]::text[],'nenhum carimbo operacional gravado acima ficou em hora real');

-- Guarda: uso novo de hora real precisa entrar aqui com justificativa, ou passar para o relógio do hotel.
select is(
  array(
    select distinct p.proname::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.prolang<>(select oid from pg_language where lanname='c')
      and regexp_replace(pg_get_functiondef(p.oid),
        '(updated_at\s*:?=\s*|''updated_at'',\s*|''generated_at'',\s*|triaged_at\s*=\s*|p_now\s+timestamp with time zone\s+DEFAULT\s+)now\(\)','','gi') ~* '\mnow\(\)'
      and p.proname not in (
        -- O relógio em si, e o último recurso do carimbo quando a linha aponta para um hotel inexistente:
        -- nesse caso, quem responde é a chave estrangeira, não a coluna vazia.
        'hotel_operational_now','stamp_operational_time',
        -- Links de pré-chegada expiram em tempo real, mesmo com o hotel-escola congelado.
        'create_prearrival_link','create_prearrival_change_request','resolve_prearrival_token','submit_prearrival',
        -- Leitura de aviso e pendência é evento técnico de quem leu.
        'act_operational_pending','mark_all_maintenance_notifications_read','set_maintenance_notification_status',
        -- Versão do feed de canais é técnica; a janela padrão da agenda é sobrescrita pelo backend.
        'get_booking_channel_inventory','list_maintenance_planning_board',
        -- Criação do hotel, antes de existir relógio operacional para ele.
        'initialize_consumption_management_settings','initialize_default_rate_plan_for_hotel',
        -- Carimbos técnicos de atualização.
        'set_updated_at','set_updated_at_if_changed','inventory_protect_location_delete','inventory_protect_position',
        'update_user_with_roles'
      )
    order by 1
  ),
  array[]::text[],
  'nenhuma função usa hora real fora da lista justificada'
);
select is(
  array(
    select c.table_name||'.'||c.column_name from information_schema.columns c
    where c.table_schema='public' and c.column_default ~* 'now\(\)' and c.column_name not in ('created_at','updated_at')
      and c.table_name||'.'||c.column_name not in (
        -- Técnicos: credencial, feed, automação, cálculo, leitura e link externo.
        'booking_channels.credential_rotated_at','booking_channel_feed_acknowledgements.acknowledged_at',
        'integrated_operation_facts.reconciled_at','maintenance_automation_runs.started_at',
        'maintenance_impact_scores.computed_at','operational_pending.opened_at','operational_pending_reads.read_at',
        'prearrival_submissions.submitted_at',
        -- Instante técnico do registro; o instante do fato fica em occurred_at.
        'inventory_documents.posted_at','inventory_movements.posted_at'
      )
    order by 1
  ),
  array[]::text[],
  'nenhuma coluna operacional assume hora real por padrão'
);

select * from finish();
rollback;
