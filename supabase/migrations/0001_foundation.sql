-- VentaPOS Phase 0 foundation: tenancy tables (docs/03-database-schema.md)
-- organizations, organization_settings, stores, profiles, store_users

create extension if not exists "pgcrypto";

-- Updated-at trigger -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Organizations ------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  receipt_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_org_settings_updated on public.organization_settings;
create trigger trg_org_settings_updated
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- Stores -------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists idx_stores_org on public.stores(organization_id);

drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Profiles (linked to auth.users) ------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  phone text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_org on public.profiles(organization_id);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Store membership + role ---------------------------------------------------
-- Roles: owner | manager | cashier | inventory (docs/05). platform_admin lives outside tenant.
create table if not exists public.store_users (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','cashier','inventory')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists idx_store_users_user on public.store_users(user_id);
create index if not exists idx_store_users_store on public.store_users(store_id);
