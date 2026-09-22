-- VentaPOS Phase 5: inter-store stock transfers (draft -> dispatch -> receive)
-- Writes run service-role via FastAPI; reads are member-scoped via RLS.

-- Transfers ------------------------------------------------------------------
create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_store_id uuid not null references public.stores(id) on delete cascade,
  to_store_id uuid not null references public.stores(id) on delete cascade,
  reference_no text not null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT','IN_TRANSIT','RECEIVED','CANCELLED')),
  created_by uuid,
  dispatched_by uuid,
  received_by uuid,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  received_at timestamptz,
  check (from_store_id <> to_store_id),
  unique (organization_id, reference_no)
);
create index if not exists idx_transfers_from
  on public.stock_transfers(organization_id, from_store_id, status);
create index if not exists idx_transfers_to
  on public.stock_transfers(organization_id, to_store_id, status);

create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null check (quantity > 0)
);
create index if not exists idx_transfer_items_tr
  on public.stock_transfer_items(transfer_id);

-- Atomic dispatch: lock source rows, block negative, emit TRANSFER_OUT --------
create or replace function public.dispatch_transfer(
  p_org uuid,
  p_transfer uuid,
  p_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tr record;
  v_line record;
  v_qty numeric(12,2);
begin
  select * into v_tr from public.stock_transfers
    where id = p_transfer and organization_id = p_org
    for update;
  if not found then raise exception 'TRANSFER_NOT_FOUND'; end if;
  if v_tr.status <> 'DRAFT' then
    raise exception 'TRANSFER_NOT_DISPATCHABLE:%', v_tr.status;
  end if;

  for v_line in select * from public.stock_transfer_items
                where transfer_id = p_transfer loop
    select quantity into v_qty from public.inventory
      where store_id = v_tr.from_store_id and product_id = v_line.product_id
      for update;
    if v_qty is null then v_qty := 0; end if;
    if v_qty < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_line.product_id;
    end if;
    update public.inventory
      set quantity = quantity - v_line.quantity, updated_at = now()
      where store_id = v_tr.from_store_id and product_id = v_line.product_id;
    insert into public.inventory_movements(
      organization_id, store_id, product_id, movement_type, quantity,
      reference_type, reference_id, created_by)
    values (p_org, v_tr.from_store_id, v_line.product_id, 'TRANSFER_OUT',
      -v_line.quantity, 'STOCK_TRANSFER', p_transfer, p_user);
  end loop;

  update public.stock_transfers
    set status = 'IN_TRANSIT', dispatched_by = p_user, dispatched_at = now()
    where id = p_transfer;

  return jsonb_build_object('transfer_id', p_transfer, 'status', 'IN_TRANSIT');
end $$;

-- Atomic receive: upsert destination rows, emit TRANSFER_IN --------------------
create or replace function public.receive_transfer(
  p_org uuid,
  p_transfer uuid,
  p_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tr record;
  v_line record;
begin
  select * into v_tr from public.stock_transfers
    where id = p_transfer and organization_id = p_org
    for update;
  if not found then raise exception 'TRANSFER_NOT_FOUND'; end if;
  if v_tr.status <> 'IN_TRANSIT' then
    raise exception 'TRANSFER_NOT_RECEIVABLE:%', v_tr.status;
  end if;

  for v_line in select * from public.stock_transfer_items
                where transfer_id = p_transfer loop
    insert into public.inventory(store_id, product_id, quantity)
      values (v_tr.to_store_id, v_line.product_id, 0)
      on conflict (store_id, product_id) do nothing;
    update public.inventory
      set quantity = quantity + v_line.quantity, updated_at = now()
      where store_id = v_tr.to_store_id and product_id = v_line.product_id;
    insert into public.inventory_movements(
      organization_id, store_id, product_id, movement_type, quantity,
      reference_type, reference_id, created_by)
    values (p_org, v_tr.to_store_id, v_line.product_id, 'TRANSFER_IN',
      v_line.quantity, 'STOCK_TRANSFER', p_transfer, p_user);
  end loop;

  update public.stock_transfers
    set status = 'RECEIVED', received_by = p_user, received_at = now()
    where id = p_transfer;

  return jsonb_build_object('transfer_id', p_transfer, 'status', 'RECEIVED');
end $$;

-- RLS: members of either endpoint store can read ------------------------------
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;

drop policy if exists "transfer_member_read" on public.stock_transfers;
create policy "transfer_member_read" on public.stock_transfers
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.user_id = auth.uid()
        and su.store_id in (stock_transfers.from_store_id,
                            stock_transfers.to_store_id)));

drop policy if exists "transfer_items_member_read" on public.stock_transfer_items;
create policy "transfer_items_member_read" on public.stock_transfer_items
  for select to authenticated using (
    exists (select 1 from public.stock_transfers tr
      join public.store_users su
        on su.store_id in (tr.from_store_id, tr.to_store_id)
      where tr.id = stock_transfer_items.transfer_id
        and su.user_id = auth.uid()));

-- RPCs: service-role only ------------------------------------------------------
revoke all on function public.dispatch_transfer(uuid,uuid,uuid) from anon, authenticated;
revoke all on function public.receive_transfer(uuid,uuid,uuid) from anon, authenticated;
