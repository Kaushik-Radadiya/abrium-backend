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

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date
}
