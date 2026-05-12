-- Migration for PMS expense monitoring and management fields.
-- Run this in Supabase SQL editor after the current project.sql schema is applied.

begin;

alter table public.financial_transactions
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists stay_id uuid null,
  add column if not exists reservation_id uuid null,
  add column if not exists payment_method text null,
  add column if not exists paid_at timestamp with time zone null,
  add column if not exists created_by uuid null,
  add column if not exists due_date date null,
  add column if not exists counterparty text null,
  add column if not exists cost_center text null,
  add column if not exists reference_code text null;

alter table public.financial_transactions
  alter column paid_at drop not null;

create or replace function public.set_updated_at_if_changed()
returns trigger as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_financial_transactions_set_updated_at on public.financial_transactions;
create trigger trg_financial_transactions_set_updated_at
before update on public.financial_transactions
for each row
execute function public.set_updated_at_if_changed();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_currency_iso_code_check'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_currency_iso_code_check
      check (currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_created_by_fkey'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_created_by_fkey
      foreign key (created_by) references public.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_stay_id_fkey'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_stay_id_fkey
      foreign key (stay_id) references public.stays(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_transactions_reservation_id_fkey'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_reservation_id_fkey
      foreign key (reservation_id) references public.reservations(id) on delete set null;
  end if;
end $$;

create index if not exists idx_financial_transactions_hotel_status_due_date
on public.financial_transactions(hotel_id, status, due_date);

create index if not exists idx_financial_transactions_hotel_type_paid_at
on public.financial_transactions(hotel_id, type, paid_at desc);

create index if not exists idx_financial_transactions_hotel_cost_center
on public.financial_transactions(hotel_id, cost_center);

create index if not exists idx_financial_transactions_hotel_counterparty
on public.financial_transactions(hotel_id, counterparty);

commit;
