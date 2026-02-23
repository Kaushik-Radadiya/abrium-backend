create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  dynamic_user_id text not null unique,
  email text,
  wallet_address text,
  auth_provider text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for legacy databases where users existed before dynamic_user_id.
alter table if exists users
  add column if not exists dynamic_user_id text,
  add column if not exists wallet_address text,
  add column if not exists auth_provider text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table if exists users
  alter column dynamic_user_id set not null;

-- Legacy schema had wallet_address/chain_id as required columns, but Dynamic
-- sends some user events without wallet context (e.g. verifiedCredentialType=email).
alter table if exists users
  alter column wallet_address drop not null;

-- `users.chain_id` is legacy and not used by Dynamic user identity sync.
alter table if exists users
  drop constraint if exists users_wallet_address_chain_id_key;

alter table if exists users
  drop column if exists chain_id;

alter table if exists users
  drop column if exists last_seen_wallet_address;

alter table if exists users
  drop column if exists metadata;

create unique index if not exists users_dynamic_user_id_uidx on users (dynamic_user_id);
create unique index if not exists users_email_uidx on users (lower(email)) where email is not null;

create table if not exists user_wallets (
  id uuid primary key default gen_random_uuid(),
  dynamic_user_id text not null references users(dynamic_user_id) on delete cascade,
  wallet_address text not null,
  chain text,
  provider text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dynamic_user_id, wallet_address)
);

create table if not exists webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists risk_assessments (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null,
  token_address text not null,
  score integer not null,
  decision text not null check (decision in ('ALLOW', 'WARN', 'BLOCK')),
  flags jsonb not null,
  reasons jsonb not null,
  provider_payload jsonb not null,
  created_at timestamptz not null default now()
);
