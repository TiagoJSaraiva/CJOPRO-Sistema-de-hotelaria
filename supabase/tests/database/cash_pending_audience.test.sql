begin;
select plan(12);

-- Cada pendência de caixa chega a quem pode resolvê-la, e a matriz de papéis vale no seed local.
create function pg_temp.perms(p_user_id uuid) returns text[] language sql stable as $$
  select coalesce(array_agg(distinct permission.name),array[]::text[])
  from public.user_roles assignment
  join public.role_permissions grant_entry on grant_entry.role_id=assignment.role_id
  join public.permissions permission on permission.id=grant_entry.permission_id
  where assignment.user_id=p_user_id
$$;

insert into public.operational_pending
  (id,hotel_id,source,source_key,kind,entity_type,entity_id,episode,title,href,severity)
values
  ('a9300000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','cash','daily-close:teste',
   'daily_close','daily_close',gen_random_uuid(),1,'Fechamento diário pendente','/dashboard/cash','warning'),
  ('a9300000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','cash','cash:teste',
   'cash_session','cash_session',gen_random_uuid(),1,'Sessão de caixa aberta','/dashboard/cash','warning');

create function pg_temp.sees(p_user_id uuid, p_kind text) returns boolean language sql stable as $$
  select public.can_read_operational_pending(p,p_user_id,pg_temp.perms(p_user_id))
  from public.operational_pending p
  where p.id in ('a9300000-0000-4000-8000-000000000001','a9300000-0000-4000-8000-000000000002')
    and p.kind=p_kind
$$;

select ok(not pg_temp.sees('80000000-0000-4000-8000-000000000004','daily_close'),
  'a recepção não recebe o fechamento diário, que ela não pode resolver');
select ok(not pg_temp.sees('80000000-0000-4000-8000-000000000008','daily_close'),
  'o caixa não recebe o fechamento diário, que ele não pode resolver');
select ok(pg_temp.sees('80000000-0000-4000-8000-000000000010','daily_close'),
  'o financeiro, que prepara, recebe o fechamento diário');
select ok(pg_temp.sees('80000000-0000-4000-8000-000000000002','daily_close'),
  'o gerente, que aprova, recebe o fechamento diário');

select ok(pg_temp.sees('80000000-0000-4000-8000-000000000004','cash_session'),
  'a recepção, que opera caixa, recebe a pendência de sessão');
select ok(pg_temp.sees('80000000-0000-4000-8000-000000000008','cash_session'),
  'o caixa recebe a pendência de sessão');
select ok(not pg_temp.sees('80000000-0000-4000-8000-000000000003','daily_close'),
  'o gerente de outro hotel não recebe o fechamento deste hotel');

-- Matriz de papéis: o gerente opera a conta, mas não opera sessão de caixa.
select ok(pg_temp.perms('80000000-0000-4000-8000-000000000002') @> array['receive_consumption_payment'],
  'o gerente recebe pagamentos na conta');
select ok(pg_temp.perms('80000000-0000-4000-8000-000000000002') @> array['post_consumption'],
  'o gerente lança consumo na conta');
select ok(pg_temp.perms('80000000-0000-4000-8000-000000000002') @> array['manage_stay_payers'],
  'o gerente define pagadores na conta');
select ok(pg_temp.perms('80000000-0000-4000-8000-000000000002') @> array['review_procurement_invoices'],
  'o gerente aprova a nota que o financeiro registrou');
select ok(not pg_temp.perms('80000000-0000-4000-8000-000000000002') @> array['operate_cash_register'],
  'o gerente não opera sessão de caixa');

select * from finish();
rollback;
