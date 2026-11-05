begin;
select plan(3);

-- QA-027: as datas do seed seguem o dia do hotel, não o dia em UTC. O dia de referência
-- vem do created_at do próprio seed, para o teste não depender da hora em que roda.

select is(
  (
    select b.start_date
    from public.room_blocks b
    where b.id = '95000000-0000-4000-8000-000000000001'
  ),
  (
    select (b.created_at at time zone h.timezone)::date + 1
    from public.room_blocks b
    join public.hotels h on h.id = b.hotel_id
    where b.id = '95000000-0000-4000-8000-000000000001'
  ),
  'o bloqueio do 103 começa no dia seguinte do hotel'
);

select is(
  (
    select (s.checkin_date_expected at time zone h.timezone)::time
    from public.stays s
    join public.reservations r on r.id = s.reservation_id
    join public.hotels h on h.id = r.hotel_id
    where s.id = '91000000-0000-4000-8000-000000000001'
  ),
  time '14:00',
  'a chegada prevista é às 14h no fuso do hotel'
);

select is(
  (
    select (s.checkout_date_expected at time zone h.timezone)::time
    from public.stays s
    join public.reservations r on r.id = s.reservation_id
    join public.hotels h on h.id = r.hotel_id
    where s.id = '91000000-0000-4000-8000-000000000001'
  ),
  time '11:00',
  'a saída prevista é às 11h no fuso do hotel'
);

select * from finish();

rollback;
