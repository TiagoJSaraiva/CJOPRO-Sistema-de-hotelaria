create type public.room_block_status as enum (
  'blocked',
  'maintenance'
);

create table public.room_blocks (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  status public.room_block_status not null default 'blocked'::public.room_block_status,
  label text,
  start_date date not null,
  end_date date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint room_blocks_pkey primary key (id),
  constraint room_blocks_room_id_fkey foreign key (room_id) references public.rooms(id) on delete cascade,
  constraint room_blocks_dates_check check (end_date >= start_date),
  constraint room_blocks_room_id_dates_excl exclude using gist (
    room_id with =,
    daterange(start_date, end_date, '[]'::text) with &&
  )
);

alter table public.room_blocks enable row level security;

create index idx_room_blocks_room_dates
  on public.room_blocks using btree (room_id, start_date, end_date);

create trigger trg_room_blocks_set_updated_at
  before update on public.room_blocks
  for each row
  execute function public.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.room_blocks
  to anon, authenticated, postgres, service_role;

grant usage on type public.room_block_status to postgres, service_role;
