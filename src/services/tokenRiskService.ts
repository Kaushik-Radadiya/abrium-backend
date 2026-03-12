import { AppDataSource, initializeDataSource } from '../db/dataSource.js'
import { fetchGoPlusTokenSecurityBatch } from '../integrations/goPlus.js'
import { evaluateGoPlusRisk, toAbriumTokenSecurity } from './riskPolicyEngine.js'
import {
  findLatestRiskAssessmentsByTokens,
  persistRiskAssessments,
} from '../repositories/riskAssessmentRepository.js'
import type { RiskEvaluation } from '../types/security.js'

const TOKEN_RISK_TTL_SECONDS = 24 * 60 * 60

function isCacheFresh(createdAt: Date, ttlSeconds: number) {
  if (ttlSeconds <= 0) return false
  return Date.now() - createdAt.getTime() <= ttlSeconds * 1000
}

function providerUnavailableEvaluation(): RiskEvaluation {
  return {
    decision: 'WARN',
    securityLevel: 'caution',
    criticalFlags: [],
    reasons: ['Security provider is temporarily unavailable.'],
    badges: [
      {
        id: 'provider_unavailable',
        label: 'Provider Unavailable',
        detail: 'Security provider is temporarily unavailable.',
        level: 'warning',
      },
    ],
  }
}

async function upsertCatalogTokenSecurity(params: {
  chainId: number
  tokenAddress: string
  evaluation: RiskEvaluation
  providerPayload: Record<string, unknown>
  securityUpdatedAt: Date
}) {
  const { securityLevel } = toAbriumTokenSecurity(params.evaluation)
  const badges = params.evaluation.badges

  const name =
    typeof params.providerPayload.token_name === 'string' &&
    params.providerPayload.token_name.trim()
      ? params.providerPayload.token_name.trim()
      : 'Unknown'
  const symbol =
    typeof params.providerPayload.token_symbol === 'string' &&
    params.providerPayload.token_symbol.trim()
      ? params.providerPayload.token_symbol.trim()
      : params.tokenAddress.slice(0, 6).toUpperCase()

  await AppDataSource.query(
    `INSERT INTO catalog_tokens
       (chain_id, address, name, symbol, decimals, security_level, security_badges, security_updated_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
     ON CONFLICT (chain_id, address) DO UPDATE SET
       security_level      = EXCLUDED.security_level,
       security_badges     = EXCLUDED.security_badges,
       security_updated_at = EXCLUDED.security_updated_at,
       updated_at          = NOW()`,
    [
      params.chainId,
      params.tokenAddress,
      name,
      symbol,
      18,
      securityLevel,
      JSON.stringify(badges),
      params.securityUpdatedAt,
    ],
  )
}

export async function assessTokenRisk(params: {
  chainId: number
  tokenAddress: string
}): Promise<RiskEvaluation> {
  await initializeDataSource()
  const normalizedAddress = params.tokenAddress.trim().toLowerCase()

  const latestByAddress = await findLatestRiskAssessmentsByTokens(
    params.chainId,
    [normalizedAddress],
  )
  const latestAssessment = latestByAddress.get(normalizedAddress) ?? null

  if (latestAssessment) {
    const cachedEvaluation = evaluateGoPlusRisk(
      latestAssessment.providerPayload as Record<string, unknown>,
    )
    const isHighRisk = cachedEvaluation.decision === 'BLOCK'
    if (!isHighRisk && isCacheFresh(latestAssessment.createdAt, TOKEN_RISK_TTL_SECONDS)) {
      return cachedEvaluation
    }
  }

  let payloadByAddress: Map<string, Record<string, unknown>>
  try {
    payloadByAddress = await fetchGoPlusTokenSecurityBatch({
      chainId: params.chainId,
      tokenAddresses: [normalizedAddress],
      bypassCache: true,
    })
  } catch {
    if (latestAssessment) {
      return evaluateGoPlusRisk(
        latestAssessment.providerPayload as Record<string, unknown>,
      )
    }
    return providerUnavailableEvaluation()
  }

  const payload = payloadByAddress.get(normalizedAddress)
  if (!payload) {
    if (latestAssessment) {
      return evaluateGoPlusRisk(
        latestAssessment.providerPayload as Record<string, unknown>,
      )
    }
    return providerUnavailableEvaluation()
  }

  const evaluation = evaluateGoPlusRisk(payload)
  const fetchedAt = new Date()

  const isHighRisk = evaluation.decision === 'BLOCK'
  if (!isHighRisk) {
    await persistRiskAssessments([
      {
        chainId: params.chainId,
        tokenAddress: normalizedAddress,
        evaluation,
        providerPayload: payload,
      },
    ])
  }

  await upsertCatalogTokenSecurity({
    chainId: params.chainId,
    tokenAddress: normalizedAddress,
    evaluation,
    providerPayload: payload,
    securityUpdatedAt: fetchedAt,
  })

  return evaluation
}
