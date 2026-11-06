-- A mesma ocorrência aparecia como OCO-001103 e MAN-001103. Fica um só código, também no rótulo
-- dos bloqueios. O rótulo é só de exibição, então os já gravados acompanham.
CREATE OR REPLACE FUNCTION public.create_maintenance_room_block(p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_start_date date, p_end_date date, p_status room_block_status, p_label text DEFAULT NULL::text, p_conflict_acknowledgement text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_occurrence public.maintenance_occurrences%rowtype;
  v_block_id uuid;
  v_has_conflicts boolean;
begin
  select * into v_occurrence from public.maintenance_occurrences
  where id = p_occurrence_id and hotel_id = p_hotel_id for update;
  if not found or v_occurrence.room_id is null then return null; end if;
  select exists (
    select 1 from public.stays stay
    where stay.room_id = v_occurrence.room_id
      and stay.stay_status not in ('canceled', 'no_show')
      and stay.checkin_date_expected < (p_end_date + 1)::timestamptz
      and stay.checkout_date_expected > p_start_date::timestamptz
  ) into v_has_conflicts;
  if v_has_conflicts and nullif(btrim(p_conflict_acknowledgement), '') is null then
    raise exception 'Há estadias ou reservas conflitantes sem ciência.' using errcode = '23514';
  end if;
  insert into public.room_blocks(
    hotel_id, room_id, maintenance_occurrence_id, created_by, status, label, start_date, end_date,
    conflicts_acknowledged_at, conflicts_acknowledged_by, conflicts_acknowledgement
  ) values (
    p_hotel_id, v_occurrence.room_id, p_occurrence_id, p_actor_id, p_status, coalesce(p_label, 'MAN-' || lpad(v_occurrence.occurrence_number::text, 6, '0')),
    p_start_date, p_end_date, case when v_has_conflicts then now() end,
    case when v_has_conflicts then p_actor_id end, case when v_has_conflicts then p_conflict_acknowledgement end
  ) returning id into v_block_id;
  update public.maintenance_work_orders set requires_inspection = true
  where occurrence_id = p_occurrence_id and status not in ('completed', 'canceled');
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, p_occurrence_id, p_actor_id, 'room_block_created', p_label,
    jsonb_build_object('block_id', v_block_id, 'start_date', p_start_date, 'end_date', p_end_date, 'conflicts_acknowledged', v_has_conflicts));
  perform public.recompute_maintenance_occurrence_status(p_occurrence_id);
  return v_block_id;
end;
$function$;

update public.room_blocks
set label = 'MAN-' || substr(label, 5)
where label ~ '^OCO-[0-9]{6}$';
