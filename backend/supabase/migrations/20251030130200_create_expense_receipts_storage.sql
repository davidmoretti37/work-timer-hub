-- Create storage bucket for expense receipts
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

-- Storage policies for expense receipts
create policy "Users can upload own expense receipts"
on storage.objects for insert
with check (
    bucket_id = 'expense-receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view own expense receipts"
on storage.objects for select
using (
    bucket_id = 'expense-receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Admins can view all expense receipts"
on storage.objects for select
using (
    bucket_id = 'expense-receipts' and
    exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    )
);

create policy "Users can update own expense receipts"
on storage.objects for update
using (
    bucket_id = 'expense-receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own expense receipts"
on storage.objects for delete
using (
    bucket_id = 'expense-receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
);
