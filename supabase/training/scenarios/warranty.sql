select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','warranty',1,
  'Equipamento com garantia próxima do vencimento e decisão pendente.',
  '80000000-0000-4000-8000-000000000002'
);

update public.maintenance_locations set
  warranty_ends_on=public.hotel_operational_date(hotel_id)+7,
  lifecycle_status='active',is_active=true,version=version+1
where id='99500000-0000-4000-8000-000000000001';

select public.process_maintenance_expiry_alerts(
  '10000000-0000-4000-8000-000000000001',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')
);

do $$ begin
  if not exists(
    select 1 from public.maintenance_notifications
    where hotel_id='10000000-0000-4000-8000-000000000001'
      and entity_id='99500000-0000-4000-8000-000000000001'
      and kind='warranty_expiry' and status='unread'
  ) then
    raise exception 'warranty alert was not prepared';
  end if;
end $$;
