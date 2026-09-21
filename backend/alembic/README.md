# Alembic (optional)

Source of truth for schema is `supabase/migrations/*.sql` (Phase 0).
Use Alembic only if you adopt SQLAlchemy models as migration source later.
For now keep `alembic/versions/` empty and apply SQL via Supabase CLI / dashboard.
