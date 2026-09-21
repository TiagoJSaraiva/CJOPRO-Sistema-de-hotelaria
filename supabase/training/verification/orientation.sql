select pg_temp.assert_training_scenario(
  (select scenario_key='orientation' and scenario_version=2 from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario orientation key and version'
);
select pg_temp.assert_training_scenario(
  (select guest_balance_alert_days=1 from public.consumption_management_settings
   where hotel_id='10000000-0000-4000-8000-000000000001')
  and (select stay_status='checked_in'
        and checkout_date_expected::date=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+1
       from public.stays where id='91000000-0000-4000-8000-000000000002')
  and (select coalesce(sum(case when entry.direction='debit' then entry.amount else -entry.amount end),0)>0
       from public.stay_folio_entries entry
       where entry.hotel_id='10000000-0000-4000-8000-000000000001'
         and entry.stay_id='91000000-0000-4000-8000-000000000002'),
  'assert_training_scenario reception guest balance prerequisites are missing'
);
select pg_temp.assert_training_scenario(
  (select count(*)=1 from public.operational_pending p
   where p.hotel_id='10000000-0000-4000-8000-000000000001'
     and p.kind='guest_balance' and p.entity_id='91000000-0000-4000-8000-000000000002'
     and p.title='Saldo pendente no quarto 102'
     and p.href='/dashboard/reservations/account?stay_id=91000000-0000-4000-8000-000000000002'
     and p.status='open' and p.assigned_to is null
     and not exists(select 1 from public.operational_pending_reads r where r.pending_id=p.id)),
  'assert_training_scenario reception pending must start open, unread and unassigned'
);
select pg_temp.assert_training_scenario(
  (select (public.list_operational_pending(
    '10000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000004',
    array(select distinct permission.name from public.user_roles role_assignment
      join public.role_permissions grant_entry on grant_entry.role_id=role_assignment.role_id
      join public.permissions permission on permission.id=grant_entry.permission_id
      where role_assignment.user_id='80000000-0000-4000-8000-000000000004'
        and role_assignment.hotel_id='10000000-0000-4000-8000-000000000001'),
    '{}'::jsonb)->>'total')::integer=1),
  'assert_training_scenario reception must see exactly one actionable pending item'
);
select pg_temp.assert_training_scenario(
  (select (public.list_operational_pending(
    '10000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003',
    array(select distinct permission.name from public.user_roles role_assignment
      join public.role_permissions grant_entry on grant_entry.role_id=role_assignment.role_id
      join public.permissions permission on permission.id=grant_entry.permission_id
      where role_assignment.user_id='80000000-0000-4000-8000-000000000003'
        and role_assignment.hotel_id='10000000-0000-4000-8000-000000000002'),
    '{}'::jsonb)->>'total')::integer=0),
  'assert_training_scenario Horizonte must not see Aurora pending items'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.inventory_positions where id='a2000000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.commercial_partners where id='a3010000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001'),
  'assert_training_scenario orientation contains residue from another lesson'
);
