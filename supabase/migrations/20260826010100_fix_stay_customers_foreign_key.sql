alter table public.stay_customers
  drop constraint if exists reservation_customers_reservation_id_fkey;
