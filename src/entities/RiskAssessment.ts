import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { RiskDecision } from '../types/security.js'

@Entity({ name: 'risk_assessments' })
@Check(
  'risk_assessments_decision_check',
  `"decision" in ('ALLOW', 'WARN', 'BLOCK')`,
)
@Index('idx_risk_assessments_chain_token_created', [
  'chainId',
  'tokenAddress',
  'createdAt',
])
export class RiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'chain_id', type: 'integer' })
  chainId!: number

  @Column({ name: 'token_address', type: 'text' })
  tokenAddress!: string

  @Column({ type: 'integer' })
  score!: number

  @Column({ type: 'text' })
  decision!: RiskDecision

  @Column({ type: 'jsonb' })
  flags!: string[]

  @Column({ type: 'jsonb' })
  reasons!: string[]

  @Column({ name: 'provider_payload', type: 'jsonb' })
  providerPayload!: object

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date
}
