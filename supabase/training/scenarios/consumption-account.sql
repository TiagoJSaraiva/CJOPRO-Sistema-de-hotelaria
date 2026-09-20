select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','consumption-account',1,
  'Hospedagem ativa com consumo ainda não classificado na conta.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.consumption_orders where id='93000000-0000-4000-8000-000000000001') then
    raise exception 'consumption-account order is missing';
  end if;
end $$;
