-- Create expense_reimbursements table
create table if not exists public.expense_reimbursements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    employee_name text not null,
    department text,
    supervisor_name text,
    confirmation_email text not null,
    payment_method text not null check (payment_method in ('payroll', 'bank_transfer')),
    total_amount_usd numeric(12,2) not null default 0,
    employee_signature text not null,
    employee_certified boolean not null default false,
    manager_signature text,
    manager_name text,
    manager_approval_date timestamptz,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
    submission_date timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.expense_reimbursements is 'Employee expense reimbursement requests with approval workflow';

-- Enable RLS
alter table public.expense_reimbursements enable row level security;

-- RLS Policies
create policy "Employees can insert own expense reimbursement"
    on public.expense_reimbursements for insert
    with check (auth.uid() = user_id);

create policy "Employees can view own expense reimbursements"
    on public.expense_reimbursements for select
    using (auth.uid() = user_id);

create policy "Admins can view all expense reimbursements"
    on public.expense_reimbursements for select
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

create policy "Admins can update expense reimbursements"
    on public.expense_reimbursements for update
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

-- Indexes
create index if not exists idx_expense_reimbursements_user_id on public.expense_reimbursements(user_id);
create index if not exists idx_expense_reimbursements_status on public.expense_reimbursements(status);
create index if not exists idx_expense_reimbursements_submission_date on public.expense_reimbursements(submission_date);

-- Updated at trigger
create or replace function public.set_expense_reimbursements_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_expense_reimbursements_updated_at on public.expense_reimbursements;
create trigger update_expense_reimbursements_updated_at
    before update on public.expense_reimbursements
    for each row execute function public.set_expense_reimbursements_updated_at();
