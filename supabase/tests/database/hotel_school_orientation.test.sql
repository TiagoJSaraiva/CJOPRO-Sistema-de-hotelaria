begin;
select plan(13);

create function pg_temp.orientation_permissions(p_user_id uuid)
returns text[] language sql stable as $$
  select coalesce(array_agg(distinct permission.name),array[]::text[])
  from public.user_roles role_assignment
  join public.role_permissions grant_entry on grant_entry.role_id=role_assignment.role_id
  join public.permissions permission on permission.id=grant_entry.permission_id
  where role_assignment.user_id=p_user_id
$$;

select is(
  jsonb_array_length(public.get_management_alerts('10000000-0000-4000-8000-000000000001')->'guest_balances'),
  0,'seed alone has no reception guest-balance alert'
);
select is(
  (public.prepare_training_scenario(
    '10000000-0000-4000-8000-000000000001','orientation',2,'Orientation pgTAP',
    '80000000-0000-4000-8000-000000000002')->>'clock_mode'),
  'frozen','orientation freezes the Aurora operational clock'
);
select is(
  (public.act_training_clock(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','set','at','2030-01-10T12:00:00-03:00',
      'expected_version',(select version from public.hotel_training_environments
        where hotel_id='10000000-0000-4000-8000-000000000001'),
      'reason','Fixed orientation test date'))->>'result'),
  'ok','orientation can use a deterministic operational date'
);

update public.stays set
  checkout_date_expected=public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+1+time '11:00'
where id='91000000-0000-4000-8000-000000000002';
update public.consumption_management_settings set guest_balance_alert_days=1
where hotel_id='10000000-0000-4000-8000-000000000001';

select is(
  jsonb_array_length(public.get_management_alerts('10000000-0000-4000-8000-000000000001')->'guest_balances'),
  1,'active stay balance becomes an operational alert inside the one-day window'
);
select is(
  (public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001',null)->>'result'),
  'ok','reconciliation materializes the business alert'
);
select is(
  (select count(*)::integer from public.operational_pending p
   where p.hotel_id='10000000-0000-4000-8000-000000000001'
     and p.kind='guest_balance' and p.entity_id='91000000-0000-4000-8000-000000000002'
     and p.status='open' and p.assigned_to is null),
  1,'reception pending starts open and unassigned'
);
select is(
  (public.list_operational_pending(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
    pg_temp.orientation_permissions('80000000-0000-4000-8000-000000000004'),'{}'::jsonb)->>'total')::integer,
  1,'reception sees its guest-balance pending'
);
select is(
  (public.list_operational_pending(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',
    pg_temp.orientation_permissions('80000000-0000-4000-8000-000000000003'),'{}'::jsonb)->>'total')::integer,
  0,'Horizonte manager cannot see Aurora pending items'
);
select is(
  (public.act_operational_pending(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',
    pg_temp.orientation_permissions('80000000-0000-4000-8000-000000000003'),
    array(select id from public.operational_pending where kind='daily_close'
      and hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'read')->>'result'),
  'not_found','Horizonte manager cannot act on an Aurora cash pending item'
);
select is(
  (public.act_operational_pending(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
    pg_temp.orientation_permissions('80000000-0000-4000-8000-000000000004'),
    array(select id from public.operational_pending where kind='guest_balance'
      and hotel_id='10000000-0000-4000-8000-000000000001'),'read')->>'result'),
  'ok','reception can mark the item as read'
);
select ok(
  exists(select 1 from public.operational_pending p
    join public.operational_pending_reads r on r.pending_id=p.id
    where p.kind='guest_balance' and p.hotel_id='10000000-0000-4000-8000-000000000001'
      and p.status='open' and r.user_id='80000000-0000-4000-8000-000000000004'),
  'reading does not resolve the pending item'
);
select is(
  (public.act_operational_pending(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004',
    pg_temp.orientation_permissions('80000000-0000-4000-8000-000000000004'),
    array(select id from public.operational_pending where kind='guest_balance'
      and hotel_id='10000000-0000-4000-8000-000000000001'),'claim',1)->>'result'),
  'ok','reception can assume the pending item'
);
select ok(
  exists(select 1 from public.operational_pending p
    where p.kind='guest_balance' and p.hotel_id='10000000-0000-4000-8000-000000000001'
      and p.status='claimed' and p.assigned_to='80000000-0000-4000-8000-000000000004')
  and (select coalesce(sum(case when direction='debit' then amount else -amount end),0)>0
       from public.stay_folio_entries where stay_id='91000000-0000-4000-8000-000000000002'),
  'assuming does not settle the underlying stay balance'
);

select * from finish();
rollback;
