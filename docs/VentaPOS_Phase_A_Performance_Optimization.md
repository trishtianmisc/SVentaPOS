# VentaPOS Performance Optimization — Phase A

## Overview

VentaPOS uses:

```text
React + Vite
      ↓
FastAPI
      ↓
Supabase/PostgREST
      ↓
PostgreSQL
```

The POS initially felt slow even though the frontend and FastAPI server were running locally.

The investigation showed that **localhost was not the main bottleneck**. The main issue was repeated sequential network round trips between FastAPI and the Supabase region in Singapore.

The Philippines → Singapore network path has an approximate ~100 ms round-trip floor per request. Multiple sequential requests therefore accumulated noticeable latency.

---

## 1. Original Performance Problem

Before Phase A, a typical request could look like:

```text
Browser
   ↓
FastAPI
   ↓
Supabase: profile lookup       ~140 ms
   ↓
Supabase: store lookup         ~150 ms
   ↓
Supabase: business query       ~100 ms
   ↓
Browser
```

This meant a simple endpoint could spend roughly:

```text
~294 ms
```

just resolving authentication/profile/store context before performing its actual business query.

Inventory could require even more remote calls.

### Additional frontend issue

React `StrictMode` caused the POS component's development-only effect to mount twice.

Because the original POS data loading had no deduplication, the browser could issue:

```text
products
inventory
sales

products
inventory
sales
```

This created duplicate requests during development.

---

# 2. Phase A Goals

The optimization was deliberately kept small and low-risk.

The goals were:

1. Reduce unnecessary Supabase/PostgREST round trips.
2. Prevent duplicate requests from concurrent component mounts.
3. Cache authentication/user context briefly.
4. Keep the existing React + Vite + FastAPI + Supabase architecture.
5. Preserve authentication, tenant isolation, RLS, and API contracts.
6. Avoid premature migration to direct async PostgreSQL access.

---

# 3. Optimization #1 — Combine Profile and Store Lookup

## Before

FastAPI performed two sequential requests:

```text
Request 1:
profiles

Request 2:
store_users
```

Together these took approximately:

```text
~294 ms
```

## After

The lookup was combined into one PostgREST request using the relationship between the profile and store membership.

Conceptually:

```text
profiles
   └── store_users
          └── store information
```

This reduced the context lookup to approximately:

```text
~125 ms
```

### Result

Approximately one remote round trip was removed from every cache miss.

---

# 4. Optimization #2 — User Context Cache

A short-lived cache was added for authenticated user context.

The cached context contains information such as:

```text
Supabase user ID
Profile
Organization
Store membership
Role
```

The cache is keyed by:

```text
Supabase Auth `sub`
```

### TTL

Current TTL:

```text
45 seconds
```

This is intentionally short because roles and store memberships can change.

### Before

Every endpoint repeatedly resolved:

```text
user
 → profile
 → organization/store
 → role
```

### After

First request:

```text
user
 ↓
Supabase context lookup
 ↓
cache for 45 seconds
```

Subsequent requests:

```text
user
 ↓
cached context
 ↓
continue immediately
```

A cache hit is effectively:

```text
~0 ms
```

compared with approximately:

```text
~125 ms
```

for a cache miss.

---

# 5. Optimization #3 — JWKS Single-Flight

VentaPOS uses Supabase's current JWT Signing Keys system.

The backend verifies ES256 JWTs through:

```text
{SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

Previously, multiple concurrent requests during a cold start could potentially trigger multiple JWKS requests.

A single-flight/cache mechanism was added.

## Behavior

If multiple requests arrive while JWKS is being fetched:

```text
Request A ─┐
Request B ─┼──→ ONE JWKS request
Request C ─┤
Request D ─┘
```

The other requests wait for the same result.

### JWKS cache

Current TTL:

```text
600 seconds (10 minutes)
```

### Key rotation

If an unknown `kid` appears:

```text
JWT
 ↓
unknown kid
 ↓
refresh JWKS once
 ↓
try matching key again
```

The system still validates:

- JWT signature
- ES256
- expiration
- `sub`

No secrets or private signing keys are cached or logged.

---

# 6. Optimization #4 — React Query Caching

The frontend now uses shared query caching.

Current cache policies:

| Data | Cache / stale period |
|---|---:|
| Products | 5 minutes |
| Categories | 10 minutes |
| Customers | 2 minutes |
| Inventory | 15 seconds |
| User context | 45 seconds |

These values are intentionally different because each dataset changes at a different rate.

### Important

Caching does NOT replace server-side validation.

For example, inventory displayed in the UI may be slightly stale, but the server still validates:

- product
- price
- stock
- credit limits
- sale totals

when a transaction is submitted.

---

# 7. Optimization #5 — Remove Unnecessary POS Requests

The POS page previously loaded sales information that was not required to perform a sale.

The POS now focuses on:

```text
Products
Categories
Inventory
Customers
```

Sales history belongs to the Sales page.

This means opening POS no longer requires loading the entire sales history.

---

# 8. Optimization #6 — Request Deduplication

The frontend uses shared query keys so multiple components requesting the same data can reuse one request.

For example:

```text
Component A → products
Component B → products
```

becomes:

```text
Component A ─┐
             ├──→ one products request
Component B ─┘
```

This is especially useful with React StrictMode during development.

---

# 9. Performance Measurements

## Before Phase A

Measured using the same server-side profiling methodology:

| Measurement | Before |
|---|---:|
| JWKS cold | ~1638 ms |
| Auth/context | ~294 ms |
| Products query | ~106 ms |
| Categories query | ~138 ms |
| Inventory queries | ~102 + ~121 ms |
| Customers query | ~104–200 ms |
| Warm endpoint estimate | ~400–515 ms |

## After Phase A

| Measurement | After |
|---|---:|
| JWKS cold | ~1788 ms* |
| Auth/context cache miss | ~125 ms |
| Auth/context cache hit | ~0 ms |
| Products query | ~109 ms |
| Categories query | ~105 ms |
| Inventory queries | ~143 + ~108 ms |
| Customers query | ~104 ms |
| Warm endpoint estimate | ~230–375 ms miss / ~105–250 ms hit |

\* JWKS cold time varies between process starts. Single-flight primarily prevents multiple concurrent cold requests from causing a request herd.

---

# 10. Test Results

After Phase A:

```text
31 tests passed
```

Coverage included:

- Existing authentication tests
- Tenant isolation
- POS tests
- JWKS verification
- JWKS rotation
- JWKS single-flight
- User-context cache hit
- User-context cache expiration
- Per-user cache isolation
- Unknown user handling
- Targeted cache invalidation

---

# 11. Security Considerations

The optimization does NOT remove:

- Supabase authentication
- JWT signature verification
- JWKS verification
- organization isolation
- store isolation
- RLS
- server-side stock validation
- server-side price validation
- server-side sale calculations

The user-context cache is only a performance optimization.

It must never be used to trust client-provided:

- prices
- stock quantities
- sale totals
- payment amounts
- organization IDs
- store IDs

The server remains the source of truth.

---

# 12. Cache Invalidation

User context should be invalidated when authorization-related information changes.

Examples:

```text
Role changed
Store membership changed
Organization membership changed
User disabled
```

The backend provides:

```python
invalidate_user_context(...)
```

Future admin/user-management endpoints should call this after successful changes.

Because the current TTL is 45 seconds, authorization changes may otherwise take up to approximately 45 seconds to naturally expire from cache.

---

# 13. Why We Did Not Move to AsyncPG Yet

Direct asyncpg profiling was also performed.

Approximate measurements:

```text
PostgREST: ~95–165 ms
asyncpg:   ~102–104 ms
```

The database/network round-trip itself was therefore not dramatically faster through direct asyncpg.

Because Phase A already achieved the required improvement, migrating all reads to SQLAlchemy + asyncpg would add architectural complexity without a demonstrated need.

### Current decision

Keep:

```text
React/Vite
   ↓
FastAPI
   ↓
Supabase/PostgREST
   ↓
PostgreSQL
```

Reconsider direct asyncpg reads only if future profiling demonstrates that Phase A is no longer sufficient.

---

# 14. Current Recommended Architecture

```text
                    VentaPOS

┌─────────────────────────────────────┐
│           React + Vite              │
│                                     │
│ React Query                         │
│ ├── products cache                 │
│ ├── categories cache               │
│ ├── inventory cache                │
│ └── customers cache                │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│             FastAPI                 │
│                                     │
│ Supabase JWKS authentication        │
│ User context cache                  │
│ Tenant authorization                │
│ Business logic                      │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│       Supabase / PostgreSQL         │
│                                     │
│ PostgREST                           │
│ RLS                                 │
│ Database                            │
└─────────────────────────────────────┘
```

---

# 15. Future Optimization

Do not optimize further without measurement.

If performance becomes a problem again:

1. Profile the slow endpoint.
2. Measure each network/database round trip.
3. Identify the actual bottleneck.
4. Optimize the specific bottleneck.
5. Run the full test suite.
6. Compare before/after measurements.

Potential future optimization:

```text
Phase B
Async SQLAlchemy + asyncpg
```

Only implement Phase B if profiling demonstrates that it provides a meaningful improvement.

---

# 16. Practical Rule for VentaPOS

For every new feature, ask:

> "Does this request require another remote round trip?"

Prefer:

```text
one efficient request
```

over:

```text
multiple sequential requests
```

And prefer:

```text
shared cache + targeted invalidation
```

over:

```text
refetch everything after every action
```

But never cache data in a way that can compromise financial, inventory, or authorization correctness.

---

## Final Result

Phase A successfully changed VentaPOS from a request-heavy flow into a more efficient application without changing the framework or database architecture.

The biggest gains came from:

1. **Combining profile/store lookups**
2. **Caching user context for 45 seconds**
3. **Preventing duplicate frontend requests**
4. **Using React Query shared caching**
5. **Removing unnecessary sales fetching from POS**
6. **Single-flight JWKS fetching**

The system should now feel significantly faster while retaining the same authentication, tenant isolation, database, and API behavior.
