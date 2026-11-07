begin;
select plan(56);

-- Cancelamento e no-show encerram a estadia, a acomodação e a reserva juntos, liberam o quarto e acertam
-- o dinheiro: multa só depois do prazo limite no cancelamento, sempre no no-show, e o que sobrar do
-- adiantamento vira crédito a devolver. Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  '81200000-0000-4000-8000-000000000001'::uuid as register,
  '20000000-0000-4000-8000-000000000103'::uuid as room,
  '20000000-0000-4000-8000-000000000102'::uuid as other_room,
  (select id from public.customers c where c.hotel_id='10000000-0000-4000-8000-000000000001' limit 1) as customer,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as today;

insert into public.rate_plans(id,hotel_id,code,name,kind)
select id::uuid,hotel,code,code,'flexible' from ctx,(values
  ('b1000000-0000-4000-8000-000000000001','CLOSE-FREE'),
  ('b1000000-0000-4000-8000-000000000002','CLOSE-LATE'),
  ('b1000000-0000-4000-8000-000000000003','CLOSE-NIGHT')) p(id,code);
insert into public.rate_plan_versions(id,hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,guarantee_type,channels,cancellation_type,cancellation_value,cancellation_cutoff_hours)
select v.id::uuid,hotel,v.plan::uuid,1,'BRL','fixed',0,2,'none',array['internal'],v.kind,v.value,v.cutoff from ctx,(values
  -- Prazo curto: a 40 dias da chegada ainda é de graça.
  ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','percentage',20::numeric,48),
  -- Prazo de um ano: a 40 dias da chegada já passou do limite.
  ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','percentage',20::numeric,8760),
  ('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','first_night',0::numeric,8760)) v(id,plan,kind,value,cutoff);

-- Cria reserva, estadia e, quando há plano, acomodação com diárias de R$ 100.
create function pg_temp.book(p_tag integer,p_room uuid,p_days integer,p_version uuid default null) returns uuid language plpgsql as $$
declare c ctx;v_res uuid:=('b3000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid;v_stay uuid:=('b4000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid;v_acc uuid:=('b5000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid;
begin
  select * into c from ctx;
  insert into public.reservations(id,hotel_id,booking_customer_id,reservation_code,guest_count) values(v_res,c.hotel,c.customer,'CLOSE-'||p_tag,1) on conflict (id) do nothing;
  insert into public.stays(id,reservation_id,room_id,applied_daily_rate,total_price_estimated,checkin_date_expected,checkout_date_expected,stay_status)
  values(v_stay,v_res,p_room,100,200,(c.today+p_days)+time '14:00',(c.today+p_days+2)+time '11:00','confirmed');
  if p_version is not null then
    insert into public.reservation_accommodations(id,hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,stay_id,assigned_room_id,total_price,rate_plan_version_id)
    values(v_acc,c.hotel,v_res,'Standard',c.today+p_days,c.today+p_days+2,1,0,'assigned',v_stay,p_room,200,p_version);
    insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,final_amount)
    select c.hotel,v_acc,d::date,p_version,100,100 from generate_series(c.today+p_days,c.today+p_days+1,interval '1 day') d;
  end if;
  return v_stay;
end $$;
create function pg_temp.res(p_tag integer) returns uuid language sql as $$ select ('b3000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid $$;
create function pg_temp.stay(p_tag integer) returns uuid language sql as $$ select ('b4000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid $$;
create function pg_temp.acc(p_tag integer) returns uuid language sql as $$ select ('b5000000-0000-4000-8000-'||lpad(p_tag::text,12,'0'))::uuid $$;
create function pg_temp.guarantee(p_tag integer,p_amount numeric) returns void language sql as $$
  insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,payment_method,actor_id)
  select hotel,pg_temp.res(p_tag),'credit','guarantee',p_amount,'BRL','pix',reception from ctx
$$;
create function pg_temp.close(p_tag integer,p_action text,p_reason text default 'Pedido do hóspede') returns jsonb language sql as $$
  select public.close_stay_before_arrival(hotel,pg_temp.stay(p_tag),reception,p_action,p_reason) from ctx
$$;
create function pg_temp.state(p_tag integer) returns text language sql as $$
  select s.stay_status||'|'||r.lifecycle_status||'|'||coalesce(a.status,'-')
  from public.stays s join public.reservations r on r.id=s.reservation_id
  left join public.reservation_accommodations a on a.stay_id=s.id where s.id=pg_temp.stay(p_tag)
$$;
create function pg_temp.folio(p_tag integer) returns numeric language sql as $$
  select coalesce(sum(case direction when 'debit' then amount else -amount end),0) from public.stay_folio_entries where stay_id=pg_temp.stay(p_tag)
$$;
create function pg_temp.entry(p_tag integer,p_kind text) returns numeric language sql as $$
  select coalesce(sum(amount),0) from public.reservation_account_entries where reservation_id=pg_temp.res(p_tag) and kind=p_kind
$$;

-- Cancelamento antes do prazo limite: sem multa, adiantamento inteiro a devolver.
select pg_temp.book(1,(select room from ctx),40,'b2000000-0000-4000-8000-000000000001');
select pg_temp.guarantee(1,50);
select is((select (public.stay_closure_preview(hotel,pg_temp.stay(1))->>'cancel_penalty')::numeric from ctx),0::numeric,'a prévia mostra cancelamento sem multa antes do prazo');
select is((select (public.stay_closure_preview(hotel,pg_temp.stay(1))->>'no_show_penalty')::numeric from ctx),40::numeric,'a prévia mostra a multa do no-show');
select is((select (public.stay_closure_preview(hotel,pg_temp.stay(1))->>'balance')::numeric from ctx),50::numeric,'a prévia mostra o adiantamento recebido');
select is(pg_temp.close(1,'cancel')->>'result','ok','o cancelamento antes do prazo é aceito');
select is(pg_temp.state(1),'canceled|canceled|canceled','estadia, reserva e acomodação são canceladas juntas');
select is(pg_temp.folio(1),0::numeric,'a hospedagem sai da conta da estadia');
select is(pg_temp.entry(1,'penalty'),0::numeric,'antes do prazo não há multa');
select is(pg_temp.entry(1,'refund_credit'),50::numeric,'o adiantamento vira crédito a devolver');
select is(public.reservation_closure_balance(pg_temp.res(1)),50::numeric,'o saldo mostra o valor a devolver');
select is(
  (select details->>'business_date' from public.reservation_events where reservation_id=pg_temp.res(1) and action='cancel'),
  (select today::text from ctx),'o evento guarda o dia de negócio do hotel'
);

-- O quarto fica livre para outra reserva.
select pg_temp.book(2,(select room from ctx),40,'b2000000-0000-4000-8000-000000000001');
select is(
  (select public.assign_reservation_room(hotel,pg_temp.res(2),reception,jsonb_build_object(
    'accommodation_id',pg_temp.acc(2),'room_id',room,'reason','Quarto liberado',
    'expected_version',(select version from public.reservation_accommodations where id=pg_temp.acc(2))))->>'result' from ctx),
  'ok','o quarto da reserva cancelada pode ser alocado de novo'
);

-- Cancelamento depois do prazo limite: multa de 20% sobre R$ 200.
select pg_temp.book(3,(select other_room from ctx),40,'b2000000-0000-4000-8000-000000000002');
select pg_temp.guarantee(3,50);
select is((select (public.stay_closure_preview(hotel,pg_temp.stay(3))->>'cancel_penalty')::numeric from ctx),40::numeric,'a prévia mostra a multa depois do prazo');
select is((pg_temp.close(3,'cancel')->>'penalty')::numeric,40::numeric,'o cancelamento depois do prazo cobra a multa');
select is(pg_temp.entry(3,'refund_credit'),10::numeric,'só o que passa da multa vira crédito');
select is(public.reservation_closure_balance(pg_temp.res(3)),10::numeric,'o saldo desconta a multa');

-- No-show cobra a multa mesmo antes do prazo limite.
select pg_temp.book(4,(select room from ctx),50,'b2000000-0000-4000-8000-000000000001');
select is((pg_temp.close(4,'no_show')->>'penalty')::numeric,40::numeric,'o no-show sempre cobra a multa do plano');
select is(pg_temp.state(4),'no_show|no_show|no_show','estadia, reserva e acomodação ficam em no-show');
select is(public.reservation_closure_balance(pg_temp.res(4)),-40::numeric,'sem adiantamento, a multa fica a receber');
select is(pg_temp.entry(4,'refund_credit'),0::numeric,'multa a receber não gera crédito');

-- Primeira diária como multa.
select pg_temp.book(5,(select other_room from ctx),50,'b2000000-0000-4000-8000-000000000003');
select is((pg_temp.close(5,'cancel')->>'penalty')::numeric,100::numeric,'a multa de primeira diária usa o valor da noite');

-- Reserva do calendário não tem plano nem acomodação: encerra sem multa.
select pg_temp.book(6,(select room from ctx),60);
select is((pg_temp.close(6,'no_show')->>'penalty')::numeric,0::numeric,'sem plano não há multa');
select is(pg_temp.state(6),'no_show|no_show|-','a reserva do calendário também é encerrada');

-- Várias estadias: a reserva só termina com a última, e o crédito só nasce aí.
select pg_temp.book(7,(select room from ctx),70,'b2000000-0000-4000-8000-000000000001');
insert into public.stays(id,reservation_id,room_id,applied_daily_rate,total_price_estimated,checkin_date_expected,checkout_date_expected,stay_status)
select 'b4000000-0000-4000-8000-000000000077',pg_temp.res(7),other_room,100,200,(today+70)+time '14:00',(today+72)+time '11:00','confirmed' from ctx;
select pg_temp.guarantee(7,30);
select is(pg_temp.close(7,'cancel')->>'result','ok','a primeira estadia é cancelada');
select is((select lifecycle_status from public.reservations where id=pg_temp.res(7)),'confirmed','a reserva continua ativa com outra estadia');
select is(pg_temp.entry(7,'refund_credit'),0::numeric,'o adiantamento continua valendo para a outra estadia');
select is(
  (select public.close_stay_before_arrival(hotel,'b4000000-0000-4000-8000-000000000077',reception,'cancel','Pedido do hóspede')->>'result' from ctx),
  'ok','a última estadia é cancelada'
);
select is((select lifecycle_status from public.reservations where id=pg_temp.res(7)),'canceled','a reserva termina com a última estadia');
select is(pg_temp.entry(7,'refund_credit'),30::numeric,'o crédito nasce no fim da reserva');

-- Recusas não mudam nada.
select pg_temp.book(8,(select room from ctx),80,'b2000000-0000-4000-8000-000000000001');
select is(pg_temp.close(8,'cancel','x')->>'result','invalid','motivo curto é recusado');
select is(pg_temp.close(8,'ignorar')->>'result','invalid','ação desconhecida é recusada');
select is(
  (select public.close_stay_before_arrival('10000000-0000-4000-8000-000000000002',pg_temp.stay(8),reception,'cancel','Outro hotel')->>'result' from ctx),
  'not_found','estadia de outro hotel não é encontrada'
);
select is(pg_temp.state(8),'confirmed|confirmed|assigned','recusas não alteram a reserva');
select is(pg_temp.close(1,'cancel')->>'result','invalid_status','estadia já encerrada não é encerrada de novo');

-- Pagamento na conta da estadia precisa ser devolvido antes.
select is(
  (select public.create_stay_payment_batch(hotel,pg_temp.stay(8),reception,'[{"payment_method":"pix","amount":10}]'::jsonb,
    'b6000000-0000-4000-8000-000000000001',(select account_version from public.stays where id=pg_temp.stay(8)),'regular','Pix')->>'result' from ctx),
  'ok','a conta recebe um pagamento'
);
select is(pg_temp.close(8,'cancel')->>'result','open_account','conta com pagamento bloqueia o encerramento');
select is(pg_temp.state(8),'confirmed|confirmed|assigned','o bloqueio não altera a reserva');

select is(
  (select c->>'href' from jsonb_array_elements(public.operational_pending_candidates_before_training((select hotel from ctx))) c
    where c->>'kind'='reservation_refund_credit' and c->>'entity_id'=(select id::text from public.reservation_account_entries where reservation_id=pg_temp.res(1) and kind='refund_credit')),
  '/dashboard/reservations/view?stay_id='||pg_temp.stay(1)::text,'a pendência de devolução abre o painel da estadia'
);

-- Acerto: devolver o crédito.
select is(
  (select public.open_cash_session(hotel,register,reception,jsonb_build_object('opening_float',100,'idempotency_key','b6000000-0000-4000-8000-000000000002'))->>'result' from ctx),
  'ok','a recepção abre o caixa'
);
create function pg_temp.settle(p_tag integer,p_amount numeric,p_method text,p_key text,p_session uuid default null) returns jsonb language sql as $$
  select public.settle_closed_reservation(hotel,pg_temp.res(p_tag),reception,jsonb_build_object(
    'amount',p_amount,'method',p_method,'idempotency_key',p_key,'cash_session_id',p_session)) from ctx
$$;
select is(pg_temp.settle(1,60,'pix','b6000000-0000-4000-8000-000000000003')->>'result','amount_exceeds_balance','não se devolve mais que o saldo');
select is(pg_temp.settle(1,50,'cash','b6000000-0000-4000-8000-000000000004')->>'result','invalid_cash_session','dinheiro exige a sessão de quem devolve');
create temporary table sess on commit drop as
select s.id,s.expected_cash from public.cash_sessions s join ctx on s.operator_id=ctx.reception and s.status='open';
select is(pg_temp.settle(1,50,'cash','b6000000-0000-4000-8000-000000000005',(select id from sess))->>'kind','refund','o saldo positivo é devolvido');
select is((select expected_cash from public.cash_sessions where id=(select id from sess)),(select expected_cash-50 from sess),'a devolução em dinheiro sai do caixa');
select is(public.reservation_closure_balance(pg_temp.res(1)),0::numeric,'o saldo zera depois da devolução');
select ok(not exists(select 1 from public.reservation_account_entries where reservation_id=pg_temp.res(1) and kind='refund_credit' and reversed_entry_id is null),'a pendência de devolução é resolvida');
select is(pg_temp.settle(1,50,'cash','b6000000-0000-4000-8000-000000000005',(select id from sess))->>'result','ok','repetir a mesma chave não devolve de novo');
select is(public.reservation_closure_balance(pg_temp.res(1)),0::numeric,'a repetição não altera o saldo');
select is(pg_temp.settle(1,10,'pix','b6000000-0000-4000-8000-000000000006')->>'result','nothing_to_settle','sem saldo não há acerto');

-- Acerto: receber a multa.
select is(pg_temp.settle(4,40,'pix','b6000000-0000-4000-8000-000000000007')->>'kind','penalty_payment','o saldo negativo é recebido');
select is(public.reservation_closure_balance(pg_temp.res(4)),0::numeric,'o saldo zera depois do recebimento');
select is(
  (select type||'|'||category||'|'||amount::numeric(12,2) from public.financial_transactions where reservation_id=pg_temp.res(4) and category='RESERVATION_PENALTY'),
  'INCOME|RESERVATION_PENALTY|40.00','o recebimento da multa entra no financeiro'
);
select is(pg_temp.settle(8,10,'pix','b6000000-0000-4000-8000-000000000008')->>'result','invalid_status','reserva ativa não tem acerto');

-- A ação da reserva segue as mesmas regras.
select pg_temp.book(9,(select other_room from ctx),90,'b2000000-0000-4000-8000-000000000001');
select is(
  (select (public.act_reservation(hotel,pg_temp.res(9),reception,jsonb_build_object('action','cancel','reason','Pedido do hóspede','expected_version',(select version from public.reservations where id=pg_temp.res(9))))->>'penalty')::numeric from ctx),
  0::numeric,'a ação da reserva respeita o prazo limite'
);
select is(pg_temp.state(9),'canceled|canceled|canceled','a ação da reserva encerra a estadia alocada');

-- Indicadores contam pelo dia do hotel, inclusive reserva sem acomodação.
select is(
  (select public.reconcile_integrated_analytics(hotel,today,today,now())->>'result' from ctx),
  'ok','a apuração roda'
);
select cmp_ok(
  (select (f.actual->>'cancellations')::integer from public.integrated_operation_facts f join ctx on f.hotel_id=ctx.hotel and f.business_date=ctx.today),
  '>=',4,'os cancelamentos entram no indicador do dia'
);
select cmp_ok(
  (select (f.actual->>'no_shows')::integer from public.integrated_operation_facts f join ctx on f.hotel_id=ctx.hotel and f.business_date=ctx.today),
  '>=',2,'os no-shows entram no indicador do dia, inclusive sem acomodação'
);

select * from finish();
rollback;
