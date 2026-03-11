import type { Request, Response } from 'express'
import { z } from 'zod'
import { getUserInfoByWalletAddress } from '../services/userService.js'
import { errorResponse, failResponse, successResponse } from '../utils/response.js'

const getUserInfoQuerySchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a valid EVM address'),
})

export async function getUserInfo(req: Request, res: Response) {
  try {
    const query = getUserInfoQuerySchema.parse(req.query)
    const userInfo = await getUserInfoByWalletAddress(query.walletAddress)

    if (!userInfo) {
      return failResponse(res, 'User not found for the provided walletAddress', 404)
    }

    return successResponse(res, 'User info fetched successfully', 200, userInfo)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failResponse(res, error.issues[0]?.message ?? 'Invalid query', 400)
    }

    const message =
      error instanceof Error ? error.message : 'Failed to fetch user info'
    return errorResponse(res, message, 500)
  }
}
