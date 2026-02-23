import { query } from '../db/pool.js'
import type { RiskEvaluation } from '../types/security.js'

type PersistRiskAssessmentInput = {
  chainId: number
  tokenAddress: string
  evaluation: RiskEvaluation
  providerPayload: Record<string, unknown>
}

export async function persistRiskAssessment(input: PersistRiskAssessmentInput) {
  await query(
    `
    insert into risk_assessments (
      chain_id,
      token_address,
      score,
      decision,
      flags,
      reasons,
      provider_payload
    ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
    `,
    [
      input.chainId,
      input.tokenAddress.toLowerCase(),
      input.evaluation.score,
      input.evaluation.decision,
      JSON.stringify(input.evaluation.flags),
      JSON.stringify(input.evaluation.reasons),
      JSON.stringify(input.providerPayload),
    ]
  )
}
