import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ConsolidatedSchemaChanges20260311000000 implements MigrationInterface {
  name = 'ConsolidatedSchemaChanges20260311000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // catalog_tokens: APY fields
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "apy" double precision
    `)
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "apy_pool_id" text
    `)
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "apy_updated_at" timestamptz
    `)

    // catalog_tokens: security fields (net result — security_score and security_badge_type were added then dropped, so omitted)
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "security_level" text
    `)
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "security_updated_at" timestamptz
    `)
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "security_badges" jsonb
    `)

    // catalog_chains: drop redundant fields (rpc/explorer config lives in frontend static config)
    await queryRunner.query(`
      alter table "catalog_chains"
      drop column if exists "rpc_urls"
    `)
    await queryRunner.query(`
      alter table "catalog_chains"
      drop column if exists "explorer_url"
    `)

    // risk_assessments: add badges, drop legacy score
    await queryRunner.query(`
      alter table "risk_assessments"
      add column if not exists "badges" jsonb not null default '[]'::jsonb
    `)
    await queryRunner.query(`
      alter table "risk_assessments"
      drop column if exists "score"
    `)

    // users: verification and wealth tier
    await queryRunner.query(`
      alter table "users"
      add column if not exists "is_verified" boolean not null default false
    `)
    await queryRunner.query(`
      alter table "users"
      add column if not exists "wealth_tier" integer not null default 0
    `)
    await queryRunner.query(`
      update "users"
      set "is_verified" = false,
          "wealth_tier" = 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.query(`alter table "users" drop column if exists "wealth_tier"`)
    await queryRunner.query(`alter table "users" drop column if exists "is_verified"`)

    // risk_assessments
    await queryRunner.query(`
      alter table "risk_assessments"
      add column if not exists "score" integer not null default 0
    `)
    await queryRunner.query(`alter table "risk_assessments" drop column if exists "badges"`)

    // catalog_chains: restore dropped fields
    await queryRunner.query(`
      alter table "catalog_chains"
      add column if not exists "explorer_url" text
    `)
    await queryRunner.query(`
      alter table "catalog_chains"
      add column if not exists "rpc_urls" jsonb not null default '[]'::jsonb
    `)

    // catalog_tokens: security fields
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "security_badges"`)
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "security_updated_at"`)
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "security_level"`)

    // catalog_tokens: APY fields
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "apy_updated_at"`)
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "apy_pool_id"`)
    await queryRunner.query(`alter table "catalog_tokens" drop column if exists "apy"`)
  }
}
