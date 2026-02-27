import {
  fetchGoPlusTokenSecurity,
  GoPlusApiError,
} from '../integrations/goPlus.js'
import type { RiskEvaluation } from '../types/security.js'
import { evaluateGoPlusRisk } from './riskPolicyEngine.js'
import {
  findRecentRiskAssessment,
  persistRiskAssessment,
} from '../repositories/riskAssessmentRepository.js'
import { env } from '../config/env.js'

function buildProviderUnavailableEvaluation(
  chainId: number,
  tokenAddress: string,
  detail: string,
  providerMessage: string | null,
): RiskEvaluation {
  const normalizedProviderMessage =
    typeof providerMessage === 'string' && providerMessage.trim()
      ? providerMessage.trim()
      : null

  return {
    decision: 'WARN',
    score: 50,
    flags: ['provider_unavailable'],
    criticalFlags: [],
    warningFlags: ['provider_unavailable'],
    trustSignals: [],
    reasons: [detail],
    badges: [
      {
        id: 'provider_unavailable',
        label: 'Risk Provider Unavailable',
        detail,
        level: 'warning',
      },
    ],
    metrics: {
      buyTaxPercent: null,
      sellTaxPercent: null,
      maxDexLiquidityUsd: null,
      ownershipAbandoned: false,
    },
    alertLevel: 'warning',
    alertTitle: 'Risk data unavailable',
    alertMessage:
      normalizedProviderMessage ??
      'Could not fetch token risk data from provider. Proceed with caution.',
  }
}

export async function assessTokenRisk(input: {
  chainId: number
  tokenAddress: string
}) {
  const ttlSeconds = env.GOPLUS_TOKEN_SECURITY_CACHE_TTL_SECONDS
  const recent = await findRecentRiskAssessment(
    input.chainId,
    input.tokenAddress,
    ttlSeconds,
  )

  if (recent) {
    // eslint-disable-next-line no-console
    console.log('Token risk served from DB cache', {
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      cachedAt: recent.createdAt,
    })
    return evaluateGoPlusRisk(recent.providerPayload as Record<string, unknown>)
  }

  let providerPayload: Record<string, unknown> = {}
  let evaluation: RiskEvaluation

  try {
    providerPayload = await fetchGoPlusTokenSecurity({
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
    })
    evaluation = evaluateGoPlusRisk(providerPayload)
  } catch (error) {
    const providerError =
      error instanceof Error ? error.message : 'Risk provider unavailable'
    const providerCode = error instanceof GoPlusApiError ? error.code : null
    const providerMessage =
      error instanceof GoPlusApiError ? error.providerMessage : null
    const detail = `GoPlus unavailable for chain ${input.chainId} token ${input.tokenAddress.toLowerCase()}: ${providerError}`

    // eslint-disable-next-line no-console
    console.warn('Risk provider unavailable; falling back to WARN evaluation', {
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      providerError,
      providerCode,
      providerMessage,
    })

    providerPayload = {
      provider: 'goplus',
      unavailable: true,
      error: providerError,
      code: providerCode,
      message: providerMessage,
    }
    evaluation = buildProviderUnavailableEvaluation(
      input.chainId,
      input.tokenAddress,
      detail,
      providerMessage,
    )
  }

  await persistRiskAssessment({
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    evaluation,
    providerPayload,
  })

  return evaluation
}
