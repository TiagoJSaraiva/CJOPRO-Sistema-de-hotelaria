-- Migration for operational stay panel:
-- - hotel check-in/check-out time windows
-- - stay payments history table

begin;

alter table public.hotels
  add column if not exists checkin_time_start text,
  add column if not exists checkin_time_limit text,
  add column if not exists checkout_time_start text,
  add column if not exists checkout_time_limit text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hotels_checkin_time_start_format'
  ) then
    alter table public.hotels
      add constraint hotels_checkin_time_start_format
      check (checkin_time_start is null or checkin_time_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'hotels_checkin_time_limit_format'
  ) then
    alter table public.hotels
      add constraint hotels_checkin_time_limit_format
      check (checkin_time_limit is null or checkin_time_limit ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'hotels_checkout_time_start_format'
  ) then
    alter table public.hotels
      add constraint hotels_checkout_time_start_format
      check (checkout_time_start is null or checkout_time_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'hotels_checkout_time_limit_format'
  ) then
    alter table public.hotels
      add constraint hotels_checkout_time_limit_format
      check (checkout_time_limit is null or checkout_time_limit ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;

create table if not exists public.stay_payments (
  id uuid not null default gen_random_uuid(),
  stay_id uuid not null,
  amount numeric(12,2) not null,
  method text not null,
  note text null,
  paid_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  created_by uuid null,
  constraint stay_payments_pkey primary key (id),
  constraint stay_payments_stay_id_fkey foreign key (stay_id) references public.stays(id) on delete cascade,
  constraint stay_payments_amount_positive check (amount > 0)
);

create index if not exists idx_stay_payments_stay_id on public.stay_payments(stay_id);
create index if not exists idx_stay_payments_paid_at on public.stay_payments(paid_at desc);

commit;

