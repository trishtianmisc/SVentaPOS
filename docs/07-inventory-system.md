# VentaPOS — Inventory System

## Core Principle
Inventory is an auditable ledger, not simply a number.

## Architecture

```text
Purchase
   ↓
Inventory + movement

Sale
   ↓
Inventory - movement

Adjustment
   ↓
Inventory ± movement

Return
   ↓
Inventory +/− movement
```

## Movement Types

```text
PURCHASE
SALE
SALE_RETURN
PURCHASE_RETURN
ADJUSTMENT
DAMAGE
EXPIRED
TRANSFER_IN
TRANSFER_OUT
```

## Rules
- Prevent negative stock by default.
- Require a reason for manual adjustment.
- Record user performing the adjustment.
- Every sale creates a movement.
- Every stock receipt creates a movement.
- Server controls final stock changes.

## Low Stock
Fields:
- minimum_stock
- reorder_level

Alert:
```text
current_stock <= reorder_level
```

## Units
Normalize inventory to a base unit.

Example:
```text
1 case = 24 pieces
```

Receiving 2 cases:
```text
+48 base units
```

## Costing
V1 may use weighted average cost if selected. Document the exact costing method before relying on it for profit reporting.

## Import
CSV import must:
1. Validate headers.
2. Validate every row.
3. Show preview.
4. Report errors.
5. Require confirmation.
6. Import safely in batches/transactions.
