select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','orientation',2,
  'Orientação do hotel-escola com saldo de hóspede visível à recepção.',
  '80000000-0000-4000-8000-000000000002'
);

-- A conta da estadia já tem saldo sintético. A saída de amanhã torna o
-- acompanhamento pertinente à recepção sem criar uma pendência artificial.
update public.stays set
  checkout_date_expected=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+1+time '11:00'
where id='91000000-0000-4000-8000-000000000002'
  and stay_status='checked_in';

update public.consumption_management_settings set guest_balance_alert_days=1
where hotel_id='10000000-0000-4000-8000-000000000001';

do $$ begin
  if (select count(*) from public.user_roles where hotel_id='10000000-0000-4000-8000-000000000001')<8 then
    raise exception 'orientation requires eight Aurora accounts';
  end if;
  if (select public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001',null)->>'result') is distinct from 'ok' then
    raise exception 'orientation could not reconcile operational pending items';
  end if;
end $$;
