-- VentaPOS Phase 4: cashier shifts + Z-report closeout.
-- One open shift per store (partial unique index). Writes run service-role
-- via FastAPI; Z-report aggregates sale_payments in the shift window.

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  opened_by uuid,
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null default 0 check (opening_float >= 0),
  closed_by uuid,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  variance numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_shifts_store
  on public.shifts(store_id, opened_at desc);

-- At most one OPEN shift per store.
drop index if exists uq_open_shift_per_store;
create unique index uq_open_shift_per_store
  on public.shifts(store_id) where status = 'OPEN';

-- RLS: store members can read -----------------------------------------------
alter table public.shifts enable row level security;

drop policy if exists "shift_member_read" on public.shifts;
create policy "shift_member_read" on public.shifts
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = shifts.store_id and su.user_id = auth.uid()));
