-- A pendência de fechamento diário vai para quem prepara ou aprova o fechamento.
-- Quem só opera caixa continua vendo as pendências das sessões, mas não pode resolver
-- o fechamento, e sem este filtro a fila dessas pessoas ficava tomada por dias a fechar.
create or replace function public.can_read_operational_pending_stage6_base(
  p public.operational_pending,
  p_user_id uuid,
  p_permissions text[]
) returns boolean
language sql
stable
set search_path = public
as $$
  select case p.source
    when 'inventory' then 'read_inventory' = any(p_permissions)
    when 'procurement' then p_permissions && array[
      'read_procurement','request_procurement','approve_procurement','receive_procurement',
      'review_procurement_invoices','settle_supplier_payables'
    ]
    when 'cash' then
      case p.kind
        when 'daily_close' then p_permissions && array['prepare_daily_close','approve_daily_close']
        else p_permissions && array[
          'read_cash_management','operate_cash_register','approve_cash_differences',
          'prepare_daily_close','approve_daily_close'
        ]
      end
    when 'partner' then p_permissions && array[
      'read_partner_settlements','manage_partner_disputes','settle_partner_settlements'
    ]
    else public.can_read_operational_pending_stage5_base(p, p_user_id, p_permissions)
  end
$$;
