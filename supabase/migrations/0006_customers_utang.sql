-- VentaPOS Phase 2: customers + utang ledger (docs/03, 08)
-- Ledger is immutable: no UPDATE or DELETE allowed, ever.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  credit_limit numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org on public.customers(organization_id);
create index if not exists idx_customers_name on public.customers(organization_id, name);

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Signed amounts: CREDIT_SALE (+) increases balance owed,
-- PAYMENT (-) decreases it. Balance = sum(amount) per customer.
create table if not exists public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  transaction_type text not null check (transaction_type in (
    'CREDIT_SALE','PAYMENT','CREDIT_RETURN','ADJUSTMENT')),
  amount numeric(12,2) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_customer
  on public.customer_ledger(customer_id, created_at desc);
create index if not exists idx_ledger_ref
  on public.customer_ledger(reference_type, reference_id);

-- Immutability guard ------------------------------------------------------------
create or replace function public.block_ledger_write()
returns trigger language plpgsql as $$
begin
  raise exception 'LEDGER_IMMUTABLE: history cannot be edited, post a new entry';
end $$;

drop trigger if exists trg_ledger_no_update on public.customer_ledger;
create trigger trg_ledger_no_update
  before update or delete on public.customer_ledger
  for each row execute function public.block_ledger_write();

-- Atomic utang payment ------------------------------------------------------------
create or replace function public.record_utang_payment(
  p_org uuid,
  p_store uuid,
  p_customer uuid,
  p_amount numeric,
  p_method text,
  p_user uuid,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
  v_active boolean;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  select active into v_active from public.customers
    where id = p_customer and organization_id = p_org;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not v_active then raise exception 'CUSTOMER_INACTIVE'; end if;

  insert into public.customer_ledger(
    customer_id, store_id, transaction_type, amount,
    reference_type, notes, created_by)
  values (p_customer, p_store, 'PAYMENT', -p_amount,
    p_method || coalesce(' ' || p_reference, ''), p_notes, p_user);

  select coalesce(sum(amount), 0) into v_balance
    from public.customer_ledger where customer_id = p_customer;

  return jsonb_build_object(
    'customer_id', p_customer, 'paid', p_amount, 'balance', v_balance);
end $$;
