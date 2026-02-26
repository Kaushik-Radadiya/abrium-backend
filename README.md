# Abrium Backend

Express + Postgres backend for token risk checks and Dynamic webhook-based user sync.

## Features

- Dynamic webhook ingestion with signature validation (`x-dynamic-signature-256`)
- Idempotent webhook processing (`webhook_events` table)
- User + wallet sync from webhook events (`users`, `user_wallets` tables)
- GoPlus token security wrapper + Risk Policy Engine v0 (ALLOW/WARN/BLOCK)
- Li.Fi chain + token catalog APIs with Postgres-backed metadata cache
- Full TypeORM stack (DataSource, entities, repositories, migrations)

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Set `DYNAMIC_WEBHOOK_SECRET` from Dynamic dashboard.
3. Install packages:
   - `npm install`
4. Run migrations:
   - `npm run migrate`
5. Start dev server:
   - `npm run dev`

## Database Commands

- `npm run migrate`
  - Runs pending TypeORM migrations.
- `npm run migration:show`
  - Shows pending/applied TypeORM migrations.
- `npm run migration:generate -- <name>`
  - Auto-generates a migration from entity changes.
  - Example: `npm run migration:generate -- add_risk_indexes`
- `npm run migration:create -- <name>`
  - Creates an empty migration file.
  - Example: `npm run migration:create -- manual_hotfix`
- `npm run migration:revert`
  - Reverts the last applied migration.
- `npm run db:reset`
  - Drops and recreates `public` schema, then runs all TypeORM migrations.

## API

- `POST /webhooks/dynamic`
- `GET /risk/token?chainId=1&tokenAddress=0x...`
- `GET /catalog/chains`
- `GET /catalog/tokens?chainId=1`
