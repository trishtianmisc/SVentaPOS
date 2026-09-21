# Supabase

SQL migrations are source of truth for schema (docs/03-database-schema.md).
Apply in order: `supabase/migrations/0001_*.sql`, `0002_*.sql`, ...

- `migrations/` — versioned DDL + RLS policies
- `seeds/` — dev-only seed data (never prod secrets)
- `functions/` — Edge Functions (optional, later)
- `tests/` — RLS / policy checks

Rules:
- Tenant tables carry `organization_id`. Store tables carry `store_id`.
- Use UUID PKs, NUMERIC for money, FKs, indexes per access pattern.
- RLS is defense in depth; FastAPI authZ is mandatory.
