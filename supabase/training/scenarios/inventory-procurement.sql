select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','inventory-procurement',1,
  'Estoque do Aurora com posições, lote e fluxo de compra para exercício.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.inventory_positions where hotel_id='10000000-0000-4000-8000-000000000001') then
    raise exception 'inventory-procurement requires Aurora positions';
  end if;
end $$;
