select pg_temp.assert_training_scenario(
  (select scenario_key='reservations-arrival' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario reservations-arrival key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.stays
    where id='91000000-0000-4000-8000-000000000001'
      and stay_status='confirmed'
      and checkin_date_expected::date=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')),
  'assert_training_scenario arrival is not on the operational date'
);
