-- Allow admins to view all employee records
-- This enables the admin dashboard to display all workers correctly

drop policy if exists "Admins can view all employees" on public.employees;

create policy "Admins can view all employees"
  on public.employees
  for select
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );
