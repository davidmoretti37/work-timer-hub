-- Fix admin UPDATE and DELETE policies for clock_in_records
-- Migration: 20251104020000_fix_admin_update_delete_policies.sql
-- This enables admins to edit and delete worker time sessions

-- Fix UPDATE policy with WITH CHECK clause (required by Supabase)
drop policy if exists "Admins can update all clock-in records" on public.clock_in_records;

create policy "Admins can update all clock-in records"
  on public.clock_in_records
  for update
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

-- Add DELETE policy for admins
drop policy if exists "Admins can delete all clock-in records" on public.clock_in_records;

create policy "Admins can delete all clock-in records"
  on public.clock_in_records
  for delete
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );
