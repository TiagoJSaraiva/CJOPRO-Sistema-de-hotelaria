-- Necessário para gerar UUID automaticamente
create extension if not exists "pgcrypto";

create type transaction_type as enum (
    'INCOME',
    'EXPENSE',
    'REFUND'
);

create type transaction_status as enum (
    'PENDING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'REFUNDED'
);

create table public.financial_transactions (
    id uuid primary key default gen_random_uuid(),

    hotel_id uuid not null,

    type transaction_type not null,
    category text not null,

    amount numeric(12, 2) not null check (amount >= 0),

    currency text not null default 'BRL',

    description text null,

    status transaction_status not null
        default 'COMPLETED',

    created_at timestamptz not null default now(),

    -- Foreign Key para hotels
    constraint fk_financial_transactions_hotel
        foreign key (hotel_id)
        references public.hotels(id)
        on delete cascade

);

create index idx_financial_transactions_hotel_id
on public.financial_transactions(hotel_id);

create index idx_financial_transactions_created_at
on public.financial_transactions(created_at);

create index idx_financial_transactions_type
on public.financial_transactions(type);

create index idx_financial_transactions_category
on public.financial_transactions(category);