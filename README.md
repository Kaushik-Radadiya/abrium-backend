# Abrium Backend

Express + Postgres backend for token risk checks and Dynamic webhook-based user sync.

## Features

- Dynamic webhook ingestion with signature validation (`x-dynamic-signature-256`)
- Idempotent webhook processing (`webhook_events` table)
- User + wallet sync from webhook events (`users`, `user_wallets` tables)
- GoPlus token security wrapper + Risk Policy Engine v0 (ALLOW/WARN/BLOCK)
- Postgres schema v0 and migration script

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Set `DYNAMIC_WEBHOOK_SECRET` from Dynamic dashboard.
3. Install packages:
   - `npm install`
4. Run migration:
   - `npm run migrate`
5. Start dev server:
   - `npm run dev`

## API

- `POST /webhooks/dynamic`
- `GET /risk/token?chainId=1&tokenAddress=0x...`
