-- VentaPOS: org-scoped role permission matrix (full enforcement).
-- JSONB shape matches frontend PermMatrix:
--   { "<feature>": { "manager": bool, "cashier": bool, "staff": bool }, ... }
-- Empty object {} means "use application defaults" (owner always full).
-- staff column is the UI label for DB/API role 'inventory'.
-- RLS: organization_settings already has member-select (0002); writes go
-- through the FastAPI service-role only.

alter table public.organization_settings
  add column if not exists role_matrix jsonb not null default '{}'::jsonb;
