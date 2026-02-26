import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'catalog_chains' })
export class CatalogChain {
  @PrimaryColumn({ name: 'chain_id', type: 'integer' })
  chainId!: number

  @Column({ name: 'chain_key', type: 'text' })
  chainKey!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ name: 'native_symbol', type: 'text' })
  nativeSymbol!: string

  @Column({ name: 'logo_uri', type: 'text', nullable: true })
  logoUri!: string | null

  @Column({ name: 'rpc_urls', type: 'jsonb' })
  rpcUrls!: string[]

  @Column({ name: 'explorer_url', type: 'text', nullable: true })
  explorerUrl!: string | null

  @Column({ name: 'mainnet', type: 'boolean', default: true })
  mainnet!: boolean

  @Column({ name: 'chain_type', type: 'text', nullable: true })
  chainType!: string | null

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date
}
