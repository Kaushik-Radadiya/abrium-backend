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
  getAccessToken: () => Promise<{
    code: number;
    message: string;
    result?: { access_token: string };
  }>;
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
const TOKEN_SECURITY_BATCH_SIZE = 50;

let sdkConfigured = false;
let sdkConfiguringPromise: Promise<void> | null = null;

const tokenSecurityCache = new Map<
  string,
  { payload: GoPlusRiskPayload; expiresAt: number }
>();

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
}

function normalizeTokenAddresses(tokenAddresses: string[]) {
  return Array.from(
    new Set(
      tokenAddresses
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

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

function getTokenResultsFromResponse(
  data: GoPlusResponse | null,
  normalizedAddresses: string[],
) {
  if (!data || typeof data !== 'object') {
    throw new GoPlusApiError({
      message: 'GoPlus returned an invalid response payload',
    });
  }

  const code = normalizeGoPlusCode(data.code);
  const providerMessage = normalizeGoPlusMessage(data.message);

  if (code !== null && code !== SUCCESS_CODE) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return complete token risk data',
    });
  }

  const results = data.result;
  if (!results || typeof results !== 'object') {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return token risk data',
    });
  }

  const payloadByAddress = new Map<string, GoPlusRiskPayload>();
  for (const address of normalizedAddresses) {
    const payload = results[address] ?? results[address.toLowerCase()] ?? null;
    if (!payload || typeof payload !== 'object') continue;
    payloadByAddress.set(address, payload);
  }

  return payloadByAddress;
}

async function configureSdkIfNeeded() {
  if (!useSdkAuth || sdkConfigured) {
    return;
  }

  if (sdkConfiguringPromise) {
    return sdkConfiguringPromise;
  }

  sdkConfiguringPromise = (async () => {
    try {
      sdkClient.config(appKey, appSecret, env.GOPLUS_TIMEOUT_SECONDS);
      await sdkClient.getAccessToken();
      sdkConfigured = true;
    } catch (e) {
      console.error('Failed to get GoPlus access token:', e);
    } finally {
      sdkConfiguringPromise = null;
    }
  })();

  return sdkConfiguringPromise;
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

async function fetchGoPlusTokenSecurityBatchWithSdk(params: {
  chainId: number;
  tokenAddresses: string[];
}): Promise<Map<string, GoPlusRiskPayload>> {
  const normalizedAddresses = normalizeTokenAddresses(params.tokenAddresses);
  if (normalizedAddresses.length === 0) {
    return new Map<string, GoPlusRiskPayload>();
  }

  const performRequest = async () => {
    await configureSdkIfNeeded();
    const data = await sdkClient.tokenSecurity(
      String(params.chainId),
      normalizedAddresses,
      env.GOPLUS_TIMEOUT_SECONDS,
    );

    return getTokenResultsFromResponse(data, normalizedAddresses);
  };

  try {
    return await performRequest();
  } catch (error) {
    if (
      useSdkAuth &&
      error instanceof GoPlusApiError &&
      error.code !== null &&
      [4011, 4012, 4022, 4023].includes(error.code)
    ) {
      sdkConfigured = false;
      return await performRequest();
    }
    throw error;
  }
}

export async function fetchGoPlusTokenSecurityBatch(params: {
  chainId: number;
  tokenAddresses: string[];
  bypassCache?: boolean;
}): Promise<Map<string, GoPlusRiskPayload>> {
  const normalizedAddresses = normalizeTokenAddresses(params.tokenAddresses);
  const payloadByAddress = new Map<string, GoPlusRiskPayload>();
  if (normalizedAddresses.length === 0) {
    return payloadByAddress;
  }

  const addressesToFetch: string[] = [];
  for (const address of normalizedAddresses) {
    const cacheKey = buildTokenSecurityCacheKey(params.chainId, address);
    const cachedPayload = params.bypassCache
      ? null
      : getCachedTokenSecurity(cacheKey);
    if (cachedPayload) {
      payloadByAddress.set(address, cachedPayload);
    } else {
      addressesToFetch.push(address);
    }
  }

  const batches = chunkItems(addressesToFetch, TOKEN_SECURITY_BATCH_SIZE);
  for (const batch of batches) {
    const fetched = await fetchGoPlusTokenSecurityBatchWithSdk({
      chainId: params.chainId,
      tokenAddresses: batch,
    });

    for (const [address, payload] of fetched.entries()) {
      payloadByAddress.set(address, payload);
      setCachedTokenSecurity(
        buildTokenSecurityCacheKey(params.chainId, address),
        payload,
      );
    }
  }

  return payloadByAddress;
}
