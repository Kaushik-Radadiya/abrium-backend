import { Router } from 'express'
import { z } from 'zod'
import { assessTokenRisk } from '../services/tokenRiskService.js'
import { errorResponse, successResponse } from '../utils/response.js'

const TOKEN_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

const tokenRiskQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  tokenAddress: z.string().regex(TOKEN_ADDRESS_REGEX),
})

export const riskRouter = Router()

riskRouter.get('/token', async (req, res) => {
  const queryParams = tokenRiskQuerySchema.parse(req.query)

  try {
    const evaluation = await assessTokenRisk({
      chainId: queryParams.chainId,
      tokenAddress: queryParams.tokenAddress,
    })

    return successResponse(res, 'Token risk fetched successfully', 200, {
      decision: evaluation.decision,
      score: evaluation.score,
      flags: evaluation.flags,
      criticalFlags: evaluation.criticalFlags,
      warningFlags: evaluation.warningFlags,
      trustSignals: evaluation.trustSignals,
      reasons: evaluation.reasons,
      badges: evaluation.badges,
      metrics: evaluation.metrics,
      alertLevel: evaluation.alertLevel,
      alertTitle: evaluation.alertTitle,
      alertMessage: evaluation.alertMessage,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Risk lookup failed'
    return errorResponse(res, message, 502)
  }
})
