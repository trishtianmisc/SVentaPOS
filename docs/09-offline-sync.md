# VentaPOS — Offline and Sync Architecture

## Goal
Keep POS usable during temporary internet outages.

## Important
Do not build offline synchronization until the online POS transaction flow is stable and tested.

## Target Architecture

```text
React PWA
   ↓
IndexedDB
   ↓
Offline transaction queue
   ↓
Sync engine
   ↓
FastAPI
   ↓
PostgreSQL
```

## Local Data
Potentially cache:
- Products
- Prices
- Categories
- Store configuration
- Recent customers
- Pending sales
- Sync metadata

Avoid storing unnecessary sensitive data locally.

## Offline Sale

```text
Create sale
 ↓
Validate against local catalog/stock snapshot
 ↓
Create local transaction
 ↓
Show success
 ↓
Queue for sync
```

## Sync State

```text
PENDING
UPLOADING
SYNCED
FAILED
CONFLICT
```

## Idempotency
Every offline transaction needs a unique client-generated idempotency key.

The FastAPI backend must prevent duplicate sale creation when a queued request is retried.

## Conflict Handling
Potential conflicts:
- Same product sold from disconnected devices
- Price changed while offline
- Product disabled
- Stock changed on server

The server is authoritative for final inventory.

## Multi-device Limitation
When multiple devices are offline, they cannot know each other's sales. The system must reconcile after reconnecting and clearly communicate any conflicts.
