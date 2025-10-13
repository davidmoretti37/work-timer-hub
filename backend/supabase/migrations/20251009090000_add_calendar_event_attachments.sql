-- Add attachments column to calendar_events and create storage bucket/policies for uploads

-- 1) Add JSONB attachments column
alter table if exists public.calendar_events
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2) Create a public bucket for event attachments (images, PDFs)
--    Use direct insert for compatibility across Storage versions
insert into storage.buckets (id, name, public)
values ('event-attachments', 'event-attachments', true)
on conflict (id) do nothing;

-- 3) Storage RLS policies for bucket 'event-attachments'
-- Allow public read (because bucket is public), restrict write/delete to owner by path prefix `${auth.uid()}/...`

-- Read access (redundant for public bucket, but explicit policy is fine)
drop policy if exists "Public read event attachments" on storage.objects;
create policy "Public read event attachments"
  on storage.objects for select
  using (bucket_id = 'event-attachments');

-- Insert by authenticated users to a folder matching their user id
drop policy if exists "User can upload to own folder" on storage.objects;
create policy "User can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-attachments'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Update only within own folder
drop policy if exists "User can update own files" on storage.objects;
create policy "User can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  )
  with check (
    bucket_id = 'event-attachments'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Delete only within own folder
drop policy if exists "User can delete own files" on storage.objects;
create policy "User can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Nudge PostgREST to reload schema
select pg_notify('pgrst', 'reload schema');


