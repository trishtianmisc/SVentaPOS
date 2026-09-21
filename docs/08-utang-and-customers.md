# VentaPOS — Customers and Utang

## Principle
Utang is a financial ledger. Do not overwrite history to change a balance.

## Customer
Required:
- ID
- Organization
- Name

Optional:
- Phone
- Address
- Credit limit
- Notes

## Ledger Types

```text
CREDIT_SALE
PAYMENT
CREDIT_RETURN
ADJUSTMENT
```

## Example

```text
Credit sale: ₱200
Payment:     ₱100
Balance:     ₱100
```

## Credit Sale
- Customer must be selected.
- Check credit limit if enabled.
- Calculate current outstanding.
- Calculate resulting balance.
- Confirm if credit policy is exceeded.

## Payment
Record:
- Customer
- Amount
- Payment method
- Reference
- Date/time
- User
- Notes

Never silently edit an old payment.

## UI

```text
Juan Dela Cruz

Outstanding
₱850

[Record Payment]
[New Utang]

Recent Activity
- ₱200 Credit Sale
- ₱100 Payment
- ₱300 Credit Sale
```

## Privacy
Collect only information needed for the store's legitimate operations and protect customer information through authorization, RLS, and appropriate retention/security controls.
