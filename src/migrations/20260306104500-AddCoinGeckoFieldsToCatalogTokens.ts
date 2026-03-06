import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCoinGeckoFieldsToCatalogTokens20260306104500
  implements MigrationInterface
{
  name = 'AddCoinGeckoFieldsToCatalogTokens20260306104500'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "coingecko_coin_id" text
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "price_usd" double precision
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "price_change_1h_percent" double precision
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "price_change_24h_percent" double precision
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "price_change_7d_percent" double precision
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      add column if not exists "volume_24h_usd" double precision
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "volume_24h_usd"
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "price_change_7d_percent"
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "price_change_24h_percent"
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "price_change_1h_percent"
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "price_usd"
    `)

    await queryRunner.query(`
      alter table "catalog_tokens"
      drop column if exists "coingecko_coin_id"
    `)
  }
}
