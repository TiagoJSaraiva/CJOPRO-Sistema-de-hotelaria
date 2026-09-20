select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','governance-maintenance',1,
  'Quarto 103 retido até conclusão técnica e inspeção final da governança.',
  '80000000-0000-4000-8000-000000000002'
);

update public.rooms set status='blocked' where id='20000000-0000-4000-8000-000000000103';

insert into public.maintenance_occurrences(
  id,occurrence_number,hotel_id,category_id,room_id,kind,priority,status,
  description,discovered_at,reported_by,blocking_recommended,triaged_by,triaged_at,
  liability_status
)
select
  'a1100000-0000-4000-8000-000000000001',1103,
  '10000000-0000-4000-8000-000000000001',category.id,
  '20000000-0000-4000-8000-000000000103','defect','high','triaged',
  'Fechadura eletrônica do quarto 103 não conclui o travamento.',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001')-interval '2 hours',
  '80000000-0000-4000-8000-000000000004',true,
  '80000000-0000-4000-8000-000000000007',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001')-interval '90 minutes',
  'not_applicable'
from public.maintenance_categories category
where category.hotel_id='10000000-0000-4000-8000-000000000001'
order by category.display_order,category.id limit 1;

insert into public.maintenance_work_orders(
  id,hotel_id,occurrence_id,title,instructions,priority,status,assigned_to,due_at,
  requires_inspection,created_by
) values(
  'a1110000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a1100000-0000-4000-8000-000000000001',
  'Revisar fechadura do quarto 103',
  'Diagnosticar, corrigir e registrar teste de travamento antes de solicitar inspeção.',
  'high','assigned','80000000-0000-4000-8000-000000000006',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001')+interval '4 hours',
  true,'80000000-0000-4000-8000-000000000007'
);

update public.room_blocks set
  status='maintenance',label='Retido pela manutenção',
  start_date=public.hotel_operational_date(hotel_id),
  end_date=public.hotel_operational_date(hotel_id)+2,
  maintenance_occurrence_id='a1100000-0000-4000-8000-000000000001',
  created_by='80000000-0000-4000-8000-000000000007'
where id='95000000-0000-4000-8000-000000000001';

select setval('public.maintenance_occurrence_number_seq',
  greatest((select max(occurrence_number) from public.maintenance_occurrences),1103),true);

do $$ begin
  if not exists(select 1 from public.room_blocks where id='95000000-0000-4000-8000-000000000001' and released_at is null) then
    raise exception 'governance-maintenance block is missing';
  end if;
end $$;
