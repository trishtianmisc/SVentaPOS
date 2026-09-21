# VentaPOS — POS Sales Flow

## Standard Sale

```text
Open POS
 ↓
Search/scan product
 ↓
Add item
 ↓
Change quantity
 ↓
Repeat
 ↓
Select customer if needed
 ↓
Apply permitted discount
 ↓
Select payment method
 ↓
Confirm
 ↓
FastAPI validates request
 ↓
Service starts database transaction
 ↓
Verify products/prices/stock
 ↓
Calculate authoritative totals
 ↓
Create sale
 ↓
Create sale items
 ↓
Create payments
 ↓
Deduct inventory
 ↓
Create inventory movements
 ↓
Create customer ledger entry if credit
 ↓
Commit
 ↓
Return receipt
```

## Atomicity
Sale completion must be atomic. If any critical operation fails, the entire sale must roll back.

## Pricing
The server is authoritative.

1. Resolve product.
2. Resolve unit.
3. Determine retail/wholesale tier.
4. Check quantity threshold.
5. Apply permitted promotion/discount.
6. Calculate line totals.
7. Calculate subtotal.
8. Apply applicable tax/discount logic.
9. Calculate final total.

## Payment
Cash:
- Amount received
- Change

Digital:
- Method
- Reference if applicable

Utang:
- Customer required
- Credit policy checked
- Customer ledger updated

## Idempotency
The client must send an idempotency key for sale creation.

FastAPI must return the existing result if the same valid idempotency key is retried.

## Sale Status
- COMPLETED
- VOIDED
- PARTIALLY_RETURNED
- FULLY_RETURNED

Completed sales must not be deleted.

## Receipt
Include:
- Store
- Receipt number
- Date/time
- Cashier
- Items
- Quantity
- Price
- Discounts
- Total
- Payment
- Change
- Customer when appropriate
