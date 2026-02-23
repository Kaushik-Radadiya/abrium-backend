import { AppDataSource, initializeDataSource } from '../db/dataSource.js'
import { RiskAssessment } from '../entities/RiskAssessment.js'
import type { RiskEvaluation } from '../types/security.js'

type PersistRiskAssessmentInput = {
  chainId: number
  tokenAddress: string
  evaluation: RiskEvaluation
  providerPayload: Record<string, unknown>
}

export async function persistRiskAssessment(input: PersistRiskAssessmentInput) {
  await initializeDataSource()
  const repository = AppDataSource.getRepository(RiskAssessment)

  await repository.insert({
    chainId: input.chainId,
    tokenAddress: input.tokenAddress.toLowerCase(),
    score: input.evaluation.score,
    decision: input.evaluation.decision,
    flags: input.evaluation.flags,
    reasons: input.evaluation.reasons,
    providerPayload: input.providerPayload,
  })
}
