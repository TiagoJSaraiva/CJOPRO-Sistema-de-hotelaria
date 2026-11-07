-- QA-089: um lançamento com data de um dia já fechado entrava nesse dia, e o valor de um lançamento que
-- não era em dinheiro ainda podia mudar ou ser apagado depois. Os totais do dia fechado deixavam de bater
-- com o snapshot aprovado. Agora o lançamento tardio fica na próxima data aberta, a partir da data atual,
-- e guarda a data e o fechamento originais. O que já está no dia fechado só muda por novo lançamento.
create function public.next_open_business_date(p_hotel_id uuid)
returns date
language plpgsql
stable
set search_path to 'public'
as $function$
declare v_date date := public.hotel_operational_date(p_hotel_id);
begin
  while exists(
    select 1 from public.daily_closes
    where hotel_id = p_hotel_id and business_date = v_date and status = 'closed'
  ) loop
    v_date := v_date + 1;
  end loop;
  return v_date;
end $function$;

CREATE OR REPLACE FUNCTION public.assign_financial_business_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_session uuid;v_close uuid;
begin
 -- Pagamento concluído sem data informada acontece no instante operacional do hotel.
 if new.paid_at is null and new.status in ('COMPLETED','REFUNDED') then new.paid_at:=public.hotel_operational_now(new.hotel_id);end if;
 if new.business_date is null then
  if new.paid_at is not null then
   select (new.paid_at at time zone h.timezone)::date into new.business_date from public.hotels h where h.id=new.hotel_id;
  else
   new.business_date:=public.hotel_operational_date(new.hotel_id);
  end if;
 end if;
 select id into v_close from public.daily_closes where hotel_id=new.hotel_id and business_date=new.business_date and status='closed';
 if v_close is not null then
  new.original_business_date:=coalesce(new.original_business_date,new.business_date);
  new.origin_daily_close_id:=coalesce(new.origin_daily_close_id,v_close);
  new.business_date:=public.next_open_business_date(new.hotel_id);
 end if;
 if new.cash_session_id is null and new.created_by is not null and new.status in ('COMPLETED','REFUNDED') then select id into v_session from public.cash_sessions where hotel_id=new.hotel_id and operator_id=new.created_by and status='open' order by opened_at desc limit 1;new.cash_session_id:=v_session;end if;
 if new.cash_session_id is null and lower(coalesce(new.payment_method,''))='cash' and new.status in ('COMPLETED','REFUNDED') then raise exception 'cash_session_required';end if;
 if new.original_business_date is not null and new.original_business_date<>new.business_date and new.origin_daily_close_id is null then raise exception 'origin_close_required';end if;
 return new;end $function$;

CREATE OR REPLACE FUNCTION public.guard_financial_cash_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
 v_was_cash boolean:=lower(coalesce(old.payment_method,''))='cash' and old.status in ('COMPLETED','REFUNDED');
 v_was_settled boolean:=old.status in ('COMPLETED','REFUNDED');
 v_close uuid;
begin
 select id into v_close from public.daily_closes where hotel_id=old.hotel_id and business_date=old.business_date and status='closed';
 if tg_op='DELETE' then
  if v_was_cash and old.cash_session_id is not null then raise exception 'cash_transaction_immutable';end if;
  if v_close is not null and v_was_settled then raise exception 'closed_day_immutable';end if;
  return old;
 end if;
 if v_was_cash and old.cash_session_id is not null and (
   new.amount<>old.amount or new.type<>old.type or new.status<>old.status
   or lower(coalesce(new.payment_method,''))<>'cash' or new.cash_session_id is distinct from old.cash_session_id
 ) then raise exception 'cash_transaction_immutable';end if;
 if not v_was_cash and lower(coalesce(new.payment_method,''))='cash' and new.status in ('COMPLETED','REFUNDED') and new.cash_session_id is null then
  raise exception 'cash_session_required';
 end if;
 if v_close is not null and v_was_settled and (
   new.amount<>old.amount or new.type<>old.type or new.status<>old.status
   or coalesce(new.payment_method,'')<>coalesce(old.payment_method,'') or new.business_date<>old.business_date
 ) then raise exception 'closed_day_immutable';end if;
 -- Pendente concluído depois do fechamento é um lançamento tardio.
 if v_close is not null and not v_was_settled and new.status in ('COMPLETED','REFUNDED') then
  new.original_business_date:=old.business_date;
  new.origin_daily_close_id:=v_close;
  new.business_date:=public.next_open_business_date(old.hotel_id);
 end if;
 return new;
end $function$;
