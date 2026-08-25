set local check_function_bodies = off;

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "service_role";

create extension "btree_gist" schema "public";

create table "public"."customers" (
  "id"              uuid                     not null default gen_random_uuid(),
  "full_name"       text                     not null,
  "document_number" text                     not null,
  "document_type"   text                     not null,
  "email"           text,
  "mobile_phone"    text,
  "phone"           text,
  "birth_date"      date                     not null,
  "nationality"     text,
  "notes"           text,
  "created_at"      timestamp with time zone not null default now(),
  "updated_at"      timestamp with time zone not null default now(),
  "hotel_id"        uuid                     not null,
  constraint "customers_document_type_document_number_key" unique (document_type, document_number),
  constraint "customers_pkey" primary key (id)
);

alter table "public"."customers"
  enable row level security;

create table "public"."financial_transactions" (
  "id"             uuid                     not null default gen_random_uuid(),
  "hotel_id"       uuid                     not null,
  "category"       text                     not null,
  "amount"         numeric(12,2)            not null,
  "currency"       text                     not null default 'BRL'::text,
  "description"    text,
  "created_at"     timestamp with time zone not null default now(),
  "stay_id"        uuid,
  "reservation_id" uuid,
  "payment_method" text,
  "paid_at"        timestamp with time zone default now(),
  "created_by"     uuid,
  "updated_at"     timestamp with time zone not null default now(),
  "due_date"       date,
  "counterparty"   text,
  "cost_center"    text,
  "reference_code" text,
  constraint "financial_transactions_amount_check" check ((amount >= (0)::numeric)),
  constraint "financial_transactions_currency_iso_code_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "financial_transactions_pkey" primary key (id)
);

alter table "public"."financial_transactions"
  enable row level security;

create table "public"."hotels" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "name"                character varying(150)   not null,
  "legal_name"          character varying(150)   not null,
  "tax_id"              character varying(20)    not null,
  "email"               character varying(150)   not null,
  "phone"               character varying(20)    not null,
  "address_line"        character varying(200)   not null,
  "address_number"      character varying(20)    not null,
  "address_complement"  character varying(100),
  "district"            character varying(100)   not null,
  "city"                character varying(100)   not null,
  "state"               character varying(50)    not null,
  "country"             character varying(50)    not null,
  "zip_code"            character varying(20)    not null,
  "checkin_time_start"  time without time zone,
  "checkout_time_start" time without time zone,
  "timezone"            character varying(50)    not null,
  "currency"            character varying(10)    not null,
  "is_active"           boolean                  default true,
  "subscription_plan"   character varying(50),
  "subscription_status" character varying(50),
  "max_users"           integer,
  "max_rooms"           integer,
  "slug"                character varying(100)   not null,
  "created_at"          timestamp with time zone default now(),
  "updated_at"          timestamp with time zone default now(),
  "checkin_time_limit"  time without time zone,
  "checkout_time_limit" time without time zone,
  constraint "hotels_pkey" primary key (id),
  constraint "hotels_slug_key" unique (slug)
);

alter table "public"."hotels"
  enable row level security;

create table "public"."permissions" (
  "id"   uuid                  not null default gen_random_uuid(),
  "name" character varying(50) not null,
  "type" character varying(20) not null,
  constraint "ck_permissions_type" check (((type)::text = ANY ((ARRAY['SYSTEM_PERMISSION'::character varying, 'HOTEL_PERMISSION'::character varying])::text[]))),
  constraint "permissions_name_key" unique (name),
  constraint "permissions_pkey" primary key (id)
);

alter table "public"."permissions"
  enable row level security;

create table "public"."products" (
  "id"         uuid                     not null default gen_random_uuid(),
  "hotel_id"   uuid                     not null,
  "name"       text                     not null,
  "category"   text,
  "unit_price" numeric(12,2)            not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "products_pkey" primary key (id),
  constraint "products_unit_price_check" check ((unit_price >= (0)::numeric))
);

alter table "public"."products"
  enable row level security;

create table "public"."reservations" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "hotel_id"              uuid                     not null,
  "booking_customer_id"   uuid                     not null,
  "reservation_code"      text                     not null,
  "guest_count"           integer                  not null,
  "estimated_total_price" numeric(12,2),
  "final_total_price"     numeric(12,2),
  "notes"                 text,
  "created_at"            timestamp with time zone not null default now(),
  "updated_at"            timestamp with time zone not null default now(),
  "total_paid"            numeric                  not null default '0'::numeric,
  constraint "reservations_estimated_total_amount_check" check (((estimated_total_price IS NULL) OR (estimated_total_price >= (0)::numeric))),
  constraint "reservations_final_total_amount_check" check (((final_total_price IS NULL) OR (final_total_price >= (0)::numeric))),
  constraint "reservations_guest_count_check" check ((guest_count > 0)),
  constraint "reservations_pkey" primary key (id),
  constraint "reservations_reservation_code_key" unique (reservation_code)
);

alter table "public"."reservations"
  enable row level security;

create table "public"."role_permissions" (
  "id"            uuid not null default gen_random_uuid(),
  "role_id"       uuid not null,
  "permission_id" uuid not null,
  constraint "role_permissions_pkey" primary key (id),
  constraint "role_permissions_role_id_permission_id_key" unique (role_id, permission_id)
);

alter table "public"."role_permissions"
  enable row level security;

create table "public"."roles" (
  "id"        uuid                  not null default gen_random_uuid(),
  "name"      character varying(50) not null,
  "hotel_id"  uuid,
  "role_type" character varying(20) not null,
  constraint "ck_roles_type_hotel" check (((((role_type)::text = 'SYSTEM_ROLE'::text) AND (hotel_id IS NULL)) OR ((role_type)::text = 'HOTEL_ROLE'::text))),
  constraint "ck_roles_type" check (((role_type)::text = ANY ((ARRAY['SYSTEM_ROLE'::character varying, 'HOTEL_ROLE'::character varying])::text[]))),
  constraint "roles_name_key" unique (name),
  constraint "roles_pkey" primary key (id)
);

alter table "public"."roles"
  enable row level security;

create table "public"."rooms" (
  "id"              uuid                     not null default gen_random_uuid(),
  "hotel_id"        uuid                     not null,
  "room_number"     text                     not null,
  "room_type"       text                     not null,
  "max_occupancy"   integer                  not null,
  "base_daily_rate" numeric(12,2)            not null,
  "notes"           text,
  "created_at"      timestamp with time zone not null default now(),
  "updated_at"      timestamp with time zone not null default now(),
  constraint "rooms_base_daily_rate_check" check ((base_daily_rate >= (0)::numeric)),
  constraint "rooms_hotel_id_room_number_key" unique (hotel_id, room_number),
  constraint "rooms_max_occupancy_check" check ((max_occupancy > 0)),
  constraint "rooms_pkey" primary key (id)
);

alter table "public"."rooms"
  enable row level security;

create table "public"."season_room_rates" (
  "id"         uuid                     not null default gen_random_uuid(),
  "season_id"  uuid                     not null,
  "hotel_id"   uuid                     not null,
  "room_type"  text                     not null,
  "daily_rate" numeric(12,2)            not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "season_room_rates_daily_rate_check" check ((daily_rate >= (0)::numeric)),
  constraint "season_room_rates_pkey" primary key (id),
  constraint "season_room_rates_season_id_room_type_key" unique (season_id, room_type)
);

alter table "public"."season_room_rates"
  enable row level security;

create table "public"."seasons" (
  "id"         uuid                     not null default gen_random_uuid(),
  "hotel_id"   uuid                     not null,
  "name"       text                     not null,
  "start_date" date                     not null,
  "end_date"   date                     not null,
  "is_active"  boolean                  not null default true,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "seasons_check" check ((end_date >= start_date)),
  constraint "seasons_hotel_id_name_start_date_end_date_key" unique (hotel_id, name, start_date, end_date),
  constraint "seasons_id_hotel_id_key" unique (id, hotel_id),
  constraint "seasons_pkey" primary key (id)
);

alter table "public"."seasons"
  enable row level security;

create table "public"."stay_consumption" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "product_id"         uuid                     not null,
  "quantity"           integer                  not null,
  "charged_unit_price" numeric(12,2)            not null,
  "consumption_date"   timestamp with time zone,
  "notes"              text,
  "created_at"         timestamp with time zone not null default now(),
  "updated_at"         timestamp with time zone not null default now(),
  "stay_id"            uuid,
  constraint "reservation_consumption_charged_unit_price_check" check ((charged_unit_price >= (0)::numeric)),
  constraint "reservation_consumption_pkey" primary key (id),
  constraint "reservation_consumption_quantity_check" check ((quantity > 0))
);

alter table "public"."stay_consumption"
  enable row level security;

create table "public"."stay_customers" (
  "id"          uuid                     not null default gen_random_uuid(),
  "stay_id"     uuid                     not null,
  "customer_id" uuid                     not null,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "reservation_customers_pkey" primary key (id),
  constraint "reservation_customers_reservation_id_customer_id_key" unique (stay_id, customer_id)
);

alter table "public"."stay_customers"
  enable row level security;

create table "public"."stays" (
  "id"                     uuid                     not null default gen_random_uuid(),
  "reservation_id"         uuid                     not null,
  "room_id"                uuid                     not null,
  "applied_daily_rate"     numeric(12,2)            not null,
  "total_price_estimated"  numeric(12,2)            not null default null::numeric,
  "created_at"             timestamp with time zone not null default now(),
  "updated_at"             timestamp with time zone not null default now(),
  "checkin_date_expected"  timestamp with time zone not null,
  "checkout_date_expected" timestamp with time zone not null,
  "checkin_date_actual"    timestamp with time zone,
  "checkout_date_actual"   timestamp with time zone,
  "total_paid"             numeric                  default '0'::numeric,
  constraint "reservation_rooms_applied_daily_rate_check" check ((applied_daily_rate >= (0)::numeric)),
  constraint "reservation_rooms_pkey" primary key (id),
  constraint "reservation_rooms_reservation_id_room_id_key" unique (reservation_id, room_id),
  constraint "reservation_rooms_surcharge_amount_check" check ((total_price_estimated >= (0)::numeric)),
  constraint "stays_expected_dates_check" check ((checkout_date_expected > checkin_date_expected))
);

alter table "public"."stays"
  enable row level security;

create table "public"."user_roles" (
  "id"       uuid not null default gen_random_uuid(),
  "user_id"  uuid not null,
  "role_id"  uuid not null,
  "hotel_id" uuid,
  constraint "user_roles_pkey" primary key (id),
  constraint "user_roles_user_id_role_id_hotel_id_key" unique (user_id, role_id, hotel_id)
);

alter table "public"."user_roles"
  enable row level security;

create table "public"."users" (
  "id"              uuid                     not null default gen_random_uuid(),
  "name"            character varying(150)   not null,
  "email"           character varying(150)   not null,
  "password_hash"   text                     not null,
  "is_active"       boolean                  default true,
  "last_login_at"   timestamp with time zone,
  "failed_attempts" integer                  default 0,
  "created_at"      timestamp with time zone default now(),
  "updated_at"      timestamp with time zone default now(),
  "locked_until"    timestamp with time zone,
  constraint "users_email_key" unique (email),
  constraint "users_pkey" primary key (id)
);

alter table "public"."users"
  enable row level security;

alter table "public"."stay_consumption"
  add column "item_total_amount" numeric(12,2) generated always as (((quantity)::numeric * charged_unit_price)) stored;

create type "public"."admin_role_assignment_input" as (
  "role_id"  uuid,
  "hotel_id" uuid
);

create type "public"."payment_status" as enum (
  'pending',
  'partial',
  'paid',
  'refunded'
);

create type "public"."product_status" as enum (
  'active',
  'inactive'
);

alter table "public"."products"
  add column "status" public.product_status not null default 'active'::public.product_status;

create type "public"."reservation_source" as enum (
  'front_desk',
  'website',
  'phone',
  'agency'
);

alter table "public"."reservations"
  add column "reservation_source" public.reservation_source;

create type "public"."reservation_status" as enum (
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'canceled',
  'no_show'
);

create type "public"."room_status" as enum (
  'available',
  'occupied',
  'maintenance',
  'blocked'
);

alter table "public"."rooms"
  add column "status" public.room_status not null default 'available'::public.room_status;

create type "public"."stay_status" as enum (
  'checked_in',
  'checked_out',
  'no_show',
  'canceled',
  'confirmed'
);

alter table "public"."stays"
  add column "stay_status" public.stay_status not null default 'confirmed'::public.stay_status;

create type "public"."transaction_status" as enum (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
);

alter table "public"."financial_transactions"
  add column "status" public.transaction_status not null default 'COMPLETED'::public.transaction_status;

create type "public"."transaction_type" as enum (
  'INCOME',
  'EXPENSE',
  'REFUND'
);

alter table "public"."financial_transactions"
  add column "type" public.transaction_type not null;

create or replace function public.create_role_with_permissions (
  p_name           text,
  p_role_type      text,
  p_hotel_id       uuid,
  p_permission_ids uuid[]
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  AS $function$
DECLARE
  v_role_id UUID;
  v_permission_count INT;
  v_invalid_permission_count INT;
BEGIN
  IF p_role_type NOT IN ('SYSTEM_ROLE', 'HOTEL_ROLE') THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_role_type = 'SYSTEM_ROLE' AND p_hotel_id IS NOT NULL THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = p_hotel_id) THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

    IF v_permission_count <> array_length(p_permission_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_invalid_permission_count
    FROM permissions
    WHERE permissions.id = ANY(p_permission_ids)
      AND permissions.type <> CASE WHEN p_role_type = 'SYSTEM_ROLE' THEN 'SYSTEM_PERMISSION' ELSE 'HOTEL_PERMISSION' END;

    IF v_invalid_permission_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO roles (name, role_type, hotel_id)
  VALUES (p_name, p_role_type, p_hotel_id)
  RETURNING roles.id INTO v_role_id;

  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, UNNEST(p_permission_ids);
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_role_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.create_role_with_permissions (
  p_name           text,
  p_hotel_id       uuid,
  p_permission_ids uuid[]
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  AS $function$
DECLARE
  v_role_id UUID;
  v_permission_count INT;
BEGIN
  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

    IF v_permission_count <> array_length(p_permission_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO roles (name, hotel_id)
  VALUES (p_name, p_hotel_id)
  RETURNING roles.id INTO v_role_id;

  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, UNNEST(p_permission_ids);
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_role_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.create_user_with_roles (
  p_name             text,
  p_email            text,
  p_password_hash    text,
  p_is_active        boolean,
  p_role_assignments public.admin_role_assignment_input[]
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  AS $function$
DECLARE
  v_user_id UUID;
  v_assignment_count INT;
  v_missing_count INT;
  v_invalid_count INT;
BEGIN
  IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
    SELECT COUNT(*)
    INTO v_assignment_count
    FROM unnest(p_role_assignments) AS assignment;

    SELECT COUNT(*)
    INTO v_missing_count
    FROM unnest(p_role_assignments) AS assignment
    LEFT JOIN roles r ON r.id = assignment.role_id
    WHERE r.id IS NULL;

    IF v_missing_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_invalid_count
    FROM unnest(p_role_assignments) AS assignment
    JOIN roles r ON r.id = assignment.role_id
    WHERE
      (r.role_type = 'SYSTEM_ROLE' AND assignment.hotel_id IS NOT NULL)
      OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NULL AND assignment.hotel_id IS NULL)
      OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NOT NULL AND assignment.hotel_id IS NOT NULL AND assignment.hotel_id <> r.hotel_id)
      OR (r.role_type = 'HOTEL_ROLE' AND assignment.hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = assignment.hotel_id));

    IF v_invalid_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO users (name, email, password_hash, is_active)
  VALUES (p_name, p_email, p_password_hash, p_is_active)
  RETURNING users.id INTO v_user_id;

  IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
    INSERT INTO user_roles (user_id, role_id, hotel_id)
    SELECT
      v_user_id,
      assignment.role_id,
      CASE
        WHEN r.role_type = 'SYSTEM_ROLE' THEN NULL
        WHEN r.hotel_id IS NOT NULL THEN r.hotel_id
        ELSE assignment.hotel_id
      END
    FROM unnest(p_role_assignments) AS assignment
    JOIN roles r ON r.id = assignment.role_id;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_user_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.create_user_with_roles (
  p_name          text,
  p_email         text,
  p_password_hash text,
  p_is_active     boolean,
  p_role_ids      uuid[]
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  AS $function$
DECLARE
  v_user_id UUID;
  v_role_count INT;
BEGIN
  IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_role_count FROM roles WHERE roles.id = ANY(p_role_ids);

    IF v_role_count <> array_length(p_role_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO users (name, email, password_hash, is_active)
  VALUES (p_name, p_email, p_password_hash, p_is_active)
  RETURNING users.id INTO v_user_id;

  IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT v_user_id, UNNEST(p_role_ids);
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_user_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.enforce_overlaps_on_reservation_change()
  returns trigger
  language plpgsql
  AS $function$
begin
	if new.reservation_status in ('confirmed', 'checked_in') then
		if exists (
			select 1
			from reservation_rooms rr
			join reservation_rooms rr2 on rr2.room_id = rr.room_id and rr2.reservation_id <> rr.reservation_id
			join reservations r2 on r2.id = rr2.reservation_id
			where rr.reservation_id = new.id
				and r2.reservation_status in ('confirmed', 'checked_in')
				and daterange(r2.planned_checkin_date, r2.planned_checkout_date, '[)')
						&& daterange(new.planned_checkin_date, new.planned_checkout_date, '[)')
		) then
			raise exception 'Reservation % causes overlapping active bookings for one or more rooms', new.id;
		end if;
	end if;

	return new;
end;
$function$;

create or replace function public.rls_auto_enable()
  returns event_trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  AS $function$
begin
	new.updated_at = now();
	return new;
end;
$function$;

create or replace function public.set_updated_at_if_changed()
  returns trigger
  language plpgsql
  AS $function$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;

  return new;
end;
$function$;

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
  AS $function$
DECLARE
  v_permission_count INT;
  v_role_exists BOOLEAN;
  v_role_type TEXT;
  v_role_hotel_id UUID;
  v_effective_role_type TEXT;
  v_effective_hotel_id UUID;
  v_invalid_permission_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM roles WHERE roles.id = p_id) INTO v_role_exists;

  IF NOT v_role_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT role_type, hotel_id INTO v_role_type, v_role_hotel_id FROM roles WHERE roles.id = p_id;

  v_effective_role_type := COALESCE(NULLIF(p_payload->>'role_type', ''), v_role_type);

  IF v_effective_role_type NOT IN ('SYSTEM_ROLE', 'HOTEL_ROLE') THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload ? 'hotel_id' THEN
    v_effective_hotel_id := NULLIF(p_payload->>'hotel_id', '')::UUID;
  ELSE
    v_effective_hotel_id := v_role_hotel_id;
  END IF;

  IF v_effective_role_type = 'SYSTEM_ROLE' AND v_effective_hotel_id IS NOT NULL THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_effective_hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = v_effective_hotel_id) THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE roles
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      role_type = CASE WHEN p_payload ? 'role_type' THEN NULLIF(p_payload->>'role_type', '') ELSE role_type END,
      hotel_id = CASE WHEN p_payload ? 'hotel_id' THEN NULLIF(p_payload->>'hotel_id', '')::UUID ELSE hotel_id END
    WHERE roles.id = p_id;
  END IF;

  IF p_should_replace_permissions THEN
    IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
      SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

      IF v_permission_count <> array_length(p_permission_ids, 1) THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;

      SELECT COUNT(*)
      INTO v_invalid_permission_count
      FROM permissions
      WHERE permissions.id = ANY(p_permission_ids)
        AND permissions.type <> CASE WHEN v_effective_role_type = 'SYSTEM_ROLE' THEN 'SYSTEM_PERMISSION' ELSE 'HOTEL_PERMISSION' END;

      IF v_invalid_permission_count > 0 THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM role_permissions WHERE role_permissions.role_id = p_id;

    IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT p_id, UNNEST(p_permission_ids);
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, p_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.update_user_with_roles (
  p_id                   uuid,
  p_payload              jsonb,
  p_role_assignments     public.admin_role_assignment_input[],
  p_should_replace_roles boolean                              default false
)
  returns table (
    result text,
    id     uuid
  )
  language plpgsql
  AS $function$
DECLARE
  v_user_exists BOOLEAN;
  v_missing_count INT;
  v_invalid_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE users.id = p_id) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE users
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      email = CASE WHEN p_payload ? 'email' THEN NULLIF(p_payload->>'email', '') ELSE email END,
      password_hash = CASE WHEN p_payload ? 'password_hash' THEN NULLIF(p_payload->>'password_hash', '') ELSE password_hash END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::BOOLEAN ELSE is_active END,
      updated_at = NOW()
    WHERE users.id = p_id;
  END IF;

  IF p_should_replace_roles THEN
    IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_missing_count
      FROM unnest(p_role_assignments) AS assignment
      LEFT JOIN roles r ON r.id = assignment.role_id
      WHERE r.id IS NULL;

      IF v_missing_count > 0 THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;

      SELECT COUNT(*)
      INTO v_invalid_count
      FROM unnest(p_role_assignments) AS assignment
      JOIN roles r ON r.id = assignment.role_id
      WHERE
        (r.role_type = 'SYSTEM_ROLE' AND assignment.hotel_id IS NOT NULL)
        OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NULL AND assignment.hotel_id IS NULL)
        OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NOT NULL AND assignment.hotel_id IS NOT NULL AND assignment.hotel_id <> r.hotel_id)
        OR (r.role_type = 'HOTEL_ROLE' AND assignment.hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = assignment.hotel_id));

      IF v_invalid_count > 0 THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM user_roles WHERE user_roles.user_id = p_id;

    IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
      INSERT INTO user_roles (user_id, role_id, hotel_id)
      SELECT
        p_id,
        assignment.role_id,
        CASE
          WHEN r.role_type = 'SYSTEM_ROLE' THEN NULL
          WHEN r.hotel_id IS NOT NULL THEN r.hotel_id
          ELSE assignment.hotel_id
        END
      FROM unnest(p_role_assignments) AS assignment
      JOIN roles r ON r.id = assignment.role_id;
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, p_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
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
  AS $function$
DECLARE
  v_role_count INT;
  v_user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE users.id = p_id) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE users
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      email = CASE WHEN p_payload ? 'email' THEN NULLIF(p_payload->>'email', '') ELSE email END,
      password_hash = CASE WHEN p_payload ? 'password_hash' THEN NULLIF(p_payload->>'password_hash', '') ELSE password_hash END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::BOOLEAN ELSE is_active END,
      updated_at = NOW()
    WHERE users.id = p_id;
  END IF;

  IF p_should_replace_roles THEN
    IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
      SELECT COUNT(*) INTO v_role_count FROM roles WHERE roles.id = ANY(p_role_ids);

      IF v_role_count <> array_length(p_role_ids, 1) THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM user_roles WHERE user_roles.user_id = p_id;

    IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
      INSERT INTO user_roles (user_id, role_id)
      SELECT p_id, UNNEST(p_role_ids);
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, p_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$function$;

create or replace function public.validate_capacity_after_reservation_rooms_change()
  returns trigger
  language plpgsql
  AS $function$
begin
	if tg_op = 'DELETE' then
		perform validate_reservation_capacity(old.reservation_id);
		return old;
	end if;

	perform validate_reservation_capacity(new.reservation_id);
	return new;
end;
$function$;

create or replace function public.validate_capacity_after_reservations_change()
  returns trigger
  language plpgsql
  AS $function$
begin
	perform validate_reservation_capacity(new.id);
	return new;
end;
$function$;

create or replace function public.validate_reservation_capacity (
  p_reservation_id uuid
)
  returns void
  language plpgsql
  AS $function$
declare
	v_guest_count integer;
	v_total_capacity integer;
begin
	select r.guest_count
		into v_guest_count
	from reservations r
	where r.id = p_reservation_id;

	if v_guest_count is null then
		return;
	end if;

	select coalesce(sum(ro.max_occupancy), 0)
		into v_total_capacity
	from reservation_rooms rr
	join rooms ro on ro.id = rr.room_id
	where rr.reservation_id = p_reservation_id;

	if v_total_capacity > 0 and v_guest_count > v_total_capacity then
		raise exception 'Reservation % guest_count (%) exceeds total room capacity (%)',
			p_reservation_id, v_guest_count, v_total_capacity;
	end if;
end;
$function$;

alter table "public"."customers"
  add constraint "customers_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on delete restrict;

alter table "public"."financial_transactions"
  add constraint "fk_financial_transactions_hotel" foreign key (hotel_id) references public.hotels(id) on delete cascade;

alter table "public"."products"
  add constraint "products_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on delete restrict;

alter table "public"."reservations"
  add constraint "reservations_booking_customer_id_fkey" foreign key (booking_customer_id) references public.customers(id) on delete restrict;

alter table "public"."reservations"
  add constraint "reservations_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on delete restrict;

alter table "public"."financial_transactions"
  add constraint "financial_transactions_reservation_id_fkey" foreign key (reservation_id) references public.reservations(id) on delete set null;

alter table "public"."role_permissions"
  add constraint "role_permissions_permission_id_fkey" foreign key (permission_id) references public.permissions(id) on delete cascade;

alter table "public"."roles"
  add constraint "roles_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on update cascade on delete cascade;

alter table "public"."role_permissions"
  add constraint "role_permissions_role_id_fkey" foreign key (role_id) references public.roles(id) on delete cascade;

alter table "public"."rooms"
  add constraint "rooms_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on delete restrict;

alter table "public"."seasons"
  add constraint "seasons_hotel_id_daterange_excl" EXCLUDE using gist (hotel_id with =, daterange(start_date, end_date, '[]'::text) with &&) where (is_active);

alter table "public"."seasons"
  add constraint "seasons_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on delete cascade;

alter table "public"."season_room_rates"
  add constraint "season_room_rates_season_id_hotel_id_fkey" foreign key (season_id, hotel_id) references public.seasons(id, hotel_id) on delete cascade;

alter table "public"."stay_consumption"
  add constraint "reservation_consumption_product_id_fkey" foreign key (product_id) references public.products(id) on delete restrict;

alter table "public"."stay_customers"
  add constraint "reservation_customers_customer_id_fkey" foreign key (customer_id) references public.customers(id) on delete restrict;

alter table "public"."stay_customers"
  add constraint "reservation_customers_reservation_id_fkey" foreign key (stay_id) references public.reservations(id) on delete cascade;

alter table "public"."financial_transactions"
  add constraint "financial_transactions_stay_id_fkey" foreign key (stay_id) references public.stays(id) on delete set null;

alter table "public"."stay_consumption"
  add constraint "stay_consumption_stay_id_fkey" foreign key (stay_id) references public.stays(id) on delete cascade;

alter table "public"."stay_customers"
  add constraint "stay_customers_stay_id_fkey" foreign key (stay_id) references public.stays(id) on update cascade on delete cascade;

alter table "public"."stays"
  add constraint "reservation_rooms_reservation_id_fkey" foreign key (reservation_id) references public.reservations(id) on delete cascade;

alter table "public"."stays"
  add constraint "reservation_rooms_room_id_fkey" foreign key (room_id) references public.rooms(id) on delete restrict;

alter table "public"."user_roles"
  add constraint "user_roles_hotel_id_fkey" foreign key (hotel_id) references public.hotels(id) on update cascade on delete cascade;

alter table "public"."user_roles"
  add constraint "user_roles_role_id_fkey" foreign key (role_id) references public.roles(id) on delete cascade;

alter table "public"."financial_transactions"
  add constraint "financial_transactions_created_by_fkey" foreign key (created_by) references public.users(id) on delete set null;

alter table "public"."user_roles"
  add constraint "user_roles_user_id_fkey" foreign key (user_id) references public.users(id) on delete cascade;

create index idx_customers_document on public.customers using btree (document_type, document_number);

create index idx_financial_transactions_category_status on public.financial_transactions using btree (category, status);

create index idx_financial_transactions_category on public.financial_transactions using btree (category);

create index idx_financial_transactions_created_at on public.financial_transactions using btree (created_at);

create index idx_financial_transactions_hotel_cost_center on public.financial_transactions using btree (hotel_id, cost_center);

create index idx_financial_transactions_hotel_counterparty on public.financial_transactions using btree (hotel_id, counterparty);

create index idx_financial_transactions_hotel_id on public.financial_transactions using btree (hotel_id);

create index idx_financial_transactions_hotel_status_due_date on public.financial_transactions using btree (hotel_id, status, due_date);

create index idx_financial_transactions_hotel_type_paid_at on public.financial_transactions using btree (hotel_id, type, paid_at desc);

create index idx_financial_transactions_paid_at on public.financial_transactions using btree (paid_at desc);

create index idx_financial_transactions_reservation_id on public.financial_transactions using btree (reservation_id);

create index idx_financial_transactions_stay_id on public.financial_transactions using btree (stay_id);

create index idx_financial_transactions_type on public.financial_transactions using btree (type);

create index idx_products_hotel_id on public.products using btree (hotel_id);

create index idx_products_status on public.products using btree (status);

create index idx_reservation_consumption_product_id on public.stay_consumption using btree (product_id);

create index idx_reservation_customers_customer_id on public.stay_customers using btree (customer_id);

create index idx_reservation_customers_reservation_id on public.stay_customers using btree (stay_id);

create index idx_reservation_rooms_reservation_id on public.stays using btree (reservation_id);

create index idx_reservation_rooms_room_id on public.stays using btree (room_id);

create index idx_reservations_booking_customer on public.reservations using btree (booking_customer_id);

create index idx_rooms_hotel_id on public.rooms using btree (hotel_id);

create index idx_rooms_hotel_type on public.rooms using btree (hotel_id, room_type);

create index idx_season_room_rates_lookup on public.season_room_rates using btree (hotel_id, room_type, season_id);

create index idx_seasons_active on public.seasons using btree (hotel_id, is_active);

create index idx_seasons_hotel_dates on public.seasons using btree (hotel_id, start_date, end_date);

create index idx_stays_room_expected_dates on public.stays using btree (room_id, checkin_date_expected, checkout_date_expected);

create unique index ux_customers_hotel_document on public.customers using btree (hotel_id, document_type, document_number);

create trigger trg_customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

create trigger trg_financial_transactions_set_updated_at
  before update on public.financial_transactions
  for each row
  execute function public.set_updated_at_if_changed();

create trigger trg_hotels_set_updated_at
  before update on public.hotels
  for each row
  execute function public.set_updated_at_if_changed();

create trigger trg_products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

create trigger trg_rooms_set_updated_at
  before update on public.rooms
  for each row
  execute function public.set_updated_at();

create trigger trg_season_room_rates_set_updated_at
  before update on public.season_room_rates
  for each row
  execute function public.set_updated_at();

create trigger trg_seasons_set_updated_at
  before update on public.seasons
  for each row
  execute function public.set_updated_at();

create trigger trg_reservation_consumption_set_updated_at
  before update on public.stay_consumption
  for each row
  execute function public.set_updated_at();

create trigger trg_reservation_customers_set_updated_at
  before update on public.stay_customers
  for each row
  execute function public.set_updated_at();

create trigger trg_users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at_if_changed();

create event trigger "ensure_rls"
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function "public"."rls_auto_enable"();

comment on extension "btree_gist" is 'support for indexing common datatypes in GiST';

grant execute on function "public"."create_role_with_permissions"(text, text, uuid, uuid[]) to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."create_role_with_permissions"(text, uuid, uuid[]) to public, "anon", "authenticated", "postgres", "service_role";

grant execute
  on function "public"."create_user_with_roles"(text, text, text, boolean, public.admin_role_assignment_input[])
  to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."create_user_with_roles"(text, text, text, boolean, uuid[]) to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."enforce_overlaps_on_reservation_change"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."rls_auto_enable"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."set_updated_at"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."set_updated_at_if_changed"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."update_role_with_permissions"(uuid, jsonb, uuid[], boolean) to public, "anon", "authenticated", "postgres", "service_role";

grant execute
  on function "public"."update_user_with_roles"(uuid, jsonb, public.admin_role_assignment_input[], boolean)
  to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."update_user_with_roles"(uuid, jsonb, uuid[], boolean) to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."validate_capacity_after_reservation_rooms_change"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."validate_capacity_after_reservations_change"() to public, "anon", "authenticated", "postgres", "service_role";

grant execute on function "public"."validate_reservation_capacity"(uuid) to public, "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."customers" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."financial_transactions" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."hotels" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."permissions" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."products" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."reservations" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."role_permissions" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."roles" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."rooms" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."season_room_rates" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."seasons" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."stay_consumption" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."stay_customers" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."stays" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_roles" to "anon", "authenticated", "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."users" to "anon", "authenticated", "postgres", "service_role";

grant usage on type "public"."admin_role_assignment_input" to "postgres";

grant usage on type "public"."payment_status" to "postgres";

grant usage on type "public"."product_status" to "postgres";

grant usage on type "public"."reservation_source" to "postgres";

grant usage on type "public"."reservation_status" to "postgres";

grant usage on type "public"."room_status" to "postgres";

grant usage on type "public"."stay_status" to "postgres";

grant usage on type "public"."transaction_status" to "postgres";

grant usage on type "public"."transaction_type" to "postgres";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "anon";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "authenticated";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "anon";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "authenticated";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "service_role";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "anon";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "authenticated";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

