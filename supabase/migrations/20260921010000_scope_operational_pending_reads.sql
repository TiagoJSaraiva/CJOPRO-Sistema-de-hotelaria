-- A permissão de uma função não concede acesso a pendências de outro hotel.
-- As origens mais recentes (caixa, estoque, compras, parceiros e reservas)
-- eram filtradas apenas por permissão, sem repetir o vínculo do usuário.
create or replace function public.can_read_operational_pending(
  p public.operational_pending,
  p_user_id uuid,
  p_permissions text[]
) returns boolean language sql stable set search_path=public as $$
  select public.maintenance_user_has_hotel_scope(p_user_id,p.hotel_id)
    and case
      when p.source in ('reservations','booking_channels') then
        p_permissions && array['read_reservation','manage_prearrival','manage_booking_channels']
      else public.can_read_operational_pending_stage6_base(p,p_user_id,p_permissions)
    end
$$;
