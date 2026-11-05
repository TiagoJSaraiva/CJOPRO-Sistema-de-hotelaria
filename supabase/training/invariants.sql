-- Invariantes de negócio do banco local: regras que precisam valer em qualquer
-- estado, depois de qualquer fluxo. Cada linha devolvida é uma violação.
-- Somente leitura depois de criar a função temporária. Executado pelas jornadas em apps/pms/__tests__/journeys.
begin;

-- Isolamento: nenhum registro pode apontar para uma linha de outro hotel. Gerado a
-- partir das FKs, para cobrir tabelas novas sem manutenção. Só as FKs que não incluem
-- hotel_id precisam da conferência; as compostas já são garantidas pelo banco.
create function pg_temp.cross_hotel_violations() returns setof text language plpgsql as $$
declare
  fk record;
  found_count bigint;
begin
  for fk in
    select c.conname, c.conrelid::regclass as child, c.confrelid::regclass as parent,
      a.attname as child_column, pa.attname as parent_column
    from pg_constraint c
    join lateral unnest(c.conkey, c.confkey) as k(child_num, parent_num) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.child_num
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.parent_num
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and cardinality(c.conkey) = 1
      and c.confrelid <> 'public.hotels'::regclass
      and exists (select 1 from pg_attribute h where h.attrelid = c.conrelid and h.attname = 'hotel_id' and not h.attisdropped)
      and exists (select 1 from pg_attribute h where h.attrelid = c.confrelid and h.attname = 'hotel_id' and not h.attisdropped)
  loop
    execute format(
      'select count(*) from %s child join %s parent on parent.%I = child.%I where parent.hotel_id is distinct from child.hotel_id',
      fk.child, fk.parent, fk.parent_column, fk.child_column
    ) into found_count;
    if found_count > 0 then
      return next format('isolamento: %s linha(s) de %s.%s apontam para outro hotel em %s',
        found_count, fk.child, fk.child_column, fk.parent);
    end if;
  end loop;
end $$;

set local transaction_read_only = on;

select * from pg_temp.cross_hotel_violations();

-- Estadias
select 'estadia: quarto ' || r.room_number || ' com ' || count(*) || ' estadias em andamento'
from public.stays s join public.rooms r on r.id = s.room_id
where s.stay_status = 'checked_in' group by r.room_number having count(*) > 1;

select 'estadia: ' || s.id || ' em andamento sem horário real de chegada'
from public.stays s where s.stay_status = 'checked_in' and s.checkin_date_actual is null;

select 'estadia: ' || s.id || ' encerrada sem horário real de saída'
from public.stays s where s.stay_status = 'checked_out' and s.checkout_date_actual is null;

select 'estadia: ' || s.id || ' com saída anterior à chegada'
from public.stays s where s.checkout_date_actual < s.checkin_date_actual;

select 'estadia: ' || s.id || ' não confirmada com horário real de chegada'
from public.stays s where s.stay_status in ('confirmed', 'canceled', 'no_show') and s.checkin_date_actual is not null;

-- Dinheiro
select 'conta: lançamento ' || e.id || ' com valor não positivo'
from public.stay_folio_entries e where e.amount <= 0;

select 'conta: estorno ' || e.id || ' maior que o lançamento original'
from public.stay_folio_entries e join public.stay_folio_entries o on o.id = e.reversed_entry_id
where e.amount > o.amount;

select 'conta: estadia e reserva divergentes no lançamento ' || e.id
from public.stay_folio_entries e join public.stays s on s.id = e.stay_id
where e.reservation_id is not null and e.reservation_id <> s.reservation_id;

select 'sinal: transferido ' || count(*) || ' vezes para a estadia ' || e.stay_id
from public.stay_folio_entries e
where e.description = 'Sinal da reserva transferido na chegada'
group by e.stay_id having count(*) > 1;

select 'sinal: estadia ' || e.stay_id || ' recebeu ' || sum(e.amount) || ' de transferência, mas a reserva registrou ' || coalesce(a.received, 0)
from public.stay_folio_entries e
join public.stays s on s.id = e.stay_id
left join lateral (
  select sum(case when direction = 'credit' then amount else -amount end) received
  from public.reservation_account_entries where reservation_id = s.reservation_id and kind = 'guarantee'
) a on true
where e.description = 'Sinal da reserva transferido na chegada'
group by e.stay_id, a.received
having sum(e.amount) <> coalesce(a.received, 0);

select 'consumo: pedido ' || o.id || ' com líquido diferente de bruto menos desconto'
from public.consumption_orders o where o.net_amount <> o.gross_amount - o.discount_amount;

select 'consumo: pedido ' || o.id || ' não fecha com a soma dos itens'
from public.consumption_orders o join public.consumption_order_items i on i.order_id = o.id
where not o.is_legacy
group by o.id, o.net_amount having o.net_amount <> sum(i.net_amount);

select 'consumo: pedido cobrado ' || o.id || ' sem lançamento na conta da estadia'
from public.consumption_orders o
where o.billing_mode = 'stay_folio' and o.disposition = 'charged' and not o.is_legacy
  and not exists (select 1 from public.stay_folio_entries e where e.consumption_order_id = o.id);

select 'recebível: ' || r.id || ' pago acima do valor'
from public.corporate_receivables r where r.paid_amount > r.amount;

select 'recebível: ' || r.id || ' com status ' || r.status || ' incoerente com ' || r.paid_amount || ' de ' || r.amount
from public.corporate_receivables r
where (r.status = 'paid' and r.paid_amount <> r.amount)
   or (r.status = 'partially_paid' and (r.paid_amount <= 0 or r.paid_amount >= r.amount))
   or (r.status = 'open' and r.paid_amount <> 0);

select 'pós-checkout: conta ' || a.id || ' paga acima do valor'
from public.post_checkout_supplemental_accounts a where a.paid_amount > a.amount;

select 'parceiro: apuração ' || s.id || ' com pagamentos acima do líquido'
from public.partner_settlements s
join public.partner_settlement_payments p on p.settlement_id = s.id
group by s.id, s.net_settlement
having sum(case when p.reversal_of_id is null then p.amount else -p.amount end) > abs(s.net_settlement);

select 'caixa: sessão ' || c.id || ' contada sem diferença coerente'
from public.cash_sessions c
where c.counted_cash is not null and c.expected_cash is not null and c.difference_amount is not null
  and c.difference_amount <> c.counted_cash - c.expected_cash;

select 'caixa: sessão ' || c.id || ' encerrada sem contagem'
from public.cash_sessions c where c.closed_at is not null and c.counted_cash is null;

-- Compras
select 'compra: pedido ' || o.id || ' não fecha com a soma das linhas'
from public.purchase_orders o join public.purchase_order_lines l on l.purchase_order_id = o.id
group by o.id, o.total_amount
having o.total_amount <> sum(l.quantity * l.unit_price + l.tax_amount);

select 'compra: parcela ' || d.id || ' paga acima do valor'
from public.procurement_invoice_due_dates d where d.paid_amount > d.amount;

select 'compra: nota paga ' || i.id || ' com parcela em aberto'
from public.procurement_invoices i join public.procurement_invoice_due_dates d on d.invoice_id = i.id
where i.status = 'paid' and d.paid_amount < d.amount;

-- Estoque
select 'estoque: movimento ' || m.id || ' com saldo final diferente de inicial mais variação'
from public.inventory_movements m where m.quantity_after <> m.quantity_before + m.quantity_delta;

select 'estoque: posição ' || p.id || ' com saldo ' || p.quantity || ', último movimento indica ' || last_move.quantity_after
from public.inventory_positions p
join lateral (
  select quantity_after from public.inventory_movements m
  where m.position_id = p.id order by m.posted_at desc, m.id desc limit 1
) last_move on true
where p.quantity <> last_move.quantity_after;

select 'estoque: posição ' || p.id || ' com saldo negativo'
from public.inventory_positions p where p.quantity < 0;

select 'estoque: posição ' || p.id || ' com lotes somando ' || coalesce(sum(b.quantity), 0) || ' e saldo ' || p.quantity
from public.inventory_positions p
join public.products pr on pr.id = p.product_id and pr.lot_tracking_mode <> 'none'
left join public.inventory_lot_balances b on b.position_id = p.id
group by p.id, p.quantity having coalesce(sum(b.quantity), 0) <> p.quantity;

-- Pendências resolvidas com responsável ativo são uma contradição.
select 'pendência: ' || p.id || ' resolvida e ainda atribuída'
from public.operational_pending p where p.status = 'resolved' and p.assigned_to is not null;

rollback;
