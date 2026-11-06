-- A rota de reposição podia ser criada, mas nenhuma tela a listava. O painel passa a trazer as
-- rotas em aberto. A conclusão também deixa de mover só parte dos itens quando falta saldo e passa
-- a usar o relógio do hotel.
CREATE OR REPLACE FUNCTION public.act_minibar_replenishment_route(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.minibar_replenishment_routes%rowtype; i record; s record; d record; v_out uuid;
begin select * into v from public.minibar_replenishment_routes where id=p_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 if p_input->>'action'='assign' and v.status='draft' then update public.minibar_replenishment_routes set status='in_progress',responsible_id=p_actor_id,version=version+1 where id=p_id;
 elsif p_input->>'action'='cancel' and v.status in('draft','in_progress') then update public.minibar_replenishment_routes set status='canceled',version=version+1 where id=p_id;
 elsif p_input->>'action'='complete' and v.status='in_progress' and v.responsible_id=p_actor_id then
  -- Confere todos os itens antes de mover qualquer um: a conclusão é inteira.
  for i in select * from public.minibar_replenishment_route_items where route_id=p_id and status='pending' order by id loop
   select * into s from public.inventory_positions where id=i.source_position_id for update;
   if s.quantity<(select sum(o.quantity) from public.minibar_replenishment_route_items o where o.route_id=p_id and o.status='pending' and o.source_position_id=i.source_position_id) then
    return jsonb_build_object('result','stock_changed');
   end if;
  end loop;
  for i in select * from public.minibar_replenishment_route_items where route_id=p_id and status='pending' order by id loop
   select * into s from public.inventory_positions where id=i.source_position_id for update; select * into d from public.inventory_positions where id=i.destination_position_id for update;
   insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,metadata)
   values(p_hotel_id,s.id,s.product_id,s.location_id,'transfer_out',-i.quantity,s.quantity,s.quantity-i.quantity,s.average_unit_cost,i.quantity*s.average_unit_cost,'Reposição de frigobar',public.hotel_operational_now(p_hotel_id),p_actor_id,jsonb_build_object('minibar_route_id',p_id)) returning id into v_out;
   update public.inventory_positions set quantity=quantity-i.quantity,version=version+1,updated_at=now() where id=s.id;
   insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,metadata)
   values(p_hotel_id,d.id,d.product_id,d.location_id,'transfer_in',i.quantity,d.quantity,d.quantity+i.quantity,s.average_unit_cost,i.quantity*s.average_unit_cost,'Reposição de frigobar',public.hotel_operational_now(p_hotel_id),p_actor_id,jsonb_build_object('minibar_route_id',p_id,'source_movement_id',v_out));
   update public.inventory_positions set quantity=quantity+i.quantity,average_unit_cost=s.average_unit_cost,version=version+1,updated_at=now() where id=d.id; update public.minibar_replenishment_route_items set status='completed' where id=i.id;
  end loop; update public.minibar_replenishment_routes set status='completed',version=version+1,completed_at=public.hotel_operational_now(p_hotel_id) where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if; return jsonb_build_object('result','ok'); end $function$;

CREATE OR REPLACE FUNCTION public.get_minibar_replenishment_board(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 with needs as(select r.id room_id,r.room_number,c.id composition_id,i.product_id,p.name product_name,i.source_location_id,src.name source_name,i.ideal_quantity,coalesce(dest.quantity,0) current_quantity,greatest(0,i.ideal_quantity-coalesce(dest.quantity,0)) required_quantity,dest.id destination_position_id,source.id source_position_id
 from public.rooms r join public.minibar_compositions c on c.hotel_id=r.hotel_id and lower(btrim(c.room_type))=lower(btrim(r.room_type)) and c.active_version_id is not null join public.minibar_composition_items i on i.version_id=c.active_version_id join public.products p on p.id=i.product_id join public.inventory_locations roomloc on roomloc.room_id=r.id join public.inventory_locations src on src.id=i.source_location_id left join public.inventory_positions dest on dest.location_id=roomloc.id and dest.product_id=i.product_id left join public.inventory_positions source on source.location_id=i.source_location_id and source.product_id=i.product_id where r.hotel_id=p_hotel_id)
 select jsonb_build_object('version',coalesce((select max(version) from public.inventory_positions where hotel_id=p_hotel_id),0),'items',coalesce(jsonb_agg(to_jsonb(needs) order by room_number,product_name) filter(where required_quantity>0),'[]'),
  'routes',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',route.id,'status',route.status,'version',route.version,'created_at',route.created_at,
      'responsible_id',route.responsible_id,'responsible_name',responsible.name,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',item.id,'room_number',room.room_number,'product_name',product.name,
          'source_name',source_location.name,'quantity',item.quantity,'status',item.status
        ) order by room.room_number,product.name)
        from public.minibar_replenishment_route_items item
        join public.rooms room on room.id=item.room_id
        join public.products product on product.id=item.product_id
        join public.inventory_positions source_position on source_position.id=item.source_position_id
        join public.inventory_locations source_location on source_location.id=source_position.location_id
        where item.route_id=route.id
      ),'[]'::jsonb)
    ) order by route.created_at desc)
    from public.minibar_replenishment_routes route
    left join public.users responsible on responsible.id=route.responsible_id
    where route.hotel_id=p_hotel_id and route.status in ('draft','in_progress')
  ),'[]'::jsonb)) from needs;
$function$;
