select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','partner-settlement',1,
  'Parceiro comercial sintético com apuração para análise e contestação.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.hotels where id='10000000-0000-4000-8000-000000000001') then
    raise exception 'partner-settlement hotel is missing';
  end if;
end $$;
