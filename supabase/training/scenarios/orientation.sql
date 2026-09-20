select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','orientation',1,
  'Orientação do hotel-escola, papéis, permissões e pendências.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if (select count(*) from public.user_roles where hotel_id='10000000-0000-4000-8000-000000000001')<8 then
    raise exception 'orientation requires eight Aurora accounts';
  end if;
end $$;
