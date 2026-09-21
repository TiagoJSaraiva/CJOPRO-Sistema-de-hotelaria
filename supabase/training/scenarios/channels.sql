select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','channels',2,
  'Configuração do site direto e do conector fictício HospedaLink Sandbox.',
  '80000000-0000-4000-8000-000000000002'
);

update public.rate_plan_versions version
set channels=array_append(version.channels,'external')
from public.rate_plans plan
where plan.id=version.rate_plan_id
  and plan.hotel_id='10000000-0000-4000-8000-000000000001'
  and plan.status='active'
  and version.id=plan.active_version_id
  and not ('external'=any(version.channels));

do $$ begin
  if not exists(select 1 from public.rooms where hotel_id='10000000-0000-4000-8000-000000000001')
     or not exists(
       select 1 from public.rate_plans plan
       join public.rate_plan_versions version on version.id=plan.active_version_id
       where plan.hotel_id='10000000-0000-4000-8000-000000000001'
         and plan.status='active' and 'external'=any(version.channels)
     ) then
    raise exception 'channels reference data is incomplete';
  end if;
end $$;
