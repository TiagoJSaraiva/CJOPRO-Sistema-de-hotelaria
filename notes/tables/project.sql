-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  document_number text NOT NULL,
  document_type text NOT NULL,
  email text,
  mobile_phone text,
  phone text,
  birth_date date NOT NULL,
  nationality text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  hotel_id uuid NOT NULL,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.financial_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  currency text NOT NULL DEFAULT 'BRL'::text,
  description text,
  status USER-DEFINED NOT NULL DEFAULT 'COMPLETED'::transaction_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  stay_id uuid,
  reservation_id uuid,
  payment_method text,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT financial_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_financial_transactions_hotel FOREIGN KEY (hotel_id) REFERENCES public.hotels(id),
  CONSTRAINT financial_transactions_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id),
  CONSTRAINT financial_transactions_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id)
);
CREATE TABLE public.hotels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  legal_name character varying NOT NULL,
  tax_id character varying NOT NULL,
  email character varying NOT NULL,
  phone character varying NOT NULL,
  address_line character varying NOT NULL,
  address_number character varying NOT NULL,
  address_complement character varying,
  district character varying NOT NULL,
  city character varying NOT NULL,
  state character varying NOT NULL,
  country character varying NOT NULL,
  zip_code character varying NOT NULL,
  checkin_time_start time without time zone,
  checkout_time_start time without time zone,
  timezone character varying NOT NULL,
  currency character varying NOT NULL,
  is_active boolean DEFAULT true,
  subscription_plan character varying,
  subscription_status character varying,
  max_users integer,
  max_rooms integer,
  slug character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  checkin_time_limit time without time zone,
  checkout_time_limit time without time zone,
  CONSTRAINT hotels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['SYSTEM_PERMISSION'::character varying, 'HOTEL_PERMISSION'::character varying]::text[])),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  status USER-DEFINED NOT NULL DEFAULT 'active'::product_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  booking_customer_id uuid NOT NULL,
  reservation_code text NOT NULL UNIQUE,
  guest_count integer NOT NULL CHECK (guest_count > 0),
  reservation_source USER-DEFINED,
  estimated_total_price numeric CHECK (estimated_total_price IS NULL OR estimated_total_price >= 0::numeric),
  final_total_price numeric CHECK (final_total_price IS NULL OR final_total_price >= 0::numeric),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  total_paid numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id),
  CONSTRAINT reservations_booking_customer_id_fkey FOREIGN KEY (booking_customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  hotel_id uuid,
  role_type character varying NOT NULL CHECK (role_type::text = ANY (ARRAY['SYSTEM_ROLE'::character varying, 'HOTEL_ROLE'::character varying]::text[])),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  room_number text NOT NULL,
  room_type text NOT NULL,
  max_occupancy integer NOT NULL CHECK (max_occupancy > 0),
  base_daily_rate numeric NOT NULL CHECK (base_daily_rate >= 0::numeric),
  status USER-DEFINED NOT NULL DEFAULT 'available'::room_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.season_room_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  room_type text NOT NULL,
  daily_rate numeric NOT NULL CHECK (daily_rate >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT season_room_rates_pkey PRIMARY KEY (id),
  CONSTRAINT season_room_rates_season_id_hotel_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id),
  CONSTRAINT season_room_rates_season_id_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.seasons(id),
  CONSTRAINT season_room_rates_season_id_hotel_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(hotel_id),
  CONSTRAINT season_room_rates_season_id_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.seasons(hotel_id)
);
CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seasons_pkey PRIMARY KEY (id),
  CONSTRAINT seasons_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.stay_consumption (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  charged_unit_price numeric NOT NULL CHECK (charged_unit_price >= 0::numeric),
  item_total_amount numeric DEFAULT ((quantity)::numeric * charged_unit_price),
  consumption_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  stay_id uuid,
  CONSTRAINT stay_consumption_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_consumption_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT stay_consumption_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id)
);
CREATE TABLE public.stay_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stay_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stay_customers_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_customers_reservation_id_fkey FOREIGN KEY (stay_id) REFERENCES public.reservations(id),
  CONSTRAINT reservation_customers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT stay_customers_stay_id_fkey FOREIGN KEY (stay_id) REFERENCES public.stays(id)
);
CREATE TABLE public.stays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  room_id uuid NOT NULL,
  applied_daily_rate numeric NOT NULL CHECK (applied_daily_rate >= 0::numeric),
  total_price_estimated numeric NOT NULL DEFAULT NULL::numeric CHECK (total_price_estimated >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  checkin_date_expected timestamp with time zone NOT NULL,
  checkout_date_expected timestamp with time zone NOT NULL,
  checkin_date_actual timestamp with time zone,
  checkout_date_actual timestamp with time zone,
  total_paid numeric DEFAULT '0'::numeric,
  stay_status USER-DEFINED NOT NULL DEFAULT 'confirmed'::stay_status,
  CONSTRAINT stays_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_rooms_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id),
  CONSTRAINT reservation_rooms_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  hotel_id uuid,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  failed_attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  locked_until timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);