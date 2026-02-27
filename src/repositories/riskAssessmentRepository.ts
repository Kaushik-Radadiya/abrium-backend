import { AppDataSource, initializeDataSource } from '../db/dataSource.js'
import { RiskAssessment } from '../entities/RiskAssessment.js'
import type { RiskEvaluation } from '../types/security.js'

type PersistRiskAssessmentInput = {
  chainId: number
  tokenAddress: string
  evaluation: RiskEvaluation
  providerPayload: Record<string, unknown>
}

export async function findRecentRiskAssessment(
  chainId: number,
  tokenAddress: string,
  ttlSeconds: number,
): Promise<RiskAssessment | null> {
  if (ttlSeconds <= 0) return null

  await initializeDataSource()
  const repository = AppDataSource.getRepository(RiskAssessment)

  const cutoff = new Date(Date.now() - ttlSeconds * 1_000)

  const record = await repository
    .createQueryBuilder('ra')
    .where('ra.chain_id = :chainId', { chainId })
    .andWhere('ra.token_address = :tokenAddress', {
      tokenAddress: tokenAddress.toLowerCase(),
    })
    .andWhere('ra.created_at >= :cutoff', { cutoff })
    .orderBy('ra.created_at', 'DESC')
    .limit(1)
    .getOne()

  return record ?? null
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
