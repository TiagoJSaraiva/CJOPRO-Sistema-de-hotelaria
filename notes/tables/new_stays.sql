create table public.reservations ( id uuid not null default gen_random_uuid (), hotel_id uuid not null, booking_customer_id uuid not null, reservation_code text not null, guest_count integer not null, reservation_status public.reservation_status not null default 'pending'::reservation_status, reservation_source public.reservation_source null, estimated_total_price numeric(12, 2) null, final_total_price numeric(12, 2) null, notes text null, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), payment_status public.payment_status null default 'pending'::payment_status, constraint reservations_pkey primary key (id), constraint reservations_hotel_id_fkey foreign KEY (hotel_id) references hotels (id) on delete RESTRICT, constraint reservations_booking_customer_id_fkey foreign KEY (booking_customer_id) references customers (id) on delete RESTRICT ); create table public.stay ( id uuid not null default gen_random_uuid (), reservation_id uuid not null, room_id uuid not null, applied_daily_rate numeric(12, 2) not null, total_price_estimated numeric(12, 2) not null default null::numeric, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), checkin_date_expected timestamp with time zone not null, checkout_date_expected timestamp with time zone not null, checkin_date_actual timestamp with time zone null, checkout_date_actual timestamp with time zone null, total_paid numeric null default '0'::numeric, constraint stay_pkey primary key (id), constraint stay_reservation_id_room_id_key unique (reservation_id, room_id), constraint stay_reservation_id_fkey foreign KEY (reservation_id) references reservations (id) on delete CASCADE, constraint stay_room_id_fkey foreign KEY (room_id) references rooms (id) on delete RESTRICT ); create table public.stay_consumption ( id uuid not null default gen_random_uuid (), product_id uuid not null, quantity integer not null, charged_unit_price numeric(12, 2) not null, item_total_amount numeric GENERATED ALWAYS as (((quantity)::numeric * charged_unit_price)) STORED (12, 2) null, consumption_date timestamp with time zone null, notes text null, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), stay_id uuid null, constraint stay_consumption_pkey primary key (id), constraint stay_consumption_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT, constraint stay_consumption_stay_id_fkey foreign KEY (stay_id) references stay (id) on delete CASCADE ); create table public.stay_customers ( id uuid not null default gen_random_uuid (), stay_id uuid not null, customer_id uuid not null, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), constraint stay_customers_pkey primary key (id), constraint stay_customers_stay_id_customer_id_key unique (stay_id, customer_id), constraint stay_customers_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete RESTRICT, constraint stay_customers_reservation_id_fkey foreign KEY (stay_id) references reservations (id) on delete CASCADE, constraint stay_customers_stay_id_fkey foreign KEY (stay_id) references stay (id) on update CASCADE on delete CASCADE );create table public.reservations (
  id uuid not null default gen_random_uuid (),
  hotel_id uuid not null,
  booking_customer_id uuid not null,
  reservation_code text not null,
  guest_count integer not null,
  reservation_status public.reservation_status not null default 'pending'::reservation_status,
  reservation_source public.reservation_source null,
  estimated_total_price numeric(12, 2) null,
  final_total_price numeric(12, 2) null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  payment_status public.payment_status null default 'pending'::payment_status,

  constraint reservations_pkey
    primary key (id),

  constraint reservations_hotel_id_fkey
    foreign key (hotel_id)
    references hotels (id)
    on delete restrict,

  constraint reservations_booking_customer_id_fkey
    foreign key (booking_customer_id)
    references customers (id)
    on delete restrict
);



create table public.stay (
  id uuid not null default gen_random_uuid (),
  reservation_id uuid not null,
  room_id uuid not null,
  applied_daily_rate numeric(12, 2) not null,
  total_price_estimated numeric(12, 2) null default null::numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  checkin_date_expected timestamp with time zone not null,
  checkout_date_expected timestamp with time zone not null,
  checkin_date_actual timestamp with time zone null,
  checkout_date_actual timestamp with time zone null,
  total_paid numeric null default '0'::numeric,

  constraint stay_pkey
    primary key (id),

  constraint stay_reservation_id_room_id_key
    unique (reservation_id, room_id),

  constraint stay_reservation_id_fkey
    foreign key (reservation_id)
    references reservations (id)
    on delete cascade,

  constraint stay_room_id_fkey
    foreign key (room_id)
    references rooms (id)
    on delete restrict
);



create table public.stay_consumption (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  quantity integer not null,
  charged_unit_price numeric(12, 2) not null,

  item_total_amount numeric
    generated always as (
      ((quantity)::numeric * charged_unit_price)
    ) stored,

  consumption_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  stay_id uuid null,

  constraint stay_consumption_pkey
    primary key (id),

  constraint stay_consumption_product_id_fkey
    foreign key (product_id)
    references products (id)
    on delete restrict,

  constraint stay_consumption_stay_id_fkey
    foreign key (stay_id)
    references stay (id)
    on delete cascade
);



create table public.stay_customers (
  id uuid not null default gen_random_uuid (),
  stay_id uuid not null,
  customer_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint stay_customers_pkey
    primary key (id),

  constraint stay_customers_stay_id_customer_id_key
    unique (stay_id, customer_id),

  constraint stay_customers_customer_id_fkey
    foreign key (customer_id)
    references customers (id)
    on delete restrict,

  constraint stay_customers_stay_id_fkey
    foreign key (stay_id)
    references stay (id)
    on update cascade
    on delete cascade
);