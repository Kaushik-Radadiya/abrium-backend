import { env } from '../config/env.js';
import { getChainConfig } from '../config/goPlusChains.js';

type DefiLlamaPoolApi = {
  pool?: unknown;
  project?: unknown;
  apy?: unknown;
  tvlUsd?: unknown;
  underlyingTokens?: unknown;
};

/**
 * Lending/single-asset deposit protocols that give accurate per-token supply APY.
 * Pools from these protocols are strongly preferred over LP/farming pools.
 */
const LENDING_PROTOCOLS = new Set([
  'aave-v3',
  'aave-v2',
  'aave-v1',
  'compound-v3',
  'compound-v2',
  'morpho-blue',
  'morpho-aave-v3',
  'morpho-aave-v2',
  'morpho-compound-v3',
  'morpho-compound-v2',
  'spark',
  'euler',
  'euler-v2',
  'silo-finance',
  'silo-v2',
  'radiant-v2',
  'benqi',
  'venus',
  'fluid',
  'ironbank',
  'seamless-protocol',
  'moonwell',
  'exactly',
  'agave',
  'granary',
  'geist',
  'fraxlend',
  'tender',
  'blue-chip',
  'zerolend',
  'yldr',
  'ionic-protocol',
  'layerbank',
]);

/**
 * Score a pool for APY accuracy.
 * Higher score = more accurate representation of a token's yield.
 *
 * Scoring tiers (additive):
 *  +100_000  pool belongs to a known lending/single-asset protocol
 *  +  1_000  pool has exactly one underlying token (pure single-asset deposit)
 *  +    tvl  tiebreaker within the same tier
 */
function scorePool(pool: DefiLlamaPoolApi): number {
  const project = toNonEmptyString(pool.project)?.toLowerCase() ?? '';
  const isLending = LENDING_PROTOCOLS.has(project);
  const underlyingCount = Array.isArray(pool.underlyingTokens)
    ? pool.underlyingTokens.length
    : 0;
  const isSingleAsset = underlyingCount === 1;
  const tvl = toFiniteNumber(pool.tvlUsd) ?? 0;

  return (isLending ? 100_000 : 0) + (isSingleAsset ? 1_000 : 0) + tvl;
}

type DefiLlamaPoolsResponse = {
  status?: unknown;
  data?: unknown;
};

export type DefiLlamaTokenApy = {
  apy: number | null;
  apyPoolId: string | null;
};

const EVM_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;

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

function normalizeEvmAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  if (!EVM_ADDRESS_REGEX.test(normalized)) return null;
  return normalized;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function fetchDefiLlamaPoolsByChain(chainName: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    env.DEFI_LLAMA_TIMEOUT_SECONDS * 1000,
  );

  try {
    const baseUrl = env.DEFI_LLAMA_BASE_URL.endsWith('/')
      ? env.DEFI_LLAMA_BASE_URL
      : `${env.DEFI_LLAMA_BASE_URL}/`;
    const url = new URL('pools', baseUrl);
    url.search = new URLSearchParams({ chain: chainName }).toString();

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`DefiLlama request failed (${response.status})`);
    }

    const payload = (await response.json()) as DefiLlamaPoolsResponse;
    if (!Array.isArray(payload.data)) {
      return [] as DefiLlamaPoolApi[];
    }
    return payload.data as DefiLlamaPoolApi[];
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `DefiLlama request timed out after ${env.DEFI_LLAMA_TIMEOUT_SECONDS}s`,
      );
    }
    const message =
      error instanceof Error ? error.message : 'DefiLlama request failed';
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDefiLlamaTokenApyByChain(params: {
  chainId: number;
  addresses: string[];
}) {
  const chainName = getChainConfig(params.chainId)?.defiLlamaName ?? null;
  const byAddress = new Map<string, DefiLlamaTokenApy>();
  if (!chainName) return byAddress;

  const trackedAddresses = new Set(
    params.addresses
      .map((address) => normalizeEvmAddress(address))
      .filter((address): address is string => Boolean(address)),
  );
  if (trackedAddresses.size === 0) {
    return byAddress;
  }

  const bestByAddress = new Map<
    string,
    DefiLlamaTokenApy & { poolScore: number }
  >();

  const pools = await fetchDefiLlamaPoolsByChain(chainName);
  for (const pool of pools) {
    const poolId = toNonEmptyString(pool.pool);
    const apy = toFiniteNumber(pool.apy);
    if (!poolId || apy === null) continue;

    const underlyingTokens = Array.isArray(pool.underlyingTokens)
      ? pool.underlyingTokens
      : [];
    if (underlyingTokens.length === 0) continue;

    const poolScore = scorePool(pool);
    for (const underlyingToken of underlyingTokens) {
      if (typeof underlyingToken !== 'string') continue;

      const normalizedAddress = normalizeEvmAddress(underlyingToken);
      if (!normalizedAddress || !trackedAddresses.has(normalizedAddress)) {
        continue;
      }

      const previous = bestByAddress.get(normalizedAddress);
      if (!previous || poolScore > previous.poolScore) {
        bestByAddress.set(normalizedAddress, {
          apy,
          apyPoolId: poolId,
          poolScore,
        });
      }
    }
  }

  for (const [address, snapshot] of bestByAddress.entries()) {
    byAddress.set(address, {
      apy: snapshot.apy,
      apyPoolId: snapshot.apyPoolId,
    });
  }

  return byAddress;
}
