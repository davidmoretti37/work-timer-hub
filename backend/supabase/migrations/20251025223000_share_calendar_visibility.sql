-- Share calendar events and approved PTO visibility with all employees

-- Allow any authenticated user to read calendar events
drop policy if exists "Users can view own events" on public.calendar_events;
create policy "Authenticated users can view calendar events"
  on public.calendar_events for select
  to authenticated
  using (true);

-- Allow any authenticated user to read approved PTO requests
drop policy if exists "Employees can view approved pto" on public.pto_requests;
create policy "Employees can view approved pto"
  on public.pto_requests for select
  to authenticated
  using (status = 'approved');

