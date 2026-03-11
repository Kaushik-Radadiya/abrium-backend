import { env } from '../config/env.js';

type CoinGeckoAssetPlatformApi = {
  id?: unknown;
  chain_identifier?: unknown;
  name?: unknown;
  image?: unknown;
  native_coin_id?: unknown;
};

export type CoinGeckoChainMetadata = {
  chainId: number;
  coingeckoId: string;
  name: string;
  logoUri: string | null;
  nativeCoinId: string | null;
};

export class CoinGeckoApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'CoinGeckoApiError';
    this.status = status;
  }
}

type CoinGeckoTokenListApi = {
  status?: {
    error_code?: unknown;
    error_message?: unknown;
  } | null;
  tokens?: unknown;
};

type CoinGeckoTokenListTokenApi = {
  address?: unknown;
  symbol?: unknown;
  name?: unknown;
  decimals?: unknown;
  logoURI?: unknown;
};

type CoinGeckoCoinsListApi = {
  id?: unknown;
  platforms?: Record<string, unknown> | null;
};

type CoinGeckoCoinsMarketApi = {
  id?: unknown;
  current_price?: unknown;
  total_volume?: unknown;
  price_change_percentage_1h_in_currency?: unknown;
  price_change_percentage_24h_in_currency?: unknown;
  price_change_percentage_7d_in_currency?: unknown;
};

export type CoinGeckoTokenMetadata = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri: string | null;
};

export type CoinGeckoTokenMarketSnapshot = {
  coingeckoCoinId: string;
  priceUsd: number | null;
  priceChange1hPercent: number | null;
  priceChange24hPercent: number | null;
  priceChange7dPercent: number | null;
  volume24hUsd: number | null;
};

const EVM_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;
const COINS_MARKET_BATCH_SIZE = 100;
const COINS_MARKET_CONCURRENCY = 4;
const CHAIN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let chainsCache:
  | { expiresAt: number; value: CoinGeckoChainMetadata[] }
  | null = null;

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

function toFiniteFloat(value: unknown) {
  const num = toFiniteNumber(value);
  if (num === null) return null;
  return num;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function buildCoinGeckoUrl(path: string, searchParams?: URLSearchParams) {
  const baseUrl = env.COINGECKO_BASE_URL.endsWith('/')
    ? env.COINGECKO_BASE_URL
    : `${env.COINGECKO_BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  const url = new URL(normalizedPath, baseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url;
}

function buildCoinGeckoHeaders(): HeadersInit {
  const headers: HeadersInit = { accept: 'application/json' };
  const apiKey = env.COINGECKO_API_KEY?.trim();
  if (!apiKey) {
    return headers;
  }

  const isProApi = new URL(env.COINGECKO_BASE_URL).hostname
    .toLowerCase()
    .includes('pro-api.coingecko.com');
  headers[isProApi ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = apiKey;
  return headers;
}

const COINGECKO_HEADERS = buildCoinGeckoHeaders();

async function fetchCoinGeckoJson<T>(
  path: string,
  searchParams?: URLSearchParams,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    env.COINGECKO_TIMEOUT_SECONDS * 1000,
  );

  try {
    const response = await fetch(buildCoinGeckoUrl(path, searchParams), {
      method: 'GET',
      signal: controller.signal,
      headers: COINGECKO_HEADERS,
    });
    if (!response.ok) {
      const fallback = `CoinGecko API request failed (${response.status})`;
      const message = await response.text().catch(() => fallback);
      throw new CoinGeckoApiError(message || fallback, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof CoinGeckoApiError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new CoinGeckoApiError(
        `CoinGecko API request timed out after ${env.COINGECKO_TIMEOUT_SECONDS}s`,
      );
    }

    const message =
      error instanceof Error ? error.message : 'CoinGecko API request failed';
    throw new CoinGeckoApiError(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseChain(
  platform: CoinGeckoAssetPlatformApi,
): CoinGeckoChainMetadata | null {
  const chainId = toFiniteNumber(platform.chain_identifier);
  const coingeckoId = toNonEmptyString(platform.id)?.toLowerCase();
  const name = toNonEmptyString(platform.name);
  if (!chainId || !coingeckoId || !name) return null;

  const normalizedChainId = Math.trunc(chainId);
  if (normalizedChainId <= 0) return null;

  return {
    chainId: normalizedChainId,
    coingeckoId,
    name,
    logoUri: toNonEmptyString(platform.image),
    nativeCoinId:
      toNonEmptyString(platform.native_coin_id)?.toLowerCase() ?? null,
  };
}

export async function fetchCoinGeckoChains() {
  if (chainsCache && chainsCache.expiresAt > Date.now()) {
    return chainsCache.value;
  }

  const payload = await fetchCoinGeckoJson<unknown>('/asset_platforms');
  if (!Array.isArray(payload)) {
    throw new CoinGeckoApiError(
      'CoinGecko asset platforms response is invalid',
    );
  }

  const deduped = new Map<number, CoinGeckoChainMetadata>();
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const parsed = parseChain(entry as CoinGeckoAssetPlatformApi);
    if (!parsed) continue;
    if (!deduped.has(parsed.chainId)) {
      deduped.set(parsed.chainId, parsed);
    }
  }

  const chains = Array.from(deduped.values());
  chainsCache = {
    expiresAt: Date.now() + CHAIN_CACHE_TTL_MS,
    value: chains,
  };
  return chains;
}

function normalizeEvmAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  if (!EVM_ADDRESS_REGEX.test(normalized)) return null;
  return normalized;
}

function parseTokenListToken(
  token: CoinGeckoTokenListTokenApi,
): CoinGeckoTokenMetadata | null {
  const address = toNonEmptyString(token.address);
  const symbol = toNonEmptyString(token.symbol);
  const name = toNonEmptyString(token.name);
  const decimals = toFiniteNumber(token.decimals);
  if (!address || !symbol || !name || decimals === null) return null;

  const normalizedAddress = normalizeEvmAddress(address);
  if (!normalizedAddress) return null;

  const normalizedDecimals = Math.trunc(decimals);
  if (normalizedDecimals < 0) return null;

  return {
    address: normalizedAddress,
    symbol,
    name,
    decimals: normalizedDecimals,
    logoUri: toNonEmptyString(token.logoURI),
  };
}

export async function fetchCoinGeckoTokensForPlatformId(platformId: string) {
  const normalizedPlatformId = platformId.trim().toLowerCase();
  if (!normalizedPlatformId) return [] as CoinGeckoTokenMetadata[];

  const payload = await fetchCoinGeckoJson<CoinGeckoTokenListApi>(
    `/token_lists/${encodeURIComponent(normalizedPlatformId)}/all.json`,
  );

  const errorCode = toFiniteNumber(payload.status?.error_code);
  if (errorCode) {
    const message =
      toNonEmptyString(payload.status?.error_message) ??
      'CoinGecko token list request failed';
    throw new CoinGeckoApiError(message, 502);
  }

  if (!Array.isArray(payload.tokens)) {
    throw new CoinGeckoApiError(
      'CoinGecko token list response is invalid',
      502,
    );
  }

  const deduped = new Map<string, CoinGeckoTokenMetadata>();
  for (const entry of payload.tokens) {
    if (!entry || typeof entry !== 'object') continue;
    const parsed = parseTokenListToken(entry as CoinGeckoTokenListTokenApi);
    if (!parsed) continue;
    if (!deduped.has(parsed.address)) {
      deduped.set(parsed.address, parsed);
    }
  }

  return Array.from(deduped.values());
}

export async function fetchCoinGeckoCoinIdsByContracts(
  platformId: string,
  contractAddresses: string[],
) {
  const normalizedPlatformId = platformId.trim().toLowerCase();
  const trackedAddresses = new Set(
    contractAddresses
      .map((address) => normalizeEvmAddress(address))
      .filter((address): address is string => Boolean(address)),
  );
  const byAddress = new Map<string, string>();
  if (!normalizedPlatformId || trackedAddresses.size === 0) {
    return byAddress;
  }

  const params = new URLSearchParams({ include_platform: 'true' });
  const payload = await fetchCoinGeckoJson<unknown>('/coins/list', params);
  if (!Array.isArray(payload)) return byAddress;

  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as CoinGeckoCoinsListApi;
    const coinId = toNonEmptyString(row.id)?.toLowerCase();
    if (!coinId) continue;

    const rawAddress = row.platforms?.[normalizedPlatformId];
    const normalizedAddress =
      typeof rawAddress === 'string' ? normalizeEvmAddress(rawAddress) : null;
    if (!normalizedAddress) continue;
    if (!trackedAddresses.has(normalizedAddress)) continue;
    if (!byAddress.has(normalizedAddress)) {
      byAddress.set(normalizedAddress, coinId);
    }
    if (byAddress.size >= trackedAddresses.size) break;
  }

  return byAddress;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
}

function parseCoinsMarket(
  row: CoinGeckoCoinsMarketApi,
): CoinGeckoTokenMarketSnapshot | null {
  const coingeckoCoinId = toNonEmptyString(row.id)?.toLowerCase();
  if (!coingeckoCoinId) return null;

  return {
    coingeckoCoinId,
    priceUsd: toFiniteFloat(row.current_price),
    priceChange1hPercent: toFiniteFloat(
      row.price_change_percentage_1h_in_currency,
    ),
    priceChange24hPercent: toFiniteFloat(
      row.price_change_percentage_24h_in_currency,
    ),
    priceChange7dPercent: toFiniteFloat(
      row.price_change_percentage_7d_in_currency,
    ),
    volume24hUsd: toFiniteFloat(row.total_volume),
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  if (safeConcurrency === 0) return [] as TOutput[];

  const results: TOutput[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await mapper(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function fetchCoinGeckoTokenMarketsBatch(
  coinIds: string[],
): Promise<CoinGeckoTokenMarketSnapshot[]> {
  if (coinIds.length === 0) return [] as CoinGeckoTokenMarketSnapshot[];

  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: coinIds.join(','),
    per_page: String(coinIds.length),
    page: '1',
    sparkline: 'false',
    price_change_percentage: '1h,24h,7d',
  });

  try {
    const payload = await fetchCoinGeckoJson<unknown>('/coins/markets', params);
    if (!Array.isArray(payload)) return [] as CoinGeckoTokenMarketSnapshot[];

    const snapshots: CoinGeckoTokenMarketSnapshot[] = [];
    for (const entry of payload) {
      if (!entry || typeof entry !== 'object') continue;
      const parsed = parseCoinsMarket(entry as CoinGeckoCoinsMarketApi);
      if (!parsed) continue;
      snapshots.push(parsed);
    }
    return snapshots;
  } catch (error) {
    if (
      error instanceof CoinGeckoApiError &&
      error.status === 400 &&
      coinIds.length > 1
    ) {
      const middle = Math.floor(coinIds.length / 2);
      const [left, right] = await Promise.all([
        fetchCoinGeckoTokenMarketsBatch(coinIds.slice(0, middle)),
        fetchCoinGeckoTokenMarketsBatch(coinIds.slice(middle)),
      ]);
      return [...left, ...right];
    }

    if (
      error instanceof CoinGeckoApiError &&
      error.status === 400 &&
      coinIds.length === 1
    ) {
      return [] as CoinGeckoTokenMarketSnapshot[];
    }

    throw error;
  }
}

export async function fetchCoinGeckoTokenMarketsByCoinIds(coinIds: string[]) {
  const normalizedCoinIds = Array.from(
    new Set(coinIds.map((id) => id.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalizedCoinIds.length === 0) {
    return new Map<string, CoinGeckoTokenMarketSnapshot>();
  }

  const markets = new Map<string, CoinGeckoTokenMarketSnapshot>();
  const batches = chunkItems(normalizedCoinIds, COINS_MARKET_BATCH_SIZE);
  const snapshotsByBatch: CoinGeckoTokenMarketSnapshot[][] =
    await mapWithConcurrency(
      batches,
      COINS_MARKET_CONCURRENCY,
      (batch) => fetchCoinGeckoTokenMarketsBatch(batch),
    );

  for (const snapshots of snapshotsByBatch) {
    for (const snapshot of snapshots) {
      markets.set(snapshot.coingeckoCoinId, snapshot);
    }
  }

  return markets;
}
