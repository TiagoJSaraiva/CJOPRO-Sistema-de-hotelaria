
select public.prepare_training_scenario(
 '10000000-0000-4000-8000-000000000001','reservations-arrival',2,
 'Reserva confirmada com sinal da primeira diária e chegada às 14h.',
 '80000000-0000-4000-8000-000000000002'
);
select public.act_training_clock(
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
