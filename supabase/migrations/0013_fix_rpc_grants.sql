-- VentaPOS hardening: RPCs must be service-role only.
--
-- Earlier migrations revoked EXECUTE from `anon`/`authenticated`, but every
-- function keeps its default PUBLIC grant, and anon/authenticated inherit
-- via PUBLIC — so unauthenticated callers could still execute the RPCs.
-- (Input validation blocked cross-tenant abuse, but the surface must not
-- exist.) Revoke from PUBLIC as well and grant back only to service_role.
--
-- NOT touched: my_organization_id() (RLS policies need it for
-- authenticated), trigger helpers (set_updated_at, block_ledger_write),
-- assign_free_plan() (separate review).

-- complete_sale (current 0007 signature; 10 args) ------------------------------
revoke all on function public.complete_sale(uuid,uuid,uuid,jsonb,jsonb,text,uuid,numeric,boolean,text)
  from public, anon, authenticated;
grant execute on function public.complete_sale(uuid,uuid,uuid,jsonb,jsonb,text,uuid,numeric,boolean,text)
  to service_role;

-- adjust_stock -----------------------------------------------------------------
revoke all on function public.adjust_stock(uuid,uuid,uuid,numeric,text,text,uuid,numeric)
  from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid,uuid,uuid,numeric,text,text,uuid,numeric)
  to service_role;

-- record_utang_payment ----------------------------------------------------------
revoke all on function public.record_utang_payment(uuid,uuid,uuid,numeric,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.record_utang_payment(uuid,uuid,uuid,numeric,text,uuid,text,text)
  to service_role;

-- receive_purchase ---------------------------------------------------------------
revoke all on function public.receive_purchase(uuid,uuid,uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.receive_purchase(uuid,uuid,uuid,uuid,jsonb)
  to service_role;

-- dispatch_transfer / receive_transfer -------------------------------------------
revoke all on function public.dispatch_transfer(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.dispatch_transfer(uuid,uuid,uuid)
  to service_role;

revoke all on function public.receive_transfer(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.receive_transfer(uuid,uuid,uuid)
  to service_role;
