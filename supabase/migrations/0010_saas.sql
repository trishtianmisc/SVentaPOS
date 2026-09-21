-- VentaPOS Phase 3: SaaS subscriptions, audit log, notifications (docs/03, 10, 11)

-- Plans ------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(12,2) not null default 0,
  billing_interval text not null default 'monthly',
  feature_limits jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

-- Limit keys: max_stores, max_products, max_users, advanced_reports (bool),
-- wholesale (bool). Prices in PHP, proposals per docs/10.
insert into public.subscription_plans (name, price, billing_interval, feature_limits)
values
  ('Free', 0, 'monthly',
   '{"max_stores": 1, "max_products": 50, "max_users": 1, "advanced_reports": false, "wholesale": false}'),
  ('Starter', 499, 'monthly',
   '{"max_stores": 1, "max_products": 500, "max_users": 5, "advanced_reports": true, "wholesale": false}'),
  ('Business', 1499, 'monthly',
   '{"max_stores": 3, "max_products": 5000, "max_users": 15, "advanced_reports": true, "wholesale": true}'),
  ('Pro', 2999, 'monthly',
   '{"max_stores": 10, "max_products": 100000, "max_users": 50, "advanced_reports": true, "wholesale": true}')
on conflict (name) do update set
  price = excluded.price,
  billing_interval = excluded.billing_interval,
  feature_limits = excluded.feature_limits;

-- Subscriptions (one row per organization) ----------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active' check (status in (
    'trialing','active','past_due','canceled')),
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Every organization gets the Free plan automatically.
create or replace function public.assign_free_plan()
returns trigger language plpgsql as $$
declare
  v_plan uuid;
begin
  select id into v_plan from public.subscription_plans where name = 'Free';
  if v_plan is not null then
    insert into public.subscriptions (organization_id, plan_id, status)
      values (new.id, v_plan, 'active')
      on conflict (organization_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_org_free_plan on public.organizations;
create trigger trg_org_free_plan
  after insert on public.organizations
  for each row execute function public.assign_free_plan();

-- Audit log (append-only; never updated by the app) ---------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org_time
  on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_audit_entity
  on public.audit_logs(entity_type, entity_id);

-- Notifications (in-app; provider push/SMS deferred) ----------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  user_id uuid,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_org_unread
  on public.notifications(organization_id, read_at, created_at desc);
