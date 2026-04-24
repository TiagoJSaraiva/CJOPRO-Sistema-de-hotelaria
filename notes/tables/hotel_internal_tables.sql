-- NOTE:
-- This script assumes PostgreSQL/Supabase and that hotels.id is UUID.
-- If hotels.id uses another type, adjust all hotel_id columns accordingly.

begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- =========================
-- ENUM TYPES
-- =========================

do $$
begin
	if not exists (select 1 from pg_type where typname = 'room_status') then
		create type room_status as enum ('available', 'occupied', 'maintenance', 'blocked');
	end if;

	if not exists (select 1 from pg_type where typname = 'reservation_status') then
		create type reservation_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'canceled', 'no_show');
	end if;

	if not exists (select 1 from pg_type where typname = 'reservation_source') then
		create type reservation_source as enum ('front_desk', 'website', 'phone', 'agency');
	end if;

	if not exists (select 1 from pg_type where typname = 'payment_status') then
		create type payment_status as enum ('pending', 'partial', 'paid', 'refunded');
	end if;

	if not exists (select 1 from pg_type where typname = 'product_status') then
		create type product_status as enum ('active', 'inactive');
	end if;
end
$$;

-- =========================
-- TRIGGER UTILITIES
-- =========================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- =========================
-- MAIN TABLES
-- =========================

create table if not exists rooms (
	id uuid primary key default gen_random_uuid(),
	hotel_id uuid not null references hotels(id) on delete restrict,
	room_number text not null,
	room_type text not null,
	max_occupancy integer not null check (max_occupancy > 0),
	base_daily_rate numeric(12,2) not null check (base_daily_rate >= 0),
	status room_status not null default 'available',
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (hotel_id, room_number)
);

create table if not exists customers (
	id uuid primary key default gen_random_uuid(),
	full_name text not null,
	document_number text not null,
	document_type text not null,
	email text,
	mobile_phone text,
	phone text,
	birth_date date not null,
	nationality text,
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (document_type, document_number)
);

create table if not exists reservations (
	id uuid primary key default gen_random_uuid(),
	hotel_id uuid not null references hotels(id) on delete restrict,
	booking_customer_id uuid not null references customers(id) on delete restrict,
	reservation_code text not null unique,
	planned_checkin_date date not null,
	planned_checkout_date date not null,
	actual_checkin_date timestamptz,
	actual_checkout_date timestamptz,
	guest_count integer not null check (guest_count > 0),
	reservation_status reservation_status not null default 'pending',
	reservation_source reservation_source,
	payment_status payment_status not null default 'pending',
	estimated_total_amount numeric(12,2) check (estimated_total_amount is null or estimated_total_amount >= 0),
	final_total_amount numeric(12,2) check (final_total_amount is null or final_total_amount >= 0),
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (planned_checkout_date > planned_checkin_date)
);

create table if not exists reservation_rooms (
	id uuid primary key default gen_random_uuid(),
	reservation_id uuid not null references reservations(id) on delete cascade,
	room_id uuid not null references rooms(id) on delete restrict,
	applied_daily_rate numeric(12,2) not null check (applied_daily_rate >= 0),
	discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
	surcharge_amount numeric(12,2) not null default 0 check (surcharge_amount >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (reservation_id, room_id)
);

create table if not exists reservation_customers (
	id uuid primary key default gen_random_uuid(),
	reservation_id uuid not null references reservations(id) on delete cascade,
	customer_id uuid not null references customers(id) on delete restrict,
	is_primary boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (reservation_id, customer_id)
);

create table if not exists products (
	id uuid primary key default gen_random_uuid(),
	hotel_id uuid not null references hotels(id) on delete restrict,
	name text not null,
	category text,
	unit_price numeric(12,2) not null check (unit_price >= 0),
	status product_status not null default 'active',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists reservation_consumption (
	id uuid primary key default gen_random_uuid(),
	reservation_id uuid not null references reservations(id) on delete cascade,
	product_id uuid not null references products(id) on delete restrict,
	quantity integer not null check (quantity > 0),
	charged_unit_price numeric(12,2) not null check (charged_unit_price >= 0),
	item_total_amount numeric(12,2) generated always as (quantity * charged_unit_price) stored,
	consumption_date timestamptz,
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- =========================
-- RATE MVP TABLES
-- =========================

create table if not exists seasons (
	id uuid primary key default gen_random_uuid(),
	hotel_id uuid not null references hotels(id) on delete cascade,
	name text not null,
	start_date date not null,
	end_date date not null,
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (end_date >= start_date),
	unique (hotel_id, name, start_date, end_date),
	unique (id, hotel_id),
	exclude using gist (
		hotel_id with =,
		daterange(start_date, end_date, '[]') with &&
	) where (is_active)
);

create table if not exists season_room_rates (
	id uuid primary key default gen_random_uuid(),
	season_id uuid not null,
	hotel_id uuid not null,
	room_type text not null,
	daily_rate numeric(12,2) not null check (daily_rate >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (season_id, room_type),
	foreign key (season_id, hotel_id)
		references seasons(id, hotel_id)
		on delete cascade
);

-- Validates that the sum of room max occupancy can hold reservation guest_count.
create or replace function validate_reservation_capacity(p_reservation_id uuid)
returns void
language plpgsql
as $$
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
$$;

-- Blocks overlapping active reservations for the same room and date range.
create or replace function enforce_room_reservation_no_overlap()
returns trigger
language plpgsql
as $$
declare
	v_checkin date;
	v_checkout date;
	v_status reservation_status;
begin
	select r.planned_checkin_date, r.planned_checkout_date, r.reservation_status
		into v_checkin, v_checkout, v_status
	from reservations r
	where r.id = new.reservation_id;

	if v_status not in ('confirmed', 'checked_in') then
		return new;
	end if;

	if exists (
		select 1
		from reservation_rooms rr
		join reservations r_existing on r_existing.id = rr.reservation_id
		where rr.room_id = new.room_id
			and rr.reservation_id <> new.reservation_id
			and r_existing.reservation_status in ('confirmed', 'checked_in')
			and daterange(r_existing.planned_checkin_date, r_existing.planned_checkout_date, '[)')
					&& daterange(v_checkin, v_checkout, '[)')
	) then
		raise exception 'Room % already has an active reservation that overlaps % to %',
			new.room_id, v_checkin, v_checkout;
	end if;

	return new;
end;
$$;

-- Revalidates overlaps if reservation dates/status change.
create or replace function enforce_overlaps_on_reservation_change()
returns trigger
language plpgsql
as $$
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
$$;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_rooms_hotel_id on rooms(hotel_id);
create index if not exists idx_rooms_hotel_type on rooms(hotel_id, room_type);

create index if not exists idx_customers_document on customers(document_type, document_number);

create index if not exists idx_reservations_hotel_dates on reservations(hotel_id, planned_checkin_date, planned_checkout_date);
create index if not exists idx_reservations_status on reservations(reservation_status);
create index if not exists idx_reservations_booking_customer on reservations(booking_customer_id);

create index if not exists idx_reservation_rooms_room_id on reservation_rooms(room_id);
create index if not exists idx_reservation_rooms_reservation_id on reservation_rooms(reservation_id);

create index if not exists idx_reservation_customers_reservation_id on reservation_customers(reservation_id);
create index if not exists idx_reservation_customers_customer_id on reservation_customers(customer_id);

create unique index if not exists ux_reservation_customers_primary
	on reservation_customers(reservation_id)
	where is_primary;

create index if not exists idx_products_hotel_id on products(hotel_id);
create index if not exists idx_products_status on products(status);

create index if not exists idx_reservation_consumption_reservation_id on reservation_consumption(reservation_id);
create index if not exists idx_reservation_consumption_product_id on reservation_consumption(product_id);

create index if not exists idx_seasons_hotel_dates on seasons(hotel_id, start_date, end_date);
create index if not exists idx_seasons_active on seasons(hotel_id, is_active);

create index if not exists idx_season_room_rates_lookup on season_room_rates(hotel_id, room_type, season_id);

-- =========================
-- TRIGGERS
-- =========================

drop trigger if exists trg_rooms_set_updated_at on rooms;
create trigger trg_rooms_set_updated_at
before update on rooms
for each row
execute function set_updated_at();

drop trigger if exists trg_customers_set_updated_at on customers;
create trigger trg_customers_set_updated_at
before update on customers
for each row
execute function set_updated_at();

drop trigger if exists trg_reservations_set_updated_at on reservations;
create trigger trg_reservations_set_updated_at
before update on reservations
for each row
execute function set_updated_at();

drop trigger if exists trg_reservation_rooms_set_updated_at on reservation_rooms;
create trigger trg_reservation_rooms_set_updated_at
before update on reservation_rooms
for each row
execute function set_updated_at();

drop trigger if exists trg_reservation_customers_set_updated_at on reservation_customers;
create trigger trg_reservation_customers_set_updated_at
before update on reservation_customers
for each row
execute function set_updated_at();

drop trigger if exists trg_products_set_updated_at on products;
create trigger trg_products_set_updated_at
before update on products
for each row
execute function set_updated_at();

drop trigger if exists trg_reservation_consumption_set_updated_at on reservation_consumption;
create trigger trg_reservation_consumption_set_updated_at
before update on reservation_consumption
for each row
execute function set_updated_at();

drop trigger if exists trg_seasons_set_updated_at on seasons;
create trigger trg_seasons_set_updated_at
before update on seasons
for each row
execute function set_updated_at();

drop trigger if exists trg_season_room_rates_set_updated_at on season_room_rates;
create trigger trg_season_room_rates_set_updated_at
before update on season_room_rates
for each row
execute function set_updated_at();

drop trigger if exists trg_reservation_rooms_no_overlap on reservation_rooms;
create trigger trg_reservation_rooms_no_overlap
before insert or update on reservation_rooms
for each row
execute function enforce_room_reservation_no_overlap();

drop trigger if exists trg_reservations_enforce_overlap on reservations;
create trigger trg_reservations_enforce_overlap
before update of planned_checkin_date, planned_checkout_date, reservation_status on reservations
for each row
execute function enforce_overlaps_on_reservation_change();

-- Trigger wrapper for reservation capacity validation.

drop trigger if exists trg_reservation_rooms_validate_capacity on reservation_rooms;

create or replace function validate_capacity_after_reservation_rooms_change()
returns trigger
language plpgsql
as $$
begin
	if tg_op = 'DELETE' then
		perform validate_reservation_capacity(old.reservation_id);
		return old;
	end if;

	perform validate_reservation_capacity(new.reservation_id);
	return new;
end;
$$;

create trigger trg_reservation_rooms_validate_capacity
after insert or update or delete on reservation_rooms
for each row
execute function validate_capacity_after_reservation_rooms_change();

create or replace function validate_capacity_after_reservations_change()
returns trigger
language plpgsql
as $$
begin
	perform validate_reservation_capacity(new.id);
	return new;
end;
$$;

drop trigger if exists trg_reservations_validate_capacity on reservations;
create trigger trg_reservations_validate_capacity
after update of guest_count on reservations
for each row
execute function validate_capacity_after_reservations_change();

commit;