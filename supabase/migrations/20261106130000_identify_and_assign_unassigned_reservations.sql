-- QA-079: reserva de canal ou do site nasce sem cliente e não tinha como chegar ao check-in: nenhuma tela
-- vinculava o cliente nem alocava o quarto, e a alocação falhava por erro de banco ao criar o pagador
-- principal. O cadastro exige documento e nascimento, que o canal não envia, então o sistema não cria o
-- cliente sozinho: a recepção identifica o hóspede.

create or replace function public.link_reservation_customer(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_customer_id uuid,p_expected_version integer)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare r public.reservations;
begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found');end if;
 if exists(select 1 from public.stays where reservation_id=p_reservation_id) or r.lifecycle_status not in('hold','confirmed') then return jsonb_build_object('result','invalid_status');end if;
 if r.version<>p_expected_version then return jsonb_build_object('result','conflict','context',to_jsonb(r));end if;
 if not exists(select 1 from public.customers where id=p_customer_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','invalid_customer');end if;
 update public.reservations set booking_customer_id=p_customer_id,version=version+1,updated_at=now() where id=p_reservation_id;
 insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,'customer_linked',p_actor_id,jsonb_build_object('customer_id',p_customer_id,'previous_customer_id',r.booking_customer_id));
 return jsonb_build_object('result','ok','id',p_reservation_id);
end $function$;

-- Reservas ativas com acomodação sem quarto, e encerradas sem estadia que ainda têm saldo a acertar.
create or replace function public.list_unassigned_reservations(p_hotel_id uuid)
returns jsonb language sql stable set search_path to 'public' as $function$
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'code',r.reservation_code,'version',r.version,'lifecycle_status',r.lifecycle_status,'source',r.reservation_source,
   'guest_count',r.guest_count,'hold_expires_at',r.hold_expires_at,'customer_id',r.booking_customer_id,
   'customer_name',(select c.full_name from public.customers c where c.id=r.booking_customer_id),
   'contact',(select jsonb_build_object('full_name',c.full_name,'email',c.email,'phone',c.phone) from public.reservation_contacts c where c.reservation_id=r.id),
   'closure_balance',public.reservation_closure_balance(r.id),
   'cancel_penalty',(select coalesce(sum(public.reservation_closure_penalty(a.id,'cancel',public.hotel_operational_now(p_hotel_id))),0) from public.reservation_accommodations a where a.reservation_id=r.id and a.status in('held','confirmed','assigned')),
   'accommodations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'room_type',a.room_type,'checkin_date',a.checkin_date,'checkout_date',a.checkout_date,'adults',a.adults,'children',a.children,'version',a.version,'status',a.status) order by a.checkin_date,a.id) from public.reservation_accommodations a where a.reservation_id=r.id and a.status in('held','confirmed') and a.assigned_room_id is null),'[]'::jsonb))
  order by r.hold_expires_at nulls last,r.created_at),'[]'::jsonb))
 from public.reservations r
 where r.hotel_id=p_hotel_id and (
   (r.lifecycle_status in('hold','confirmed') and exists(select 1 from public.reservation_accommodations a where a.reservation_id=r.id and a.status in('held','confirmed') and a.assigned_room_id is null))
   or (r.lifecycle_status in('canceled','no_show') and public.reservation_closure_balance(r.id)<>0 and not exists(select 1 from public.stays s where s.reservation_id=r.id)))
$function$;

CREATE OR REPLACE FUNCTION public.assign_reservation_room(p_hotel_id uuid, p_reservation_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare a public.reservation_accommodations;r public.rooms;v_stay uuid;v_reservation public.reservations;begin
 select * into a from public.reservation_accommodations where id=(p_input->>'accommodation_id')::uuid and reservation_id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 select * into v_reservation from public.reservations where id=p_reservation_id;
 -- Pré-reserva vencida não encerra estadia: primeiro confirma, depois recebe quarto.
 if v_reservation.lifecycle_status='hold' then return jsonb_build_object('result','hold_not_confirmed');end if;
 -- A estadia nasce com o pagador principal, que precisa de um cliente identificado.
 if a.stay_id is null and v_reservation.booking_customer_id is null then return jsonb_build_object('result','customer_required');end if;if a.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(a));end if;select * into r from public.rooms where id=(p_input->>'room_id')::uuid and hotel_id=p_hotel_id;if not found or r.room_type<>a.room_type then return jsonb_build_object('result','invalid_room');end if;
 if exists(select 1 from public.stays x where x.room_id=r.id and x.stay_status in ('confirmed','checked_in') and x.checkin_date_expected::date<a.checkout_date and x.checkout_date_expected::date>a.checkin_date and x.id is distinct from a.stay_id) or exists(select 1 from public.room_blocks b where b.room_id=r.id and b.released_at is null and b.start_date<a.checkout_date and b.end_date>=a.checkin_date) then return jsonb_build_object('result','conflict');end if;
 if a.stay_id is null then insert into public.stays(reservation_id,room_id,applied_daily_rate,total_price_estimated,checkin_date_expected,checkout_date_expected,stay_status) values(p_reservation_id,r.id,round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2),a.total_price,a.checkin_date+time '12:00',a.checkout_date+time '12:00','confirmed') returning id into v_stay;else v_stay=a.stay_id;update public.stays set room_id=r.id where id=v_stay;end if;
 insert into public.reservation_assignment_events(hotel_id,accommodation_id,from_room_id,to_room_id,reason,actor_id) values(p_hotel_id,a.id,a.assigned_room_id,r.id,trim(p_input->>'reason'),p_actor_id);update public.reservation_accommodations set stay_id=v_stay,assigned_room_id=r.id,status=case when status='checked_in' then status else 'assigned' end,version=version+1,updated_at=now() where id=a.id;update public.reservations set version=version+1,updated_at=now() where id=p_reservation_id;return jsonb_build_object('result','ok','id',v_stay);end$function$
;

-- A pendência de chegada sem quarto abre a fila onde ela é resolvida.
CREATE OR REPLACE FUNCTION public.operational_pending_candidates_stage6_channels_base(p_hotel_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare v jsonb;begin v:=public.operational_pending_candidates_stage6_base(p_hotel_id,p_now);
 v:=v||coalesce((select jsonb_agg(jsonb_build_object('source','reservations','source_key','prearrival:'||q.id,'kind',q.type,'entity_type','prearrival_request','entity_id',q.id,'title','Pré-chegada: '||replace(q.category,'_',' '),'href','/dashboard/reservations/prearrival','severity',case when q.due_at<=p_now then 'critical' else 'warning' end,'assignee_id',q.assignee_id,'due_at',q.due_at)) from public.prearrival_requests q where q.hotel_id=p_hotel_id and q.status in('open','triaged','accepted')),'[]');
 v:=v||coalesce((select jsonb_agg(jsonb_build_object('source','reservations','source_key','unassigned:'||a.id,'kind','unassigned_arrival','entity_type','reservation_accommodation','entity_id',a.id,'title','Chegada próxima sem quarto','href','/dashboard/reservations/unassigned','severity','critical','due_on',a.checkin_date)) from public.reservation_accommodations a where a.hotel_id=p_hotel_id and a.status='confirmed' and a.assigned_room_id is null and a.checkin_date<=((p_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date+1)),'[]');return v;end$function$
;
