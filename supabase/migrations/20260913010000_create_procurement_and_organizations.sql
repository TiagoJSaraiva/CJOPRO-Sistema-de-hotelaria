-- Etapa 5.1: organizações, reposição, compras, recebimento e contas a pagar.

create type public.business_organization_role as enum ('commercial_partner','maintenance_supplier','corporate_account','stock_supplier');
create type public.replenishment_status as enum ('draft','submitted','approved','converted','fulfilled','canceled');
create type public.purchase_order_status as enum ('draft','pending_approval','approved','issued','partially_received','received','closed','canceled');
create type public.procurement_invoice_status as enum ('draft','exception','approved','partially_paid','paid','canceled');
create type public.procurement_discrepancy_status as enum ('open','accepted','corrected','rejected');

create or replace function public.normalize_business_tax_id(p_value text)
returns text language sql immutable parallel safe as $$
  select nullif(upper(regexp_replace(coalesce(p_value,''),'[^A-Za-z0-9]','','g')),'');
$$;

create table public.business_organizations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  tax_id text,
  normalized_tax_id text generated always as (public.normalize_business_tax_id(tax_id)) stored,
  currency text not null default 'BRL',
  email text,
  phone text,
  active boolean not null default true,
  version integer not null default 1,
  bootstrap_role_type public.business_organization_role,
  bootstrap_role_id uuid,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,hotel_id),
  check(length(btrim(legal_name)) between 2 and 200),
  check(trade_name is null or length(btrim(trade_name)) between 1 and 160),
  check(currency~'^[A-Z]{3}$'),
  check(version>0)
);
create unique index business_organizations_tax_unique on public.business_organizations(hotel_id,normalized_tax_id) where normalized_tax_id is not null;
create unique index business_organizations_bootstrap_unique on public.business_organizations(hotel_id,bootstrap_role_type,bootstrap_role_id) where bootstrap_role_id is not null;

create table public.business_organization_events (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, organization_id uuid not null,
  action text not null, actor_id uuid references public.users(id), reason text, details jsonb not null default '{}', created_at timestamptz not null default now(),
  foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict
);
create table public.business_organization_conflicts (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,organization_id uuid not null,role_type public.business_organization_role not null,role_id uuid not null,
 divergent_values jsonb not null,status text not null default 'open',version integer not null default 1,resolved_by uuid references public.users(id),resolution_reason text,resolved_at timestamptz,created_at timestamptz not null default now(),
 unique(id,hotel_id),unique(hotel_id,role_type,role_id),foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict,
 check(status in('open','resolved') and (status='open' or resolved_by is not null and resolved_at is not null and nullif(btrim(resolution_reason),'') is not null))
);

alter table public.commercial_partners add column organization_id uuid;
alter table public.maintenance_suppliers add constraint maintenance_suppliers_id_hotel_unique unique(id,hotel_id);
alter table public.maintenance_suppliers add column organization_id uuid;
alter table public.corporate_accounts add column organization_id uuid;

with candidates as (
  select hotel_id,id role_id,'commercial_partner'::public.business_organization_role role_type,
    legal_name,trade_name,tax_id,email,phone,'BRL' currency,created_at from public.commercial_partners
  union all
  select hotel_id,id,'maintenance_supplier'::public.business_organization_role,
    coalesce(legal_name,name),name,tax_document,email,phone,'BRL',created_at from public.maintenance_suppliers
  union all
  select hotel_id,id,'corporate_account'::public.business_organization_role,
    legal_name,legal_name,tax_id,billing_email,billing_phone,currency,created_at from public.corporate_accounts
), selected as (
  select distinct on(hotel_id,coalesce(public.normalize_business_tax_id(tax_id),role_type::text||':'||role_id::text)) *
  from candidates order by hotel_id,coalesce(public.normalize_business_tax_id(tax_id),role_type::text||':'||role_id::text),created_at,role_id
)
insert into public.business_organizations(hotel_id,legal_name,trade_name,tax_id,currency,email,phone,bootstrap_role_type,bootstrap_role_id,created_at)
select hotel_id,legal_name,trade_name,tax_id,currency,email,phone,role_type,role_id,created_at from selected;

update public.commercial_partners p set organization_id=o.id from public.business_organizations o
where o.hotel_id=p.hotel_id and (o.normalized_tax_id is not null and o.normalized_tax_id=public.normalize_business_tax_id(p.tax_id)
  or o.bootstrap_role_type='commercial_partner' and o.bootstrap_role_id=p.id);
update public.maintenance_suppliers s set organization_id=o.id from public.business_organizations o
where o.hotel_id=s.hotel_id and (o.normalized_tax_id is not null and o.normalized_tax_id=public.normalize_business_tax_id(s.tax_document)
  or o.bootstrap_role_type='maintenance_supplier' and o.bootstrap_role_id=s.id);
update public.corporate_accounts a set organization_id=o.id from public.business_organizations o
where o.hotel_id=a.hotel_id and (o.normalized_tax_id is not null and o.normalized_tax_id=public.normalize_business_tax_id(a.tax_id)
  or o.bootstrap_role_type='corporate_account' and o.bootstrap_role_id=a.id);

insert into public.business_organization_conflicts(hotel_id,organization_id,role_type,role_id,divergent_values)
select p.hotel_id,p.organization_id,'commercial_partner'::public.business_organization_role,p.id,jsonb_build_object('legal_name',p.legal_name,'trade_name',p.trade_name,'tax_id',p.tax_id,'email',p.email,'phone',p.phone)
from public.commercial_partners p join public.business_organizations o on o.id=p.organization_id
where (p.legal_name,p.trade_name,p.email,p.phone) is distinct from (o.legal_name,o.trade_name,o.email,o.phone)
union all
select s.hotel_id,s.organization_id,'maintenance_supplier'::public.business_organization_role,s.id,jsonb_build_object('legal_name',s.legal_name,'trade_name',s.name,'tax_id',s.tax_document,'email',s.email,'phone',s.phone)
from public.maintenance_suppliers s join public.business_organizations o on o.id=s.organization_id
where (coalesce(s.legal_name,s.name),s.name,s.email,s.phone) is distinct from (o.legal_name,o.trade_name,o.email,o.phone)
union all
select a.hotel_id,a.organization_id,'corporate_account'::public.business_organization_role,a.id,jsonb_build_object('legal_name',a.legal_name,'tax_id',a.tax_id,'email',a.billing_email,'phone',a.billing_phone,'currency',a.currency)
from public.corporate_accounts a join public.business_organizations o on o.id=a.organization_id
where (a.legal_name,a.billing_email,a.billing_phone,a.currency) is distinct from (o.legal_name,o.email,o.phone,o.currency);

alter table public.commercial_partners add constraint commercial_partners_organization_hotel_fkey foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict;
alter table public.maintenance_suppliers add constraint maintenance_suppliers_organization_hotel_fkey foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict;
alter table public.corporate_accounts add constraint corporate_accounts_organization_hotel_fkey foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict;

create or replace function public.ensure_business_organization_role()
returns trigger language plpgsql set search_path=public as $$
declare v_row jsonb:=to_jsonb(new);v_tax text;v_legal text;v_trade text;v_email text;v_phone text;v_currency text;v_id uuid;
begin
 if new.organization_id is not null then return new;end if;
 v_tax:=coalesce(v_row->>'tax_id',v_row->>'tax_document');
 v_legal:=coalesce(nullif(v_row->>'legal_name',''),v_row->>'name');
 v_trade:=coalesce(nullif(v_row->>'trade_name',''),v_row->>'name',v_legal);
 v_email:=coalesce(v_row->>'email',v_row->>'billing_email');v_phone:=coalesce(v_row->>'phone',v_row->>'billing_phone');v_currency:=coalesce(v_row->>'currency','BRL');
 if public.normalize_business_tax_id(v_tax) is not null then select id into v_id from public.business_organizations where hotel_id=new.hotel_id and normalized_tax_id=public.normalize_business_tax_id(v_tax) for update;end if;
 if v_id is null then insert into public.business_organizations(hotel_id,legal_name,trade_name,tax_id,currency,email,phone,created_by) values(new.hotel_id,v_legal,v_trade,v_tax,v_currency,v_email,v_phone,(v_row->>'created_by')::uuid) returning id into v_id;end if;
 new.organization_id:=v_id;return new;
end $$;
create trigger commercial_partner_ensure_organization before insert on public.commercial_partners for each row execute function public.ensure_business_organization_role();
create trigger maintenance_supplier_ensure_organization before insert on public.maintenance_suppliers for each row execute function public.ensure_business_organization_role();
create trigger corporate_account_ensure_organization before insert on public.corporate_accounts for each row execute function public.ensure_business_organization_role();

create table public.procurement_suppliers (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
  organization_id uuid not null, payment_term_days integer not null default 0, lead_time_days integer not null default 0,
  active boolean not null default true, version integer not null default 1, created_by uuid references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,hotel_id), unique(hotel_id,organization_id),
  foreign key(organization_id,hotel_id) references public.business_organizations(id,hotel_id) on delete restrict,
  check(payment_term_days between 0 and 365 and lead_time_days between 0 and 365)
);

create table public.procurement_policies (
  hotel_id uuid primary key references public.hotels(id) on delete restrict, currency text not null default 'BRL',
  configuration_required boolean not null default true, price_tolerance_percent numeric(7,4) not null default 0,
  price_tolerance_amount numeric(14,2) not null default 0, quantity_tolerance_percent numeric(7,4) not null default 0,
  quantity_tolerance_amount numeric(14,3) not null default 0, version integer not null default 1,
  updated_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(currency~'^[A-Z]{3}$' and price_tolerance_percent between 0 and 100 and quantity_tolerance_percent between 0 and 100)
);
insert into public.procurement_policies(hotel_id,currency) select id,coalesce(currency,'BRL') from public.hotels on conflict do nothing;

create or replace function public.initialize_procurement_policy_for_hotel()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.procurement_policies(hotel_id,currency)
  values(new.id,coalesce(new.currency,'BRL')) on conflict do nothing;
  return new;
end $$;
create trigger hotel_initialize_procurement_policy after insert on public.hotels
for each row execute function public.initialize_procurement_policy_for_hotel();

create table public.procurement_approval_tiers (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, minimum_amount numeric(14,2) not null,
  maximum_amount numeric(14,2), approvals_required integer not null, quotes_required integer not null default 0,
  created_at timestamptz not null default now(), foreign key(hotel_id) references public.procurement_policies(hotel_id) on delete cascade,
  check(minimum_amount>=0 and (maximum_amount is null or maximum_amount>=minimum_amount) and approvals_required in(1,2) and quotes_required between 0 and 10)
);

create table public.replenishment_requests (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
  product_id uuid not null, location_id uuid not null, episode integer not null default 1, source text not null default 'manual',
  status public.replenishment_status not null default 'draft', priority text not null default 'normal', current_quantity numeric(14,3) not null,
  minimum_quantity numeric(14,3) not null, ideal_quantity numeric(14,3) not null, requested_quantity numeric(14,3) not null,
  need_by date, preferred_supplier_id uuid, responsible_id uuid references public.users(id), reason text not null,
  version integer not null default 1, created_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,hotel_id), unique(hotel_id,product_id,location_id,episode),
  foreign key(product_id,hotel_id) references public.products(id,hotel_id) on delete restrict,
  foreign key(location_id,hotel_id) references public.inventory_locations(id,hotel_id) on delete restrict,
  foreign key(preferred_supplier_id,hotel_id) references public.procurement_suppliers(id,hotel_id) on delete restrict,
  check(source in('manual','critical_stock','minibar') and priority in('low','normal','high','critical') and requested_quantity>0 and version>0 and length(btrim(reason)) between 3 and 1000)
);
create unique index replenishment_active_unique on public.replenishment_requests(hotel_id,product_id,location_id) where status not in('fulfilled','canceled');

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
  supplier_id uuid not null, destination_location_id uuid not null, status public.purchase_order_status not null default 'draft',
  currency text not null, expected_on date, notes text, total_amount numeric(14,2) not null default 0,
  required_approvals integer not null default 1, required_quotes integer not null default 0, version integer not null default 1,
  created_by uuid not null references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,hotel_id), foreign key(supplier_id,hotel_id) references public.procurement_suppliers(id,hotel_id) on delete restrict,
  foreign key(destination_location_id,hotel_id) references public.inventory_locations(id,hotel_id) on delete restrict,
  check(currency~'^[A-Z]{3}$' and total_amount>=0 and required_approvals in(1,2) and version>0)
);
create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, purchase_order_id uuid not null, product_id uuid not null,
  quantity numeric(14,3) not null, received_quantity numeric(14,3) not null default 0, unit_price numeric(14,4) not null,
  tax_amount numeric(14,2) not null default 0, unique(id,hotel_id),
  foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict,
  foreign key(product_id,hotel_id) references public.products(id,hotel_id) on delete restrict,
  check(quantity>0 and received_quantity between 0 and quantity and unit_price>=0 and tax_amount>=0)
);
create table public.purchase_order_quotes (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, purchase_order_id uuid not null,
  supplier_id uuid not null, amount numeric(14,2) not null, reference text, created_at timestamptz not null default now(),
  foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict,
  foreign key(supplier_id,hotel_id) references public.procurement_suppliers(id,hotel_id) on delete restrict,
  unique(purchase_order_id,supplier_id),check(amount>=0)
);
create table public.purchase_order_replenishments (
  hotel_id uuid not null, purchase_order_id uuid not null, replenishment_request_id uuid not null,
  primary key(purchase_order_id,replenishment_request_id),
  foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict,
  foreign key(replenishment_request_id,hotel_id) references public.replenishment_requests(id,hotel_id) on delete restrict
);
create table public.purchase_order_approvals (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, purchase_order_id uuid not null, approval_level integer not null,
  actor_id uuid not null references public.users(id), decision text not null, reason text not null, created_at timestamptz not null default now(),
  foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict,
  unique(purchase_order_id,approval_level), unique(purchase_order_id,actor_id), check(decision in('approved','rejected') and approval_level in(1,2))
);

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, purchase_order_id uuid not null, occurred_at timestamptz not null,
  reference_code text, notes text, idempotency_key uuid not null, request_fingerprint text not null, received_by uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(id,hotel_id), unique(hotel_id,idempotency_key), foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict
);
create table public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, receipt_id uuid not null, order_line_id uuid not null,
  accepted_quantity numeric(14,3) not null, rejected_quantity numeric(14,3) not null, unit_cost numeric(14,4) not null,
  lot_code text, expires_on date, evidence_path text, inventory_movement_id uuid,
  foreign key(receipt_id,hotel_id) references public.purchase_receipts(id,hotel_id) on delete restrict,
  foreign key(order_line_id,hotel_id) references public.purchase_order_lines(id,hotel_id) on delete restrict,
  check(accepted_quantity>=0 and rejected_quantity>=0 and accepted_quantity+rejected_quantity>0 and unit_cost>=0)
);

create table public.procurement_invoices (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, purchase_order_id uuid not null,
  invoice_number text not null, issued_on date not null, total_amount numeric(14,2) not null, status public.procurement_invoice_status not null default 'draft',
  evidence_path text, version integer not null default 1, idempotency_key uuid not null, created_by uuid not null references public.users(id),
  approved_by uuid references public.users(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,hotel_id), unique(hotel_id,idempotency_key), unique(hotel_id,purchase_order_id,invoice_number),
  foreign key(purchase_order_id,hotel_id) references public.purchase_orders(id,hotel_id) on delete restrict,
  check(total_amount>0 and version>0)
);
create table public.procurement_invoice_due_dates (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, invoice_id uuid not null, due_on date not null,
  amount numeric(14,2) not null, paid_amount numeric(14,2) not null default 0, version integer not null default 1,
  foreign key(invoice_id,hotel_id) references public.procurement_invoices(id,hotel_id) on delete restrict,
  check(amount>0 and paid_amount between 0 and amount)
);
create table public.procurement_discrepancies (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, invoice_id uuid not null, order_line_id uuid,
  kind text not null, expected_amount numeric(14,3) not null, actual_amount numeric(14,3) not null, allowed_variance numeric(14,3) not null,
  status public.procurement_discrepancy_status not null default 'open', opened_by uuid not null references public.users(id),
  decided_by uuid references public.users(id), decision_reason text, created_at timestamptz not null default now(), resolved_at timestamptz,
  foreign key(invoice_id,hotel_id) references public.procurement_invoices(id,hotel_id) on delete restrict,
  foreign key(order_line_id,hotel_id) references public.purchase_order_lines(id,hotel_id) on delete restrict,
  check(kind in('price','quantity','identity'))
);
create table public.procurement_payment_batches (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
  installment_id uuid not null, idempotency_key uuid not null, request_fingerprint text not null,
  total_amount numeric(14,2) not null, created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(id,hotel_id), unique(hotel_id,idempotency_key),
  foreign key(installment_id) references public.procurement_invoice_due_dates(id) on delete restrict,
  check(total_amount>0)
);
create table public.procurement_payments (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, installment_id uuid not null,
  payment_batch_id uuid not null,
  financial_transaction_id uuid references public.financial_transactions(id) on delete restrict, amount numeric(14,2) not null,
  payment_method text not null, reference_code text, cash_session_id uuid, idempotency_key uuid not null, request_fingerprint text not null,
  reversal_of_id uuid, paid_at timestamptz not null, created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(hotel_id,idempotency_key), foreign key(installment_id) references public.procurement_invoice_due_dates(id) on delete restrict,
  foreign key(payment_batch_id,hotel_id) references public.procurement_payment_batches(id,hotel_id) on delete restrict,
  foreign key(reversal_of_id) references public.procurement_payments(id) on delete restrict, check(amount>0)
);
create table public.procurement_events (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), entity_type text not null,
  entity_id uuid not null, action text not null, actor_id uuid references public.users(id), reason text, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.reconcile_replenishment_requests(p_hotel_id uuid,p_actor_id uuid default null)
returns jsonb language plpgsql set search_path=public as $$
declare v_position record; v_episode integer; v_created integer:=0;
begin
  for v_position in select * from public.inventory_positions where hotel_id=p_hotel_id and is_active loop
    if v_position.quantity<v_position.minimum_quantity and not exists(select 1 from public.replenishment_requests where hotel_id=p_hotel_id and product_id=v_position.product_id and location_id=v_position.location_id and status not in('fulfilled','canceled')) then
      select coalesce(max(episode),0)+1 into v_episode from public.replenishment_requests where hotel_id=p_hotel_id and product_id=v_position.product_id and location_id=v_position.location_id;
      insert into public.replenishment_requests(hotel_id,product_id,location_id,episode,source,priority,current_quantity,minimum_quantity,ideal_quantity,requested_quantity,reason,created_by)
      values(p_hotel_id,v_position.product_id,v_position.location_id,v_episode,'critical_stock',case when v_position.quantity<0 then 'critical' else 'high' end,
        v_position.quantity,v_position.minimum_quantity,v_position.ideal_quantity,greatest(1,v_position.ideal_quantity-v_position.quantity),'Reposição sugerida pelo estoque mínimo.',p_actor_id);
      v_created:=v_created+1;
    elsif v_position.quantity>=v_position.minimum_quantity then
      update public.replenishment_requests set status='fulfilled',version=version+1,updated_at=now()
      where hotel_id=p_hotel_id and product_id=v_position.product_id and location_id=v_position.location_id and status in('draft','submitted','approved');
    end if;
  end loop;
  return jsonb_build_object('result','ok','created',v_created);
end $$;

create or replace function public.list_procurement_board(p_hotel_id uuid)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('policy',(select to_jsonb(p) from public.procurement_policies p where hotel_id=p_hotel_id),
 'replenishments',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('product_name',p.name,'location_name',l.name) order by r.created_at desc) from public.replenishment_requests r join public.products p on p.id=r.product_id join public.inventory_locations l on l.id=r.location_id where r.hotel_id=p_hotel_id),'[]'),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('supplier_name',b.legal_name,'lines',(select coalesce(jsonb_agg(to_jsonb(li)||jsonb_build_object('product_name',p.name)),'[]') from public.purchase_order_lines li join public.products p on p.id=li.product_id where li.purchase_order_id=o.id)) order by o.created_at desc) from public.purchase_orders o join public.procurement_suppliers s on s.id=o.supplier_id join public.business_organizations b on b.id=s.organization_id where o.hotel_id=p_hotel_id),'[]'),
 'invoices',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object(
   'due_dates',(select coalesce(jsonb_agg(to_jsonb(d) order by d.due_on),'[]') from public.procurement_invoice_due_dates d where d.invoice_id=i.id),
   'discrepancies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at),'[]') from public.procurement_discrepancies d where d.invoice_id=i.id)
  ) order by i.created_at desc) from public.procurement_invoices i where i.hotel_id=p_hotel_id),'[]'),
 'suppliers',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',o.legal_name)) from public.procurement_suppliers s join public.business_organizations o on o.id=s.organization_id where s.hotel_id=p_hotel_id and s.active),'[]'));
$$;

create or replace function public.create_replenishment_request(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_pos record; v_id uuid; v_episode integer;
begin
 select * into v_pos from public.inventory_positions where hotel_id=p_hotel_id and product_id=(p_input->>'product_id')::uuid and location_id=(p_input->>'location_id')::uuid and is_active for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if exists(select 1 from public.replenishment_requests where hotel_id=p_hotel_id and product_id=v_pos.product_id and location_id=v_pos.location_id and status not in('fulfilled','canceled')) then return jsonb_build_object('result','active_request_exists'); end if;
 select coalesce(max(episode),0)+1 into v_episode from public.replenishment_requests where hotel_id=p_hotel_id and product_id=v_pos.product_id and location_id=v_pos.location_id;
 insert into public.replenishment_requests(hotel_id,product_id,location_id,episode,current_quantity,minimum_quantity,ideal_quantity,requested_quantity,priority,need_by,preferred_supplier_id,reason,created_by)
 values(p_hotel_id,v_pos.product_id,v_pos.location_id,v_episode,v_pos.quantity,v_pos.minimum_quantity,v_pos.ideal_quantity,(p_input->>'requested_quantity')::numeric,p_input->>'priority',(p_input->>'need_by')::date,(p_input->>'preferred_supplier_id')::uuid,btrim(p_input->>'reason'),p_actor_id) returning id into v_id;
 return jsonb_build_object('result','ok','id',v_id); end $$;

create or replace function public.act_replenishment_request(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql set search_path=public as $$ declare v public.replenishment_requests%rowtype;
begin select * into v from public.replenishment_requests where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict'); end if;
 if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
 if p_action='submit' and v.status='draft' then if (select configuration_required from public.procurement_policies where hotel_id=p_hotel_id) then return jsonb_build_object('result','policy_required'); end if; update public.replenishment_requests set status='submitted',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='approve' and v.status='submitted' and v.created_by<>p_actor_id then update public.replenishment_requests set status='approved',version=version+1,responsible_id=p_actor_id,updated_at=now() where id=p_id;
 elsif p_action='cancel' and v.status not in('fulfilled','canceled','converted') then update public.replenishment_requests set status='canceled',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='fulfill' and v.status in('approved','converted') then update public.replenishment_requests set status='fulfilled',version=version+1,updated_at=now() where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if;
 insert into public.procurement_events(hotel_id,entity_type,entity_id,action,actor_id,reason) values(p_hotel_id,'replenishment',p_id,p_action,p_actor_id,btrim(p_reason)); return jsonb_build_object('result','ok'); end $$;

create or replace function public.save_procurement_policy(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare t jsonb; v_prev numeric:=-1;
begin
 if jsonb_array_length(p_input->'tiers')=0 then return jsonb_build_object('result','invalid_tiers'); end if;
 for t in select value from jsonb_array_elements(p_input->'tiers') order by (value->>'minimum_amount')::numeric loop
   if (t->>'minimum_amount')::numeric<=v_prev then return jsonb_build_object('result','invalid_tiers'); end if; v_prev:=(t->>'minimum_amount')::numeric;
 end loop;
 update public.procurement_policies set currency=p_input->>'currency',configuration_required=false,price_tolerance_percent=(p_input->>'price_tolerance_percent')::numeric,
 price_tolerance_amount=(p_input->>'price_tolerance_amount')::numeric,quantity_tolerance_percent=(p_input->>'quantity_tolerance_percent')::numeric,
 quantity_tolerance_amount=(p_input->>'quantity_tolerance_amount')::numeric,version=version+1,updated_by=p_actor_id,updated_at=now() where hotel_id=p_hotel_id;
 delete from public.procurement_approval_tiers where hotel_id=p_hotel_id;
 insert into public.procurement_approval_tiers(hotel_id,minimum_amount,maximum_amount,approvals_required,quotes_required)
 select p_hotel_id,(x->>'minimum_amount')::numeric,(x->>'maximum_amount')::numeric,(x->>'approvals_required')::integer,(x->>'quotes_required')::integer from jsonb_array_elements(p_input->'tiers') x;
 return jsonb_build_object('result','ok'); end $$;

create or replace function public.create_purchase_order(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid; v_total numeric; v_tier record; x jsonb;
begin
 if (select configuration_required from public.procurement_policies where hotel_id=p_hotel_id) then return jsonb_build_object('result','policy_required'); end if;
 if (p_input->>'currency')<>(select currency from public.procurement_policies where hotel_id=p_hotel_id) then return jsonb_build_object('result','currency_mismatch'); end if;
 select sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric+(x->>'tax_amount')::numeric) into v_total from jsonb_array_elements(p_input->'lines') x;
 select * into v_tier from public.procurement_approval_tiers where hotel_id=p_hotel_id and v_total>=minimum_amount and (maximum_amount is null or v_total<=maximum_amount) order by minimum_amount desc limit 1;
 if not found then return jsonb_build_object('result','approval_tier_missing'); end if;
 if (select count(distinct value->>'supplier_id') from jsonb_array_elements(p_input->'quotes'))<v_tier.quotes_required then return jsonb_build_object('result','quotes_required'); end if;
 if exists(select 1 from public.replenishment_requests r where r.id in(select value::text::uuid from jsonb_array_elements_text(p_input->'replenishment_request_ids')) and (r.hotel_id<>p_hotel_id or r.status<>'approved' or r.location_id<>(p_input->>'destination_location_id')::uuid or r.preferred_supplier_id is not null and r.preferred_supplier_id<>(p_input->>'supplier_id')::uuid)) then return jsonb_build_object('result','incompatible_replenishments'); end if;
 insert into public.purchase_orders(hotel_id,supplier_id,destination_location_id,currency,expected_on,notes,total_amount,required_approvals,required_quotes,created_by)
 values(p_hotel_id,(p_input->>'supplier_id')::uuid,(p_input->>'destination_location_id')::uuid,p_input->>'currency',(p_input->>'expected_on')::date,p_input->>'notes',v_total,v_tier.approvals_required,v_tier.quotes_required,p_actor_id) returning id into v_id;
 insert into public.purchase_order_lines(hotel_id,purchase_order_id,product_id,quantity,unit_price,tax_amount)
 select p_hotel_id,v_id,(x->>'product_id')::uuid,(x->>'quantity')::numeric,(x->>'unit_price')::numeric,(x->>'tax_amount')::numeric from jsonb_array_elements(p_input->'lines') x;
 insert into public.purchase_order_quotes(hotel_id,purchase_order_id,supplier_id,amount,reference)
 select distinct on (x->>'supplier_id') p_hotel_id,v_id,(x->>'supplier_id')::uuid,(x->>'amount')::numeric,x->>'reference' from jsonb_array_elements(p_input->'quotes') x order by x->>'supplier_id';
 insert into public.purchase_order_replenishments(hotel_id,purchase_order_id,replenishment_request_id)
 select p_hotel_id,v_id,value::text::uuid from jsonb_array_elements_text(p_input->'replenishment_request_ids');
 update public.replenishment_requests set status='converted',version=version+1,updated_at=now() where id in(select replenishment_request_id from public.purchase_order_replenishments where purchase_order_id=v_id);
 return jsonb_build_object('result','ok','id',v_id); exception when foreign_key_violation then return jsonb_build_object('result','invalid_reference'); end $$;

create or replace function public.act_purchase_order(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql set search_path=public as $$ declare v public.purchase_orders%rowtype; v_level integer;
begin select * into v from public.purchase_orders where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict'); end if;
 if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
 if p_action='submit' and v.status='draft' then update public.purchase_orders set status='pending_approval',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='approve' and v.status='pending_approval' then
   if v.created_by=p_actor_id or exists(select 1 from public.purchase_order_approvals where purchase_order_id=p_id and actor_id=p_actor_id) then return jsonb_build_object('result','segregation_required'); end if;
   select count(*)+1 into v_level from public.purchase_order_approvals where purchase_order_id=p_id and decision='approved';
   insert into public.purchase_order_approvals(hotel_id,purchase_order_id,approval_level,actor_id,decision,reason) values(p_hotel_id,p_id,v_level,p_actor_id,'approved',btrim(p_reason));
   if v_level>=v.required_approvals then update public.purchase_orders set status='approved',version=version+1,updated_at=now() where id=p_id; else update public.purchase_orders set version=version+1,updated_at=now() where id=p_id; end if;
 elsif p_action='reject' and v.status='pending_approval' and v.created_by<>p_actor_id then insert into public.purchase_order_approvals(hotel_id,purchase_order_id,approval_level,actor_id,decision,reason) values(p_hotel_id,p_id,1,p_actor_id,'rejected',btrim(p_reason)); update public.purchase_orders set status='draft',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='issue' and v.status='approved' then update public.purchase_orders set status='issued',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='close' and v.status='received' then update public.purchase_orders set status='closed',version=version+1,updated_at=now() where id=p_id;
 elsif p_action='cancel' and v.status in('draft','pending_approval','approved') then update public.purchase_orders set status='canceled',version=version+1,updated_at=now() where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if;
 insert into public.procurement_events(hotel_id,entity_type,entity_id,action,actor_id,reason) values(p_hotel_id,'purchase_order',p_id,p_action,p_actor_id,btrim(p_reason)); return jsonb_build_object('result','ok'); end $$;

-- Receipt posts aggregate stock atomically. Lot allocation is added by the next migration.
create or replace function public.receive_purchase_order(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_order public.purchase_orders%rowtype; v_receipt uuid; v_line record; x jsonb; v_pos record; v_doc uuid; v_movement uuid;
begin select * into v_order from public.purchase_orders where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_order.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 if v_order.status not in('issued','partially_received') then return jsonb_build_object('result','invalid_transition'); end if;
 if exists(select 1 from public.purchase_receipts where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint<>md5(p_input::text)) then return jsonb_build_object('result','idempotency_conflict'); end if;
 select id into v_receipt from public.purchase_receipts where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid; if found then return jsonb_build_object('result','ok','id',v_receipt); end if;
 insert into public.purchase_receipts(hotel_id,purchase_order_id,occurred_at,reference_code,notes,idempotency_key,request_fingerprint,received_by)
 values(p_hotel_id,p_id,(p_input->>'occurred_at')::timestamptz,p_input->>'reference_code',p_input->>'notes',(p_input->>'idempotency_key')::uuid,md5(p_input::text),p_actor_id) returning id into v_receipt;
 insert into public.inventory_documents(hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata)
 values(p_hotel_id,'receipt','Recebimento de pedido de compra',p_input->>'reference_code',(p_input->>'occurred_at')::timestamptz,p_actor_id,gen_random_uuid(),md5(p_input::text),jsonb_build_object('purchase_order_id',p_id)) returning id into v_doc;
 for x in select value from jsonb_array_elements(p_input->'lines') loop
   select * into v_line from public.purchase_order_lines where id=(x->>'order_line_id')::uuid and purchase_order_id=p_id and hotel_id=p_hotel_id for update;
   if not found or v_line.received_quantity+(x->>'accepted_quantity')::numeric>v_line.quantity then raise exception 'invalid_quantity'; end if;
   select * into v_pos from public.inventory_positions where hotel_id=p_hotel_id and product_id=v_line.product_id and location_id=v_order.destination_location_id for update;
   if not found then raise exception 'inventory_position_missing'; end if;
   v_movement:=null;
   if (x->>'accepted_quantity')::numeric>0 then
     insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,reference_code,occurred_at,actor_id,document_id,metadata)
     values(p_hotel_id,v_pos.id,v_pos.product_id,v_pos.location_id,'receipt',(x->>'accepted_quantity')::numeric,v_pos.quantity,v_pos.quantity+(x->>'accepted_quantity')::numeric,
       case when v_pos.quantity+(x->>'accepted_quantity')::numeric=0 then v_pos.average_unit_cost else ((v_pos.quantity*coalesce(v_pos.average_unit_cost,0))+((x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric))/(v_pos.quantity+(x->>'accepted_quantity')::numeric) end,
       (x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric,'Recebimento de compra',p_input->>'reference_code',(p_input->>'occurred_at')::timestamptz,p_actor_id,v_doc,jsonb_strip_nulls(jsonb_build_object('lot_code',x->>'lot_code','expires_on',x->>'expires_on'))) returning id into v_movement;
     update public.inventory_positions set quantity=quantity+(x->>'accepted_quantity')::numeric,average_unit_cost=case when quantity+(x->>'accepted_quantity')::numeric=0 then average_unit_cost else ((quantity*coalesce(average_unit_cost,0))+((x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric))/(quantity+(x->>'accepted_quantity')::numeric) end,version=version+1,updated_at=now() where id=v_pos.id;
   end if;
   update public.purchase_order_lines set received_quantity=received_quantity+(x->>'accepted_quantity')::numeric where id=v_line.id;
   insert into public.purchase_receipt_lines(hotel_id,receipt_id,order_line_id,accepted_quantity,rejected_quantity,unit_cost,lot_code,expires_on,evidence_path,inventory_movement_id)
   values(p_hotel_id,v_receipt,v_line.id,(x->>'accepted_quantity')::numeric,(x->>'rejected_quantity')::numeric,(x->>'unit_cost')::numeric,x->>'lot_code',(x->>'expires_on')::date,x->>'evidence_path',v_movement);
 end loop;
 update public.purchase_orders set status=case when exists(select 1 from public.purchase_order_lines where purchase_order_id=p_id and received_quantity<quantity) then 'partially_received'::public.purchase_order_status else 'received' end,version=version+1,updated_at=now() where id=p_id;
 perform public.reconcile_replenishment_requests(p_hotel_id,p_actor_id); return jsonb_build_object('result','ok','id',v_receipt);
 exception when others then if sqlerrm in('invalid_quantity','inventory_position_missing') then return jsonb_build_object('result',sqlerrm); else raise; end if; end $$;

create or replace function public.create_procurement_invoice(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_order public.purchase_orders%rowtype; v_id uuid; v_expected numeric; v_policy public.procurement_policies%rowtype; v_due jsonb; v_line record; v_count integer; v_index integer:=0; v_sum numeric:=0;
begin select * into v_order from public.purchase_orders where id=(p_input->>'purchase_order_id')::uuid and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if; select * into v_policy from public.procurement_policies where hotel_id=p_hotel_id;
 select coalesce(sum(rl.accepted_quantity*rl.unit_cost),v_order.total_amount) into v_expected from public.purchase_receipt_lines rl join public.purchase_receipts r on r.id=rl.receipt_id where r.purchase_order_id=v_order.id;
 insert into public.procurement_invoices(hotel_id,purchase_order_id,invoice_number,issued_on,total_amount,evidence_path,idempotency_key,created_by)
 values(p_hotel_id,v_order.id,btrim(p_input->>'invoice_number'),(p_input->>'issued_on')::date,(p_input->>'total_amount')::numeric,p_input->>'evidence_path',(p_input->>'idempotency_key')::uuid,p_actor_id) returning id into v_id;
 if abs((p_input->>'total_amount')::numeric-v_expected)>greatest(v_policy.price_tolerance_amount,v_expected*v_policy.price_tolerance_percent/100) then
   update public.procurement_invoices set status='exception' where id=v_id;
   insert into public.procurement_discrepancies(hotel_id,invoice_id,kind,expected_amount,actual_amount,allowed_variance,opened_by) values(p_hotel_id,v_id,'price',v_expected,(p_input->>'total_amount')::numeric,greatest(v_policy.price_tolerance_amount,v_expected*v_policy.price_tolerance_percent/100),p_actor_id);
 end if;
 for v_line in select l.*,coalesce(sum(rl.accepted_quantity),0) received from public.purchase_order_lines l left join public.purchase_receipt_lines rl on rl.order_line_id=l.id where l.purchase_order_id=v_order.id group by l.id loop
  if abs(v_line.quantity-v_line.received)>greatest(v_policy.quantity_tolerance_amount,v_line.quantity*v_policy.quantity_tolerance_percent/100) then
   insert into public.procurement_discrepancies(hotel_id,invoice_id,order_line_id,kind,expected_amount,actual_amount,allowed_variance,opened_by) values(p_hotel_id,v_id,v_line.id,'quantity',v_line.quantity,v_line.received,greatest(v_policy.quantity_tolerance_amount,v_line.quantity*v_policy.quantity_tolerance_percent/100),p_actor_id);
   update public.procurement_invoices set status='exception' where id=v_id;
  end if;
 end loop;
 v_count:=jsonb_array_length(p_input->'due_dates');
 for v_due in select value from jsonb_array_elements(p_input->'due_dates') loop v_index:=v_index+1;
   insert into public.procurement_invoice_due_dates(hotel_id,invoice_id,due_on,amount) values(p_hotel_id,v_id,(v_due#>>'{}')::date,case when v_index=v_count then (p_input->>'total_amount')::numeric-v_sum else round((p_input->>'total_amount')::numeric/v_count,2) end);
   v_sum:=v_sum+round((p_input->>'total_amount')::numeric/v_count,2);
 end loop; return jsonb_build_object('result','ok','id',v_id); exception when unique_violation then return jsonb_build_object('result','idempotency_conflict'); end $$;

create or replace function public.act_procurement_invoice(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql set search_path=public as $$ declare v public.procurement_invoices%rowtype;
begin select * into v from public.procurement_invoices where id=p_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict'); end if;
 if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
 if p_action='approve' and v.status='draft' and v.created_by<>p_actor_id then update public.procurement_invoices set status='approved',approved_by=p_actor_id,approved_at=now(),version=version+1,updated_at=now() where id=p_id;
 elsif p_action='accept_exception' and v.status='exception' and v.created_by<>p_actor_id then update public.procurement_discrepancies set status='accepted',decided_by=p_actor_id,decision_reason=btrim(p_reason),resolved_at=now() where invoice_id=p_id and status='open'; update public.procurement_invoices set status='approved',approved_by=p_actor_id,approved_at=now(),version=version+1,updated_at=now() where id=p_id;
 elsif p_action='cancel' and v.status in('draft','exception') then update public.procurement_invoices set status='canceled',version=version+1,updated_at=now() where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if; return jsonb_build_object('result','ok'); end $$;

create or replace function public.pay_procurement_installment(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_due record; x jsonb; v_total numeric; v_payment uuid; v_batch uuid; v_tx uuid; v_fp text:=md5(p_input::text);
begin select d.*,i.status invoice_status,i.version invoice_version,o.supplier_id,b.legal_name from public.procurement_invoice_due_dates d join public.procurement_invoices i on i.id=d.invoice_id join public.purchase_orders o on o.id=i.purchase_order_id join public.procurement_suppliers s on s.id=o.supplier_id join public.business_organizations b on b.id=s.organization_id where d.id=p_id and d.hotel_id=p_hotel_id for update into v_due;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_due.invoice_version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 select sum((x->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') x; if v_total<=0 or v_due.paid_amount+v_total>v_due.amount then return jsonb_build_object('result','invalid_amount'); end if;
 if exists(select 1 from jsonb_array_elements(p_input->'tenders') x where x->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required'); end if;
 select id into v_batch from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp; if found then return jsonb_build_object('result','ok','id',v_batch); end if;
 if exists(select 1 from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict'); end if;
 insert into public.procurement_payment_batches(hotel_id,installment_id,idempotency_key,request_fingerprint,total_amount,created_by) values(p_hotel_id,p_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
 for x in select value from jsonb_array_elements(p_input->'tenders') loop
   insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,counterparty,reference_code,created_by)
   values(p_hotel_id,'EXPENSE','PROCUREMENT',(x->>'amount')::numeric,(select currency from public.procurement_invoices where id=v_due.invoice_id),'Pagamento de fornecedor','COMPLETED',x->>'payment_method',now(),v_due.legal_name,x->>'reference_code',p_actor_id) returning id into v_tx;
   insert into public.procurement_payments(hotel_id,installment_id,payment_batch_id,financial_transaction_id,amount,payment_method,reference_code,cash_session_id,idempotency_key,request_fingerprint,paid_at,created_by)
   values(p_hotel_id,p_id,v_batch,v_tx,(x->>'amount')::numeric,x->>'payment_method',x->>'reference_code',(p_input->>'cash_session_id')::uuid,gen_random_uuid(),v_fp,now(),p_actor_id) returning id into v_payment;
 end loop;
 update public.procurement_invoice_due_dates set paid_amount=paid_amount+v_total,version=version+1 where id=p_id;
 update public.procurement_invoices set status=case when exists(select 1 from public.procurement_invoice_due_dates where invoice_id=v_due.invoice_id and id<>p_id and paid_amount<amount) or v_due.paid_amount+v_total<v_due.amount then 'partially_paid'::public.procurement_invoice_status else 'paid' end,version=version+1,updated_at=now() where id=v_due.invoice_id;
 return jsonb_build_object('result','ok','id',v_batch); end $$;

create or replace function public.list_business_organizations(p_hotel_id uuid)
returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('roles',jsonb_strip_nulls(jsonb_build_object(
 'commercial_partner_id',(select id from public.commercial_partners where organization_id=o.id limit 1),
 'maintenance_supplier_id',(select id from public.maintenance_suppliers where organization_id=o.id limit 1),
 'corporate_account_id',(select id from public.corporate_accounts where organization_id=o.id limit 1),
 'stock_supplier_id',(select id from public.procurement_suppliers where organization_id=o.id limit 1)))) order by o.legal_name),'[]') from public.business_organizations o where o.hotel_id=p_hotel_id;
$$;

create or replace function public.get_business_organization_overview(p_hotel_id uuid,p_id uuid,p_permissions text[])
returns jsonb language sql stable set search_path=public as $$
 select to_jsonb(o)||jsonb_build_object(
  'roles',jsonb_strip_nulls(jsonb_build_object(
   'commercial_partner_id',cp.id,'maintenance_supplier_id',ms.id,'corporate_account_id',ca.id,'stock_supplier_id',ps.id)),
  'conflicts',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.business_organization_conflicts c where c.organization_id=o.id and c.status='open'),'[]'),
  'commercial_agreements',case when p_permissions&&array['read_commercial_partners','manage_commercial_agreements'] and cp.id is not null then
    coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.commercial_agreements a where a.partner_id=cp.id and a.hotel_id=p_hotel_id),'[]') else null end,
  'partner_settlements',case when p_permissions&&array['read_partner_settlements','settle_partner_settlements','manage_partner_disputes'] and cp.id is not null then
    coalesce((select jsonb_agg(to_jsonb(s) order by s.period_start desc) from public.partner_settlements s where s.partner_id=cp.id and s.hotel_id=p_hotel_id),'[]') else null end,
  'maintenance_contracts',case when p_permissions&&array['read_maintenance_management','manage_maintenance_suppliers'] and ms.id is not null then
    coalesce((select jsonb_agg(to_jsonb(c) order by c.starts_on desc) from public.maintenance_contracts c where c.supplier_id=ms.id and c.hotel_id=p_hotel_id),'[]') else null end,
  'purchase_orders',case when p_permissions&&array['read_procurement','request_procurement','approve_procurement','receive_procurement','review_procurement_invoices','settle_supplier_payables'] and ps.id is not null then
    coalesce((select jsonb_agg(to_jsonb(po) order by po.created_at desc) from public.purchase_orders po where po.supplier_id=ps.id and po.hotel_id=p_hotel_id),'[]') else null end,
  'corporate_authorizations',case when p_permissions&&array['manage_corporate_accounts','request_corporate_credit','approve_corporate_credit','settle_corporate_receivables'] and ca.id is not null then
    coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.corporate_credit_authorizations a where a.corporate_account_id=ca.id and a.hotel_id=p_hotel_id),'[]') else null end)
 from public.business_organizations o
 left join public.commercial_partners cp on cp.organization_id=o.id
 left join public.maintenance_suppliers ms on ms.organization_id=o.id
 left join public.corporate_accounts ca on ca.organization_id=o.id
 left join public.procurement_suppliers ps on ps.organization_id=o.id
 where o.id=p_id and o.hotel_id=p_hotel_id;
$$;

create or replace function public.save_business_organization(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin insert into public.business_organizations(hotel_id,legal_name,trade_name,tax_id,currency,email,phone,active,created_by)
 values(p_hotel_id,btrim(p_input->>'legal_name'),nullif(btrim(p_input->>'trade_name'),''),nullif(btrim(p_input->>'tax_id'),''),p_input->>'currency',p_input->>'email',p_input->>'phone',(p_input->>'active')::boolean,p_actor_id) returning id into v_id;
 if coalesce(p_input->'roles','[]') ? 'stock_supplier' then insert into public.procurement_suppliers(hotel_id,organization_id,created_by) values(p_hotel_id,v_id,p_actor_id); end if;
 insert into public.business_organization_events(hotel_id,organization_id,action,actor_id,details) values(p_hotel_id,v_id,'created',p_actor_id,p_input); return jsonb_build_object('result','ok','id',v_id);
 exception when unique_violation then return jsonb_build_object('result','tax_id_conflict'); end $$;

create or replace function public.act_business_organization(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v public.business_organizations%rowtype; v_target public.business_organizations%rowtype;
begin select * into v from public.business_organizations where id=p_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 if p_input->>'action'='merge' then select * into v_target from public.business_organizations where id=(p_input->>'target_id')::uuid and hotel_id=p_hotel_id for update; if not found or v_target.id=v.id then return jsonb_build_object('result','invalid_target'); end if;
  update public.commercial_partners set organization_id=v_target.id where organization_id=v.id; update public.maintenance_suppliers set organization_id=v_target.id where organization_id=v.id; update public.corporate_accounts set organization_id=v_target.id where organization_id=v.id; update public.procurement_suppliers set organization_id=v_target.id where organization_id=v.id;
  update public.business_organizations set active=false,version=version+1,updated_at=now() where id=v.id;
 elsif p_input->>'action'='split' then return jsonb_build_object('result','split_requires_role_copy'); else return jsonb_build_object('result','invalid_action'); end if;
 insert into public.business_organization_events(hotel_id,organization_id,action,actor_id,reason,details) values(p_hotel_id,p_id,p_input->>'action',p_actor_id,btrim(p_input->>'reason'),p_input); return jsonb_build_object('result','ok'); end $$;

create trigger business_organization_events_immutable before update or delete on public.business_organization_events for each row execute function public.prevent_maintenance_event_mutation();
create trigger procurement_events_immutable before update or delete on public.procurement_events for each row execute function public.prevent_maintenance_event_mutation();
create trigger purchase_receipts_immutable before update or delete on public.purchase_receipts for each row execute function public.prevent_maintenance_event_mutation();
create trigger purchase_receipt_lines_immutable before update or delete on public.purchase_receipt_lines for each row execute function public.prevent_maintenance_event_mutation();
create trigger purchase_order_approvals_immutable before update or delete on public.purchase_order_approvals for each row execute function public.prevent_maintenance_event_mutation();
create trigger procurement_payment_batches_immutable before update or delete on public.procurement_payment_batches for each row execute function public.prevent_maintenance_event_mutation();
create trigger procurement_payments_immutable before update or delete on public.procurement_payments for each row execute function public.prevent_maintenance_event_mutation();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array[
 'read_business_organizations','manage_business_organizations','read_procurement','request_procurement','approve_procurement','receive_procurement','review_procurement_invoices','settle_supplier_payables'
]) name on conflict(name) do nothing;

do $$ declare t text; begin foreach t in array array['business_organizations','business_organization_events','business_organization_conflicts','procurement_suppliers','procurement_policies','procurement_approval_tiers','replenishment_requests','purchase_orders','purchase_order_lines','purchase_order_quotes','purchase_order_replenishments','purchase_order_approvals','purchase_receipts','purchase_receipt_lines','procurement_invoices','procurement_invoice_due_dates','procurement_discrepancies','procurement_payment_batches','procurement_payments','procurement_events'] loop
 execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
grant execute on function public.list_business_organizations(uuid),public.get_business_organization_overview(uuid,uuid,text[]),public.save_business_organization(uuid,uuid,jsonb),public.act_business_organization(uuid,uuid,uuid,jsonb),
 public.reconcile_replenishment_requests(uuid,uuid),public.list_procurement_board(uuid),public.create_replenishment_request(uuid,uuid,jsonb),public.act_replenishment_request(uuid,uuid,uuid,text,integer,text),
 public.save_procurement_policy(uuid,uuid,jsonb),public.create_purchase_order(uuid,uuid,jsonb),public.act_purchase_order(uuid,uuid,uuid,text,integer,text),
 public.receive_purchase_order(uuid,uuid,uuid,jsonb),public.create_procurement_invoice(uuid,uuid,jsonb),public.act_procurement_invoice(uuid,uuid,uuid,text,integer,text),public.pay_procurement_installment(uuid,uuid,uuid,jsonb) to service_role;
