begin;
select plan(14);

-- A rota de reposição é executada por quem a assume, e a conclusão é inteira: ou todos os itens
-- saem do estoque, ou nenhum. Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000005'::uuid as governance,
  '80000000-0000-4000-8000-000000000004'::uuid as other_person,
  '80000000-0000-4000-8000-000000000003'::uuid as other_hotel_manager,
  'a9400000-0000-4000-8000-000000000003'::uuid as central,
  'a9400000-0000-4000-8000-000000000004'::uuid as frigobar;

insert into public.inventory_locations(id,hotel_id,name,internal_code,kind,room_id,is_active,created_by)
select l.id,hotel,l.name,code,kind::public.inventory_location_kind,room,true,'80000000-0000-4000-8000-000000000009'::uuid
from ctx, (values
  ('a9400000-0000-4000-8000-000000000001'::uuid,'Depósito de teste','TESTE-DEP','warehouse',null::uuid),
  ('a9400000-0000-4000-8000-000000000002'::uuid,'Frigobar de teste','TESTE-MB','minibar_room','20000000-0000-4000-8000-000000000101'::uuid)
) l(id,name,code,kind,room);
insert into public.inventory_positions(id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,ideal_quantity,average_unit_cost,is_active,created_by,updated_by)
select p.id,ctx.hotel,'40000000-0000-4000-8000-000000000001',p.location,p.quantity,1,0,2,3,true,'80000000-0000-4000-8000-000000000009','80000000-0000-4000-8000-000000000009'
from ctx, (values
  ('a9400000-0000-4000-8000-000000000003'::uuid,'a9400000-0000-4000-8000-000000000001'::uuid,18),
  ('a9400000-0000-4000-8000-000000000004'::uuid,'a9400000-0000-4000-8000-000000000002'::uuid,0)
) p(id,location,quantity);
insert into public.minibar_replenishment_routes(id,hotel_id,status,version,idempotency_key,request_fingerprint,created_by)
values('a9400000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','draft',1,'a9400000-0000-4000-8000-000000000011','pgtap','80000000-0000-4000-8000-000000000009');
insert into public.minibar_replenishment_route_items(id,hotel_id,route_id,room_id,product_id,source_position_id,destination_position_id,quantity,status)
values('a9400000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000101','40000000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000003','a9400000-0000-4000-8000-000000000004',2,'pending');

create temporary table route on commit drop as
select 'a9400000-0000-4000-8000-000000000010'::uuid as id;

create function pg_temp.act(p_action text, p_actor uuid default null) returns text language sql as $$
  select public.act_minibar_replenishment_route(
    hotel,(select id from route),coalesce(p_actor,governance),jsonb_build_object(
      'action',p_action,'reason','Exercício da reposição',
      'expected_version',(select version from public.minibar_replenishment_routes where id=(select id from route))
    ))->>'result' from ctx
$$;
create function pg_temp.quantity(p_position uuid) returns numeric language sql as $$
  select quantity from public.inventory_positions where id=p_position
$$;

select ok(
  (select jsonb_array_length(public.get_minibar_replenishment_board(hotel)->'routes') from ctx)>=1,
  'o painel lista as rotas para quem vai executá-las'
);
select is(
  (select item->>'status' from ctx, jsonb_array_elements(public.get_minibar_replenishment_board(hotel)->'routes') item
   where (item->>'id')::uuid=(select id from route)),
  'draft','a rota aparece com a situação atual'
);
select ok(
  (select jsonb_array_length(item->'items')>=1 and item->'items'->0->>'product_name' is not null and item->'items'->0->>'room_number' is not null
   from ctx, jsonb_array_elements(public.get_minibar_replenishment_board(hotel)->'routes') item
   where (item->>'id')::uuid=(select id from route)),
  'a rota diz o que levar e para qual quarto'
);
select is(
  (select jsonb_array_length(public.get_minibar_replenishment_board('10000000-0000-4000-8000-000000000002')->'routes')),
  0,'outro hotel não vê a rota'
);

select is(pg_temp.act('complete'),'invalid_transition','não se conclui uma rota que ninguém assumiu');
select is(pg_temp.act('assign'),'ok','a governança assume a rota');
select is(pg_temp.act('complete',(select other_person from ctx)),'invalid_transition','só quem assumiu conclui');

-- Um segundo item sem saldo: ele é o último, para o primeiro já ter sido processado.
insert into public.minibar_replenishment_route_items
  (id,hotel_id,route_id,room_id,product_id,source_position_id,destination_position_id,quantity,status)
select 'ffffffff-ffff-4fff-8fff-ffffffffffff',i.hotel_id,i.route_id,i.room_id,i.product_id,i.source_position_id,i.destination_position_id,9999,'pending'
from public.minibar_replenishment_route_items i where i.route_id=(select id from route) limit 1;

select is(pg_temp.act('complete'),'stock_changed','saldo insuficiente recusa a conclusão');
select is(pg_temp.quantity((select central from ctx)),18.000,'nenhum item sai do estoque central');
select is(pg_temp.quantity((select frigobar from ctx)),0.000,'nenhum item entra no frigobar');
select is(
  (select status from public.minibar_replenishment_routes where id=(select id from route)),
  'in_progress','a rota continua em andamento'
);

delete from public.minibar_replenishment_route_items where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
select is(pg_temp.act('complete'),'ok','com saldo, a rota é concluída');
select is(pg_temp.quantity((select frigobar from ctx)),2.000,'o frigobar recebe a quantidade da rota');
select is(
  (select count(*)::int from public.inventory_movements m join ctx on m.hotel_id=ctx.hotel
   where m.metadata->>'minibar_route_id'=(select id::text from route)
     and m.occurred_at=public.hotel_operational_now(ctx.hotel)),
  2,'os movimentos usam o relógio do hotel'
);

select * from finish();
rollback;
