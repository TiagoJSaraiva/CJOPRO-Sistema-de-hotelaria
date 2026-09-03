create type public.product_kind as enum ('physical', 'service');
create type public.product_sales_unit as enum ('unit', 'portion', 'person', 'hour', 'daily', 'service');
create type public.catalog_audit_entity as enum ('product', 'product_category');

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_check check (length(btrim(name)) between 1 and 120),
  constraint product_categories_display_order_check check (display_order >= 0)
);

create unique index product_categories_hotel_name_unique
  on public.product_categories(hotel_id, lower(btrim(name)));
create index product_categories_hotel_order_index
  on public.product_categories(hotel_id, archived_at, is_active, display_order, name);

alter table public.products
  add column category_id uuid,
  add column description text,
  add column internal_code text,
  add column kind public.product_kind not null default 'physical',
  add column sales_unit public.product_sales_unit not null default 'unit',
  add column archived_at timestamptz,
  add column last_changed_by uuid references public.users(id) on delete set null;

insert into public.product_categories (hotel_id, name, display_order, is_active)
select hotel_id, min(category_name), 0, lower(category_key) <> lower('Sem categoria')
from (
  select
    hotel_id,
    coalesce(nullif(btrim(category), ''), 'Sem categoria') as category_name,
    lower(coalesce(nullif(btrim(category), ''), 'Sem categoria')) as category_key
  from public.products
) categories
group by hotel_id, category_key;

update public.products product
set category_id = category.id
from public.product_categories category
where category.hotel_id = product.hotel_id
  and lower(category.name) = lower(coalesce(nullif(btrim(product.category), ''), 'Sem categoria'));

alter table public.product_categories
  add constraint product_categories_id_hotel_unique unique (id, hotel_id);

alter table public.products
  alter column category_id set not null,
  add constraint products_category_hotel_fkey
    foreign key (category_id, hotel_id)
    references public.product_categories(id, hotel_id) on delete restrict,
  add constraint products_description_check
    check (description is null or length(btrim(description)) <= 1000),
  add constraint products_internal_code_check
    check (internal_code is null or length(btrim(internal_code)) between 1 and 80);

create unique index products_hotel_internal_code_unique
  on public.products(hotel_id, lower(btrim(internal_code)))
  where internal_code is not null;
create index products_catalog_index
  on public.products(hotel_id, archived_at, status, kind, category_id, name);

alter table public.products drop column category;

create table public.catalog_audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type public.catalog_audit_entity not null,
  entity_id uuid not null,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint catalog_audit_events_action_check check (length(btrim(action)) between 1 and 80)
);
create index catalog_audit_events_entity_index
  on public.catalog_audit_events(hotel_id, entity_type, entity_id, created_at desc);

insert into public.catalog_audit_events (
  hotel_id, entity_type, entity_id, actor_id, action, changes
)
select
  hotel_id,
  'product'::public.catalog_audit_entity,
  id,
  null,
  'migrated',
  jsonb_build_object('before', null, 'after', to_jsonb(product) - 'last_changed_by')
from public.products product;

insert into public.catalog_audit_events (
  hotel_id, entity_type, entity_id, actor_id, action, changes
)
select
  hotel_id,
  'product_category'::public.catalog_audit_entity,
  id,
  null,
  'migrated',
  jsonb_build_object('before', null, 'after', to_jsonb(category) - 'last_changed_by')
from public.product_categories category;

create or replace function public.validate_product_catalog_scope()
returns trigger language plpgsql as $$
declare v_hotel_id uuid;
begin
  if tg_table_name = 'products' then
    select hotel_id into v_hotel_id from public.product_categories where id = new.category_id;
    if v_hotel_id is distinct from new.hotel_id then
      raise exception 'product category crosses hotel scope' using errcode = '23514';
    end if;
  end if;
  if new.last_changed_by is not null and not public.maintenance_user_has_hotel_scope(new.last_changed_by, new.hotel_id) then
    raise exception 'catalog actor crosses hotel scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.write_catalog_audit_event()
returns trigger language plpgsql as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif new.archived_at is distinct from old.archived_at then
    v_action := case when new.archived_at is null then 'restored' else 'archived' end;
  elsif tg_table_name = 'product_categories' and new.is_active is distinct from old.is_active then
    v_action := case when new.is_active then 'activated' else 'deactivated' end;
  elsif tg_table_name = 'products' and new.status is distinct from old.status then
    v_action := case when new.status = 'active' then 'activated' else 'deactivated' end;
  else
    v_action := 'updated';
  end if;
  insert into public.catalog_audit_events(hotel_id, entity_type, entity_id, actor_id, action, changes)
  values (
    new.hotel_id,
    case when tg_table_name = 'products' then 'product'::public.catalog_audit_entity else 'product_category'::public.catalog_audit_entity end,
    new.id, new.last_changed_by, v_action,
    jsonb_build_object('before', case when tg_op = 'INSERT' then null else to_jsonb(old) - 'last_changed_by' end, 'after', to_jsonb(new) - 'last_changed_by')
  );
  return new;
end;
$$;

create or replace function public.prevent_catalog_record_deletion()
returns trigger language plpgsql as $$
begin
  raise exception 'catalog records must be archived, not deleted' using errcode = '23514';
end;
$$;

create or replace function public.prevent_catalog_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'catalog audit is immutable' using errcode = '23514';
end;
$$;

create trigger trg_product_categories_set_updated_at before update on public.product_categories
  for each row execute function public.set_updated_at();
create trigger trg_products_validate_catalog_scope before insert or update on public.products
  for each row execute function public.validate_product_catalog_scope();
create trigger trg_product_categories_validate_catalog_scope before insert or update on public.product_categories
  for each row execute function public.validate_product_catalog_scope();
create trigger trg_products_write_catalog_audit after insert or update on public.products
  for each row execute function public.write_catalog_audit_event();
create trigger trg_product_categories_write_catalog_audit after insert or update on public.product_categories
  for each row execute function public.write_catalog_audit_event();
create trigger trg_products_prevent_delete before delete on public.products
  for each row execute function public.prevent_catalog_record_deletion();
create trigger trg_product_categories_prevent_delete before delete on public.product_categories
  for each row execute function public.prevent_catalog_record_deletion();
create trigger trg_catalog_audit_events_immutable before update or delete on public.catalog_audit_events
  for each row execute function public.prevent_catalog_audit_mutation();

alter table public.product_categories enable row level security;
alter table public.catalog_audit_events enable row level security;
grant select, insert, update, delete on public.product_categories to anon, authenticated, postgres, service_role;
grant select, insert, update, delete on public.catalog_audit_events to anon, authenticated, postgres, service_role;
grant usage on type public.product_kind, public.product_sales_unit, public.catalog_audit_entity to postgres;
