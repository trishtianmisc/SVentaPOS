-- VentaPOS Phase 1: catalog (docs/03-database-schema.md)
-- categories, products, product_units (table-only in Phase 1, conversions in Phase 2)

-- Categories ---------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists idx_categories_org on public.categories(organization_id);

drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Products -----------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  brand text,
  cost_price numeric(12,2) not null default 0,
  retail_price numeric(12,2) not null default 0,
  wholesale_price numeric(12,2),
  wholesale_min_qty integer,
  minimum_stock numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  track_inventory boolean not null default true,
  active boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retail_price >= 0),
  check (cost_price >= 0)
);
create index if not exists idx_products_org on public.products(organization_id);
create index if not exists idx_products_org_active on public.products(organization_id, active);
create index if not exists idx_products_barcode on public.products(organization_id, barcode);
create unique index if not exists uq_products_org_sku
  on public.products(organization_id, sku) where sku is not null and sku <> '';

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- Product units (Phase 1: stored only; conversion math deferred to Phase 2) --
create table if not exists public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_name text not null,
  conversion_factor numeric(12,4) not null default 1,
  selling_price numeric(12,2),
  cost_price numeric(12,2),
  barcode text,
  created_at timestamptz not null default now(),
  unique (product_id, unit_name)
);
create index if not exists idx_product_units_product on public.product_units(product_id);
