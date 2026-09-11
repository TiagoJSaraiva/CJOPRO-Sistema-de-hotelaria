-- Etapa 5.3: caixas exclusivos, contagem cega e fechamento diário.

create type public.cash_register_kind as enum ('reception','consumption');
create type public.cash_session_status as enum ('open','counting','difference_pending','closed','canceled');
create type public.cash_movement_kind as enum ('opening_float','receipt','refund','cash_in','cash_out','deposit','adjustment');
create type public.daily_close_status as enum ('open','prepared','closed','rejected');

create table public.cash_registers (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 name text not null,code text not null,kind public.cash_register_kind not null,consumption_point_id uuid,currency text not null,
 difference_tolerance numeric(14,2) not null default 0,active boolean not null default true,version integer not null default 1,
 created_by uuid not null references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,hotel_id),unique(hotel_id,code),foreign key(consumption_point_id,hotel_id) references public.consumption_points(id,hotel_id) on delete restrict,
 check((kind='consumption')=(consumption_point_id is not null) and currency~'^[A-Z]{3}$' and difference_tolerance>=0)
);
create table public.cash_sessions (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,cash_register_id uuid not null,operator_id uuid not null references public.users(id),
 status public.cash_session_status not null default 'open',business_date date not null,opening_float numeric(14,2) not null,
 expected_cash numeric(14,2) not null,counted_cash numeric(14,2),difference_amount numeric(14,2),version integer not null default 1,
 opened_at timestamptz not null default now(),counted_at timestamptz,closed_at timestamptz,closed_by uuid references public.users(id),
 idempotency_key uuid not null,request_fingerprint text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,hotel_id),unique(hotel_id,idempotency_key),foreign key(cash_register_id,hotel_id) references public.cash_registers(id,hotel_id) on delete restrict,
 check(opening_float>=0 and version>0)
);
create unique index cash_register_open_session_unique on public.cash_sessions(cash_register_id) where status in('open','counting','difference_pending');
create unique index cash_operator_open_session_unique on public.cash_sessions(hotel_id,operator_id) where status in('open','counting','difference_pending');
create table public.cash_movements (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,cash_session_id uuid not null,kind public.cash_movement_kind not null,
 amount numeric(14,2) not null,cash_delta numeric(14,2) not null,reason text not null,financial_transaction_id uuid references public.financial_transactions(id),
 idempotency_key uuid not null,request_fingerprint text not null,actor_id uuid not null references public.users(id),occurred_at timestamptz not null default now(),
 reversal_of_id uuid references public.cash_movements(id),created_at timestamptz not null default now(),unique(hotel_id,idempotency_key),
 foreign key(cash_session_id,hotel_id) references public.cash_sessions(id,hotel_id) on delete restrict,check(amount>0 and length(btrim(reason)) between 3 and 1000)
);
create table public.cash_session_counts (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,cash_session_id uuid not null,counted_amount numeric(14,2) not null,
 expected_amount numeric(14,2) not null,difference_amount numeric(14,2) not null,reason text,actor_id uuid not null references public.users(id),created_at timestamptz not null default now(),
 foreign key(cash_session_id,hotel_id) references public.cash_sessions(id,hotel_id) on delete restrict,check(counted_amount>=0)
);

alter table public.financial_transactions add column cash_session_id uuid;
alter table public.financial_transactions add column business_date date;
alter table public.financial_transactions add column original_business_date date;
alter table public.financial_transactions add column origin_daily_close_id uuid;
alter table public.financial_transactions add constraint financial_cash_session_fkey foreign key(cash_session_id,hotel_id) references public.cash_sessions(id,hotel_id) on delete restrict;
alter table public.procurement_payments add constraint procurement_payment_cash_session_fkey foreign key(cash_session_id,hotel_id) references public.cash_sessions(id,hotel_id) on delete restrict;

create table public.daily_closes (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id),business_date date not null,
 status public.daily_close_status not null default 'open',version integer not null default 1,fingerprint text,snapshot jsonb,
 prepared_by uuid references public.users(id),prepared_at timestamptz,approved_by uuid references public.users(id),approved_at timestamptz,
 rejection_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,hotel_id),unique(hotel_id,business_date)
);
alter table public.financial_transactions add constraint financial_origin_close_fkey foreign key(origin_daily_close_id,hotel_id) references public.daily_closes(id,hotel_id) on delete restrict;
create table public.daily_close_pending_acceptances (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,daily_close_id uuid not null,pending_id uuid not null,responsible_id uuid not null references public.users(id),
 next_action text not null,reason text not null,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 foreign key(daily_close_id,hotel_id) references public.daily_closes(id,hotel_id) on delete restrict,
 foreign key(pending_id,hotel_id) references public.operational_pending(id,hotel_id) on delete restrict,unique(daily_close_id,pending_id)
);
create table public.daily_close_events (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,daily_close_id uuid not null,action text not null,actor_id uuid references public.users(id),reason text,details jsonb not null default '{}',created_at timestamptz not null default now(),
 foreign key(daily_close_id,hotel_id) references public.daily_closes(id,hotel_id) on delete restrict
);

create or replace function public.assign_financial_business_context() returns trigger language plpgsql set search_path=public as $$ declare v_date date;v_session uuid;
begin select (coalesce(new.paid_at,new.created_at,now()) at time zone h.timezone)::date into v_date from public.hotels h where h.id=new.hotel_id;
 new.business_date:=coalesce(new.business_date,v_date);
 if new.cash_session_id is null and new.created_by is not null then select id into v_session from public.cash_sessions where hotel_id=new.hotel_id and operator_id=new.created_by and status='open' order by opened_at desc limit 1;new.cash_session_id:=v_session;end if;
 if new.original_business_date is not null and new.original_business_date<>new.business_date and new.origin_daily_close_id is null then raise exception 'origin_close_required';end if;
 return new;end $$;
create trigger financial_business_context before insert on public.financial_transactions for each row execute function public.assign_financial_business_context();

create or replace function public.mirror_financial_cash_movement() returns trigger language plpgsql set search_path=public as $$ declare v_kind public.cash_movement_kind;v_delta numeric;v_key uuid;
begin if new.cash_session_id is null then return new;end if;
 if lower(coalesce(new.payment_method,''))<>'cash' then return new;end if;
 v_kind:=case when new.type='REFUND' then 'refund'::public.cash_movement_kind when new.type='EXPENSE' then 'cash_out'::public.cash_movement_kind else 'receipt'::public.cash_movement_kind end;
 v_delta:=case when v_kind in('refund','cash_out') then -new.amount else new.amount end;v_key:=gen_random_uuid();
 insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,financial_transaction_id,idempotency_key,request_fingerprint,actor_id,occurred_at)
 values(new.hotel_id,new.cash_session_id,v_kind,new.amount,v_delta,coalesce(nullif(new.description,''),'Movimento financeiro'),new.id,v_key,md5(new.id::text),new.created_by,coalesce(new.paid_at,new.created_at));
 update public.cash_sessions set expected_cash=expected_cash+v_delta,version=version+1,updated_at=now() where id=new.cash_session_id and status='open';
 if not found then raise exception 'cash_session_not_open';end if;return new;end $$;
create trigger financial_cash_movement after insert on public.financial_transactions for each row execute function public.mirror_financial_cash_movement();

create or replace function public.save_cash_register(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin insert into public.cash_registers(hotel_id,name,code,kind,consumption_point_id,currency,difference_tolerance,active,created_by)
 values(p_hotel_id,btrim(p_input->>'name'),upper(btrim(p_input->>'code')),(p_input->>'kind')::public.cash_register_kind,(p_input->>'consumption_point_id')::uuid,p_input->>'currency',(p_input->>'difference_tolerance')::numeric,(p_input->>'active')::boolean,p_actor_id) returning id into v_id;return jsonb_build_object('result','ok','id',v_id);
 exception when unique_violation then return jsonb_build_object('result','code_exists');when foreign_key_violation then return jsonb_build_object('result','invalid_reference');end $$;
create or replace function public.open_cash_session(p_hotel_id uuid,p_register_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;v_date date;v_fp text:=md5(p_input::text);
begin if not exists(select 1 from public.cash_registers where id=p_register_id and hotel_id=p_hotel_id and active for update) then return jsonb_build_object('result','not_found');end if;
 select (now() at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id;
 insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint)
 values(p_hotel_id,p_register_id,p_actor_id,v_date,(p_input->>'opening_float')::numeric,(p_input->>'opening_float')::numeric,(p_input->>'idempotency_key')::uuid,v_fp) returning id into v_id;
 if (p_input->>'opening_float')::numeric>0 then
  insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id)
  values(p_hotel_id,v_id,'opening_float',(p_input->>'opening_float')::numeric,(p_input->>'opening_float')::numeric,'Fundo inicial',gen_random_uuid(),v_fp,p_actor_id);
 end if;
 return jsonb_build_object('result','ok','id',v_id);exception when unique_violation then return jsonb_build_object('result','active_session_exists');end $$;
create or replace function public.post_cash_movement(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_can_override boolean,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v public.cash_sessions%rowtype;v_delta numeric;v_id uuid;v_kind public.cash_movement_kind:=(p_input->>'kind')::public.cash_movement_kind;
begin select * into v from public.cash_sessions where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.status<>'open' or (v.operator_id<>p_actor_id and not(p_can_override and v_kind='adjustment')) then return jsonb_build_object('result','session_not_operable');end if;
 v_delta:=case when v_kind in('cash_out','deposit') then -(p_input->>'amount')::numeric else (p_input->>'amount')::numeric end;
 if v.expected_cash+v_delta<0 then return jsonb_build_object('result','insufficient_cash');end if;
 insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id) values(p_hotel_id,p_id,v_kind,(p_input->>'amount')::numeric,v_delta,btrim(p_input->>'reason'),(p_input->>'idempotency_key')::uuid,md5(p_input::text),p_actor_id) returning id into v_id;
 update public.cash_sessions set expected_cash=expected_cash+v_delta,version=version+1,updated_at=now() where id=p_id;return jsonb_build_object('result','ok','id',v_id);exception when unique_violation then return jsonb_build_object('result','idempotency_conflict');end $$;
create or replace function public.act_cash_session(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v public.cash_sessions%rowtype;v_register public.cash_registers%rowtype;v_diff numeric;v_new uuid;
begin select * into v from public.cash_sessions where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;select * into v_register from public.cash_registers where id=v.cash_register_id;
 if p_input->>'action'='count' and v.status in('open','counting') and v.operator_id=p_actor_id then
  if (p_input->>'counted_amount') is null then return jsonb_build_object('result','count_required');end if;v_diff:=(p_input->>'counted_amount')::numeric-v.expected_cash;
  insert into public.cash_session_counts(hotel_id,cash_session_id,counted_amount,expected_amount,difference_amount,reason,actor_id) values(p_hotel_id,p_id,(p_input->>'counted_amount')::numeric,v.expected_cash,v_diff,p_input->>'reason',p_actor_id);
  update public.cash_sessions set counted_cash=(p_input->>'counted_amount')::numeric,difference_amount=v_diff,counted_at=now(),status=case when abs(v_diff)>v_register.difference_tolerance then 'difference_pending'::public.cash_session_status else 'closed' end,closed_at=case when abs(v_diff)<=v_register.difference_tolerance then now() end,closed_by=case when abs(v_diff)<=v_register.difference_tolerance then p_actor_id end,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='approve_difference' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='closed',closed_at=now(),closed_by=p_actor_id,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='request_recount' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='counting',counted_cash=null,difference_amount=null,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='handoff' and v.status='open' and v.operator_id=p_actor_id and (p_input->>'next_operator_id') is not null and (p_input->>'counted_amount')::numeric=v.expected_cash then
  update public.cash_sessions set status='closed',counted_cash=v.expected_cash,difference_amount=0,counted_at=now(),closed_at=now(),closed_by=p_actor_id,version=version+1 where id=p_id;
  insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint) values(p_hotel_id,v.cash_register_id,(p_input->>'next_operator_id')::uuid,v.business_date,v.expected_cash,v.expected_cash,(p_input->>'idempotency_key')::uuid,md5(p_input::text)) returning id into v_new;
  insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id) values(p_hotel_id,v_new,'opening_float',v.expected_cash,v.expected_cash,'Saldo recebido na troca de operador',gen_random_uuid(),md5(p_input::text),(p_input->>'next_operator_id')::uuid);
 elsif p_input->>'action'='cancel' and v.status='open' and not exists(select 1 from public.cash_movements where cash_session_id=p_id and kind<>'opening_float') and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='canceled',closed_at=now(),closed_by=p_actor_id,version=version+1 where id=p_id;
 else return jsonb_build_object('result','invalid_transition');end if;return jsonb_build_object('result','ok','id',coalesce(v_new,p_id),'expected_cash',v.expected_cash,'difference',v_diff);end $$;
create or replace function public.list_cash_registers(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$ select jsonb_build_object('registers',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('active_session',(select to_jsonb(s) from public.cash_sessions s where s.cash_register_id=r.id and s.status in('open','counting','difference_pending') limit 1)) order by r.name),'[]')) from public.cash_registers r where r.hotel_id=p_hotel_id $$;
create or replace function public.get_cash_session(p_hotel_id uuid,p_id uuid) returns jsonb language sql stable set search_path=public as $$ select coalesce((select to_jsonb(s)||jsonb_build_object('register_name',r.name,'movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.occurred_at),'[]') from public.cash_movements m where m.cash_session_id=s.id),'counts',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]') from public.cash_session_counts c where c.cash_session_id=s.id)) from public.cash_sessions s join public.cash_registers r on r.id=s.cash_register_id where s.hotel_id=p_hotel_id and s.id=p_id),'{}') $$;

create or replace function public.daily_close_projection(p_hotel_id uuid,p_business_date date) returns jsonb language sql stable set search_path=public as $$
 with tx as(select type,payment_method,sum(amount) amount,count(*) count from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and status='COMPLETED' group by type,payment_method), blockers as(
 select 'cash_session_open' kind,id entity_id,'Há caixa ainda aberto.' title from public.cash_sessions where hotel_id=p_hotel_id and business_date=p_business_date and status in('open','counting','difference_pending')
 union all select 'cash_without_session',id,'Movimento em dinheiro sem sessão de caixa.' from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and lower(coalesce(payment_method,''))='cash' and cash_session_id is null)
 select jsonb_build_object('transactions',coalesce((select jsonb_agg(to_jsonb(tx)) from tx),'[]'),'cash_sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.cash_sessions s where hotel_id=p_hotel_id and business_date=p_business_date),'[]'),'blockers',coalesce((select jsonb_agg(to_jsonb(blockers)) from blockers),'[]'));
$$;
create or replace function public.get_daily_close(p_hotel_id uuid,p_business_date date) returns jsonb language plpgsql stable set search_path=public as $$ declare v_close jsonb;begin select to_jsonb(c) into v_close from public.daily_closes c where hotel_id=p_hotel_id and business_date=p_business_date;return jsonb_build_object('close',v_close,'projection',public.daily_close_projection(p_hotel_id,p_business_date));end $$;
create or replace function public.prepare_daily_close(p_hotel_id uuid,p_business_date date,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;v_version integer;v_projection jsonb;v_fingerprint text;x jsonb;
begin insert into public.daily_closes(hotel_id,business_date) values(p_hotel_id,p_business_date) on conflict(hotel_id,business_date) do nothing;select id,version into v_id,v_version from public.daily_closes where hotel_id=p_hotel_id and business_date=p_business_date for update;
 if v_version<>(p_input->>'expected_version')::integer and not(v_version=1 and (p_input->>'expected_version')::integer=0) then return jsonb_build_object('result','conflict');end if;v_projection:=public.daily_close_projection(p_hotel_id,p_business_date);if jsonb_array_length(v_projection->'blockers')>0 then return jsonb_build_object('result','blocking_items','context',v_projection->'blockers');end if;v_fingerprint:=md5(v_projection::text);
 delete from public.daily_close_pending_acceptances where daily_close_id=v_id;for x in select value from jsonb_array_elements(p_input->'accepted_pending') loop insert into public.daily_close_pending_acceptances(hotel_id,daily_close_id,pending_id,responsible_id,next_action,reason,created_by) values(p_hotel_id,v_id,(x->>'pending_id')::uuid,(x->>'responsible_id')::uuid,btrim(x->>'next_action'),btrim(x->>'reason'),p_actor_id);end loop;
 update public.daily_closes set status='prepared',snapshot=v_projection,fingerprint=v_fingerprint,prepared_by=p_actor_id,prepared_at=now(),approved_by=null,approved_at=null,version=version+1,updated_at=now() where id=v_id;insert into public.daily_close_events(hotel_id,daily_close_id,action,actor_id,details) values(p_hotel_id,v_id,'prepared',p_actor_id,jsonb_build_object('fingerprint',v_fingerprint));return jsonb_build_object('result','ok','id',v_id,'fingerprint',v_fingerprint);end $$;
create or replace function public.act_daily_close(p_hotel_id uuid,p_business_date date,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v public.daily_closes%rowtype;v_current text;
begin select * into v from public.daily_closes where hotel_id=p_hotel_id and business_date=p_business_date for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if v.prepared_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;v_current:=md5(public.daily_close_projection(p_hotel_id,p_business_date)::text);if v_current<>p_input->>'expected_fingerprint' or v_current<>v.fingerprint then return jsonb_build_object('result','projection_changed');end if;
 if p_input->>'action'='approve' and v.status='prepared' then update public.daily_closes set status='closed',approved_by=p_actor_id,approved_at=now(),version=version+1,updated_at=now() where id=v.id;
 elsif p_input->>'action'='reject' and v.status='prepared' and nullif(btrim(p_input->>'reason'),'') is not null then update public.daily_closes set status='rejected',rejection_reason=btrim(p_input->>'reason'),version=version+1,updated_at=now() where id=v.id;
 else return jsonb_build_object('result','invalid_transition');end if;insert into public.daily_close_events(hotel_id,daily_close_id,action,actor_id,reason) values(p_hotel_id,v.id,p_input->>'action',p_actor_id,btrim(p_input->>'reason'));return jsonb_build_object('result','ok');end $$;

create trigger cash_movements_immutable before update or delete on public.cash_movements for each row execute function public.prevent_maintenance_event_mutation();
create trigger cash_counts_immutable before update or delete on public.cash_session_counts for each row execute function public.prevent_maintenance_event_mutation();
create trigger daily_close_events_immutable before update or delete on public.daily_close_events for each row execute function public.prevent_maintenance_event_mutation();
insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['read_cash_management','operate_cash_register','approve_cash_differences','prepare_daily_close','approve_daily_close']) name on conflict(name) do nothing;
do $$ declare t text;begin foreach t in array array['cash_registers','cash_sessions','cash_movements','cash_session_counts','daily_closes','daily_close_pending_acceptances','daily_close_events'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant execute on function public.save_cash_register(uuid,uuid,jsonb),public.open_cash_session(uuid,uuid,uuid,jsonb),public.post_cash_movement(uuid,uuid,uuid,boolean,jsonb),public.act_cash_session(uuid,uuid,uuid,jsonb),public.list_cash_registers(uuid),public.get_cash_session(uuid,uuid),public.daily_close_projection(uuid,date),public.get_daily_close(uuid,date),public.prepare_daily_close(uuid,date,uuid,jsonb),public.act_daily_close(uuid,date,uuid,jsonb) to service_role;
