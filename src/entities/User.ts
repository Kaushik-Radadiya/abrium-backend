import { Column, Entity, OneToMany, PrimaryColumn, type Relation } from 'typeorm'
import type { UserWallet } from './UserWallet.js'

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ name: 'dynamic_user_id', type: 'text' })
  dynamicUserId!: string

  @Column({ type: 'text', nullable: true })
  email!: string | null

  @Column({ name: 'wallet_address', type: 'text', nullable: true })
  walletAddress!: string | null

  @Column({ name: 'auth_provider', type: 'text', nullable: true })
  authProvider!: string | null

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null

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

  @OneToMany('UserWallet', 'user')
  wallets!: Relation<UserWallet[]>
}
