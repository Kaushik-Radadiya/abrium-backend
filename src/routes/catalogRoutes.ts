import { Router } from 'express';
import { z } from 'zod';
import {
  getCatalogChains,
  getCatalogTokens,
} from '../services/catalogService.js';
import { errorResponse, successResponse } from '../utils/response.js';

const tokensQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
});

export const catalogRouter = Router();

function isForceRefresh(queryValue: unknown) {
  if (typeof queryValue !== 'string') return false;
  const value = queryValue.trim().toLowerCase();
  return value === '1' || value === 'true';
}

function resolveStatusCode(error: unknown, fallback = 502) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  return fallback;
}

catalogRouter.get('/chains', async (req, res) => {
  const forceRefresh = isForceRefresh(req.query.refresh);

  try {
    const chains = await getCatalogChains({ forceRefresh });
    return successResponse(
      res,
      'Catalog chains fetched successfully',
      200,
      chains,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Catalog chains lookup failed';
    return errorResponse(res, message, resolveStatusCode(error));
  }
});

catalogRouter.get('/tokens', async (req, res) => {
  try {
    const forceRefresh = isForceRefresh(req.query.refresh);

    const queryParams = tokensQuerySchema.parse(req.query);
    const tokens = await getCatalogTokens({
      chainId: queryParams.chainId,
      forceRefresh,
    });
    return successResponse(
      res,
      'Catalog tokens fetched successfully',
      200,
      tokens,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Catalog tokens lookup failed';
    return errorResponse(res, message, resolveStatusCode(error));
  }
});
