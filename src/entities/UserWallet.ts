import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import { User } from './User.js'

@Entity({ name: 'user_wallets' })
export class UserWallet {
  @PrimaryColumn({ name: 'dynamic_user_id', type: 'text' })
  dynamicUserId!: string

  @PrimaryColumn({ name: 'wallet_address', type: 'text' })
  walletAddress!: string

  @Column({ type: 'text', nullable: true })
  chain!: string | null

  @Column({ type: 'text', nullable: true })
  provider!: string | null

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date

  @ManyToOne(() => User, (user) => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'dynamic_user_id',
    referencedColumnName: 'dynamicUserId',
    foreignKeyConstraintName: 'fk_user_wallets_dynamic_user_id',
  })
  user!: User
}
