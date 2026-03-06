import { Column, Entity, PrimaryColumn } from 'typeorm'

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

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date
}
