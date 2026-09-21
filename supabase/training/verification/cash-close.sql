select pg_temp.assert_training_scenario(
  (select scenario_key='cash-close' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario cash-close key'
);
select pg_temp.assert_training_scenario(
  (select count(*)=2 from public.cash_registers
    where hotel_id='10000000-0000-4000-8000-000000000001' and active)
  and exists(select 1 from public.cash_registers
    where hotel_id='10000000-0000-4000-8000-000000000001' and kind='reception')
  and exists(select 1 from public.cash_registers
    where hotel_id='10000000-0000-4000-8000-000000000001' and kind='consumption'),
  'assert_training_scenario cash registers are incomplete'
);
