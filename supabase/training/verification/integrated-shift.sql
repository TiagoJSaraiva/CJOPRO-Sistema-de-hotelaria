select pg_temp.assert_training_scenario(
  (select scenario_key='integrated-shift' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario integrated-shift key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.stays where id='91000000-0000-4000-8000-000000000001' and checkin_date_expected::date=public.hotel_operational_date('10000000-0000-4000-8000-000000000001'))
  and exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001' and status='assigned')
  and exists(select 1 from public.maintenance_notifications where entity_id='99500000-0000-4000-8000-000000000001' and kind='warranty_expiry' and status='unread')
  and exists(select 1 from public.minibar_replenishment_routes where id='a20a0000-0000-4000-8000-000000000001' and status='draft')
  and exists(select 1 from public.purchase_orders where id='a4010000-0000-4000-8000-000000000001' and status='pending_approval')
  and exists(select 1 from public.consumption_order_items where id='a3090000-0000-4000-8000-000000000001' and provider_type_snapshot='partner')
  and exists(select 1 from public.consumption_orders where id='93000000-0000-4000-8000-000000000001' and disposition='legacy_unclassified')
  and (select count(*)=2 from public.cash_registers where hotel_id='10000000-0000-4000-8000-000000000001' and active),
  'assert_training_scenario integrated prerequisites are incomplete'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.hotel_id='10000000-0000-4000-8000-000000000002'
      and r.hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario hotel isolation was violated'
);
