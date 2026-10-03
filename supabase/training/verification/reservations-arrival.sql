select pg_temp.assert_training_scenario(
  (select scenario_key='reservations-arrival' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario reservations-arrival key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.stays
    where id='91000000-0000-4000-8000-000000000001'
      and stay_status='confirmed'
      and (checkin_date_expected at time zone 'America/Sao_Paulo')::date=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')),
  'assert_training_scenario arrival is not on the operational date'
);

select pg_temp.assert_training_scenario(
 (public.hotel_operational_now('10000000-0000-4000-8000-000000000001') at time zone 'America/Sao_Paulo')::time=time '14:00',
 'arrival starts inside check-in window');
select pg_temp.assert_training_scenario(
 (public.reservation_arrival_summary('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001')->>'guarantee_required')::numeric=250
 and (select count(*) from public.reservation_nightly_prices where accommodation_id='a3040000-0000-4000-8000-000000000001' and final_amount=250)=2
 and (select total_paid=0 from public.stays where id='91000000-0000-4000-8000-000000000001'),
 'arrival fixture includes occupancy, prices and unpaid signal');
