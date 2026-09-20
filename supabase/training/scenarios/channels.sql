select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','channels',1,
  'Configuração do site direto e do conector fictício HospedaLink Sandbox.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.rooms where hotel_id='10000000-0000-4000-8000-000000000001') then
    raise exception 'channels requires room categories';
  end if;
end $$;
