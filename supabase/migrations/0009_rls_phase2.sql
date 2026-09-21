-- VentaPOS Phase 2 RLS (docs/05, 11)
-- Member reads; all writes via FastAPI service-role + RPCs.

alter table public.customers enable row level security;
alter table public.customer_ledger enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "customers_member_read" on public.customers;
create policy "customers_member_read" on public.customers
  for select to authenticated using (organization_id = public.my_organization_id());

drop policy if exists "ledger_member_read" on public.customer_ledger;
create policy "ledger_member_read" on public.customer_ledger
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = customer_ledger.store_id and su.user_id = auth.uid()));

drop policy if exists "suppliers_member_read" on public.suppliers;
create policy "suppliers_member_read" on public.suppliers
  for select to authenticated using (organization_id = public.my_organization_id());

drop policy if exists "po_member_read" on public.purchase_orders;
create policy "po_member_read" on public.purchase_orders
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = purchase_orders.store_id and su.user_id = auth.uid()));

drop policy if exists "po_items_member_read" on public.purchase_order_items;
create policy "po_items_member_read" on public.purchase_order_items
  for select to authenticated using (
    exists (select 1 from public.purchase_orders po
      join public.store_users su on su.store_id = po.store_id
      where po.id = purchase_order_items.purchase_order_id
        and su.user_id = auth.uid()));

drop policy if exists "exp_cat_member_read" on public.expense_categories;
create policy "exp_cat_member_read" on public.expense_categories
  for select to authenticated using (organization_id = public.my_organization_id());

drop policy if exists "expenses_member_read" on public.expenses;
create policy "expenses_member_read" on public.expenses
  for select to authenticated using (
    exists (select 1 from public.store_users su
      where su.store_id = expenses.store_id and su.user_id = auth.uid()));

-- RPCs: service-role only.
revoke all on function public.record_utang_payment(uuid,uuid,uuid,numeric,text,uuid,text,text) from anon, authenticated;
revoke all on function public.receive_purchase(uuid,uuid,uuid,uuid,jsonb) from anon, authenticated;
revoke all on function public.complete_sale(uuid,uuid,uuid,jsonb,jsonb,text,uuid,numeric,boolean,text) from anon, authenticated;
