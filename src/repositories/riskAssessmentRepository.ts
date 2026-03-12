import { AppDataSource, initializeDataSource } from '../db/dataSource.js'
import { RiskAssessment } from '../entities/RiskAssessment.js'
import type { RiskEvaluation } from '../types/security.js'

type PersistRiskAssessmentInput = {
  chainId: number
  tokenAddress: string
  evaluation: RiskEvaluation
  providerPayload: Record<string, unknown>
}

function normalizeTokenAddresses(tokenAddresses: string[]) {
  return Array.from(
    new Set(tokenAddresses.map((tokenAddress) => tokenAddress.toLowerCase())),
  )
}

export async function findLatestRiskAssessmentsByTokens(
  chainId: number,
  tokenAddresses: string[],
) {
  const normalizedTokenAddresses = normalizeTokenAddresses(tokenAddresses).filter(
    Boolean,
  )
  if (normalizedTokenAddresses.length === 0) {
    return new Map<string, RiskAssessment>()
  }

  await initializeDataSource()
  const repository = AppDataSource.getRepository(RiskAssessment)

  const rows = await repository
    .createQueryBuilder('ra')
    .distinctOn(['ra.token_address'])
    .where('ra.chain_id = :chainId', { chainId })
    .andWhere('ra.token_address in (:...tokenAddresses)', {
      tokenAddresses: normalizedTokenAddresses,
    })
    .orderBy('ra.token_address', 'ASC')
    .addOrderBy('ra.created_at', 'DESC')
    .getMany()

  return new Map(
    rows.map((row) => [row.tokenAddress.toLowerCase(), row] as const),
  )
}

export async function persistRiskAssessments(
  inputs: PersistRiskAssessmentInput[],
) {
  if (inputs.length === 0) return

  await initializeDataSource()
  const repository = AppDataSource.getRepository(RiskAssessment)

  await repository.insert(
    inputs.map((input) => ({
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      decision: input.evaluation.decision,
      flags: input.evaluation.criticalFlags,
      reasons: input.evaluation.reasons,
      badges: [],
      providerPayload: input.providerPayload,
    })),
  )
}
