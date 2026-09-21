-- VentaPOS Phase 1: inventory + sales + atomic RPCs (docs/03, 06, 07)
-- Sale completion MUST be atomic: one RPC = one transaction.
-- Voiding restocks and never deletes history.

-- Inventory ----------------------------------------------------------------
create table if not exists public.inventory (
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index if not exists idx_inventory_store on public.inventory(store_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in (
    'PURCHASE','SALE','SALE_RETURN','PURCHASE_RETURN','ADJUSTMENT',
    'DAMAGE','EXPIRED','TRANSFER_IN','TRANSFER_OUT')),
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_movements_store_product
  on public.inventory_movements(store_id, product_id, created_at desc);
create index if not exists idx_movements_ref
  on public.inventory_movements(reference_type, reference_id);

-- Sales --------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid,
  cashier_id uuid not null,
  receipt_number text not null,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'COMPLETED' check (status in (
    'COMPLETED','VOIDED','PARTIALLY_RETURNED','FULLY_RETURNED')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  unique (organization_id, store_id, receipt_number)
);
create unique index if not exists uq_sales_idempotency
  on public.sales(organization_id, store_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_sales_store_created
  on public.sales(store_id, created_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  unit_name text not null default 'pc',
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_method text not null,
  amount numeric(12,2) not null check (amount >= 0),
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sale_payments_sale on public.sale_payments(sale_id);

-- Receipt counter per store --------------------------------------------------
create table if not exists public.receipt_counters (
  store_id uuid primary key references public.stores(id) on delete cascade,
  last_no integer not null default 0
);

-- Atomic sale completion ------------------------------------------------------
-- All totals are computed server-side from authoritative product prices.
-- Phase 1: cash-focused; any payment method may be recorded, tax = 0.
create or replace function public.complete_sale(
  p_org uuid,
  p_store uuid,
  p_cashier uuid,
  p_items jsonb,
  p_payments jsonb,
  p_idempotency text,
  p_customer uuid default null,
  p_sale_discount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_receipt text;
  v_subtotal numeric(12,2) := 0;
  v_item_disc numeric(12,2) := 0;
  v_total numeric(12,2);
  v_paid numeric(12,2) := 0;
  v_change numeric(12,2) := 0;
  v_item jsonb;
  v_prod record;
  v_qty numeric(12,2);
  v_disc numeric(12,2);
  v_line numeric(12,2);
  v_stock numeric(12,2);
  v_counter integer;
  v_existing uuid;
  v_code text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_SALE: no items';
  end if;
  if p_idempotency is null or p_idempotency = '' then
    raise exception 'IDEMPOTENCY_REQUIRED';
  end if;

  -- Idempotent retry: return existing sale.
  select jsonb_build_object(
      'sale_id', id, 'receipt_number', receipt_number,
      'subtotal', subtotal, 'discount_amount', discount_amount,
      'tax_amount', tax_amount, 'total', total, 'status', status,
      'change', 0, 'replayed', true)
    into v_sale_id from public.sales
    where organization_id = p_org and store_id = p_store
      and idempotency_key = p_idempotency;
  if found then
    return v_sale_id;
  end if;

  select code into v_code from public.stores where id = p_store;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;

  -- Validate lines + compute authoritative totals first (no writes yet).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QTY';
    end if;
    v_disc := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    if v_disc < 0 then raise exception 'INVALID_DISCOUNT'; end if;

    select p.id, p.name, p.retail_price, p.cost_price, p.active,
           p.track_inventory
      into v_prod
      from public.products p
      where p.id = (v_item->>'product_id')::uuid
        and p.organization_id = p_org
      for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if not v_prod.active then raise exception 'PRODUCT_INACTIVE'; end if;

    v_line := round(v_prod.retail_price * v_qty - least(v_disc, v_prod.retail_price * v_qty), 2);
    v_subtotal := v_subtotal + round(v_prod.retail_price * v_qty, 2);
    v_item_disc := v_item_disc + least(v_disc, v_prod.retail_price * v_qty);

    if v_prod.track_inventory then
      select quantity into v_stock from public.inventory
        where store_id = p_store and product_id = v_prod.id
        for update;
      if v_stock is null then v_stock := 0; end if;
      if v_stock < v_qty then
        raise exception 'INSUFFICIENT_STOCK:%', v_prod.name;
      end if;
    end if;
  end loop;

  v_total := greatest(round(v_subtotal - v_item_disc - coalesce(p_sale_discount, 0), 2), 0);

  for v_item in select * from jsonb_array_elements(p_payments) loop
    v_paid := v_paid + coalesce(nullif(v_item->>'amount', '')::numeric, 0);
  end loop;
  if v_paid < v_total then
    raise exception 'UNDERPAID: paid % total %', v_paid, v_total;
  end if;
  v_change := round(v_paid - v_total, 2);

  -- Receipt number (per-store counter, locked).
  insert into public.receipt_counters(store_id, last_no)
    values (p_store, 1)
    on conflict (store_id) do update set last_no = receipt_counters.last_no + 1
    returning last_no into v_counter;
  v_receipt := v_code || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_counter::text, 5, '0');

  -- Write sale + items + payments + inventory + movements.
  insert into public.sales(
    organization_id, store_id, customer_id, cashier_id, receipt_number,
    subtotal, discount_amount, tax_amount, total, status, idempotency_key)
  values (p_org, p_store, p_customer, p_cashier, v_receipt,
    v_subtotal, round(v_item_disc + coalesce(p_sale_discount, 0), 2), 0,
    v_total, 'COMPLETED', p_idempotency)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_disc := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    select p.name, p.retail_price, p.cost_price, p.track_inventory
      into v_prod from public.products p
      where p.id = (v_item->>'product_id')::uuid;
    v_line := round(v_prod.retail_price * v_qty - least(v_disc, v_prod.retail_price * v_qty), 2);

    insert into public.sale_items(
      sale_id, product_id, product_name_snapshot, unit_name,
      quantity, unit_price, unit_cost, discount_amount, line_total)
    values (v_sale_id, (v_item->>'product_id')::uuid, v_prod.name, 'pc',
      v_qty, v_prod.retail_price, coalesce(v_prod.cost_price, 0),
      least(v_disc, v_prod.retail_price * v_qty), v_line);

    if v_prod.track_inventory then
      update public.inventory set quantity = quantity - v_qty,
        updated_at = now()
        where store_id = p_store and product_id = (v_item->>'product_id')::uuid;
      insert into public.inventory_movements(
        organization_id, store_id, product_id, movement_type, quantity,
        unit_cost, reference_type, reference_id, created_by)
      values (p_org, p_store, (v_item->>'product_id')::uuid, 'SALE', -v_qty,
        v_prod.cost_price, 'SALE', v_sale_id, p_cashier);
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_payments) loop
    insert into public.sale_payments(sale_id, payment_method, amount, reference)
    values (v_sale_id, v_item->>'method', (v_item->>'amount')::numeric,
      nullif(v_item->>'reference', ''));
  end loop;

  return jsonb_build_object(
    'sale_id', v_sale_id, 'receipt_number', v_receipt,
    'subtotal', v_subtotal,
    'discount_amount', round(v_item_disc + coalesce(p_sale_discount, 0), 2),
    'tax_amount', 0, 'total', v_total, 'paid', v_paid,
    'change', v_change, 'status', 'COMPLETED', 'replayed', false);
exception when raise_exception then
  raise;
end $$;

-- Auditable void (restocks, never deletes) --------------------------------------
create or replace function public.void_sale(
  p_org uuid,
  p_store uuid,
  p_sale uuid,
  p_user uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  r record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'VOID_REASON_REQUIRED';
  end if;
  select status into v_status from public.sales
    where id = p_sale and organization_id = p_org and store_id = p_store
    for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if v_status <> 'COMPLETED' then raise exception 'SALE_NOT_VOIDABLE:%', v_status; end if;

  update public.sales set status = 'VOIDED', voided_at = now(),
    voided_by = p_user, void_reason = p_reason where id = p_sale;

  for r in select si.product_id, si.quantity, p.track_inventory, p.cost_price
           from public.sale_items si
           join public.products p on p.id = si.product_id
           where si.sale_id = p_sale loop
    if r.track_inventory then
      update public.inventory set quantity = quantity + r.quantity,
        updated_at = now()
        where store_id = p_store and product_id = r.product_id;
      insert into public.inventory_movements(
        organization_id, store_id, product_id, movement_type, quantity,
        unit_cost, reference_type, reference_id, notes, created_by)
      values (p_org, p_store, r.product_id, 'SALE_RETURN', r.quantity,
        r.cost_price, 'SALE', p_sale, 'void: ' || p_reason, p_user);
    end if;
  end loop;

  return jsonb_build_object('sale_id', p_sale, 'status', 'VOIDED');
end $$;

-- Atomic manual adjustment (receive / damage / expired / correction) ------------
-- Reason is mandatory; every call writes exactly one movement row.
create or replace function public.adjust_stock(
  p_org uuid,
  p_store uuid,
  p_product uuid,
  p_delta numeric,
  p_type text,
  p_reason text,
  p_user uuid,
  p_unit_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric(12,2);
  v_track boolean;
begin
  if p_delta = 0 then raise exception 'ZERO_ADJUSTMENT'; end if;
  if p_type not in ('ADJUSTMENT','PURCHASE','DAMAGE','EXPIRED') then
    raise exception 'INVALID_MOVEMENT_TYPE:%', p_type;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ADJUST_REASON_REQUIRED';
  end if;

  select track_inventory into v_track from public.products
    where id = p_product and organization_id = p_org;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not v_track then raise exception 'PRODUCT_NOT_TRACKED'; end if;

  insert into public.inventory(store_id, product_id, quantity)
    values (p_store, p_product, 0)
    on conflict (store_id, product_id) do nothing;

  select quantity into v_qty from public.inventory
    where store_id = p_store and product_id = p_product
    for update;
  if v_qty + p_delta < 0 then
    raise exception 'NEGATIVE_STOCK: on hand %, delta %', v_qty, p_delta;
  end if;

  update public.inventory set quantity = quantity + p_delta, updated_at = now()
    where store_id = p_store and product_id = p_product;

  insert into public.inventory_movements(
    organization_id, store_id, product_id, movement_type, quantity,
    unit_cost, reference_type, notes, created_by)
  values (p_org, p_store, p_product, p_type, p_delta,
    p_unit_cost, 'ADJUSTMENT', p_reason, p_user);

  return jsonb_build_object(
    'product_id', p_product, 'new_quantity', v_qty + p_delta);
end $$;
