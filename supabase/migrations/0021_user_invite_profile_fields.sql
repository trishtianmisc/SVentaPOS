-- VentaPOS: carry owner-entered identity onto pending invites so accept
-- can write profiles.full_name / profiles.phone without re-prompting.

alter table public.user_invites
  add column if not exists full_name text,
  add column if not exists phone text;
