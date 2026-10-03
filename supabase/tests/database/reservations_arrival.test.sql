begin;
select no_plan();
do $$ begin

perform public.prepare_training_scenario(
 '10000000-0000-4000-8000-000000000001','reservations-arrival',2,
 'Reserva confirmada com sinal da primeira diária e chegada às 14h.',
 '80000000-0000-4000-8000-000000000002'
);
perform public.act_training_clock(
 '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 jsonb_build_object('action','set','local_at',public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+time '14:00',
 'expected_version',(select version from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
 'reason','Início da lesson-02 dentro da janela de check-in.')
);
update public.stays set
 checkin_date_expected=(public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+time '14:00') at time zone 'America/Sao_Paulo',
 checkout_date_expected=(public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+2+time '11:00') at time zone 'America/Sao_Paulo'
where id='91000000-0000-4000-8000-000000000001';

insert into public.rate_plans(id,hotel_id,code,name,kind) values(
 'a3020000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','LESSON-02','Plano didático da chegada','flexible');
insert into public.rate_plan_versions(id,hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,guarantee_type,channels)
values('a3030000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','a3020000-0000-4000-8000-000000000001',1,'BRL','fixed',0,2,'first_night',array['internal']);
update public.rate_plans set active_version_id='a3030000-0000-4000-8000-000000000001',status='active' where id='a3020000-0000-4000-8000-000000000001';
insert into public.rate_plan_version_room_types(hotel_id,version_id,room_type) values('10000000-0000-4000-8000-000000000001','a3030000-0000-4000-8000-000000000001','Standard');
insert into public.reservation_accommodations(id,hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,stay_id,assigned_room_id,total_price,rate_plan_version_id)
select 'a3040000-0000-4000-8000-000000000001',r.hotel_id,r.id,'Standard',public.hotel_operational_date(r.hotel_id),public.hotel_operational_date(r.hotel_id)+2,2,0,'assigned',s.id,s.room_id,500,'a3030000-0000-4000-8000-000000000001'
from public.reservations r join public.stays s on s.reservation_id=r.id where s.id='91000000-0000-4000-8000-000000000001';
insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,final_amount)
select a.hotel_id,a.id,d::date,a.rate_plan_version_id,250,250 from public.reservation_accommodations a cross join lateral generate_series(a.checkin_date,a.checkout_date-1,interval '1 day') d where a.id='a3040000-0000-4000-8000-000000000001';
insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,consent_version)
select r.id,r.hotel_id,c.full_name,c.email,'lesson-02-v1' from public.reservations r join public.customers c on c.id=r.booking_customer_id where r.id='90000000-0000-4000-8000-000000000001';

end $$;
create temp table arrival_access as select public.create_prearrival_link(
 '10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',
 '80000000-0000-4000-8000-000000000004',24) value;
select is((public.reservation_arrival_summary('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001')->>'guarantee_required')::numeric,250::numeric,'first night signal is explicit');
select is(public.reservation_arrival_summary('10000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001'),null::jsonb,'arrival isolated by hotel');
select is((public.submit_prearrival((select value->>'token' from arrival_access),
 jsonb_build_object('expected_version',1,'primary_guest',jsonb_build_object('full_name','Ana Treinamento','document_type','test','document_number','LOCAL-02','birth_date','1990-01-10'),
 'companions',jsonb_build_array(jsonb_build_object('accommodation_id','a3040000-0000-4000-8000-000000000001','full_name','Bruno Treinamento')),
 'arrival_time','14:00'))->>'result'),'ok','guest and companion submitted');
select is((public.submit_prearrival((select value->>'token' from arrival_access),
 jsonb_build_object('expected_version',1,'primary_guest',jsonb_build_object('full_name','Ana Atualizada','document_type','test','document_number','LOCAL-02','birth_date','1990-01-10'),
 'companions',jsonb_build_array(jsonb_build_object('accommodation_id','a3040000-0000-4000-8000-000000000001','full_name','Bruno Atualizado')),
 'arrival_time','14:30'))->>'result'),'ok','guest data can be updated');
select is((select count(*)::int from public.reservation_guests where reservation_id='90000000-0000-4000-8000-000000000001'),2,'resubmission does not duplicate guests');
select is((select count(*)::int from public.prearrival_submissions where reservation_id='90000000-0000-4000-8000-000000000001'),2,'submission history preserved');
select is((public.submit_prearrival((select value->>'token' from arrival_access),jsonb_build_object('expected_version',1,'companions',jsonb_build_array(jsonb_build_object('accommodation_id','00000000-0000-4000-8000-000000000099','full_name','Outro'))))->>'result'),'invalid_accommodation','foreign accommodation is refused');
select is((public.submit_prearrival((select value->>'token' from arrival_access),jsonb_build_object('expected_version',1,'companions',jsonb_build_array(jsonb_build_object('accommodation_id','a3040000-0000-4000-8000-000000000001','full_name','Pessoa 1'),jsonb_build_object('accommodation_id','a3040000-0000-4000-8000-000000000001','full_name','Pessoa 2'))))->>'result'),'invalid_guest_count','partial submission counts retained titular before accepting companions');
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
 '{"expected_version":1,"idempotency_key":"a3050000-0000-4000-8000-000000000001","tenders":[{"method":"pix","amount":100}]}'::jsonb)->>'result'),'insufficient_guarantee','insufficient signal rejected');
select is((select count(*)::int from public.reservation_account_entries where reservation_id='90000000-0000-4000-8000-000000000001'),0,'insufficient signal rolls back');
savepoint cash_guarantee;
insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,active,created_by)
values('a3150000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Caixa chegada','ARRIVAL','reception','BRL',0,true,'80000000-0000-4000-8000-000000000004');
select public.open_cash_session('10000000-0000-4000-8000-000000000001','a3150000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004','{"opening_float":0,"idempotency_key":"a3150000-0000-4000-8000-000000000002"}'::jsonb);
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',jsonb_build_object('expected_version',1,'idempotency_key','a3150000-0000-4000-8000-000000000003','tenders',jsonb_build_array(jsonb_build_object('method','cash','amount',250,'cash_session_id',(select id from public.cash_sessions where cash_register_id='a3150000-0000-4000-8000-000000000001')))))->>'result'),'invalid_cash_session','signal refuses another operator cash session');
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',jsonb_build_object('expected_version',1,'idempotency_key','a3150000-0000-4000-8000-000000000003','tenders',jsonb_build_array(jsonb_build_object('method','cash','amount',250,'cash_session_id',(select id from public.cash_sessions where cash_register_id='a3150000-0000-4000-8000-000000000001')))))->>'result'),'ok','cash signal uses responsible operator session');
select is((select expected_cash from public.cash_sessions where cash_register_id='a3150000-0000-4000-8000-000000000001'),250::numeric,'cash receipt updates cash expectation once');
rollback to cash_guarantee;
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
 '{"expected_version":1,"idempotency_key":"a3050000-0000-4000-8000-000000000002","tenders":[{"method":"pix","amount":250}]}'::jsonb)->>'result'),'ok','PIX signal accepted');
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
 '{"expected_version":1,"idempotency_key":"a3050000-0000-4000-8000-000000000002","tenders":[{"method":"pix","amount":250}]}'::jsonb)->>'result'),'ok','retry preserves original guarantee');
select is((public.record_reservation_guarantee('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
 '{"expected_version":2,"idempotency_key":"a3050000-0000-4000-8000-000000000002","tenders":[{"method":"pix","amount":300}]}'::jsonb)->>'result'),'idempotency_conflict','changed retry rejected');

select throws_ok($$update public.financial_transactions set amount=1 where reservation_id='90000000-0000-4000-8000-000000000001' and category='RESERVATION_GUARANTEE'$$,'23514','generated financial transactions require compensating operations','generated signal cannot be edited');
select throws_ok($$delete from public.financial_transactions where reservation_id='90000000-0000-4000-8000-000000000001' and category='RESERVATION_GUARANTEE'$$,'23514','generated financial transactions require compensating operations','generated signal cannot be deleted');
savepoint arrival_clock;
update public.hotel_training_environments set frozen_at=frozen_at-interval '1 minute' where hotel_id='10000000-0000-4000-8000-000000000001';
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',null,'Exceção',true)->>'result'),'outside_checkin_window','override cannot ignore check-in window');
rollback to arrival_clock;
update public.hotel_training_environments set frozen_at=frozen_at+interval '8 hours 59 seconds' where hotel_id='10000000-0000-4000-8000-000000000001';
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'ok','last allowed minute follows backend eligibility');
rollback to arrival_clock;
update public.hotel_training_environments set frozen_at=frozen_at+interval '8 hours 1 minute' where hotel_id='10000000-0000-4000-8000-000000000001';
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'outside_checkin_window','after end of window blocked');
rollback to arrival_clock;
update public.hotel_training_environments set frozen_at=frozen_at+interval '1 day' where hotel_id='10000000-0000-4000-8000-000000000001';
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'outside_checkin_date','wrong operational date blocked');
rollback to arrival_clock;
insert into public.room_blocks(hotel_id,room_id,status,label,start_date,end_date)
values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000101','blocked','Interdição de teste',public.hotel_operational_date('10000000-0000-4000-8000-000000000001'),public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+1);
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',null,'Exceção',true)->>'result'),'maintenance_blocked','override never ignores interdição');
rollback to arrival_clock;
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'not_found','check-in isolated');
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'ok','ready room checked in at operational 14h');
select is((select checkin_date_actual from public.stays where id='91000000-0000-4000-8000-000000000001'),public.hotel_operational_now('10000000-0000-4000-8000-000000000001'),'actual check-in uses operational clock');
select is((select total_paid from public.stays where id='91000000-0000-4000-8000-000000000001'),250::numeric,'signal credited to stay');
select is((select lifecycle_status from public.reservations where id='90000000-0000-4000-8000-000000000001'),'in_house','reservation status synchronized');
select is((select status from public.reservation_accommodations where id='a3040000-0000-4000-8000-000000000001'),'checked_in','accommodation synchronized');
select is((select applied_daily_rate from public.stays where id='91000000-0000-4000-8000-000000000001'),250::numeric,'contracted price preserved');
select is((select count(*)::int from public.financial_transactions where reservation_id='90000000-0000-4000-8000-000000000001' and type='INCOME'),1,'transfer does not create another receipt');
select is((public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004')->>'result'),'invalid_state','second check-in rejected');
select is((select count(*)::int from public.stay_folio_entries where stay_id='91000000-0000-4000-8000-000000000001' and source_key like 'reservation-guarantee:%'),1,'credit transferred once');
select * from finish();
rollback;
