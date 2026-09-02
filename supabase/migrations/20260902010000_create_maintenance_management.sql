alter type public.maintenance_occurrence_kind add value if not exists 'preventive';

create type public.maintenance_recurrence_unit as enum ('daily', 'weekly', 'monthly', 'yearly');
create type public.maintenance_preventive_plan_status as enum ('active', 'paused', 'inactive');
create type public.maintenance_preventive_run_status as enum ('scheduled', 'generated', 'deferred', 'skipped', 'rescheduled');
create type public.maintenance_supplier_status as enum ('active', 'inactive');
create type public.maintenance_contract_status as enum ('draft', 'active', 'expired', 'terminated');
create type public.maintenance_contract_kind as enum ('fixed', 'per_service', 'warranty', 'other');
create type public.maintenance_supplier_work_status as enum ('not_sent', 'sent', 'accepted', 'in_service', 'completed', 'canceled');
create type public.maintenance_asset_lifecycle as enum ('active', 'out_of_service', 'retired');
create type public.maintenance_notification_status as enum ('unread', 'read', 'dismissed');
create type public.maintenance_automation_status as enum ('running', 'completed', 'failed');

create table public.maintenance_suppliers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,
  legal_name text,
  tax_document text,
  email text,
  phone text,
  specialties text[] not null default '{}',
  notes text,
  status public.maintenance_supplier_status not null default 'active',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_suppliers_name_check check (length(btrim(name)) between 2 and 160),
  constraint maintenance_suppliers_hotel_name_key unique (hotel_id, name)
);

create table public.maintenance_supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  supplier_id uuid not null references public.maintenance_suppliers(id) on delete restrict,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_supplier_contacts_name_check check (length(btrim(name)) between 2 and 120),
  constraint maintenance_supplier_contacts_channel_check check (email is not null or phone is not null)
);

create table public.maintenance_contracts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  supplier_id uuid not null references public.maintenance_suppliers(id) on delete restrict,
  contract_number text not null,
  kind public.maintenance_contract_kind not null default 'other',
  status public.maintenance_contract_status not null default 'draft',
  starts_on date not null,
  ends_on date,
  renewal_notice_on date,
  scope_notes text,
  response_hours integer,
  resolution_hours integer,
  commercial_terms text,
  contract_amount numeric(12,2),
  currency text,
  created_by uuid not null references public.users(id) on delete restrict,
  terminated_by uuid references public.users(id) on delete restrict,
  terminated_at timestamptz,
  termination_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_contracts_number_check check (length(btrim(contract_number)) between 1 and 100),
  constraint maintenance_contracts_period_check check (ends_on is null or ends_on >= starts_on),
  constraint maintenance_contracts_sla_check check (
    (response_hours is null or response_hours > 0) and (resolution_hours is null or resolution_hours > 0)
  ),
  constraint maintenance_contracts_amount_check check (contract_amount is null or contract_amount >= 0),
  constraint maintenance_contracts_currency_check check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint maintenance_contracts_termination_check check (
    (status <> 'terminated') or (terminated_by is not null and terminated_at is not null and nullif(btrim(termination_reason), '') is not null)
  ),
  constraint maintenance_contracts_hotel_number_key unique (hotel_id, contract_number)
);

create table public.maintenance_contract_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  contract_id uuid not null references public.maintenance_contracts(id) on delete restrict,
  category_id uuid not null references public.maintenance_categories(id) on delete restrict,
  is_active boolean not null default true,
  constraint maintenance_contract_categories_key unique (contract_id, category_id)
);

create table public.maintenance_contract_locations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  contract_id uuid not null references public.maintenance_contracts(id) on delete restrict,
  location_id uuid not null references public.maintenance_locations(id) on delete restrict,
  is_active boolean not null default true,
  constraint maintenance_contract_locations_key unique (contract_id, location_id)
);

create table public.maintenance_sla_policies (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  category_id uuid references public.maintenance_categories(id) on delete restrict,
  priority public.maintenance_priority not null,
  name text not null,
  response_hours integer not null,
  resolution_hours integer not null,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_sla_policies_name_check check (length(btrim(name)) between 2 and 120),
  constraint maintenance_sla_policies_hours_check check (response_hours > 0 and resolution_hours > 0)
);

create unique index maintenance_sla_policy_category_priority_key
  on public.maintenance_sla_policies(hotel_id, category_id, priority)
  where category_id is not null and priority is not null and is_active;
create unique index maintenance_sla_policy_priority_key
  on public.maintenance_sla_policies(hotel_id, priority)
  where category_id is null and priority is not null and is_active;

create table public.maintenance_preventive_plans (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,
  category_id uuid not null references public.maintenance_categories(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete restrict,
  location_id uuid references public.maintenance_locations(id) on delete restrict,
  assigned_to uuid not null references public.users(id) on delete restrict,
  supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  contract_id uuid references public.maintenance_contracts(id) on delete restrict,
  priority public.maintenance_priority not null default 'normal',
  instructions text not null,
  requires_inspection boolean not null default false,
  blocking_recommended boolean not null default false,
  recurrence_unit public.maintenance_recurrence_unit not null,
  recurrence_interval integer not null default 1,
  recurrence_day smallint not null,
  starts_on date not null,
  ends_on date,
  local_time time not null default '09:00',
  generation_lead_days integer not null default 0,
  completion_due_hours integer not null default 24,
  next_due_date date not null,
  status public.maintenance_preventive_plan_status not null default 'active',
  created_by uuid not null references public.users(id) on delete restrict,
  paused_by uuid references public.users(id) on delete restrict,
  paused_at timestamptz,
  deactivated_by uuid references public.users(id) on delete restrict,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_preventive_plans_name_check check (length(btrim(name)) between 3 and 160),
  constraint maintenance_preventive_plans_target_check check ((room_id is null) <> (location_id is null)),
  constraint maintenance_preventive_plans_interval_check check (recurrence_interval between 1 and 365),
  constraint maintenance_preventive_plans_day_check check (recurrence_day between 1 and 31),
  constraint maintenance_preventive_plans_period_check check (ends_on is null or ends_on >= starts_on),
  constraint maintenance_preventive_plans_lead_check check (generation_lead_days between 0 and 365),
  constraint maintenance_preventive_plans_due_check check (completion_due_hours > 0)
);

create table public.maintenance_preventive_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  plan_id uuid not null references public.maintenance_preventive_plans(id) on delete restrict,
  position integer not null,
  description text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint maintenance_preventive_plan_tasks_position_check check (position >= 0),
  constraint maintenance_preventive_plan_tasks_description_check check (length(btrim(description)) between 2 and 500)
);
create unique index maintenance_preventive_plan_tasks_position_key
  on public.maintenance_preventive_plan_tasks(plan_id, position) where is_active;

create table public.maintenance_preventive_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  plan_id uuid not null references public.maintenance_preventive_plans(id) on delete restrict,
  scheduled_for timestamptz not null,
  scheduled_local_date date not null,
  status public.maintenance_preventive_run_status not null default 'scheduled',
  occurrence_id uuid references public.maintenance_occurrences(id) on delete restrict,
  work_order_id uuid references public.maintenance_work_orders(id) on delete restrict,
  snapshot jsonb not null,
  decision_reason text,
  decided_by uuid references public.users(id) on delete restrict,
  decided_at timestamptz,
  rescheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_preventive_runs_plan_date_key unique (plan_id, scheduled_local_date),
  constraint maintenance_preventive_runs_generated_check check (
    status <> 'generated' or (occurrence_id is not null and work_order_id is not null)
  ),
  constraint maintenance_preventive_runs_decision_check check (
    status not in ('skipped', 'rescheduled') or (decided_by is not null and decided_at is not null and nullif(btrim(decision_reason), '') is not null)
  )
);

create table public.maintenance_work_order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete restrict,
  source_task_id uuid references public.maintenance_preventive_plan_tasks(id) on delete set null,
  position integer not null,
  description text not null,
  is_required boolean not null default true,
  completed_by uuid references public.users(id) on delete restrict,
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz not null default now(),
  constraint maintenance_work_order_checklist_position_key unique (work_order_id, position),
  constraint maintenance_work_order_checklist_completion_check check (
    (completed_at is null and completed_by is null) or (completed_at is not null and completed_by is not null)
  )
);

create table public.maintenance_notifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  href text not null,
  entity_type text not null,
  entity_id uuid not null,
  threshold text not null,
  status public.maintenance_notification_status not null default 'unread',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint maintenance_notifications_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint maintenance_notifications_status_check check (
    (status = 'unread' and read_at is null and dismissed_at is null)
    or (status = 'read' and read_at is not null and dismissed_at is null)
    or (status = 'dismissed' and dismissed_at is not null)
  ),
  constraint maintenance_notifications_dedupe_key unique (hotel_id, recipient_id, entity_type, entity_id, kind, threshold)
);

create table public.maintenance_automation_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  run_key text not null unique,
  status public.maintenance_automation_status not null default 'running',
  trigger_kind text not null,
  local_date date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  counters jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint maintenance_automation_runs_finish_check check (
    (status = 'running' and finished_at is null) or (status <> 'running' and finished_at is not null)
  )
);

create table public.maintenance_management_attachments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  contract_id uuid references public.maintenance_contracts(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  removed_at timestamptz,
  removed_by uuid references public.users(id) on delete restrict,
  removal_reason text,
  created_at timestamptz not null default now(),
  constraint maintenance_management_attachments_target_check check ((supplier_id is null) <> (contract_id is null)),
  constraint maintenance_management_attachments_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint maintenance_management_attachments_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint maintenance_management_attachments_removal_check check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removed_by is not null and nullif(btrim(removal_reason), '') is not null)
  )
);

alter table public.maintenance_locations
  add column asset_tag text,
  add column manufacturer text,
  add column model text,
  add column serial_number text,
  add column installed_on date,
  add column warranty_ends_on date,
  add column supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  add column contract_id uuid references public.maintenance_contracts(id) on delete restrict,
  add column lifecycle_status public.maintenance_asset_lifecycle;

alter table public.maintenance_locations add constraint maintenance_locations_asset_fields_check check (
  kind = 'equipment' or (
    asset_tag is null and manufacturer is null and model is null and serial_number is null and installed_on is null
    and warranty_ends_on is null and supplier_id is null and contract_id is null and lifecycle_status is null
  )
);
create unique index maintenance_locations_asset_tag_key on public.maintenance_locations(hotel_id, asset_tag) where asset_tag is not null;

alter table public.maintenance_occurrences
  add column preventive_plan_id uuid references public.maintenance_preventive_plans(id) on delete restrict,
  add column preventive_run_id uuid references public.maintenance_preventive_runs(id) on delete restrict,
  add column sla_policy_id uuid references public.maintenance_sla_policies(id) on delete restrict,
  add column sla_snapshot jsonb,
  add column sla_response_due_at timestamptz,
  add column sla_resolution_due_at timestamptz,
  add column operational_resolved_at timestamptz;

alter table public.maintenance_work_orders
  add column supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  add column contract_id uuid references public.maintenance_contracts(id) on delete restrict,
  add column supplier_status public.maintenance_supplier_work_status not null default 'not_sent',
  add column supplier_external_reference text,
  add column supplier_sent_at timestamptz,
  add column supplier_accepted_at timestamptz,
  add column supplier_completed_at timestamptz;

alter table public.maintenance_cost_items
  add column supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  add column contract_id uuid references public.maintenance_contracts(id) on delete restrict;
alter table public.maintenance_recoveries
  add column supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  add column contract_id uuid references public.maintenance_contracts(id) on delete restrict;

create index idx_maintenance_preventive_plans_due on public.maintenance_preventive_plans(hotel_id, status, next_due_date);
create index idx_maintenance_preventive_runs_queue on public.maintenance_preventive_runs(hotel_id, status, scheduled_for);
create index idx_maintenance_checklist_order on public.maintenance_work_order_checklist_items(work_order_id, position);
create index idx_maintenance_notifications_inbox on public.maintenance_notifications(hotel_id, recipient_id, status, created_at desc);
create index idx_maintenance_sla_response on public.maintenance_occurrences(hotel_id, sla_response_due_at) where triaged_at is null and status <> 'canceled';
create index idx_maintenance_sla_resolution on public.maintenance_occurrences(hotel_id, sla_resolution_due_at) where operational_resolved_at is null and status <> 'canceled';
create index idx_maintenance_contracts_expiry on public.maintenance_contracts(hotel_id, ends_on) where status = 'active';
create index idx_maintenance_locations_warranty on public.maintenance_locations(hotel_id, warranty_ends_on) where kind = 'equipment' and is_active;

create trigger trg_maintenance_suppliers_set_updated_at before update on public.maintenance_suppliers for each row execute function public.set_updated_at();
create trigger trg_maintenance_supplier_contacts_set_updated_at before update on public.maintenance_supplier_contacts for each row execute function public.set_updated_at();
create trigger trg_maintenance_contracts_set_updated_at before update on public.maintenance_contracts for each row execute function public.set_updated_at();
create trigger trg_maintenance_sla_policies_set_updated_at before update on public.maintenance_sla_policies for each row execute function public.set_updated_at();
create trigger trg_maintenance_preventive_plans_set_updated_at before update on public.maintenance_preventive_plans for each row execute function public.set_updated_at();
create trigger trg_maintenance_preventive_runs_set_updated_at before update on public.maintenance_preventive_runs for each row execute function public.set_updated_at();

create or replace function public.create_default_maintenance_sla_policies(p_hotel_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.maintenance_sla_policies(hotel_id, priority, name, response_hours, resolution_hours)
  values
    (p_hotel_id, 'critical', 'SLA crítico', 1, 8),
    (p_hotel_id, 'high', 'SLA alto', 4, 24),
    (p_hotel_id, 'normal', 'SLA normal', 12, 72),
    (p_hotel_id, 'low', 'SLA baixo', 24, 168)
  on conflict do nothing;
$$;

create or replace function public.provision_maintenance_management_for_hotel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_default_maintenance_sla_policies(new.id);
  return new;
end;
$$;

create trigger trg_hotels_provision_maintenance_management
  after insert on public.hotels for each row execute function public.provision_maintenance_management_for_hotel();

select public.create_default_maintenance_sla_policies(id) from public.hotels;

create or replace function public.next_maintenance_preventive_date(
  p_current date,
  p_unit public.maintenance_recurrence_unit,
  p_interval integer,
  p_recurrence_day integer
)
returns date language plpgsql immutable as $$
declare
  v_base date;
  v_last_day integer;
begin
  if p_unit = 'daily' then return p_current + p_interval; end if;
  if p_unit = 'weekly' then return p_current + (p_interval * 7); end if;
  if p_unit = 'monthly' then
    v_base := (date_trunc('month', p_current) + make_interval(months => p_interval))::date;
    v_last_day := extract(day from (v_base + interval '1 month - 1 day'))::integer;
    return v_base + least(p_recurrence_day, v_last_day) - 1;
  end if;
  v_base := make_date(extract(year from p_current)::integer + p_interval, extract(month from p_current)::integer, 1);
  v_last_day := extract(day from (v_base + interval '1 month - 1 day'))::integer;
  return v_base + least(p_recurrence_day, v_last_day) - 1;
end;
$$;

create or replace function public.apply_maintenance_sla_snapshot()
returns trigger language plpgsql set search_path = public as $$
declare
  v_policy public.maintenance_sla_policies%rowtype;
begin
  if new.sla_snapshot is not null then return new; end if;
  select * into v_policy
  from public.maintenance_sla_policies policy
  where policy.hotel_id = new.hotel_id and policy.is_active
    and (policy.category_id is null or policy.category_id = new.category_id)
    and (policy.priority is null or policy.priority = new.priority)
  order by (policy.category_id is not null)::integer desc, (policy.priority is not null)::integer desc
  limit 1;
  if found then
    new.sla_policy_id := v_policy.id;
    new.sla_snapshot := jsonb_build_object(
      'policy_id', v_policy.id, 'name', v_policy.name,
      'response_hours', v_policy.response_hours, 'resolution_hours', v_policy.resolution_hours
    );
    new.sla_response_due_at := new.created_at + make_interval(hours => v_policy.response_hours);
    new.sla_resolution_due_at := new.created_at + make_interval(hours => v_policy.resolution_hours);
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_occurrences_apply_sla
  before insert on public.maintenance_occurrences for each row execute function public.apply_maintenance_sla_snapshot();

create or replace function public.validate_maintenance_management_scope()
returns trigger language plpgsql set search_path = public as $$
declare
  v_hotel uuid;
  v_supplier uuid;
  v_kind public.maintenance_location_kind;
begin
  if tg_table_name = 'maintenance_suppliers' then
    if not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id) then raise exception 'supplier user crosses hotel scope' using errcode = '23514'; end if;
    return new;
  elsif tg_table_name = 'maintenance_supplier_contacts' then
    if not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id) then raise exception 'supplier contact user crosses hotel scope' using errcode = '23514'; end if;
    select hotel_id into v_hotel from public.maintenance_suppliers where id = new.supplier_id;
  elsif tg_table_name = 'maintenance_contracts' then
    if not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id)
      or (new.terminated_by is not null and not public.maintenance_user_has_hotel_scope(new.terminated_by, new.hotel_id)) then raise exception 'contract user crosses hotel scope' using errcode = '23514'; end if;
    select hotel_id into v_hotel from public.maintenance_suppliers where id = new.supplier_id;
  elsif tg_table_name = 'maintenance_preventive_plans' then
    if not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id) then raise exception 'preventive plan user crosses hotel scope' using errcode = '23514'; end if;
    select hotel_id into v_hotel from public.maintenance_categories where id = new.category_id;
    if v_hotel is distinct from new.hotel_id then raise exception 'preventive category crosses hotel scope' using errcode = '23514'; end if;
    if not public.maintenance_user_has_hotel_scope(new.assigned_to, new.hotel_id) then raise exception 'preventive assignee crosses hotel scope' using errcode = '23514'; end if;
    if new.room_id is not null then select hotel_id into v_hotel from public.rooms where id = new.room_id;
    else select hotel_id into v_hotel from public.maintenance_locations where id = new.location_id; end if;
    if v_hotel is distinct from new.hotel_id then raise exception 'preventive target crosses hotel scope' using errcode = '23514'; end if;
    if new.supplier_id is not null then
      select hotel_id into v_hotel from public.maintenance_suppliers where id = new.supplier_id and status = 'active';
      if v_hotel is distinct from new.hotel_id then raise exception 'preventive supplier is inactive or crosses hotel scope' using errcode = '23514'; end if;
    end if;
    if new.contract_id is not null then
      select hotel_id, supplier_id into v_hotel, v_supplier from public.maintenance_contracts where id = new.contract_id and status = 'active';
      if v_hotel is distinct from new.hotel_id or (new.supplier_id is not null and v_supplier is distinct from new.supplier_id) then
        raise exception 'preventive contract is inactive or crosses scope' using errcode = '23514';
      end if;
    end if;
    return new;
  elsif tg_table_name = 'maintenance_management_attachments' then
    if new.supplier_id is not null then select hotel_id into v_hotel from public.maintenance_suppliers where id = new.supplier_id;
    else select hotel_id into v_hotel from public.maintenance_contracts where id = new.contract_id; end if;
    if not public.maintenance_user_has_hotel_scope(new.uploaded_by, new.hotel_id)
      or (new.removed_by is not null and not public.maintenance_user_has_hotel_scope(new.removed_by, new.hotel_id)) then
      raise exception 'management attachment user crosses hotel scope' using errcode = '23514';
    end if;
  else
    return new;
  end if;
  if v_hotel is distinct from new.hotel_id then raise exception 'maintenance management reference crosses hotel scope' using errcode = '23514'; end if;
  return new;
end;
$$;

create trigger trg_maintenance_suppliers_validate_scope before insert or update on public.maintenance_suppliers for each row execute function public.validate_maintenance_management_scope();
create trigger trg_maintenance_supplier_contacts_validate_scope before insert or update on public.maintenance_supplier_contacts for each row execute function public.validate_maintenance_management_scope();
create trigger trg_maintenance_contracts_validate_scope before insert or update on public.maintenance_contracts for each row execute function public.validate_maintenance_management_scope();
create trigger trg_maintenance_preventive_plans_validate_scope before insert or update on public.maintenance_preventive_plans for each row execute function public.validate_maintenance_management_scope();
create trigger trg_maintenance_management_attachments_validate_scope before insert or update on public.maintenance_management_attachments for each row execute function public.validate_maintenance_management_scope();

create or replace function public.validate_maintenance_management_reference_scope()
returns trigger language plpgsql set search_path = public as $$
declare v_hotel uuid; v_supplier uuid; v_occurrence uuid;
begin
  if tg_table_name = 'maintenance_contract_categories' then
    select hotel_id into v_hotel from public.maintenance_contracts where id = new.contract_id;
    if v_hotel is distinct from new.hotel_id or (select hotel_id from public.maintenance_categories where id = new.category_id) is distinct from new.hotel_id then
      raise exception 'contract category crosses hotel scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_contract_locations' then
    select hotel_id into v_hotel from public.maintenance_contracts where id = new.contract_id;
    if v_hotel is distinct from new.hotel_id or (select hotel_id from public.maintenance_locations where id = new.location_id) is distinct from new.hotel_id then
      raise exception 'contract location crosses hotel scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_sla_policies' then
    if new.category_id is not null and (select hotel_id from public.maintenance_categories where id = new.category_id) is distinct from new.hotel_id then
      raise exception 'SLA category crosses hotel scope' using errcode = '23514';
    end if;
    if new.created_by is not null and not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id) then raise exception 'SLA user crosses hotel scope' using errcode = '23514'; end if;
  elsif tg_table_name = 'maintenance_preventive_plan_tasks' then
    select hotel_id into v_hotel from public.maintenance_preventive_plans where id = new.plan_id;
    if v_hotel is distinct from new.hotel_id then raise exception 'preventive task crosses hotel scope' using errcode = '23514'; end if;
  elsif tg_table_name = 'maintenance_preventive_runs' then
    select hotel_id into v_hotel from public.maintenance_preventive_plans where id = new.plan_id;
    if v_hotel is distinct from new.hotel_id then raise exception 'preventive run crosses hotel scope' using errcode = '23514'; end if;
    if new.occurrence_id is not null then
      select hotel_id into v_hotel from public.maintenance_occurrences where id = new.occurrence_id;
      if v_hotel is distinct from new.hotel_id then raise exception 'preventive run occurrence crosses hotel scope' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'maintenance_work_order_checklist_items' then
    select hotel_id, occurrence_id into v_hotel, v_occurrence from public.maintenance_work_orders where id = new.work_order_id;
    if v_hotel is distinct from new.hotel_id or (new.completed_by is not null and not public.maintenance_user_has_hotel_scope(new.completed_by, new.hotel_id)) then
      raise exception 'checklist item crosses hotel scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_notifications' then
    if not public.maintenance_user_has_hotel_scope(new.recipient_id, new.hotel_id) then raise exception 'notification recipient crosses hotel scope' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_contract_categories_validate before insert or update on public.maintenance_contract_categories for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_contract_locations_validate before insert or update on public.maintenance_contract_locations for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_sla_policies_validate before insert or update on public.maintenance_sla_policies for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_preventive_plan_tasks_validate before insert or update on public.maintenance_preventive_plan_tasks for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_preventive_runs_validate before insert or update on public.maintenance_preventive_runs for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_work_order_checklist_validate before insert or update on public.maintenance_work_order_checklist_items for each row execute function public.validate_maintenance_management_reference_scope();
create trigger trg_maintenance_notifications_validate before insert or update on public.maintenance_notifications for each row execute function public.validate_maintenance_management_reference_scope();

create or replace function public.validate_maintenance_management_links()
returns trigger language plpgsql set search_path = public as $$
declare v_hotel uuid; v_supplier uuid; v_contract_supplier uuid; v_kind public.maintenance_location_kind;
begin
  if tg_table_name = 'maintenance_locations' then
    if new.kind = 'equipment' and new.lifecycle_status is null then new.lifecycle_status := 'active'; end if;
    v_supplier := new.supplier_id;
  elsif tg_table_name = 'maintenance_occurrences' then
    if new.preventive_plan_id is not null then
      select hotel_id into v_hotel from public.maintenance_preventive_plans where id = new.preventive_plan_id;
      if v_hotel is distinct from new.hotel_id or new.kind <> 'preventive' then raise exception 'preventive occurrence crosses scope or has invalid kind' using errcode = '23514'; end if;
    end if;
    if new.sla_policy_id is not null and (select hotel_id from public.maintenance_sla_policies where id = new.sla_policy_id) is distinct from new.hotel_id then
      raise exception 'occurrence SLA crosses hotel scope' using errcode = '23514';
    end if;
    return new;
  elsif tg_table_name = 'maintenance_work_orders' then
    v_supplier := new.supplier_id;
  elsif tg_table_name = 'maintenance_cost_items' or tg_table_name = 'maintenance_recoveries' then
    v_supplier := new.supplier_id;
  end if;
  if v_supplier is not null then
    select hotel_id into v_hotel from public.maintenance_suppliers where id = v_supplier;
    if v_hotel is distinct from new.hotel_id then raise exception 'supplier crosses hotel scope' using errcode = '23514'; end if;
  end if;
  if new.contract_id is not null then
    select hotel_id, supplier_id into v_hotel, v_contract_supplier from public.maintenance_contracts where id = new.contract_id;
    if v_hotel is distinct from new.hotel_id or (v_supplier is not null and v_contract_supplier is distinct from v_supplier) then
      raise exception 'contract crosses hotel or supplier scope' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_locations_validate_management before insert or update on public.maintenance_locations for each row execute function public.validate_maintenance_management_links();
create trigger trg_maintenance_occurrences_validate_management before insert or update on public.maintenance_occurrences for each row execute function public.validate_maintenance_management_links();
create trigger trg_maintenance_work_orders_validate_management before insert or update on public.maintenance_work_orders for each row execute function public.validate_maintenance_management_links();
create trigger trg_maintenance_cost_items_validate_management before insert or update on public.maintenance_cost_items for each row execute function public.validate_maintenance_management_links();
create trigger trg_maintenance_recoveries_validate_management before insert or update on public.maintenance_recoveries for each row execute function public.validate_maintenance_management_links();

create or replace function public.complete_maintenance_checklist_item(
  p_hotel_id uuid, p_work_order_id uuid, p_item_id uuid, p_actor_id uuid,
  p_completed boolean, p_notes text default null
)
returns uuid language plpgsql set search_path = public as $$
declare v_occurrence uuid;
begin
  select occurrence_id into v_occurrence from public.maintenance_work_orders
  where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  update public.maintenance_work_order_checklist_items set
    completed_by = case when p_completed then p_actor_id else null end,
    completed_at = case when p_completed then now() else null end,
    completion_notes = nullif(btrim(p_notes), '')
  where id = p_item_id and work_order_id = p_work_order_id and hotel_id = p_hotel_id;
  if not found then return null; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_occurrence, p_work_order_id, p_actor_id,
    case when p_completed then 'checklist_completed' else 'checklist_reopened' end,
    p_notes, jsonb_build_object('checklist_item_id', p_item_id));
  return v_occurrence;
end;
$$;

create or replace function public.upsert_maintenance_preventive_plan(
  p_hotel_id uuid, p_actor_id uuid, p_plan_id uuid, p_name text, p_category_id uuid,
  p_room_id uuid, p_location_id uuid, p_assigned_to uuid, p_supplier_id uuid, p_contract_id uuid,
  p_priority public.maintenance_priority, p_instructions text, p_requires_inspection boolean,
  p_blocking_recommended boolean, p_recurrence_unit public.maintenance_recurrence_unit,
  p_recurrence_interval integer, p_starts_on date, p_ends_on date, p_local_time time,
  p_generation_lead_days integer, p_completion_due_hours integer, p_tasks jsonb
)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid; v_task jsonb; v_task_id uuid;
begin
  if p_plan_id is null then
    insert into public.maintenance_preventive_plans(
      hotel_id, name, category_id, room_id, location_id, assigned_to, supplier_id, contract_id,
      priority, instructions, requires_inspection, blocking_recommended, recurrence_unit,
      recurrence_interval, recurrence_day, starts_on, ends_on, local_time, generation_lead_days,
      completion_due_hours, next_due_date, created_by
    ) values (
      p_hotel_id, p_name, p_category_id, p_room_id, p_location_id, p_assigned_to, p_supplier_id, p_contract_id,
      p_priority, p_instructions, p_requires_inspection, p_blocking_recommended, p_recurrence_unit,
      p_recurrence_interval, extract(day from p_starts_on)::integer, p_starts_on, p_ends_on, p_local_time,
      p_generation_lead_days, p_completion_due_hours, p_starts_on, p_actor_id
    ) returning id into v_id;
  else
    select id into v_id from public.maintenance_preventive_plans where id = p_plan_id and hotel_id = p_hotel_id for update;
    if not found then return null; end if;
    update public.maintenance_preventive_plans set
      name = p_name, category_id = p_category_id, room_id = p_room_id, location_id = p_location_id,
      assigned_to = p_assigned_to, supplier_id = p_supplier_id, contract_id = p_contract_id,
      priority = p_priority, instructions = p_instructions, requires_inspection = p_requires_inspection,
      blocking_recommended = p_blocking_recommended, recurrence_unit = p_recurrence_unit,
      recurrence_interval = p_recurrence_interval, recurrence_day = extract(day from p_starts_on)::integer,
      starts_on = p_starts_on, ends_on = p_ends_on, local_time = p_local_time,
      generation_lead_days = p_generation_lead_days, completion_due_hours = p_completion_due_hours,
      next_due_date = greatest(next_due_date, p_starts_on)
    where id = v_id;
    update public.maintenance_preventive_plan_tasks set is_active = false where plan_id = v_id;
  end if;
  for v_task in select value from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb))
  loop
    v_task_id := nullif(v_task->>'id', '')::uuid;
    if v_task_id is not null and exists (select 1 from public.maintenance_preventive_plan_tasks where id = v_task_id and plan_id = v_id) then
      update public.maintenance_preventive_plan_tasks set
        position = (v_task->>'position')::integer, description = v_task->>'description',
        is_required = coalesce((v_task->>'is_required')::boolean, true), is_active = true
      where id = v_task_id;
    else
      insert into public.maintenance_preventive_plan_tasks(hotel_id, plan_id, position, description, is_required)
      values (p_hotel_id, v_id, (v_task->>'position')::integer, v_task->>'description', coalesce((v_task->>'is_required')::boolean, true));
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.upsert_maintenance_contract(
  p_hotel_id uuid, p_actor_id uuid, p_contract_id uuid, p_supplier_id uuid,
  p_contract_number text, p_kind public.maintenance_contract_kind,
  p_status public.maintenance_contract_status, p_starts_on date, p_ends_on date,
  p_renewal_notice_on date, p_scope_notes text, p_response_hours integer,
  p_resolution_hours integer, p_commercial_terms text, p_contract_amount numeric,
  p_currency text, p_category_ids uuid[], p_location_ids uuid[], p_termination_reason text default null
)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  if p_contract_id is null then
    insert into public.maintenance_contracts(
      hotel_id, supplier_id, contract_number, kind, status, starts_on, ends_on,
      renewal_notice_on, scope_notes, response_hours, resolution_hours,
      commercial_terms, contract_amount, currency, created_by
    ) values (
      p_hotel_id, p_supplier_id, p_contract_number, p_kind, p_status, p_starts_on,
      p_ends_on, p_renewal_notice_on, p_scope_notes, p_response_hours,
      p_resolution_hours, p_commercial_terms, p_contract_amount, p_currency, p_actor_id
    ) returning id into v_id;
  else
    select id into v_id from public.maintenance_contracts where id = p_contract_id and hotel_id = p_hotel_id for update;
    if not found then return null; end if;
    update public.maintenance_contracts set
      supplier_id = p_supplier_id, contract_number = p_contract_number, kind = p_kind,
      status = p_status, starts_on = p_starts_on, ends_on = p_ends_on,
      renewal_notice_on = p_renewal_notice_on, scope_notes = p_scope_notes,
      response_hours = p_response_hours, resolution_hours = p_resolution_hours,
      commercial_terms = p_commercial_terms, contract_amount = p_contract_amount,
      currency = p_currency,
      terminated_by = case when p_status = 'terminated' then p_actor_id else null end,
      terminated_at = case when p_status = 'terminated' then now() else null end,
      termination_reason = case when p_status = 'terminated' then p_termination_reason else null end
    where id = v_id;
    update public.maintenance_contract_categories set is_active = false where contract_id = v_id;
    update public.maintenance_contract_locations set is_active = false where contract_id = v_id;
  end if;
  insert into public.maintenance_contract_categories(hotel_id, contract_id, category_id)
  select p_hotel_id, v_id, value from unnest(coalesce(p_category_ids, array[]::uuid[])) value
  on conflict (contract_id, category_id) do update set is_active = true;
  insert into public.maintenance_contract_locations(hotel_id, contract_id, location_id)
  select p_hotel_id, v_id, value from unnest(coalesce(p_location_ids, array[]::uuid[])) value
  on conflict (contract_id, location_id) do update set is_active = true;
  return v_id;
end;
$$;

create or replace function public.transition_maintenance_supplier_work(
  p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_action text,
  p_supplier_id uuid default null, p_contract_id uuid default null,
  p_external_reference text default null, p_notes text default null
)
returns uuid language plpgsql set search_path = public as $$
declare v_order public.maintenance_work_orders%rowtype; v_next public.maintenance_supplier_work_status;
begin
  select * into v_order from public.maintenance_work_orders where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'send' and v_order.supplier_status in ('not_sent', 'canceled') and p_supplier_id is not null then v_next := 'sent';
  elsif p_action = 'accept' and v_order.supplier_status = 'sent' then v_next := 'accepted';
  elsif p_action = 'start' and v_order.supplier_status in ('sent', 'accepted') then v_next := 'in_service';
  elsif p_action = 'complete' and v_order.supplier_status = 'in_service' then v_next := 'completed';
  elsif p_action = 'cancel' and v_order.supplier_status in ('sent', 'accepted', 'in_service') then v_next := 'canceled';
  else raise exception 'Transição de fornecedor inválida.' using errcode = '23514'; end if;
  update public.maintenance_work_orders set
    supplier_id = case when p_action = 'send' then p_supplier_id else supplier_id end,
    contract_id = case when p_action = 'send' then p_contract_id else contract_id end,
    supplier_status = v_next,
    supplier_external_reference = case when p_action = 'send' then nullif(btrim(p_external_reference), '') else supplier_external_reference end,
    supplier_sent_at = case when p_action = 'send' then now() else supplier_sent_at end,
    supplier_accepted_at = case when p_action = 'accept' then now() else supplier_accepted_at end,
    supplier_completed_at = case when p_action = 'complete' then now() else null end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'supplier_' || p_action, p_notes,
    jsonb_build_object('supplier_id', p_supplier_id, 'contract_id', p_contract_id, 'status', v_next));
  return v_order.occurrence_id;
end;
$$;

create or replace function public.update_maintenance_operational_resolution()
returns trigger language plpgsql set search_path = public as $$
declare v_occurrence uuid;
begin
  v_occurrence := coalesce(new.occurrence_id, old.occurrence_id);
  if exists (select 1 from public.maintenance_work_orders where occurrence_id = v_occurrence)
    and not exists (
      select 1 from public.maintenance_work_orders
      where occurrence_id = v_occurrence and status not in ('completed', 'canceled')
    ) then
    update public.maintenance_occurrences set operational_resolved_at = coalesce(operational_resolved_at, now()) where id = v_occurrence;
  else
    update public.maintenance_occurrences set operational_resolved_at = null where id = v_occurrence;
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_work_orders_operational_resolution
  after insert or update of status on public.maintenance_work_orders
  for each row execute function public.update_maintenance_operational_resolution();

create or replace function public.notify_maintenance_recipient(
  p_hotel_id uuid, p_recipient_id uuid, p_kind text, p_severity text,
  p_title text, p_message text, p_href text, p_entity_type text, p_entity_id uuid, p_threshold text
)
returns boolean language plpgsql set search_path = public as $$
begin
  if p_recipient_id is null then return false; end if;
  insert into public.maintenance_notifications(
    hotel_id, recipient_id, kind, severity, title, message, href, entity_type, entity_id, threshold
  ) values (p_hotel_id, p_recipient_id, p_kind, p_severity, p_title, p_message, p_href, p_entity_type, p_entity_id, p_threshold)
  on conflict (hotel_id, recipient_id, entity_type, entity_id, kind, threshold) do nothing;
  return found;
end;
$$;

create or replace function public.notify_maintenance_managers(
  p_hotel_id uuid, p_kind text, p_severity text, p_title text, p_message text,
  p_href text, p_entity_type text, p_entity_id uuid, p_threshold text
)
returns integer language plpgsql set search_path = public as $$
declare v_count integer;
begin
  with recipients as (
    select distinct ur.user_id
    from public.user_roles ur
    join public.roles role on role.id = ur.role_id
    join public.role_permissions rp on rp.role_id = role.id
    join public.permissions permission on permission.id = rp.permission_id
    join public.users account on account.id = ur.user_id and account.is_active
    where (ur.hotel_id = p_hotel_id or (ur.hotel_id is null and role.role_type = 'SYSTEM_ROLE'))
      and permission.name in ('manage_maintenance_plans', 'manage_maintenance_sla', 'read_maintenance_analytics')
  ), inserted as (
    insert into public.maintenance_notifications(
      hotel_id, recipient_id, kind, severity, title, message, href, entity_type, entity_id, threshold
    )
    select p_hotel_id, user_id, p_kind, p_severity, p_title, p_message, p_href, p_entity_type, p_entity_id, p_threshold
    from recipients
    on conflict (hotel_id, recipient_id, entity_type, entity_id, kind, threshold) do nothing
    returning 1
  ) select count(*) into v_count from inserted;
  return v_count;
end;
$$;

create or replace function public.transition_maintenance_work_order(
  p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_action text,
  p_assigned_to uuid default null, p_waiting_reason public.maintenance_waiting_reason default null,
  p_notes text default null, p_diagnosis text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_order public.maintenance_work_orders%rowtype;
  v_next public.maintenance_work_order_status;
begin
  select * into v_order from public.maintenance_work_orders
  where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'assign' and v_order.status in ('pending', 'assigned', 'paused', 'waiting', 'in_progress') then
    v_next := case when p_assigned_to is null then 'pending' else 'assigned' end;
  elsif p_action = 'start' and v_order.status = 'assigned' then v_next := 'in_progress';
  elsif p_action = 'pause' and v_order.status = 'in_progress' then v_next := 'paused';
  elsif p_action = 'wait' and v_order.status = 'in_progress' and p_waiting_reason is not null then v_next := 'waiting';
  elsif p_action = 'resume' and v_order.status in ('paused', 'waiting') then v_next := 'in_progress';
  elsif p_action = 'complete' and v_order.status = 'in_progress' then
    if exists (
      select 1 from public.maintenance_work_order_checklist_items
      where work_order_id = p_work_order_id and is_required and completed_at is null
    ) then raise exception 'Há itens obrigatórios do checklist pendentes.' using errcode = '23514'; end if;
    v_next := case when v_order.requires_inspection then 'awaiting_inspection' else 'completed' end;
  elsif p_action = 'cancel' and v_order.status in ('pending', 'assigned', 'in_progress', 'paused', 'waiting') then v_next := 'canceled';
  elsif p_action = 'reopen' and v_order.status = 'completed' then
    v_next := case when v_order.assigned_to is null then 'pending' else 'in_progress' end;
  else
    raise exception 'Transição de ordem de trabalho inválida.' using errcode = '23514';
  end if;
  update public.maintenance_work_orders set
    status = v_next,
    assigned_to = case when p_action = 'assign' then p_assigned_to else assigned_to end,
    waiting_reason = case when p_action = 'wait' then p_waiting_reason when p_action = 'resume' then null else waiting_reason end,
    waiting_notes = case when p_action = 'wait' then p_notes when p_action = 'resume' then null else waiting_notes end,
    diagnosis = case when p_action = 'complete' then p_diagnosis else diagnosis end,
    resolution_notes = case when p_action in ('complete', 'cancel') then p_notes else resolution_notes end,
    started_at = case when p_action = 'start' then coalesce(started_at, now()) else started_at end,
    completed_at = case when v_next = 'completed' then now() when p_action in ('complete', 'reopen') then null else completed_at end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'work_order_' || p_action, p_notes,
    jsonb_build_object('previous_status', v_order.status, 'status', v_next, 'assigned_to', p_assigned_to));
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id);
  return v_order.occurrence_id;
end;
$$;

create or replace function public.generate_maintenance_preventive_run(
  p_hotel_id uuid, p_run_id uuid, p_actor_id uuid, p_force boolean default false, p_reason text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_run public.maintenance_preventive_runs%rowtype;
  v_plan public.maintenance_preventive_plans%rowtype;
  v_occurrence uuid;
  v_order uuid;
begin
  select * into v_run from public.maintenance_preventive_runs where id = p_run_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if v_run.status = 'generated' then return v_run.occurrence_id; end if;
  if v_run.status not in ('scheduled', 'deferred', 'rescheduled') then raise exception 'Competência preventiva não pode ser gerada.' using errcode = '23514'; end if;
  select * into v_plan from public.maintenance_preventive_plans where id = v_run.plan_id and hotel_id = p_hotel_id;
  if not found then return null; end if;
  if not p_force and exists (
    select 1 from public.maintenance_preventive_runs previous_run
    join public.maintenance_occurrences occurrence on occurrence.id = previous_run.occurrence_id
    where previous_run.plan_id = v_plan.id and previous_run.id <> v_run.id
      and previous_run.scheduled_local_date < v_run.scheduled_local_date
      and occurrence.status not in ('resolved', 'canceled')
  ) then
    update public.maintenance_preventive_runs set status = 'deferred', decision_reason = 'Execução anterior permanece aberta.' where id = v_run.id;
    perform public.notify_maintenance_recipient(p_hotel_id, v_plan.assigned_to, 'preventive_deferred', 'warning',
      'Preventiva adiada', v_plan.name || ' aguarda decisão porque a execução anterior está aberta.',
      '/dashboard/maintenance/preventive?run=' || v_run.id, 'preventive_run', v_run.id, 'overlap');
    perform public.notify_maintenance_managers(p_hotel_id, 'preventive_deferred', 'warning', 'Preventiva adiada',
      v_plan.name || ' possui uma execução anterior aberta.', '/dashboard/maintenance/preventive?run=' || v_run.id,
      'preventive_run', v_run.id, 'overlap');
    return null;
  end if;
  v_occurrence := public.create_maintenance_occurrence(
    p_hotel_id, (v_run.snapshot->>'category_id')::uuid,
    (v_run.snapshot->>'room_id')::uuid, (v_run.snapshot->>'location_id')::uuid, null,
    'preventive', (v_run.snapshot->>'priority')::public.maintenance_priority,
    (v_run.snapshot->>'plan_name') || ': ' || (v_run.snapshot->>'instructions'),
    v_run.scheduled_for, coalesce(p_actor_id, v_plan.created_by),
    coalesce((v_run.snapshot->>'blocking_recommended')::boolean, false)
  );
  update public.maintenance_occurrences set
    preventive_plan_id = v_plan.id, preventive_run_id = v_run.id,
    status = 'triaged', triaged_by = coalesce(p_actor_id, v_plan.created_by), triaged_at = now(),
    liability_status = 'not_applicable'
  where id = v_occurrence;
  v_order := public.create_maintenance_work_order(
    p_hotel_id, v_occurrence, coalesce(p_actor_id, v_plan.created_by), v_run.snapshot->>'plan_name',
    v_run.snapshot->>'instructions', (v_run.snapshot->>'priority')::public.maintenance_priority,
    (v_run.snapshot->>'assigned_to')::uuid,
    v_run.scheduled_for + make_interval(hours => (v_run.snapshot->>'completion_due_hours')::integer),
    coalesce((v_run.snapshot->>'requires_inspection')::boolean, false)
  );
  insert into public.maintenance_work_order_checklist_items(
    hotel_id, work_order_id, source_task_id, position, description, is_required
  ) select p_hotel_id, v_order, (task->>'id')::uuid, (task->>'position')::integer,
      task->>'description', coalesce((task->>'is_required')::boolean, true)
    from jsonb_array_elements(v_run.snapshot->'tasks') task;
  update public.maintenance_work_orders set
    supplier_id = (v_run.snapshot->>'supplier_id')::uuid,
    contract_id = (v_run.snapshot->>'contract_id')::uuid
  where id = v_order;
  update public.maintenance_preventive_runs set
    status = 'generated', occurrence_id = v_occurrence, work_order_id = v_order,
    decided_by = case when p_force then p_actor_id else decided_by end,
    decided_at = case when p_force then now() else decided_at end,
    decision_reason = case when p_force then nullif(btrim(p_reason), '') else decision_reason end
  where id = v_run.id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_occurrence, v_order, coalesce(p_actor_id, v_plan.created_by), 'preventive_generated', p_reason,
    jsonb_build_object('plan_id', v_plan.id, 'run_id', v_run.id, 'scheduled_for', v_run.scheduled_for));
  perform public.notify_maintenance_recipient(p_hotel_id, (v_run.snapshot->>'assigned_to')::uuid, 'preventive_assigned', 'info',
    'Preventiva disponível', (v_run.snapshot->>'plan_name') || ' foi incluída na sua agenda.',
    '/dashboard/maintenance/occurrences/' || v_occurrence, 'occurrence', v_occurrence, 'generated');
  return v_occurrence;
end;
$$;

create or replace function public.decide_maintenance_preventive_run(
  p_hotel_id uuid, p_run_id uuid, p_actor_id uuid, p_action text,
  p_reason text, p_rescheduled_for date default null
)
returns uuid language plpgsql set search_path = public as $$
declare v_run public.maintenance_preventive_runs%rowtype; v_timezone text; v_local_time time;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'A justificativa é obrigatória.' using errcode = '23514'; end if;
  select * into v_run from public.maintenance_preventive_runs where id = p_run_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'generate' then
    return public.generate_maintenance_preventive_run(p_hotel_id, p_run_id, p_actor_id, true, p_reason);
  elsif p_action = 'skip' and v_run.status in ('scheduled', 'deferred', 'rescheduled') then
    update public.maintenance_preventive_runs set status = 'skipped', decision_reason = p_reason, decided_by = p_actor_id, decided_at = now() where id = p_run_id;
  elsif p_action = 'reschedule' and v_run.status in ('scheduled', 'deferred', 'rescheduled') and p_rescheduled_for is not null then
    select hotel.timezone, plan.local_time into v_timezone, v_local_time
    from public.maintenance_preventive_plans plan join public.hotels hotel on hotel.id = plan.hotel_id where plan.id = v_run.plan_id;
    update public.maintenance_preventive_runs set
      status = 'rescheduled', decision_reason = p_reason, decided_by = p_actor_id, decided_at = now(),
      rescheduled_for = p_rescheduled_for,
      scheduled_for = ((p_rescheduled_for::text || ' ' || v_local_time::text)::timestamp at time zone v_timezone)
    where id = p_run_id;
  else raise exception 'Decisão de competência preventiva inválida.' using errcode = '23514'; end if;
  return p_run_id;
end;
$$;

create or replace function public.process_maintenance_sla_alerts(p_hotel_id uuid, p_now timestamptz default now())
returns integer language plpgsql set search_path = public as $$
declare v_occurrence record; v_threshold text; v_count integer := 0; v_recipient uuid; v_elapsed numeric; v_limit numeric;
begin
  for v_occurrence in
    select occurrence.*, coalesce(
      (select assigned_to from public.maintenance_work_orders work_order
       where work_order.occurrence_id = occurrence.id and assigned_to is not null
       order by created_at limit 1), occurrence.triaged_by, occurrence.reported_by
    ) recipient
    from public.maintenance_occurrences occurrence
    where occurrence.hotel_id = p_hotel_id and occurrence.sla_snapshot is not null and occurrence.status <> 'canceled'
      and ((occurrence.triaged_at is null and p_now >= occurrence.created_at + (occurrence.sla_response_due_at - occurrence.created_at) * 0.75)
        or (occurrence.operational_resolved_at is null and p_now >= occurrence.created_at + (occurrence.sla_resolution_due_at - occurrence.created_at) * 0.75))
  loop
    v_recipient := v_occurrence.recipient;
    if v_occurrence.triaged_at is null then
      v_limit := extract(epoch from (v_occurrence.sla_response_due_at - v_occurrence.created_at));
      v_elapsed := extract(epoch from (p_now - v_occurrence.created_at));
      if p_now >= v_occurrence.sla_response_due_at then
        v_threshold := 'response-breach:' || floor(extract(epoch from (p_now - v_occurrence.sla_response_due_at)) / 86400)::text;
      elsif v_elapsed >= v_limit * 0.75 then v_threshold := 'response-75'; else v_threshold := null; end if;
      if v_threshold is not null then
        v_count := v_count + public.notify_maintenance_recipient(p_hotel_id, v_recipient, 'sla_response',
          case when p_now >= v_occurrence.sla_response_due_at then 'critical' else 'warning' end,
          'SLA de resposta', 'A ocorrência MAN-' || lpad(v_occurrence.occurrence_number::text, 6, '0') || ' requer triagem.',
          '/dashboard/maintenance/occurrences/' || v_occurrence.id, 'occurrence', v_occurrence.id, v_threshold)::integer;
        v_count := v_count + public.notify_maintenance_managers(p_hotel_id, 'sla_response',
          case when p_now >= v_occurrence.sla_response_due_at then 'critical' else 'warning' end,
          'SLA de resposta', 'Ocorrência próxima ou além do SLA de resposta.',
          '/dashboard/maintenance/occurrences/' || v_occurrence.id, 'occurrence', v_occurrence.id, v_threshold);
      end if;
    end if;
    if v_occurrence.operational_resolved_at is null then
      v_limit := extract(epoch from (v_occurrence.sla_resolution_due_at - v_occurrence.created_at));
      v_elapsed := extract(epoch from (p_now - v_occurrence.created_at));
      if p_now >= v_occurrence.sla_resolution_due_at then
        v_threshold := 'resolution-breach:' || floor(extract(epoch from (p_now - v_occurrence.sla_resolution_due_at)) / 86400)::text;
      elsif v_elapsed >= v_limit * 0.75 then v_threshold := 'resolution-75'; else v_threshold := null; end if;
      if v_threshold is not null then
        v_count := v_count + public.notify_maintenance_recipient(p_hotel_id, v_recipient, 'sla_resolution',
          case when p_now >= v_occurrence.sla_resolution_due_at then 'critical' else 'warning' end,
          'SLA de resolução', 'A ocorrência MAN-' || lpad(v_occurrence.occurrence_number::text, 6, '0') || ' requer conclusão operacional.',
          '/dashboard/maintenance/occurrences/' || v_occurrence.id, 'occurrence', v_occurrence.id, v_threshold)::integer;
        v_count := v_count + public.notify_maintenance_managers(p_hotel_id, 'sla_resolution',
          case when p_now >= v_occurrence.sla_resolution_due_at then 'critical' else 'warning' end,
          'SLA de resolução', 'Ocorrência próxima ou além do SLA de resolução.',
          '/dashboard/maintenance/occurrences/' || v_occurrence.id, 'occurrence', v_occurrence.id, v_threshold);
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.process_maintenance_expiry_alerts(p_hotel_id uuid, p_local_date date)
returns integer language plpgsql set search_path = public as $$
declare v_item record; v_days integer; v_count integer := 0;
begin
  for v_item in select id, contract_number as label, ends_on as expires_on from public.maintenance_contracts
    where hotel_id = p_hotel_id and status = 'active' and ends_on - p_local_date in (30, 7, 0)
  loop
    v_days := v_item.expires_on - p_local_date;
    v_count := v_count + public.notify_maintenance_managers(p_hotel_id, 'contract_expiry',
      case when v_days = 0 then 'critical' else 'warning' end, 'Vigência contratual',
      'O contrato ' || v_item.label || case when v_days = 0 then ' vence hoje.' else ' vence em ' || v_days || ' dias.' end,
      '/dashboard/maintenance/suppliers?contract=' || v_item.id, 'contract', v_item.id, v_days::text);
  end loop;
  for v_item in select id, name as label, warranty_ends_on as expires_on from public.maintenance_locations
    where hotel_id = p_hotel_id and kind = 'equipment' and is_active and warranty_ends_on - p_local_date in (30, 7, 0)
  loop
    v_days := v_item.expires_on - p_local_date;
    v_count := v_count + public.notify_maintenance_managers(p_hotel_id, 'warranty_expiry',
      case when v_days = 0 then 'critical' else 'warning' end, 'Garantia de equipamento',
      'A garantia de ' || v_item.label || case when v_days = 0 then ' vence hoje.' else ' vence em ' || v_days || ' dias.' end,
      '/dashboard/maintenance/settings?location=' || v_item.id, 'location', v_item.id, v_days::text);
  end loop;
  update public.maintenance_contracts set status = 'expired'
  where hotel_id = p_hotel_id and status = 'active' and ends_on < p_local_date;
  return v_count;
end;
$$;

create or replace function public.process_maintenance_preventive_plans(p_hotel_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql set search_path = public as $$
declare v_plan public.maintenance_preventive_plans%rowtype; v_timezone text; v_local_date date; v_run_id uuid; v_generated integer := 0; v_deferred integer := 0;
begin
  select timezone into v_timezone from public.hotels where id = p_hotel_id;
  v_local_date := (p_now at time zone v_timezone)::date;
  for v_plan in
    select * from public.maintenance_preventive_plans
    where hotel_id = p_hotel_id and status = 'active'
      and next_due_date <= v_local_date + generation_lead_days
      and (ends_on is null or next_due_date <= ends_on)
    order by next_due_date, id for update skip locked
  loop
    insert into public.maintenance_preventive_runs(
      hotel_id, plan_id, scheduled_for, scheduled_local_date, snapshot
    ) values (
      p_hotel_id, v_plan.id,
      ((v_plan.next_due_date::text || ' ' || v_plan.local_time::text)::timestamp at time zone v_timezone),
      v_plan.next_due_date,
      jsonb_build_object(
        'plan_name', v_plan.name, 'category_id', v_plan.category_id, 'room_id', v_plan.room_id,
        'location_id', v_plan.location_id, 'assigned_to', v_plan.assigned_to, 'supplier_id', v_plan.supplier_id,
        'contract_id', v_plan.contract_id, 'priority', v_plan.priority, 'instructions', v_plan.instructions,
        'requires_inspection', v_plan.requires_inspection, 'blocking_recommended', v_plan.blocking_recommended,
        'completion_due_hours', v_plan.completion_due_hours,
        'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', task.id, 'position', task.position, 'description', task.description, 'is_required', task.is_required) order by task.position), '[]'::jsonb)
                  from public.maintenance_preventive_plan_tasks task where task.plan_id = v_plan.id and task.is_active)
      )
    ) on conflict (plan_id, scheduled_local_date) do update set plan_id = excluded.plan_id
    returning id into v_run_id;
    perform public.generate_maintenance_preventive_run(p_hotel_id, v_run_id, v_plan.created_by, false, null);
    if (select status from public.maintenance_preventive_runs where id = v_run_id) = 'generated' then v_generated := v_generated + 1; else v_deferred := v_deferred + 1; end if;
    update public.maintenance_preventive_plans set next_due_date = public.next_maintenance_preventive_date(
      v_plan.next_due_date, v_plan.recurrence_unit, v_plan.recurrence_interval, v_plan.recurrence_day
    ) where id = v_plan.id;
  end loop;
  return jsonb_build_object('generated', v_generated, 'deferred', v_deferred);
end;
$$;

create or replace function public.process_maintenance_management_cycle(
  p_now timestamptz default now(), p_hotel_id uuid default null, p_force boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hotel record; v_run_id uuid; v_key text; v_started timestamptz; v_preventive jsonb; v_sla integer; v_expiry integer; v_total jsonb := '[]'::jsonb;
begin
  for v_hotel in select id, timezone, (p_now at time zone timezone)::date local_date from public.hotels where p_hotel_id is null or id = p_hotel_id
  loop
    v_key := 'management:' || v_hotel.id || ':' || to_char(
      date_trunc('hour', p_now) + make_interval(mins => (extract(minute from p_now)::integer / 15) * 15),
      'YYYYMMDDHH24MI'
    ) || case when p_force then ':' || gen_random_uuid()::text else '' end;
    insert into public.maintenance_automation_runs(hotel_id, run_key, status, trigger_kind, local_date)
    values (v_hotel.id, v_key, 'running', case when p_force then 'manual' else 'scheduled' end, v_hotel.local_date)
    on conflict (run_key) do nothing returning id, started_at into v_run_id, v_started;
    if v_run_id is null then continue; end if;
    begin
      v_preventive := public.process_maintenance_preventive_plans(v_hotel.id, p_now);
      v_sla := public.process_maintenance_sla_alerts(v_hotel.id, p_now);
      v_expiry := public.process_maintenance_expiry_alerts(v_hotel.id, v_hotel.local_date);
      update public.maintenance_automation_runs set status = 'completed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer,
        counters = v_preventive || jsonb_build_object('sla_notifications', v_sla, 'expiry_notifications', v_expiry)
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'completed'));
    exception when others then
      update public.maintenance_automation_runs set status = 'failed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer, error_message = sqlerrm
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'failed'));
    end;
  end loop;
  return v_total;
end;
$$;

create or replace function public.set_maintenance_notification_status(
  p_hotel_id uuid, p_recipient_id uuid, p_notification_id uuid, p_status public.maintenance_notification_status
)
returns boolean language plpgsql set search_path = public as $$
begin
  update public.maintenance_notifications set status = p_status,
    read_at = case when p_status = 'read' then now() else null end,
    dismissed_at = case when p_status = 'dismissed' then now() else null end
  where id = p_notification_id and hotel_id = p_hotel_id and recipient_id = p_recipient_id;
  return found;
end;
$$;

create or replace function public.mark_all_maintenance_notifications_read(p_hotel_id uuid, p_recipient_id uuid)
returns integer language plpgsql set search_path = public as $$
declare v_count integer;
begin
  update public.maintenance_notifications set status = 'read', read_at = now(), dismissed_at = null
  where hotel_id = p_hotel_id and recipient_id = p_recipient_id and status = 'unread';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

update public.maintenance_occurrences
set operational_resolved_at = resolved_at
where status = 'resolved' and operational_resolved_at is null;

alter table public.maintenance_suppliers enable row level security;
alter table public.maintenance_supplier_contacts enable row level security;
alter table public.maintenance_contracts enable row level security;
alter table public.maintenance_contract_categories enable row level security;
alter table public.maintenance_contract_locations enable row level security;
alter table public.maintenance_sla_policies enable row level security;
alter table public.maintenance_preventive_plans enable row level security;
alter table public.maintenance_preventive_plan_tasks enable row level security;
alter table public.maintenance_preventive_runs enable row level security;
alter table public.maintenance_work_order_checklist_items enable row level security;
alter table public.maintenance_notifications enable row level security;
alter table public.maintenance_automation_runs enable row level security;
alter table public.maintenance_management_attachments enable row level security;

grant usage on type public.maintenance_recurrence_unit, public.maintenance_preventive_plan_status,
  public.maintenance_preventive_run_status, public.maintenance_supplier_status,
  public.maintenance_contract_status, public.maintenance_contract_kind,
  public.maintenance_supplier_work_status, public.maintenance_asset_lifecycle,
  public.maintenance_notification_status, public.maintenance_automation_status to postgres, service_role;

grant select, insert, update on public.maintenance_suppliers, public.maintenance_supplier_contacts,
  public.maintenance_contracts, public.maintenance_contract_categories, public.maintenance_contract_locations,
  public.maintenance_sla_policies, public.maintenance_preventive_plans,
  public.maintenance_preventive_plan_tasks, public.maintenance_preventive_runs,
  public.maintenance_work_order_checklist_items, public.maintenance_notifications,
  public.maintenance_automation_runs, public.maintenance_management_attachments to postgres, service_role;

grant execute on function public.create_default_maintenance_sla_policies(uuid),
  public.next_maintenance_preventive_date(date, public.maintenance_recurrence_unit, integer, integer),
  public.complete_maintenance_checklist_item(uuid, uuid, uuid, uuid, boolean, text),
  public.upsert_maintenance_preventive_plan(uuid, uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, public.maintenance_priority, text, boolean, boolean, public.maintenance_recurrence_unit, integer, date, date, time, integer, integer, jsonb),
  public.upsert_maintenance_contract(uuid, uuid, uuid, uuid, text, public.maintenance_contract_kind, public.maintenance_contract_status, date, date, date, text, integer, integer, text, numeric, text, uuid[], uuid[], text),
  public.transition_maintenance_supplier_work(uuid, uuid, uuid, text, uuid, uuid, text, text),
  public.generate_maintenance_preventive_run(uuid, uuid, uuid, boolean, text),
  public.decide_maintenance_preventive_run(uuid, uuid, uuid, text, text, date),
  public.process_maintenance_sla_alerts(uuid, timestamptz),
  public.process_maintenance_expiry_alerts(uuid, date),
  public.process_maintenance_preventive_plans(uuid, timestamptz),
  public.process_maintenance_management_cycle(timestamptz, uuid, boolean),
  public.set_maintenance_notification_status(uuid, uuid, uuid, public.maintenance_notification_status),
  public.mark_all_maintenance_notifications_read(uuid, uuid) to postgres, service_role;

insert into public.permissions(name, type)
select name, 'HOTEL_PERMISSION'
from unnest(array[
  'manage_maintenance_plans', 'manage_maintenance_sla',
  'manage_maintenance_suppliers', 'read_maintenance_analytics'
]) as name
on conflict (name) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-management-documents', 'maintenance-management-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'maintenance-management-cycle';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'maintenance-management-cycle', '*/15 * * * *',
    $cron$select public.process_maintenance_management_cycle(now(), null, false);$cron$
  );
end;
$$;

comment on table public.maintenance_preventive_runs is 'Competências imutáveis dos planos preventivos; snapshot preserva o plano vigente na geração.';
comment on column public.maintenance_occurrences.sla_snapshot is 'Política de SLA aplicada na criação; nulo identifica ocorrência legada não acompanhada.';
comment on table public.maintenance_notifications is 'Caixa interna persistente e deduplicada por destinatário, entidade, evento e limiar.';
