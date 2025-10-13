-- Add token-based approval fields to pto_requests
alter table public.pto_requests 
  add column if not exists approval_token uuid not null default gen_random_uuid(),
  add column if not exists token_expires_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists token_used boolean not null default false;

-- Unique token for fast lookup
create unique index if not exists idx_pto_requests_approval_token on public.pto_requests(approval_token);

comment on column public.pto_requests.approval_token is 'One-time token for email approval links';
comment on column public.pto_requests.token_expires_at is 'Expiry for approval token';
comment on column public.pto_requests.token_used is 'Whether token was already used';

