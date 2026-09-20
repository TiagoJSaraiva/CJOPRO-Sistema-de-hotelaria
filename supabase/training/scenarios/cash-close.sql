select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','cash-close',1,
  'Caixa da recepção pronto para sessão, contagem cega e fechamento diário.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.cash_registers where hotel_id='10000000-0000-4000-8000-000000000001' and active) then
    raise exception 'cash-close requires an active Aurora cash register';
  end if;
end $$;
