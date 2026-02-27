import { createRequire } from 'node:module';
import { env } from '../config/env.js';

type GoPlusRiskPayload = Record<string, unknown>;

type GoPlusResponse = {
  code?: number | string;
  message?: string;
  result?: Record<string, GoPlusRiskPayload> | null;
};

type GoPlusSdkClient = {
  config: (appKey: string, appSecret: string, timeout?: number) => void;
  tokenSecurity: (
    chainId: string,
    addresses: string[],
    timeout?: number,
  ) => Promise<GoPlusResponse>;
};

const require = createRequire(import.meta.url);
const { ErrorCode, GoPlus } = require('@goplus/sdk-node') as {
  ErrorCode: Record<string, unknown>;
  GoPlus: GoPlusSdkClient;
};

const GOPLUS_CODE_MESSAGES: Record<number, string> = {
  1: 'Complete data prepared',
  2: 'Partial data obtained. Retry in about 15 seconds for full data.',
  2004: 'Contract address format error',
  2018: 'ChainID not supported',
  2020: 'Non-contract address',
  2021: 'No info for this contract',
  2022: 'Non-supported chainId',
  2026: 'dApp not found',
  2027: 'ABI not found',
  2028: 'ABI does not support parsing',
  4010: 'App key not found',
  4022: 'Invalid access token',
  4011: 'Signature expired or replayed request',
  4012: 'Wrong signature',
  4023: 'Access token not found',
  4029: 'Request limit reached',
  5000: 'System error',
  5006: 'Parameter error',
};

const sdkClient = GoPlus;
const sdkErrorCode = ErrorCode;
const SUCCESS_CODE = normalizeGoPlusCode(sdkErrorCode.SUCCESS) ?? 1;
const appKey = env.GOPLUS_APP_KEY?.trim() ?? '';
const appSecret = env.GOPLUS_APP_SECRET?.trim() ?? '';
const useSdkAuth = appKey.length > 0 && appSecret.length > 0;
const tokenSecurityCacheTtlMs =
  env.GOPLUS_TOKEN_SECURITY_CACHE_TTL_SECONDS * 1_000;
const tokenSecurityCacheMaxEntries =
  env.GOPLUS_TOKEN_SECURITY_CACHE_MAX_ENTRIES;

let sdkConfigured = false;
const tokenSecurityCache = new Map<
  string,
  { payload: GoPlusRiskPayload; expiresAt: number }
>();
const inFlightTokenSecurityRequests = new Map<
  string,
  Promise<GoPlusRiskPayload>
>();

function normalizeGoPlusCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getGoPlusKnownMessage(code: number) {
  return GOPLUS_CODE_MESSAGES[code] ?? null;
}

function normalizeGoPlusMessage(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class GoPlusApiError extends Error {
  code: number | null;
  providerMessage: string | null;

  constructor(params: {
    message: string;
    code?: number | null;
    providerMessage?: string | null;
  }) {
    super(params.message);
    this.name = 'GoPlusApiError';
    this.code = params.code ?? null;
    this.providerMessage = params.providerMessage ?? null;
  }
}

function buildGoPlusError(input: {
  code: number | null;
  providerMessage: string | null;
  fallback: string;
}) {
  const knownMessage =
    input.code === null ? null : getGoPlusKnownMessage(input.code);
  const providerMessage = input.providerMessage ?? knownMessage;
  const message =
    input.code === null
      ? (providerMessage ?? input.fallback)
      : `GoPlus error ${input.code}: ${providerMessage ?? input.fallback}`;

  return new GoPlusApiError({
    message,
    code: input.code,
    providerMessage,
  });
}

function getTokenResultFromResponse(
  data: GoPlusResponse | null,
  addresses: { normalized: string; original: string },
) {
  if (!data || typeof data !== 'object') {
    throw new GoPlusApiError({
      message: 'GoPlus returned an invalid response payload',
    });
  }

  const code = normalizeGoPlusCode(data.code);
  const providerMessage = normalizeGoPlusMessage(data.message);

  // 1 = complete payload. 2 = partial payload; avoid trusting partial risk output.
  if (code !== null && code !== SUCCESS_CODE) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return complete token risk data',
    });
  }

  const result =
    data.result?.[addresses.normalized] ??
    data.result?.[addresses.original] ??
    null;

  if (!result) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return token risk data',
    });
  }

  return result;
}

function configureSdkIfNeeded() {
  if (!useSdkAuth || sdkConfigured) {
    return;
  }
  console.log('Configuring GoPlus SDK with provided credentials', {
    appKey: appKey
      ? `${appKey.substring(0, 2)}***${appKey.substring(appKey.length - 2)}`
      : '(not set)',
    appSecret: appSecret
      ? `${appSecret.substring(0, 2)}***${appSecret.substring(appSecret.length - 2)}`
      : '(not set)',
  });
  sdkClient.config(appKey, appSecret, env.GOPLUS_TIMEOUT_SECONDS);
  sdkConfigured = true;
}

function buildTokenSecurityCacheKey(chainId: number, tokenAddress: string) {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

function getCachedTokenSecurity(cacheKey: string) {
  if (tokenSecurityCacheTtlMs <= 0) {
    return null;
  }

  const entry = tokenSecurityCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    tokenSecurityCache.delete(cacheKey);
    return null;
  }

  tokenSecurityCache.delete(cacheKey);
  tokenSecurityCache.set(cacheKey, entry);
  return entry.payload;
}

function setCachedTokenSecurity(cacheKey: string, payload: GoPlusRiskPayload) {
  if (tokenSecurityCacheTtlMs <= 0) {
    return;
  }

  tokenSecurityCache.delete(cacheKey);
  tokenSecurityCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + tokenSecurityCacheTtlMs,
  });

  while (tokenSecurityCache.size > tokenSecurityCacheMaxEntries) {
    const oldestKey = tokenSecurityCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    tokenSecurityCache.delete(oldestKey);
  }
}

async function fetchGoPlusTokenSecurityWithSdk(params: {
  chainId: number;
  tokenAddress: string;
}): Promise<GoPlusRiskPayload> {
  const normalizedAddress = params.tokenAddress.toLowerCase();
  configureSdkIfNeeded();
  const data = await sdkClient.tokenSecurity(
    String(params.chainId),
    [normalizedAddress],
    env.GOPLUS_TIMEOUT_SECONDS,
  );
  console.log('GoPlus SDK response:', {
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    data,
  });

  return getTokenResultFromResponse(data, {
    normalized: normalizedAddress,
    original: params.tokenAddress,
  });
}

export async function fetchGoPlusTokenSecurity(params: {
  chainId: number;
  tokenAddress: string;
}): Promise<GoPlusRiskPayload> {
  const cacheKey = buildTokenSecurityCacheKey(
    params.chainId,
    params.tokenAddress,
  );
  const cachedPayload = getCachedTokenSecurity(cacheKey);
  if (cachedPayload) {
    return cachedPayload;
  }

  const inFlightRequest = inFlightTokenSecurityRequests.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    const payload = await fetchGoPlusTokenSecurityWithSdk(params);
    setCachedTokenSecurity(cacheKey, payload);
    return payload;
  })();

  inFlightTokenSecurityRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightTokenSecurityRequests.delete(cacheKey);
  }
}
