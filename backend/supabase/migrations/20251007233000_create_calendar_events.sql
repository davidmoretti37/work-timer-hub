-- Create calendar_events table for custom events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

-- Users can insert their own events
create policy "Users can insert own events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

-- Users can view their own events
create policy "Users can view own events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

-- Admins can view all events
create policy "Admins can view all events"
  on public.calendar_events for select
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Indexes
create index if not exists idx_calendar_events_user_id on public.calendar_events(user_id);
create index if not exists idx_calendar_events_event_date on public.calendar_events(event_date);

