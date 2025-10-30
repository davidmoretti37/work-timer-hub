-- Create expense_items table (line items for each expense)
create table if not exists public.expense_items (
    id uuid primary key default gen_random_uuid(),
    reimbursement_id uuid not null references public.expense_reimbursements(id) on delete cascade,
    expense_date date not null,
    vendor_name text not null,
    description text not null,
    category text,
    currency text not null default 'USD',
    amount numeric(12,2) not null,
    exchange_rate numeric(12,6) not null default 1.0,
    amount_usd numeric(12,2) not null,
    receipt_url text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.expense_items is 'Individual expense line items for reimbursement requests';

-- Enable RLS
alter table public.expense_items enable row level security;

-- RLS Policies - inherit permissions from parent reimbursement
create policy "Employees can insert own expense items"
    on public.expense_items for insert
    with check (exists (
        select 1 from public.expense_reimbursements
        where expense_reimbursements.id = expense_items.reimbursement_id
          and expense_reimbursements.user_id = auth.uid()
    ));

create policy "Employees can view own expense items"
    on public.expense_items for select
    using (exists (
        select 1 from public.expense_reimbursements
        where expense_reimbursements.id = expense_items.reimbursement_id
          and expense_reimbursements.user_id = auth.uid()
    ));

create policy "Admins can view all expense items"
    on public.expense_items for select
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

create policy "Admins can update expense items"
    on public.expense_items for update
    using (exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
          and user_roles.role = 'admin'
    ));

-- Indexes
create index if not exists idx_expense_items_reimbursement_id on public.expense_items(reimbursement_id);
create index if not exists idx_expense_items_expense_date on public.expense_items(expense_date);

-- Updated at trigger
create or replace function public.set_expense_items_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_expense_items_updated_at on public.expense_items;
create trigger update_expense_items_updated_at
    before update on public.expense_items
    for each row execute function public.set_expense_items_updated_at();

-- Function to update total_amount_usd in expense_reimbursements when items change
create or replace function public.update_reimbursement_total()
returns trigger as $$
begin
    update public.expense_reimbursements
    set total_amount_usd = (
        select coalesce(sum(amount_usd), 0)
        from public.expense_items
        where reimbursement_id = coalesce(NEW.reimbursement_id, OLD.reimbursement_id)
    )
    where id = coalesce(NEW.reimbursement_id, OLD.reimbursement_id);
    return coalesce(NEW, OLD);
end;
$$ language plpgsql;

drop trigger if exists trigger_update_reimbursement_total on public.expense_items;
create trigger trigger_update_reimbursement_total
    after insert or update or delete on public.expense_items
    for each row execute function public.update_reimbursement_total();
