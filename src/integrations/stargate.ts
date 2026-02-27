import { env } from '../config/env.js';

const EVM_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;
const STARGATE_NATIVE_EVM_ADDRESS =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const STARGATE_MAX_PAGES = 50;

export const STARGATE_BASE_URL = env.STARGATE_BASE_URL;

export const getTokenIconUrl = (symbol: string) =>
  `https://icons-ckg.pages.dev/stargate-light/tokens/${encodeURIComponent(
    symbol?.toLowerCase(),
  )}.svg`;

export const getChainIconUrl = (chainKey: string) =>
  `https://icons-ckg.pages.dev/stargate-light/networks/${chainKey?.toLowerCase()}.svg`;

type StargateChainMetadata = {
  chainId: number;
  chainKey: string;
  name: string;
  nativeSymbol: string;
  logoUri: string | null;
  rpcUrls: string[];
  explorerUrl: string | null;
  mainnet: boolean;
  chainType: string | null;
};

type StargateTokenMetadata = {
  chainKey: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri: string | null;
};

type StargatePagination = {
  nextToken?: unknown;
};

type StargateChainApi = {
  name?: unknown;
  shortName?: unknown;
  chainKey?: unknown;
  nativeCurrency?: {
    symbol?: unknown;
  } | null;
  chainType?: unknown;
  chainId?: unknown;
};

type StargateTokenApi = {
  isSupported?: unknown;
  chainKey?: unknown;
  address?: unknown;
  decimals?: unknown;
  symbol?: unknown;
  name?: unknown;
  logoUrl?: unknown;
};

export class StargateApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'StargateApiError';
    this.status = status;
  }
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function normalizeChainKeys(chainKeys: string[]) {
  return Array.from(
    new Set(
      chainKeys.map((value) => value.trim().toLowerCase()).filter(Boolean),
    ),
  );
}

function normalizeEvmOrNativeAddress(address: string) {
  const lowered = address.toLowerCase();
  if (lowered === STARGATE_NATIVE_EVM_ADDRESS) return 'native';
  if (!EVM_ADDRESS_REGEX.test(lowered)) return null;
  return lowered;
}

function buildStargateUrl(path: string, searchParams?: URLSearchParams) {
  const baseUrl = STARGATE_BASE_URL.endsWith('/')
    ? STARGATE_BASE_URL
    : `${STARGATE_BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  const url = new URL(normalizedPath, baseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url;
}

async function fetchStargateJson<T>(
  path: string,
  searchParams?: URLSearchParams,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    env.STARGATE_TIMEOUT_SECONDS * 1000,
  );

  try {
    const response = await fetch(buildStargateUrl(path, searchParams), {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallback = `Stargate API request failed (${response.status})`;
      const message = await response.text().catch(() => fallback);
      throw new StargateApiError(message || fallback, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof StargateApiError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new StargateApiError(
        `Stargate API request timed out after ${env.STARGATE_TIMEOUT_SECONDS}s`,
      );
    }

    const message =
      error instanceof Error ? error.message : 'Stargate API request failed';
    throw new StargateApiError(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseChain(chain: StargateChainApi): StargateChainMetadata | null {
  const chainType = toNonEmptyString(chain.chainType)?.toUpperCase();
  if (chainType !== 'EVM') return null;

  const chainId = toFiniteNumber(chain.chainId);
  const chainKey = toNonEmptyString(chain.chainKey)?.toLowerCase();
  const name =
    toNonEmptyString(chain.name) ??
    toNonEmptyString(chain.shortName) ??
    chainKey ??
    null;

  if (!chainId || !chainKey || !name) return null;

  return {
    chainId: Math.trunc(chainId),
    chainKey,
    name,
    nativeSymbol:
      toNonEmptyString(chain.nativeCurrency?.symbol)?.toUpperCase() ?? 'NATIVE',
    logoUri: getChainIconUrl(chainKey),
    rpcUrls: [],
    explorerUrl: null,
    mainnet: true,
    chainType,
  };
}

function parseToken(token: StargateTokenApi): StargateTokenMetadata | null {
  if (token.isSupported === false) return null;

  const chainKey = toNonEmptyString(token.chainKey)?.toLowerCase();
  const address = toNonEmptyString(token.address);
  const symbol = toNonEmptyString(token.symbol);
  const name = toNonEmptyString(token.name);
  const decimals = toFiniteNumber(token.decimals);

  if (!chainKey || !address || !symbol || !name || decimals === null) {
    return null;
  }

  const normalizedAddress = normalizeEvmOrNativeAddress(address);
  if (!normalizedAddress) return null;

  const normalizedDecimals = Math.trunc(decimals);
  if (normalizedDecimals < 0) return null;

  return {
    chainKey,
    address: normalizedAddress,
    symbol,
    name,
    decimals: normalizedDecimals,
    logoUri: toNonEmptyString(token.logoUrl) ?? getTokenIconUrl(symbol),
  };
}

export async function fetchStargateChains() {
  const deduped = new Map<number, StargateChainMetadata>();

  let nextToken: string | null = null;
  let page = 0;
  do {
    const params = new URLSearchParams();
    if (nextToken) {
      params.set('pagination[nextToken]', nextToken);
    }

    const payload = await fetchStargateJson<{
      chains?: StargateChainApi[] | unknown;
      pagination?: StargatePagination;
    }>('/chains', params);

    if (!Array.isArray(payload.chains)) break;

    for (const chain of payload.chains) {
      if (!chain || typeof chain !== 'object') continue;
      const parsed = parseChain(chain as StargateChainApi);
      if (!parsed) continue;
      if (!deduped.has(parsed.chainId)) {
        deduped.set(parsed.chainId, parsed);
      }
    }

    nextToken = toNonEmptyString(payload.pagination?.nextToken);
    page += 1;
  } while (nextToken && page < STARGATE_MAX_PAGES);

  return Array.from(deduped.values());
}

export async function fetchStargateTokensForChainKeys(chainKeys: string[]) {
  const selectedChainKeys = new Set(normalizeChainKeys(chainKeys));
  if (selectedChainKeys.size === 0) {
    return [] as StargateTokenMetadata[];
  }

  const deduped = new Map<string, StargateTokenMetadata>();

  let nextToken: string | null = null;
  let page = 0;
  do {
    const params = new URLSearchParams();
    if (nextToken) {
      params.set('pagination[nextToken]', nextToken);
    }

    const payload = await fetchStargateJson<{
      tokens?: StargateTokenApi[] | unknown;
      pagination?: StargatePagination;
    }>('/tokens', params);

    if (!Array.isArray(payload.tokens)) break;

    for (const token of payload.tokens) {
      if (!token || typeof token !== 'object') continue;
      const parsed = parseToken(token as StargateTokenApi);
      if (!parsed) continue;
      if (!selectedChainKeys.has(parsed.chainKey)) continue;

      const key = `${parsed.chainKey}:${parsed.address}`;
      const existing = deduped.get(key);
      if (!existing || (!existing.logoUri && parsed.logoUri)) {
        deduped.set(key, parsed);
      }
    }

    nextToken = toNonEmptyString(payload.pagination?.nextToken);
    page += 1;
  } while (nextToken && page < STARGATE_MAX_PAGES);

  return Array.from(deduped.values());
}
