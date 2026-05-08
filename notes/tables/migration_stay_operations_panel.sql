-- Migration for operational stay panel:
-- - hotel check-in/check-out time windows
-- - financial_transactions linkage to stay/reservation payments

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

alter table public.financial_transactions
  add column if not exists stay_id uuid null,
  add column if not exists reservation_id uuid null,
  add column if not exists payment_method text null,
  add column if not exists paid_at timestamp with time zone not null default now(),
  add column if not exists created_by uuid null;

do $$
begin
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

create index if not exists idx_financial_transactions_stay_id on public.financial_transactions(stay_id);
create index if not exists idx_financial_transactions_reservation_id on public.financial_transactions(reservation_id);
create index if not exists idx_financial_transactions_category_status on public.financial_transactions(category, status);
create index if not exists idx_financial_transactions_paid_at on public.financial_transactions(paid_at desc);

-- Optional one-time migration from legacy stay_payments (if table exists)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'stay_payments'
  ) then
    insert into public.financial_transactions (
      hotel_id,
      type,
      category,
      amount,
      currency,
      description,
      status,
      created_at,
      stay_id,
      reservation_id,
      payment_method,
      paid_at,
      created_by
    )
    select
      r.hotel_id,
      'INCOME'::public.transaction_type,
      'STAY_PAYMENT',
      sp.amount,
      'BRL',
      sp.note,
      'COMPLETED'::public.transaction_status,
      sp.created_at,
      sp.stay_id,
      s.reservation_id,
      sp.method,
      sp.paid_at,
      sp.created_by
    from public.stay_payments sp
    join public.stays s on s.id = sp.stay_id
    join public.reservations r on r.id = s.reservation_id
    where not exists (
      select 1
      from public.financial_transactions ft
      where ft.stay_id = sp.stay_id
        and ft.category = 'STAY_PAYMENT'
        and ft.amount = sp.amount
        and ft.created_at = sp.created_at
    );
  end if;
end $$;

commit;
