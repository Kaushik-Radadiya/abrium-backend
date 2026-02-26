import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCatalogCacheTables20260225141000 implements MigrationInterface {
  name = 'AddCatalogCacheTables20260225141000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "catalog_chains" (
        "chain_id" integer primary key,
        "chain_key" text not null,
        "name" text not null,
        "native_symbol" text not null,
        "logo_uri" text,
        "rpc_urls" jsonb not null,
        "explorer_url" text,
        "mainnet" boolean not null default true,
        "chain_type" text,
        "updated_at" timestamptz not null default now()
      )
    `)

    await queryRunner.query(`
      create table "catalog_tokens" (
        "chain_id" integer not null,
        "address" text not null,
        "symbol" text not null,
        "name" text not null,
        "decimals" integer not null,
        "logo_uri" text,
        "updated_at" timestamptz not null default now(),
        primary key ("chain_id", "address"),
        constraint "fk_catalog_tokens_chain_id"
          foreign key ("chain_id")
          references "catalog_chains"("chain_id")
          on delete cascade
      )
    `)

    await queryRunner.query(`
      create index "catalog_tokens_chain_id_idx"
      on "catalog_tokens" ("chain_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "catalog_tokens_chain_id_idx"`)
    await queryRunner.query(`drop table if exists "catalog_tokens"`)
    await queryRunner.query(`drop table if exists "catalog_chains"`)
  }
}
