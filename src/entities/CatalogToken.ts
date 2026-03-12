import { Column, Entity, PrimaryColumn } from 'typeorm'
import type { SecurityLevel } from '../types/security.js'

@Entity({ name: 'catalog_tokens' })
export class CatalogToken {
  @PrimaryColumn({ name: 'chain_id', type: 'integer' })
  chainId!: number

  @PrimaryColumn({ type: 'text' })
  address!: string

  @Column({ type: 'text' })
  symbol!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'integer' })
  decimals!: number

  @Column({ name: 'logo_uri', type: 'text', nullable: true })
  logoUri!: string | null

  @Column({ name: 'coingecko_coin_id', type: 'text', nullable: true })
  coingeckoCoinId!: string | null

  @Column({ name: 'price_usd', type: 'double precision', nullable: true })
  priceUsd!: number | null

  @Column({
    name: 'price_change_1h_percent',
    type: 'double precision',
    nullable: true,
  })
  priceChange1hPercent!: number | null

  @Column({
    name: 'price_change_24h_percent',
    type: 'double precision',
    nullable: true,
  })
  priceChange24hPercent!: number | null

  @Column({
    name: 'price_change_7d_percent',
    type: 'double precision',
    nullable: true,
  })
  priceChange7dPercent!: number | null

  @Column({ name: 'volume_24h_usd', type: 'double precision', nullable: true })
  volume24hUsd!: number | null

  @Column({ type: 'double precision', nullable: true })
  apy!: number | null

  @Column({ name: 'apy_pool_id', type: 'text', nullable: true })
  apyPoolId!: string | null

  @Column({ name: 'apy_updated_at', type: 'timestamptz', nullable: true })
  apyUpdatedAt!: Date | null

  @Column({ name: 'security_level', type: 'text', nullable: true })
  securityLevel!: SecurityLevel | null

  @Column({ name: 'security_updated_at', type: 'timestamptz', nullable: true })
  securityUpdatedAt!: Date | null

  @Column({ name: 'security_badges', type: 'jsonb', nullable: true })
  securityBadges!: object[] | null

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date
}
