-- Add UPDATE policy for clock_in_records so employees can update their own break times
drop policy if exists "Employees can update their clock-ins" on public.clock_in_records;

create policy "Employees can update their clock-ins"
  on public.clock_in_records
  for update
  using (
    exists (
      select 1
      from public.employees e
      where e.id = clock_in_records.employee_id
        and lower(e.email) = lower(auth.jwt()->>'email')
    )
  );
