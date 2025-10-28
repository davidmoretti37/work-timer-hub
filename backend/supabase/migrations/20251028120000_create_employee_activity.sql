create table if not exists public.employee_activity (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    status text not null check (status in ('active', 'idle')),
    last_activity timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists employee_activity_updated_at_idx
    on public.employee_activity (updated_at desc);

create index if not exists employee_activity_status_idx
    on public.employee_activity (status);

