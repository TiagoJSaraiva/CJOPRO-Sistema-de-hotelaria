create or replace function public.update_role_with_permissions (
  p_id                         uuid,
  p_payload                    jsonb,
  p_permission_ids             uuid[],
  p_should_replace_permissions boolean default false
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  as $function$
declare
  v_permission_count integer;
  v_role_exists boolean;
  v_role_type text;
  v_role_hotel_id uuid;
  v_effective_role_type text;
  v_effective_hotel_id uuid;
  v_invalid_permission_count integer;
begin
  select exists(select 1 from public.roles where roles.id = p_id) into v_role_exists;

  if not v_role_exists then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  select role_type, hotel_id
    into v_role_type, v_role_hotel_id
  from public.roles
  where roles.id = p_id;

  v_effective_role_type := coalesce(nullif(p_payload->>'role_type', ''), v_role_type);

  if v_effective_role_type not in ('SYSTEM_ROLE', 'HOTEL_ROLE') then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  if p_payload ? 'hotel_id' then
    v_effective_hotel_id := nullif(p_payload->>'hotel_id', '')::uuid;
  else
    v_effective_hotel_id := v_role_hotel_id;
  end if;

  if v_effective_role_type = 'SYSTEM_ROLE' and v_effective_hotel_id is not null then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  if v_effective_hotel_id is not null
     and not exists(select 1 from public.hotels where hotels.id = v_effective_hotel_id) then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  if p_should_replace_permissions and coalesce(array_length(p_permission_ids, 1), 0) > 0 then
    select count(*) into v_permission_count
    from public.permissions
    where permissions.id = any(p_permission_ids);

    if v_permission_count <> array_length(p_permission_ids, 1) then
      return query select 'not-found'::text, null::uuid;
      return;
    end if;

    select count(*)
      into v_invalid_permission_count
    from public.permissions
    where permissions.id = any(p_permission_ids)
      and permissions.type <> case
        when v_effective_role_type = 'SYSTEM_ROLE' then 'SYSTEM_PERMISSION'
        else 'HOTEL_PERMISSION'
      end;

    if v_invalid_permission_count > 0 then
      return query select 'not-found'::text, null::uuid;
      return;
    end if;
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) = 'object' and p_payload <> '{}'::jsonb then
    update public.roles
    set
      name = case when p_payload ? 'name' then nullif(p_payload->>'name', '') else name end,
      role_type = case when p_payload ? 'role_type' then nullif(p_payload->>'role_type', '') else role_type end,
      hotel_id = case when p_payload ? 'hotel_id' then nullif(p_payload->>'hotel_id', '')::uuid else hotel_id end
    where roles.id = p_id;
  end if;

  if p_should_replace_permissions then
    delete from public.role_permissions where role_permissions.role_id = p_id;

    if coalesce(array_length(p_permission_ids, 1), 0) > 0 then
      insert into public.role_permissions (role_id, permission_id)
      select p_id, unnest(p_permission_ids);
    end if;
  end if;

  return query select 'ok'::text, p_id;
exception
  when unique_violation then
    return query select 'conflict'::text, null::uuid;
end;
$function$;

create or replace function public.update_user_with_roles (
  p_id                   uuid,
  p_payload              jsonb,
  p_role_assignments     public.admin_role_assignment_input[],
  p_should_replace_roles boolean default false
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  as $function$
declare
  v_user_exists boolean;
  v_missing_count integer;
  v_invalid_count integer;
begin
  select exists(select 1 from public.users where users.id = p_id) into v_user_exists;

  if not v_user_exists then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  if p_should_replace_roles and coalesce(array_length(p_role_assignments, 1), 0) > 0 then
    select count(*)
      into v_missing_count
    from unnest(p_role_assignments) as assignment
    left join public.roles r on r.id = assignment.role_id
    where r.id is null;

    if v_missing_count > 0 then
      return query select 'not-found'::text, null::uuid;
      return;
    end if;

    select count(*)
      into v_invalid_count
    from unnest(p_role_assignments) as assignment
    join public.roles r on r.id = assignment.role_id
    where
      (r.role_type = 'SYSTEM_ROLE' and assignment.hotel_id is not null)
      or (r.role_type = 'HOTEL_ROLE' and r.hotel_id is null and assignment.hotel_id is null)
      or (r.role_type = 'HOTEL_ROLE' and r.hotel_id is not null and assignment.hotel_id is not null and assignment.hotel_id <> r.hotel_id)
      or (r.role_type = 'HOTEL_ROLE' and assignment.hotel_id is not null and not exists(
        select 1 from public.hotels where hotels.id = assignment.hotel_id
      ));

    if v_invalid_count > 0 then
      return query select 'not-found'::text, null::uuid;
      return;
    end if;
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) = 'object' and p_payload <> '{}'::jsonb then
    update public.users
    set
      name = case when p_payload ? 'name' then nullif(p_payload->>'name', '') else name end,
      email = case when p_payload ? 'email' then nullif(p_payload->>'email', '') else email end,
      password_hash = case when p_payload ? 'password_hash' then nullif(p_payload->>'password_hash', '') else password_hash end,
      is_active = case when p_payload ? 'is_active' then (p_payload->>'is_active')::boolean else is_active end,
      updated_at = now()
    where users.id = p_id;
  end if;

  if p_should_replace_roles then
    delete from public.user_roles where user_roles.user_id = p_id;

    if coalesce(array_length(p_role_assignments, 1), 0) > 0 then
      insert into public.user_roles (user_id, role_id, hotel_id)
      select
        p_id,
        assignment.role_id,
        case
          when r.role_type = 'SYSTEM_ROLE' then null
          when r.hotel_id is not null then r.hotel_id
          else assignment.hotel_id
        end
      from unnest(p_role_assignments) as assignment
      join public.roles r on r.id = assignment.role_id;
    end if;
  end if;

  return query select 'ok'::text, p_id;
exception
  when unique_violation then
    return query select 'conflict'::text, null::uuid;
end;
$function$;

create or replace function public.update_user_with_roles (
  p_id                   uuid,
  p_payload              jsonb,
  p_role_ids             uuid[],
  p_should_replace_roles boolean default false
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  as $function$
declare
  v_role_count integer;
  v_user_exists boolean;
begin
  select exists(select 1 from public.users where users.id = p_id) into v_user_exists;

  if not v_user_exists then
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  if p_should_replace_roles and coalesce(array_length(p_role_ids, 1), 0) > 0 then
    select count(*) into v_role_count
    from public.roles
    where roles.id = any(p_role_ids);

    if v_role_count <> array_length(p_role_ids, 1) then
      return query select 'not-found'::text, null::uuid;
      return;
    end if;
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) = 'object' and p_payload <> '{}'::jsonb then
    update public.users
    set
      name = case when p_payload ? 'name' then nullif(p_payload->>'name', '') else name end,
      email = case when p_payload ? 'email' then nullif(p_payload->>'email', '') else email end,
      password_hash = case when p_payload ? 'password_hash' then nullif(p_payload->>'password_hash', '') else password_hash end,
      is_active = case when p_payload ? 'is_active' then (p_payload->>'is_active')::boolean else is_active end,
      updated_at = now()
    where users.id = p_id;
  end if;

  if p_should_replace_roles then
    delete from public.user_roles where user_roles.user_id = p_id;

    if coalesce(array_length(p_role_ids, 1), 0) > 0 then
      insert into public.user_roles (user_id, role_id)
      select p_id, unnest(p_role_ids);
    end if;
  end if;

  return query select 'ok'::text, p_id;
exception
  when unique_violation then
    return query select 'conflict'::text, null::uuid;
end;
$function$;
