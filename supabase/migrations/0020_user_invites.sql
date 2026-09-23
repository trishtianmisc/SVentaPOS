-- VentaPOS: org invites — invitee does not need a pre-registered account.
-- Owner creates a pending invite; Supabase Auth sends the invite email;
-- accept attaches profiles + store_users (same end state as add_member).

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  email text not null,
  role text not null check (role in ('owner','manager','cashier','inventory')),
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_invites_org
  on public.user_invites(organization_id, status);
create index if not exists idx_user_invites_email
  on public.user_invites(lower(email));

-- One open invite per email per org (re-invite replaces / resend updates token).
create unique index if not exists uq_user_invites_pending_email
  on public.user_invites(organization_id, lower(email))
  where status = 'pending';

alter table public.user_invites enable row level security;

drop policy if exists "user_invites_self_read" on public.user_invites;
create policy "user_invites_self_read" on public.user_invites
  for select using (false);
