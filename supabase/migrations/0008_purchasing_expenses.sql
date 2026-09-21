-- VentaPOS Phase 2: suppliers, purchase orders, expenses (docs/03)

-- Suppliers ------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org on public.suppliers(organization_id);

drop trigger if exists trg_suppliers_updated on public.suppliers;
create trigger trg_suppliers_updated
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- Purchase orders --------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  po_number text not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','ORDERED','PARTIAL','RECEIVED','CANCELLED')),
  total numeric(12,2) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, store_id, po_number)
);
create index if not exists idx_po_store on public.purchase_orders(store_id, status);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null check (quantity > 0),
  received_qty numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null,
  line_total numeric(12,2) not null
);
create index if not exists idx_po_items_po on public.purchase_order_items(purchase_order_id);

-- Atomic PO receive: lines -> inventory + PURCHASE movements ----------------------
create or replace function public.receive_purchase(
  p_org uuid,
  p_store uuid,
  p_po uuid,
  p_user uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_item jsonb;
  v_row record;
  v_qty numeric(12,2);
  v_left numeric(12,2);
  v_all boolean := true;
begin
  select status into v_status from public.purchase_orders
    where id = p_po and organization_id = p_org and store_id = p_store
    for update;
  if not found then raise exception 'PO_NOT_FOUND'; end if;
  if v_status not in ('ORDERED','PARTIAL') then
    raise exception 'PO_NOT_RECEIVABLE:%', v_status;
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'EMPTY_RECEIPT';
  end if;

  for v_item in select * from jsonb_array_elements(p_lines) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'INVALID_QTY'; end if;

    select poi.id, poi.product_id, poi.quantity, poi.received_qty, poi.unit_cost
      into v_row from public.purchase_order_items poi
      where poi.id = (v_item->>'item_id')::uuid
        and poi.purchase_order_id = p_po
      for update;
    if not found then raise exception 'PO_ITEM_NOT_FOUND'; end if;
    v_left := v_row.quantity - v_row.received_qty;
    if v_qty > v_left then
      raise exception 'OVER_RECEIVE: max %', v_left;
    end if;

    update public.purchase_order_items
      set received_qty = received_qty + v_qty where id = v_row.id;

    insert into public.inventory(store_id, product_id, quantity)
      values (p_store, v_row.product_id, 0)
      on conflict (store_id, product_id) do nothing;
    update public.inventory set quantity = quantity + v_qty, updated_at = now()
      where store_id = p_store and product_id = v_row.product_id;
    insert into public.inventory_movements(
      organization_id, store_id, product_id, movement_type, quantity,
      unit_cost, reference_type, reference_id, created_by)
    values (p_org, p_store, v_row.product_id, 'PURCHASE', v_qty,
      v_row.unit_cost, 'PURCHASE_ORDER', p_po, p_user);
  end loop;

  for v_row in select quantity, received_qty from public.purchase_order_items
               where purchase_order_id = p_po loop
    if v_row.received_qty < v_row.quantity then v_all := false; end if;
  end loop;
  update public.purchase_orders
    set status = case when v_all then 'RECEIVED' else 'PARTIAL' end
    where id = p_po;

  return jsonb_build_object('po_id', p_po,
    'status', case when v_all then 'RECEIVED' else 'PARTIAL' end);
end $$;

-- Expenses ----------------------------------------------------------------------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (organization_id, name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  notes text,
  expense_date date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_store_date
  on public.expenses(store_id, expense_date desc);
