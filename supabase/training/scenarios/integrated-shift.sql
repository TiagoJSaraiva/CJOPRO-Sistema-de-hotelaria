select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','integrated-shift',1,
  'Turno integrado final com reservas, manutenção, estoque, caixa e gestão.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if (select count(*) from public.user_roles where hotel_id='10000000-0000-4000-8000-000000000001')<8
     or not exists(select 1 from public.maintenance_locations where hotel_id='10000000-0000-4000-8000-000000000001' and kind='equipment')
     or not exists(select 1 from public.cash_registers where hotel_id='10000000-0000-4000-8000-000000000001') then
    raise exception 'integrated-shift prerequisites are incomplete';
  end if;
end $$;
