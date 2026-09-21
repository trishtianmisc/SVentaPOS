-- VentaPOS Phase 1 RLS: catalog + inventory + sales (docs/05, 11)
-- Same strategy as foundation: member reads, writes via FastAPI/service-role.

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_units enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.receipt_counters enable row level security;

-- Catalog: org member reads ----------------------------------------------------
drop policy if exists "categories_member_read" on public.categories;
create policy "categories_member_read" on public.categories
  for select to authenticated using (organization_id = public.my_organization_id());

drop policy if exists "products_member_read" on public.products;
create policy "products_member_read" on public.products
  for select to authenticated using (organization_id = public.my_organization_id());

drop policy if exists "units_member_read" on public.product_units;
create policy "units_member_read" on public.product_units
  for select to authenticated using (
    exists (select 1 from public.products p
      where p.id = product_units.product_id
        and p.organization_id = public.my_organization_id()));

-- Inventory: store member reads --------------------------------------------------
drop policy if exists "inventory_member_read" on public.inventory;
create policy "inventory_member_read" on public.inventory
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = inventory.store_id and su.user_id = auth.uid()));

drop policy if exists "movements_member_read" on public.inventory_movements;
create policy "movements_member_read" on public.inventory_movements
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = inventory_movements.store_id and su.user_id = auth.uid()));

-- Sales: store member reads ------------------------------------------------------
drop policy if exists "sales_member_read" on public.sales;
create policy "sales_member_read" on public.sales
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = sales.store_id and su.user_id = auth.uid()));

drop policy if exists "sale_items_member_read" on public.sale_items;
create policy "sale_items_member_read" on public.sale_items
  for select to authenticated using (
    exists (select 1 from public.sales s
      join public.store_users su on su.store_id = s.store_id
      where s.id = sale_items.sale_id and su.user_id = auth.uid()));

drop policy if exists "sale_payments_member_read" on public.sale_payments;
create policy "sale_payments_member_read" on public.sale_payments
  for select to authenticated using (
    exists (select 1 from public.sales s
      join public.store_users su on su.store_id = s.store_id
      where s.id = sale_payments.sale_id and su.user_id = auth.uid()));

-- No insert/update/delete policies: all writes via FastAPI service-role + RPC.
-- RPCs are SECURITY DEFINER; revoke direct execution from anon/authenticated
-- and grant only to service_role (default). Explicitly:
revoke all on function public.complete_sale(uuid,uuid,uuid,jsonb,jsonb,text,uuid,numeric) from anon, authenticated;
revoke all on function public.void_sale(uuid,uuid,uuid,uuid,text) from anon, authenticated;
revoke all on function public.adjust_stock(uuid,uuid,uuid,numeric,text,text,uuid,numeric) from anon, authenticated;
