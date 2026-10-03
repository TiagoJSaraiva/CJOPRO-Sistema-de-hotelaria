-- Os filtros selecionam a fila; o resumo conta todo o conjunto autorizado do hotel.
create or replace function public.list_operational_pending(p_hotel_id uuid,p_user_id uuid,p_permissions text[],p_filters jsonb default '{}')
returns jsonb language sql stable set search_path=public as $$
  with visible as (
    select p.*,r.read_at,u.name assignee_name from public.operational_pending p
    left join public.operational_pending_reads r on r.pending_id=p.id and r.user_id=p_user_id
    left join public.users u on u.id=p.assigned_to
    where p.hotel_id=p_hotel_id and public.can_read_operational_pending(p,p_user_id,p_permissions)
  ), filtered as (
    select * from visible where
      (coalesce(p_filters->>'source','')='' or source=p_filters->>'source') and
      (coalesce(p_filters->>'kind','')='' or kind=p_filters->>'kind') and
      (coalesce(p_filters->>'severity','')='' or severity=p_filters->>'severity') and
      (coalesce(p_filters->>'status','')='' or status=p_filters->>'status') and
      (coalesce(p_filters->>'assignee','')='' or (p_filters->>'assignee'='me' and assigned_to=p_user_id) or (p_filters->>'assignee'='unassigned' and status='open')) and
      (coalesce(p_filters->>'read','')='' or (p_filters->>'read'='read' and read_at is not null) or (p_filters->>'read'='unread' and read_at is null and status<>'resolved'))
  ), paged as (
    select * from filtered order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,opened_at,id
    limit 30 offset (greatest(1,coalesce((p_filters->>'page')::integer,1))-1)*30
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'source',source,'kind',kind,'entity_id',entity_id,'title',title,'href',case
      when source='consumption' and (
        (kind='guest_balance' and not ('access_reservations_calendar'=any(p_permissions))) or
        (kind='critical_stock' and not ('read_inventory'=any(p_permissions))) or
        (kind='agreement_expiry' and not ('read_commercial_partners'=any(p_permissions)))
      ) then '/dashboard/consumption/analytics' else href end,'severity',severity,'status',status,
    'assigned_to',assigned_to,'assignee_name',assignee_name,'version',version,'opened_at',opened_at,'resolved_at',resolved_at,'resolution_reason',resolution_reason,'read',read_at is not null
  )) from paged),'[]'::jsonb),'total',(select count(*) from filtered),
  'summary',jsonb_build_object('open',(select count(*) from visible where status='open'),'claimed',(select count(*) from visible where status='claimed'),'resolved',(select count(*) from visible where status='resolved'),'unread',(select count(*) from visible where read_at is null and status<>'resolved')),
  'sync',jsonb_build_object('last_success_at',(select last_success_at from public.operational_pending_sync where hotel_id=p_hotel_id),'error_message',(select error_message from public.operational_pending_sync where hotel_id=p_hotel_id)));
$$;
