select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','reservations-arrival',1,
  'Reserva confirmada chegando na data operacional do Hotel Aurora.',
  '80000000-0000-4000-8000-000000000002'
);

update public.stays set
  checkin_date_expected=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+time '14:00',
  checkout_date_expected=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+2+time '11:00'
where id='91000000-0000-4000-8000-000000000001';

do $$ begin
  if not exists(select 1 from public.stays where id='91000000-0000-4000-8000-000000000001' and stay_status='confirmed') then
    raise exception 'reservations-arrival fixture is incomplete';
  end if;
end $$;
