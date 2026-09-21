-- VentaPOS Phase 0 RLS strategy (docs/05, 11)
-- Principle: FastAPI authorization is mandatory; RLS is defense in depth.
-- FastAPI uses SERVICE_ROLE server-side (bypasses RLS). Direct client access
-- via anon key is locked down to self-reads only.

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.store_users enable row level security;

-- Helper: org of current user ------------------------------------------------
create or replace function public.my_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- Profiles: user reads own row; writes go through FastAPI/service_role --------
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Organizations: member reads own org ----------------------------------------
drop policy if exists "org_member_read" on public.organizations;
create policy "org_member_read" on public.organizations
  for select to authenticated using (id = public.my_organization_id());

drop policy if exists "org_settings_member_read" on public.organization_settings;
create policy "org_settings_member_read" on public.organization_settings
  for select to authenticated using (organization_id = public.my_organization_id());

-- Stores: member of store reads ------------------------------------------------
drop policy if exists "stores_member_read" on public.stores;
create policy "stores_member_read" on public.stores
  for select to authenticated using (
    exists (
      select 1 from public.store_users su
      where su.store_id = stores.id and su.user_id = auth.uid()
    )
  );

-- Store_users: user reads own memberships --------------------------------------
drop policy if exists "store_users_self_read" on public.store_users;
create policy "store_users_self_read" on public.store_users
  for select to authenticated using (user_id = auth.uid());

-- No insert/update/delete policies for anon/authenticated by default.
-- All writes flow through FastAPI with service-role + server-side authZ + audit.
-- Add stricter per-table write policies only when direct-client writes are needed.
