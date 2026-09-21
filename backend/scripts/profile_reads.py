"""TEMPORARY profiling: measures real remote costs per backend read path.

Reads only. Never prints secrets, keys, tokens, or personal data.
Run:  python scripts/profile_reads.py
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402

assert settings.supabase_url, "SUPABASE_URL missing"
assert settings.supabase_service_role_key, "SERVICE_ROLE missing"
print(f"target: {settings.supabase_url} (host only, no secrets shown)")

ROWS: dict = {}


def timed(label):
    class Ctx:
        def __enter__(self):
            self.t0 = time.perf_counter()
            return self

        def __exit__(self, *a):
            ms = (time.perf_counter() - self.t0) * 1000
            print(f"  {label:38s} {ms:9.1f} ms")
            ROWS[label] = ms

    return Ctx()


def main():
    import app.core.security as security
    from app.core.database import get_supabase_service

    # 1. JWKS cold vs warm ------------------------------------------------
    print("== JWKS ==")
    security._clear_jwks_cache()
    with timed("jwks_fetch_cold"):
        keys = security._fetch_jwks()
    print(f"  keys in set: {len(keys)}")
    with timed("jwks_fetch_warm"):
        security._fetch_jwks()

    # 2. Service client init ----------------------------------------------
    print("== client init ==")
    with timed("supabase_client_create"):
        sb = get_supabase_service()

    # 3. Context: one store + org ------------------------------------------
    print("== context ==")
    with timed("stores_limit1"):
        st = sb.table("stores").select("id,organization_id,code").limit(1).execute()
    store = (st.data or [{}])[0]
    org = store.get("organization_id")
    print(f"  rows: {len(st.data or [])}")
    with timed("store_users_for_context"):
        su = sb.table("store_users").select("user_id").limit(1).execute()
    user = ((su.data or [{}])[0]).get("user_id")

    # 4. Auth lookups as dependencies.py does them ---------------------------
    print("== auth lookups (per-request) ==")
    with timed("profiles_maybe_single"):
        sb.table("profiles").select("*").eq("id", user).maybe_single().execute()
    with timed("store_users_by_user"):
        sb.table("store_users").select("store_id,role").eq("user_id", user).execute()

    # 5. Endpoint query sequences --------------------------------------------
    print("== GET /categories (1 q) ==")
    with timed("categories_list"):
        sb.table("categories").select("*").eq("organization_id", org).order("name").execute()

    print("== GET /products (1 q) ==")
    with timed("products_list"):
        sb.table("products").select("*").eq("organization_id", org).eq(
            "active", True).order("name").limit(200).execute()

    print("== GET /inventory (2 q sequential) ==")
    with timed("inventory_list"):
        inv = sb.table("inventory").select("*").eq("store_id", store.get("id")).execute()
    pids = [r["product_id"] for r in (inv.data or [])][:50]
    if pids:
        with timed("inventory_products_join"):
            sb.table("products").select("id,name,minimum_stock,reorder_level").in_(
                "id", pids).execute()
    else:
        print("  (store empty, join skipped)")

    print("== GET /customers (up to 2 q sequential) ==")
    with timed("customers_list"):
        cust = sb.table("customers").select("*").eq("organization_id", org).order(
            "name").limit(200).execute()
    cids = [r["id"] for r in (cust.data or [])]
    if cids:
        with timed("customers_ledger"):
            sb.table("customer_ledger").select("customer_id,amount").in_(
                "customer_id", cids).execute()
    else:
        print("  (no customers, ledger skipped)")

    # 6. Repeat for warm variance ----------------------------------------------
    print("== repeat (warm) ==")
    with timed("products_list_warm"):
        sb.table("products").select("*").eq("organization_id", org).execute()
    with timed("profiles_warm"):
        sb.table("profiles").select("*").eq("id", user).maybe_single().execute()

    # 7. Phase A: combined context lookup, miss then hit --------------------------
    print("== context lookup via dependencies (combined + cache) ==")
    from app.api.v1 import dependencies as deps

    deps.invalidate_user_context(user)
    with timed("context_miss_combined"):
        prof, stores = deps._lookup_profile_and_stores(user)
    print(f"  stores: {len(stores)}")
    with timed("context_hit_cached"):
        deps._lookup_profile_and_stores(user)

    print("== done ==")
    total_auth = ROWS.get("profiles_maybe_single", 0) + ROWS.get("store_users_by_user", 0)
    print(f"auth lookups total: {total_auth:.1f} ms")


async def pg_probe():
    print("== direct asyncpg (same queries, for comparison) ==")
    try:
        import asyncpg
    except ImportError:
        print("  asyncpg not installed, skipped")
        return
    dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    sslmode = None
    if "ssl=require" in dsn or "sslmode=require" in dsn:
        sslmode = "require"
        dsn = dsn.split("?")[0]
    try:
        t0 = time.perf_counter()
        conn = await asyncio.wait_for(
            asyncpg.connect(dsn, ssl=sslmode or "require"), timeout=15)
        print(f"  {'asyncpg_connect':38s} {(time.perf_counter() - t0) * 1000:9.1f} ms")
    except Exception as e:
        print(f"  connect failed: {type(e).__name__}")
        return
    try:
        for label, sql in [
            ("pg_products", "select * from products limit 200"),
            ("pg_inventory_join", "select i.*, p.name from inventory i "
                                  "left join products p on p.id = i.product_id limit 200"),
            ("pg_categories", "select * from categories limit 200"),
        ]:
            t0 = time.perf_counter()
            rows = await conn.fetch(sql)
            print(f"  {label:38s} {(time.perf_counter() - t0) * 1000:9.1f} ms  rows={len(rows)}")
        t0 = time.perf_counter()
        idx = await conn.fetch(
            "select tablename, indexname from pg_indexes "
            "where schemaname='public' and tablename in "
            "('products','inventory','categories','customers','sales') "
            "order by tablename, indexname")
        print(f"  {'pg_indexes':38s} {(time.perf_counter() - t0) * 1000:9.1f} ms")
        for r in idx:
            print(f"    {r['tablename']}.{r['indexname']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    import sys as _sys
    if "--pg-only" not in _sys.argv:
        main()
    asyncio.run(pg_probe())
