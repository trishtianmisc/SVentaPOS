-- VentaPOS Phase 3 RLS: plans are readable, tenant rows member-read.

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "plans_public_read" on public.subscription_plans;
create policy "plans_public_read" on public.subscription_plans
  for select to authenticated using (active = true);

drop policy if exists "sub_member_read" on public.subscriptions;
create policy "sub_member_read" on public.subscriptions
  for select to authenticated using (
    organization_id = public.my_organization_id());

drop policy if exists "audit_member_read" on public.audit_logs;
create policy "audit_member_read" on public.audit_logs
  for select to authenticated using (
    organization_id = public.my_organization_id());

drop policy if exists "notif_member_read" on public.notifications;
create policy "notif_member_read" on public.notifications
  for select to authenticated using (
    organization_id = public.my_organization_id());

-- No insert/update/delete policies: writes go through FastAPI service-role
-- with server-side authZ (platform-admin checks for subscription changes,
-- role checks for everything else). Audit rows are never updated/deleted.
