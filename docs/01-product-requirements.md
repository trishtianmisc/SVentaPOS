# VentaPOS — Product Requirements

## Goal
Build a POS and inventory platform that lets a small Philippine retail or wholesale business manage the complete sales-to-stock cycle.

## Organization and Stores
- Users belong to organizations.
- Organizations can have one or more stores.
- Tenant data must be isolated.
- Store access must be permission-controlled.

## Products
Support:
- Name
- SKU
- Barcode
- Category
- Brand
- Cost price
- Retail price
- Wholesale price
- Wholesale minimum quantity
- Minimum stock
- Reorder level
- Active/inactive
- Inventory tracking
- Product image
- Supplier

## Units
Support conversions such as:
- 1 case = 24 pieces
- 1 carton = 10 packs
- 1 box = 12 units

## POS
Users can:
- Search products
- Scan barcodes
- Add/remove products
- Change quantities
- Apply permitted discounts
- Select customer
- Select payment method
- Complete sale
- Print/share receipt
- View sale result immediately

## Payments
Initial methods:
- Cash
- GCash
- Maya
- Bank transfer
- Card
- Utang
- Other

## Customers
- Walk-in customer
- Named customer
- Optional contact information
- Credit limit
- Current balance
- Transaction history
- Payment history

## Utang
- Record credit sale
- Record payment
- Show outstanding balance
- Maintain immutable ledger history
- Optional due date
- Optional notes
- Optional credit limit

## Inventory
- Receive stock
- Deduct stock from sales
- Return stock
- Stock adjustment
- Damage/expired stock
- Future inter-store transfers
- Low-stock alerts
- Inventory movement history

## Suppliers
- Supplier profile
- Supplier products
- Purchase orders
- Receive stock
- Purchase history

## Expenses
- Expense category
- Amount
- Date
- Payment method
- Notes
- Store
- User

## Reports
V1:
- Daily sales
- Sales by period
- Transaction count
- Average transaction value
- Product sales
- Inventory value
- Low-stock report
- Outstanding utang
- Basic gross-profit estimate
- Expenses

## Non-Functional Requirements
- Mobile-first
- Fast POS interaction
- Secure multi-tenancy
- Server-side authorization
- RLS where applicable
- Audit logs
- Database transactions for financial operations
- Backups and recovery
- Responsive UI
- Accessible controls
