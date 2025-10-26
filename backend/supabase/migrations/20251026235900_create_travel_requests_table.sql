create table if not exists public.travel_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    employee_name text not null,
    confirmation_email text not null,
    travel_purpose text not null,
    destination text not null,
    departure_date timestamptz not null,
    return_date timestamptz not null,
    transportation_mode text,
    transportation_details text,
    lodging_required boolean not null default false,
    lodging_details text,
    estimated_cost numeric(12,2),
    additional_notes text,
    employee_signature text not null,
    status text not null default 'pending',
    submission_date timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.travel_requests is 'Employee travel requests awaiting review';

alter table public.travel_requests enable row level security;

create policy "Employees can insert own travel request"
    on public.travel_requests for insert
    with check (auth.uid() = user_id);

create policy "Employees can view own travel request"
    on public.travel_requests for select
    using (auth.uid() = user_id);

create policy "Admins can view all travel requests"
    on public.travel_requests for select
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

create policy "Admins can update travel request status"
    on public.travel_requests for update
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

create index if not exists idx_travel_requests_user_id on public.travel_requests(user_id);
create index if not exists idx_travel_requests_status on public.travel_requests(status);
create index if not exists idx_travel_requests_departure_date on public.travel_requests(departure_date);

create or replace function public.set_travel_requests_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_travel_requests_updated_at on public.travel_requests;
create trigger update_travel_requests_updated_at
    before update on public.travel_requests
    for each row execute function public.set_travel_requests_updated_at();

