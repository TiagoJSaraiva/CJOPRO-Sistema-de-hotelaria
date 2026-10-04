begin;
select no_plan();

-- Place arrival after real time to reproduce lesson-02 independently of wall time.
insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
values('10000000-0000-4000-8000-000000000001','frozen',now()+interval '1 day')
on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at;
update public.stays set stay_status='checked_in',checkin_date_actual=now()+interval '1 day'
where id='91000000-0000-4000-8000-000000000001';
create function pg_temp.context_at(p_at timestamptz default null) returns jsonb language sql as $$
 select public.get_consumption_operational_context('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',p_at)
$$;
select is(pg_temp.context_at()->>'result','ok','default context uses operational clock');
select is((pg_temp.context_at()->>'operational_now')::timestamptz,now()+interval '1 day','context exposes operational clock');
select is((pg_temp.context_at()->>'occurred_at')::timestamptz,now()+interval '1 day','default occurrence equals operational clock');
select is(pg_temp.context_at(now())->>'result','occurred_before_checkin','real clock cannot precede actual arrival');
select is(pg_temp.context_at(now()+interval '1 day 1 second')->>'result','occurred_in_future','future occurrence remains forbidden');
select is(public.get_consumption_operational_context('10000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001')->>'result','not_found','context isolates hotels');

-- A controlled physical item proves that the temporal fix reaches stock and folio.
select is(public.configure_inventory_position('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
 (select id from public.inventory_locations where hotel_id='10000000-0000-4000-8000-000000000001' and internal_code='CENTRAL'),10,0,10,2,gen_random_uuid())->>'result','ok','controlled inventory prepared');
update public.consumption_points set default_inventory_location_id=(select id from public.inventory_locations where hotel_id='10000000-0000-4000-8000-000000000001' and internal_code='CENTRAL')
where id='81000000-0000-4000-8000-000000000001';
create function pg_temp.post_at(p_at timestamptz,p_key uuid,p_mode public.consumption_billing_mode default 'stay_folio',p_quantity numeric default 1) returns jsonb language sql as $$
 select public.post_consumption_order('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',p_at,
 'charged',p_mode,jsonb_build_array(jsonb_build_object('offer_id','81100000-0000-4000-8000-000000000001','quantity',p_quantity,'version_token',public.resolve_consumption_offer_snapshot('10000000-0000-4000-8000-000000000001','81100000-0000-4000-8000-000000000001',p_at)->>'version_token')),p_key,null,
 case when p_mode='hotel_immediate' then 'pix'::public.consumption_payment_method else null end)
$$;
create temp table clock_receipts as select pg_temp.post_at(now()+interval '1 day','c9500000-0000-4000-8000-000000000001') receipt;
select is((select receipt->>'result' from clock_receipts),'ok','post at both inclusive boundaries succeeds');
select is((select posted_at from public.consumption_orders where idempotency_key='c9500000-0000-4000-8000-000000000001'),now()+interval '1 day','order posting follows operational time');
select is((select quantity from public.inventory_positions where product_id='40000000-0000-4000-8000-000000000001' and hotel_id='10000000-0000-4000-8000-000000000001'),9::numeric,'stock decreased once');
select ok(exists(select 1 from public.stay_folio_entries where consumption_order_id=(select (receipt->>'order_id')::uuid from clock_receipts) and direction='debit'),'folio receives debit');
-- Replay the identical token, not the newly versioned stock snapshot.
select is(public.post_consumption_order('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',now()+interval '1 day','charged','stay_folio',
 (select jsonb_agg(jsonb_build_object('offer_id',offer_id,'quantity',1,'version_token',version_token)) from public.consumption_order_items where order_id=(select (receipt->>'order_id')::uuid from clock_receipts)),
 'c9500000-0000-4000-8000-000000000001')->>'created','false','identical request is replayed');
select is((select count(*)::integer from public.inventory_movements where consumption_order_id=(select (receipt->>'order_id')::uuid from clock_receipts)),1,'replay never duplicates stock');
select is(pg_temp.post_at(now(),'c9500000-0000-4000-8000-000000000002')->>'result','occurred_before_checkin','post rejects time before check-in');
select is(pg_temp.post_at(now()+interval '1 day 1 second','c9500000-0000-4000-8000-000000000003')->>'result','occurred_in_future','post rejects operational future');
select is(pg_temp.post_at(now()+interval '1 day','c9500000-0000-4000-8000-000000000004','hotel_immediate')->>'result','ok','immediate payment succeeds');
select is((select paid_at from public.financial_transactions where consumption_order_id=(select id from public.consumption_orders where idempotency_key='c9500000-0000-4000-8000-000000000004')),now()+interval '1 day','receipt uses operational clock');
update public.inventory_settings set negative_stock_policy='block' where hotel_id='10000000-0000-4000-8000-000000000001';
select throws_ok($$select pg_temp.post_at(now()+interval '1 day','c9500000-0000-4000-8000-000000000005','stay_folio',999)$$,'23514','insufficient_inventory','stock failure rolls back transaction');
select is((select count(*)::integer from public.consumption_orders where idempotency_key='c9500000-0000-4000-8000-000000000005'),0,'failed transaction leaves no order');
select is((select quantity from public.inventory_positions where product_id='40000000-0000-4000-8000-000000000001' and hotel_id='10000000-0000-4000-8000-000000000001'),8::numeric,'failed transaction leaves stock intact');
create temp table service_receipts as select public.create_consumption_service_order(
 '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',null,'room_service',null,null,
 jsonb_build_array(jsonb_build_object('offer_id','81100000-0000-4000-8000-000000000001','quantity',1,'billing_mode','stay_folio')),gen_random_uuid()) receipt;
select is((select receipt->>'result' from service_receipts),'ok','service order resolves offers at operational time');
select is(public.act_consumption_service_order('10000000-0000-4000-8000-000000000001',(select (receipt->>'order_id')::uuid from service_receipts),'80000000-0000-4000-8000-000000000002','start_preparing',0,null,null,null,null)->>'result','ok','service prepares');
select is(public.act_consumption_service_order('10000000-0000-4000-8000-000000000001',(select (receipt->>'order_id')::uuid from service_receipts),'80000000-0000-4000-8000-000000000002','mark_ready',1,null,null,null,null)->>'result','ok','service is ready');
select is(public.act_consumption_service_order('10000000-0000-4000-8000-000000000001',(select (receipt->>'order_id')::uuid from service_receipts),'80000000-0000-4000-8000-000000000002','deliver',2,null,null,null,gen_random_uuid())->>'result','ok','delivery posts at operational time');
select is((select o.occurred_at from public.consumption_orders o join public.consumption_service_order_links l on l.consumption_order_id=o.id where l.service_order_id=(select (receipt->>'order_id')::uuid from service_receipts)),now()+interval '1 day','delivery timestamp is operational');
update public.stays set stay_status='confirmed' where id='91000000-0000-4000-8000-000000000001';
select is(pg_temp.context_at()->>'result','stay_not_checked_in','closed stay is rejected');
update public.hotel_training_environments set clock_mode='live',frozen_at=null where hotel_id='10000000-0000-4000-8000-000000000001';
update public.stays set stay_status='checked_in',checkin_date_actual=now()-interval '1 hour' where id='91000000-0000-4000-8000-000000000001';
select is(pg_temp.context_at()->>'result','ok','live clock remains supported');
select is((pg_temp.context_at()->>'operational_now')::timestamptz,now(),'live operational time equals real time');
select is(pg_temp.context_at(now()-interval '1 hour')->>'result','ok','explicit occurrence at earlier check-in is accepted');
select is((pg_temp.context_at(now()-interval '1 hour')->>'operational_now')::timestamptz,now(),'historical context retains current maximum');
select is(pg_temp.post_at(now()-interval '1 hour','c9500000-0000-4000-8000-000000000006')->>'result','ok','post accepts historical occurrence at check-in');
select * from finish();
rollback;
