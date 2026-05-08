-- All-in-one migration: move operational status to stays.stay_status
-- and remove legacy columns from reservations.
-- Run in Supabase SQL editor with a privileged role.

begin;

-- 1) Ensure enum type exists (reuse existing reservation_status enum if present).
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'reservation_status' and n.nspname = 'public'
  ) then
    create type public.reservation_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'canceled', 'no_show');
  end if;
end $$;

-- 2) Ensure stays.stay_status exists with default and backfill.
alter table public.stays
  add column if not exists stay_status public.reservation_status;

update public.stays
set stay_status = 'confirmed'::public.reservation_status
where stay_status is null;

alter table public.stays
  alter column stay_status set default 'confirmed'::public.reservation_status,
  alter column stay_status set not null;

-- 3) Remove known index depending on reservations.reservation_status.
drop index if exists public.idx_reservations_status;

-- 4) Drop legacy columns in reservations if still present.
alter table public.reservations
  drop column if exists reservation_status,
  drop column if exists payment_status;

commit;
