# VentaPOS — Database Schema

## Tenancy

### organizations
- id UUID PK
- name
- slug
- status
- created_at
- updated_at

### organization_settings
- organization_id PK/FK
- currency
- timezone
- receipt_settings JSONB
- created_at
- updated_at

### stores
- id UUID PK
- organization_id FK
- name
- code
- address
- phone
- status
- created_at
- updated_at

### profiles
- id UUID PK, linked to auth.users
- organization_id FK
- full_name
- phone
- status
- created_at
- updated_at

### store_users
- store_id FK
- user_id FK
- role
- created_at

## Catalog

### categories
- id UUID PK
- organization_id FK
- name
- slug
- active
- created_at
- updated_at

### products
- id UUID PK
- organization_id FK
- category_id FK
- name
- sku
- barcode
- brand
- cost_price NUMERIC
- retail_price NUMERIC
- wholesale_price NUMERIC
- wholesale_min_qty
- minimum_stock
- reorder_level
- track_inventory
- active
- image_path
- created_at
- updated_at

### product_units
- id UUID PK
- product_id FK
- unit_name
- conversion_factor
- selling_price NUMERIC
- cost_price NUMERIC
- barcode
- created_at

## Inventory

### inventory
- store_id FK
- product_id FK
- quantity
- updated_at
- UNIQUE(store_id, product_id)

### inventory_movements
- id UUID PK
- organization_id FK
- store_id FK
- product_id FK
- movement_type
- quantity
- unit_cost NUMERIC
- reference_type
- reference_id
- notes
- created_by
- created_at

Movement types:
- PURCHASE
- SALE
- SALE_RETURN
- PURCHASE_RETURN
- ADJUSTMENT
- DAMAGE
- EXPIRED
- TRANSFER_IN
- TRANSFER_OUT

## Sales

### sales
- id UUID PK
- organization_id FK
- store_id FK
- customer_id nullable
- cashier_id FK
- receipt_number
- subtotal NUMERIC
- discount_amount NUMERIC
- tax_amount NUMERIC
- total NUMERIC
- status
- created_at
- voided_at nullable
- voided_by nullable
- void_reason nullable
- idempotency_key nullable UNIQUE per organization/store policy

### sale_items
- id UUID PK
- sale_id FK
- product_id FK
- product_name_snapshot
- unit_name
- quantity
- unit_price NUMERIC
- unit_cost NUMERIC
- discount_amount NUMERIC
- line_total NUMERIC

### sale_payments
- id UUID PK
- sale_id FK
- payment_method
- amount NUMERIC
- reference
- created_at

## Customers / Utang

### customers
- id UUID PK
- organization_id FK
- name
- phone nullable
- address nullable
- credit_limit NUMERIC nullable
- active
- created_at
- updated_at

### customer_ledger
- id UUID PK
- customer_id FK
- store_id FK
- transaction_type
- amount NUMERIC
- reference_type
- reference_id
- notes
- created_by
- created_at

Types:
- CREDIT_SALE
- PAYMENT
- ADJUSTMENT
- CREDIT_RETURN

## Suppliers / Purchases

### suppliers
- id UUID PK
- organization_id FK
- name
- contact_name
- phone
- address
- notes
- active
- created_at
- updated_at

### purchase_orders
- id UUID PK
- organization_id FK
- store_id FK
- supplier_id FK
- po_number
- status
- total NUMERIC
- created_by
- created_at

### purchase_order_items
- id UUID PK
- purchase_order_id FK
- product_id FK
- quantity
- unit_cost NUMERIC
- line_total NUMERIC

## Expenses

### expense_categories
- id UUID PK
- organization_id FK
- name
- active

### expenses
- id UUID PK
- organization_id FK
- store_id FK
- category_id FK
- amount NUMERIC
- payment_method
- notes
- expense_date
- created_by
- created_at

## Audit

### audit_logs
- id UUID PK
- organization_id FK
- store_id nullable
- user_id FK
- action
- entity_type
- entity_id
- metadata JSONB
- created_at

## Database Rules
1. Tenant-owned tables must have organization_id directly or through a trusted relationship.
2. Store-scoped tables must have store_id.
3. Completed financial records must not be hard-deleted.
4. Use database transactions for sale completion.
5. Snapshot product name/price data on sale items.
6. Use NUMERIC/DECIMAL for money.
7. Add indexes based on actual access patterns.
8. RLS is defense in depth; FastAPI authorization is also mandatory.
