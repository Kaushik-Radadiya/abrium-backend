import type { MigrationInterface, QueryRunner } from 'typeorm'

export class InitSchema20260223131000 implements MigrationInterface {
  name = 'InitSchema20260223131000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists "pgcrypto"`)

    await queryRunner.query(`
      create table "users" (
        "dynamic_user_id" text primary key,
        "email" text,
        "wallet_address" text,
        "auth_provider" text,
        "is_deleted" boolean not null default false,
        "deleted_at" timestamptz,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create unique index "users_email_uidx"
      on "users" (lower(email))
      where email is not null
    `)

    await queryRunner.query(`
      create table "user_wallets" (
        "dynamic_user_id" text not null,
        "wallet_address" text not null,
        "chain" text,
        "provider" text,
        "is_primary" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        primary key ("dynamic_user_id", "wallet_address"),
        constraint "fk_user_wallets_dynamic_user_id"
          foreign key ("dynamic_user_id")
          references "users"("dynamic_user_id")
          on delete cascade
      )
    `)

    await queryRunner.query(`
      create table "webhook_events" (
        "event_id" text primary key,
        "event_type" text not null,
        "payload" jsonb not null,
        "received_at" timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table "risk_assessments" (
        "id" uuid primary key default gen_random_uuid(),
        "chain_id" integer not null,
        "token_address" text not null,
        "score" integer not null,
        "decision" text not null check (decision in ('ALLOW', 'WARN', 'BLOCK')),
        "flags" jsonb not null,
        "reasons" jsonb not null,
        "provider_payload" jsonb not null,
        "created_at" timestamptz not null default now()
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "risk_assessments"`)
    await queryRunner.query(`drop table if exists "webhook_events"`)
    await queryRunner.query(`drop table if exists "user_wallets"`)
    await queryRunner.query(`drop index if exists "users_email_uidx"`)
    await queryRunner.query(`drop table if exists "users"`)
  }
}
