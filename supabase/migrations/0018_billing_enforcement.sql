-- VentaPOS Phase 7: billing enforcement inside complete_sale + helper.
-- subscriptions gains upgrade_request (manual upgrade flow: org owner asks,
-- platform admin approves via existing set-plan route).
-- is_feature_enabled(org, flag) resolves a feature_limits flag against the
-- EFFECTIVE plan: canceled/past_due/expired-period subscriptions fall back
-- to Free. complete_sale gates the wholesale tier on the 'wholesale' flag
-- (Free/Starter sell at retail). Signature unchanged, so existing grants
-- (see 0013) are preserved by CREATE OR REPLACE.
-- (Body is otherwise identical to 0017; DDL below is idempotent.)

alter table public.subscriptions
  add column if not exists upgrade_request jsonb;

create or replace function public.is_feature_enabled(p_org uuid, p_flag text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (sp.feature_limits->>p_flag)::boolean
       from public.subscriptions s
       join public.subscription_plans sp on sp.id = s.plan_id
       where s.organization_id = p_org
         and s.status = 'active'
         and (s.current_period_end is null
              or s.current_period_end > now())),
    (select (sp.feature_limits->>p_flag)::boolean
       from public.subscription_plans sp where sp.name = 'Free'),
    false);
$$;

-- 0013 pattern: billing helper is service-role only (no direct anon access).
revoke all on function
  public.is_feature_enabled(uuid, text) from public, anon, authenticated;
grant execute on function
  public.is_feature_enabled(uuid, text) to service_role;

alter table public.stores
  add column if not exists tax_status text not null default 'non_vat';
alter table public.stores
  add column if not exists vat_rate numeric(5,2) not null default 12;
alter table public.stores
  add column if not exists tin text;

do $$ begin
  alter table public.stores
    add constraint chk_stores_tax_status
    check (tax_status in ('non_vat', 'vat'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.stores
    add constraint chk_stores_vat_rate
    check (vat_rate >= 0 and vat_rate <= 100);
exception when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists vat_exempt boolean not null default false;

alter table public.sales
  add column if not exists tax_rate numeric(5,2) not null default 0;
alter table public.sales
  add column if not exists vatable_amount numeric(12,2) not null default 0;

alter table public.sale_items
  add column if not exists vat_exempt boolean not null default false;

create or replace function public.complete_sale(
  p_org uuid,
  p_store uuid,
  p_cashier uuid,
  p_items jsonb,
  p_payments jsonb,
  p_idempotency text,
  p_customer uuid default null,
  p_sale_discount numeric default 0,
  p_limit_override boolean default false,
  p_limit_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_replay jsonb;
  v_receipt text;
  v_subtotal numeric(12,2) := 0;
  v_item_disc numeric(12,2) := 0;
  v_total numeric(12,2);
  v_paid numeric(12,2) := 0;
  v_utang numeric(12,2) := 0;
  v_cash_paid numeric(12,2);
  v_change numeric(12,2) := 0;
  v_item jsonb;
  v_prod record;
  v_qty numeric(12,2);
  v_disc numeric(12,2);
  v_price numeric(12,2);
  v_line numeric(12,2);
  v_stock numeric(12,2);
  v_counter integer;
  v_code text;
  v_balance numeric(12,2) := 0;
  v_limit numeric(12,2);
  v_cactive boolean;
  -- Multi-unit (Phase 4): factor converts line qty to base units.
  v_unit_name text;
  v_factor numeric(12,4);
  v_unit_price numeric(12,2);
  v_base numeric(12,2);
  -- Tax (Phase 6): VAT-inclusive; buckets track line nets post item-discount.
  v_tax_status text;
  v_vat_rate numeric(5,2);
  -- Billing (Phase 7): wholesale tier requires the plan flag.
  v_wholesale_ok boolean;
  v_tax numeric(12,2) := 0;
  v_vatable numeric(12,2) := 0;
  v_vatable_gross numeric(12,2) := 0;
  v_exempt_gross numeric(12,2) := 0;
  v_net_all numeric(12,2);
  v_alloc numeric(12,2);
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
      'tax_amount', tax_amount, 'tax_rate', tax_rate,
      'vatable_amount', vatable_amount,
      'total', total, 'status', status,
      'change', 0, 'replayed', true)
    into v_replay from public.sales
    where organization_id = p_org and store_id = p_store
      and idempotency_key = p_idempotency;
  if found then
    return v_replay;
  end if;

  select code, tax_status, coalesce(vat_rate, 12)
    into v_code, v_tax_status, v_vat_rate
    from public.stores where id = p_store;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  select public.is_feature_enabled(p_org, 'wholesale') into v_wholesale_ok;

  -- Validate lines + compute authoritative totals (no writes yet).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QTY';
    end if;
    v_disc := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    if v_disc < 0 then raise exception 'INVALID_DISCOUNT'; end if;

    select p.id, p.name, p.retail_price, p.wholesale_price,
           p.wholesale_min_qty, p.cost_price, p.active, p.track_inventory,
           p.vat_exempt
      into v_prod
      from public.products p
      where p.id = (v_item->>'product_id')::uuid
        and p.organization_id = p_org
      for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if not v_prod.active then raise exception 'PRODUCT_INACTIVE'; end if;

    -- Unit resolution: 'pc' is the implicit base unit; any other name
    -- must exist in product_units (tenancy follows the product row).
    v_unit_name := coalesce(nullif(v_item->>'unit_name', ''), 'pc');
    v_factor := 1;
    v_unit_price := null;
    select pu.conversion_factor, pu.selling_price
      into v_factor, v_unit_price
      from public.product_units pu
      where pu.product_id = v_prod.id
        and pu.unit_name = v_unit_name;
    if not found then
      if v_unit_name <> 'pc' then
        raise exception 'UNKNOWN_UNIT:%', v_unit_name;
      end if;
      v_factor := 1;
    end if;
    if v_factor is null or v_factor <= 0 then
      raise exception 'INVALID_UNIT_FACTOR:%', v_unit_name;
    end if;
    v_base := v_qty * v_factor;

    -- Wholesale tier: qty at/above minimum uses wholesale price.
    -- Tier always triggers on BASE-unit quantity. Requires the plan's
    -- 'wholesale' flag (Phase 7); otherwise the tier is skipped silently.
    v_price := v_prod.retail_price;
    if v_wholesale_ok
       and v_prod.wholesale_price is not null
       and v_prod.wholesale_min_qty is not null
       and v_base >= v_prod.wholesale_min_qty then
      v_price := v_prod.wholesale_price;
    end if;
    -- Line price: explicit unit price wins, else linear from base price.
    v_unit_price := coalesce(v_unit_price, round(v_price * v_factor, 2));

    v_line := round(v_unit_price * v_qty - least(v_disc, v_unit_price * v_qty), 2);
    v_subtotal := v_subtotal + round(v_price * v_base, 2);
    v_item_disc := v_item_disc + least(v_disc, v_unit_price * v_qty);

    -- Tax buckets: VAT exemption is per product; line nets are post
    -- item-discount (sale discount allocated below, pro-rata).
    if coalesce(v_prod.vat_exempt, false) then
      v_exempt_gross := v_exempt_gross + v_line;
    else
      v_vatable_gross := v_vatable_gross + v_line;
    end if;

    if v_prod.track_inventory then
      select quantity into v_stock from public.inventory
        where store_id = p_store and product_id = v_prod.id
        for update;
      if v_stock is null then v_stock := 0; end if;
      if v_stock < v_base then
        raise exception 'INSUFFICIENT_STOCK:%', v_prod.name;
      end if;
    end if;
  end loop;

  v_total := greatest(round(v_subtotal - v_item_disc - coalesce(p_sale_discount, 0), 2), 0);

  -- VAT-inclusive tax: sale discount reduces the vatable bucket pro-rata;
  -- tax is carved out of the total (shelf prices never change).
  if v_tax_status = 'vat' and v_vat_rate > 0 then
    v_net_all := round(v_vatable_gross + v_exempt_gross, 2);
    v_alloc := 0;
    if v_net_all > 0 then
      v_alloc := least(
        round(coalesce(p_sale_discount, 0) * v_vatable_gross / v_net_all, 2),
        v_vatable_gross);
    end if;
    v_vatable := round(v_vatable_gross - v_alloc, 2);
    v_vatable := least(v_vatable, v_total);
    v_tax := round(v_vatable * v_vat_rate / (100 + v_vat_rate), 2);
  end if;

  for v_item in select * from jsonb_array_elements(p_payments) loop
    if lower(v_item->>'method') = 'utang' then
      v_utang := v_utang + coalesce(nullif(v_item->>'amount', '')::numeric, 0);
    else
      v_paid := v_paid + coalesce(nullif(v_item->>'amount', '')::numeric, 0);
    end if;
  end loop;
  if v_utang > v_total then
    raise exception 'INVALID_UTANG: exceeds total';
  end if;
  if v_paid + v_utang < v_total then
    raise exception 'UNDERPAID: paid % total %', v_paid + v_utang, v_total;
  end if;
  v_change := round(greatest(v_paid - (v_total - v_utang), 0), 2);

  -- Utang: customer required, credit-limit checked with audited override.
  if v_utang > 0 then
    if p_customer is null then
      raise exception 'UTANG_CUSTOMER_REQUIRED';
    end if;
    select credit_limit, active into v_limit, v_cactive
      from public.customers where id = p_customer and organization_id = p_org;
    if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
    if not v_cactive then raise exception 'CUSTOMER_INACTIVE'; end if;
    select coalesce(sum(amount), 0) into v_balance
      from public.customer_ledger where customer_id = p_customer;
    if v_limit is not null and v_balance + v_utang > v_limit
       and not coalesce(p_limit_override, false) then
      raise exception 'CREDIT_LIMIT_EXCEEDED: balance % + % > limit %',
        v_balance, v_utang, v_limit;
    end if;
  end if;

  -- Receipt number (per-store counter, locked).
  insert into public.receipt_counters(store_id, last_no)
    values (p_store, 1)
    on conflict (store_id) do update set last_no = receipt_counters.last_no + 1
    returning last_no into v_counter;
  v_receipt := v_code || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_counter::text, 5, '0');

  -- Write sale + items + payments + inventory + movements.
  insert into public.sales(
    organization_id, store_id, customer_id, cashier_id, receipt_number,
    subtotal, discount_amount, tax_amount, tax_rate, vatable_amount,
    total, status, idempotency_key)
  values (p_org, p_store, p_customer, p_cashier, v_receipt,
    v_subtotal, round(v_item_disc + coalesce(p_sale_discount, 0), 2),
    v_tax, case when v_tax_status = 'vat' then v_vat_rate else 0 end,
    case when v_tax_status = 'vat' then v_vatable else 0 end,
    v_total, 'COMPLETED', p_idempotency)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_disc := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    select p.name, p.retail_price, p.wholesale_price, p.wholesale_min_qty,
           p.cost_price, p.track_inventory, p.vat_exempt
      into v_prod from public.products p
      where p.id = (v_item->>'product_id')::uuid;
    v_unit_name := coalesce(nullif(v_item->>'unit_name', ''), 'pc');
    v_factor := 1;
    v_unit_price := null;
    select pu.conversion_factor, pu.selling_price
      into v_factor, v_unit_price
      from public.product_units pu
      where pu.product_id = (v_item->>'product_id')::uuid
        and pu.unit_name = v_unit_name;
    if not found and v_unit_name = 'pc' then
      v_factor := 1;
    end if;
    v_base := v_qty * v_factor;
    v_price := v_prod.retail_price;
    if v_wholesale_ok
       and v_prod.wholesale_price is not null
       and v_prod.wholesale_min_qty is not null
       and v_base >= v_prod.wholesale_min_qty then
      v_price := v_prod.wholesale_price;
    end if;
    v_unit_price := coalesce(v_unit_price, round(v_price * v_factor, 2));
    v_line := round(v_unit_price * v_qty - least(v_disc, v_unit_price * v_qty), 2);

    insert into public.sale_items(
      sale_id, product_id, product_name_snapshot, unit_name,
      quantity, unit_quantity, unit_price, unit_cost, discount_amount,
      line_total, vat_exempt)
    values (v_sale_id, (v_item->>'product_id')::uuid, v_prod.name, v_unit_name,
      v_base,
      case when v_unit_name <> 'pc' then v_qty end,
      v_unit_price, coalesce(v_prod.cost_price, 0),
      least(v_disc, v_unit_price * v_qty), v_line,
      coalesce(v_prod.vat_exempt, false));

    if v_prod.track_inventory then
      update public.inventory set quantity = quantity - v_base,
        updated_at = now()
        where store_id = p_store and product_id = (v_item->>'product_id')::uuid;
      insert into public.inventory_movements(
        organization_id, store_id, product_id, movement_type, quantity,
        unit_cost, reference_type, reference_id, created_by)
      values (p_org, p_store, (v_item->>'product_id')::uuid, 'SALE', -v_base,
        v_prod.cost_price, 'SALE', v_sale_id, p_cashier);
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_payments) loop
    insert into public.sale_payments(sale_id, payment_method, amount, reference)
    values (v_sale_id, lower(v_item->>'method'), (v_item->>'amount')::numeric,
      nullif(v_item->>'reference', ''));
  end loop;

  if v_utang > 0 then
    insert into public.customer_ledger(
      customer_id, store_id, transaction_type, amount,
      reference_type, reference_id, notes, created_by)
    values (p_customer, p_store, 'CREDIT_SALE', v_utang,
      'SALE', v_sale_id,
      case when coalesce(p_limit_override, false)
        then 'limit override: ' || coalesce(p_limit_reason, 'no reason given')
        else null end,
      p_cashier);
    v_balance := v_balance + v_utang;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id, 'receipt_number', v_receipt,
    'subtotal', v_subtotal,
    'discount_amount', round(v_item_disc + coalesce(p_sale_discount, 0), 2),
    'tax_amount', v_tax,
    'tax_rate', case when v_tax_status = 'vat' then v_vat_rate else 0 end,
    'vatable_amount', case when v_tax_status = 'vat' then v_vatable else 0 end,
    'total', v_total, 'paid', v_paid + v_utang,
    'change', v_change, 'status', 'COMPLETED', 'replayed', false,
    'customer_id', p_customer, 'utang', v_utang, 'balance', v_balance);
exception when raise_exception then
  raise;
end $$;
