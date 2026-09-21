select pg_temp.assert_training_scenario(
  (select scenario_key='channels' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario channels key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.rate_plans plan
    join public.rate_plan_versions version on version.id=plan.active_version_id
    where plan.hotel_id='10000000-0000-4000-8000-000000000001'
      and plan.status='active' and 'external'=any(version.channels))
  and exists(select 1 from public.rooms
    where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario channel reference data is incomplete'
);
