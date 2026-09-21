create or replace function pg_temp.assert_training_scenario(
  p_condition boolean,
  p_message text
) returns void language plpgsql as $$
begin
  if not coalesce(p_condition,false) then
    raise exception 'training verification failed: %',p_message;
  end if;
end $$;

select pg_temp.assert_training_scenario(
  (select count(*)=8 from public.user_roles
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'Hotel Aurora must have exactly eight operational accounts'
);
select pg_temp.assert_training_scenario(
  (select count(*)=1 from public.user_roles
   where hotel_id='10000000-0000-4000-8000-000000000002'),
  'Hotel Horizonte isolation account is missing'
);
select pg_temp.assert_training_scenario(
  (select clock_mode='frozen' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'Aurora operational clock must be frozen'
);
