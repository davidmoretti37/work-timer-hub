drop policy if exists "Employees can view their profile row" on public.employees;

create policy "Employees can view their profile row"
  on public.employees
  for select
  using (
    lower(email) = lower(auth.jwt()->>'email')
  );

