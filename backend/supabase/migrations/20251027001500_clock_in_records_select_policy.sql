drop policy if exists "Employees can view their clock-ins" on public.clock_in_records;

create policy "Employees can view their clock-ins"
  on public.clock_in_records
  for select
  using (
    exists (
      select 1
      from public.employees e
      where e.id = clock_in_records.employee_id
        and lower(e.email) = lower(auth.jwt()->>'email')
    )
  );

