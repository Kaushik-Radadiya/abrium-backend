import { env } from '../config/env.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EVM_ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;
const LIFI_API_KEY_HEADER = 'x-lifi-api-key';

type LiFiChainMetadata = {
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

type LiFiTokenMetadata = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri: string | null;
};

type LiFiChainApi = {
  id?: number | string;
  chainId?: number | string;
  key?: string;
  chainKey?: string;
  name?: string;
  chainName?: string;
  coin?: string;
  logoURI?: string;
  logoUrl?: string;
  icon?: string;
  mainnet?: boolean;
  chainType?: string;
  explorerUrl?: string;
  scanUrl?: string;
  metamask?: {
    rpcUrls?: string[];
    blockExplorerUrls?: string[];
  } | null;
  nativeToken?: {
    symbol?: string;
  } | null;
};

type LiFiTokenApi = {
  chainId?: number | string;
  address?: string;
  tokenAddress?: string;
  symbol?: string;
  name?: string;
  decimals?: number | string;
  logoURI?: string;
  logoUrl?: string;
  icon?: string;
};

export class LiFiApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'LiFiApiError';
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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeTokenAddress(address: string) {
  const lowered = address.toLowerCase();
  if (lowered === ZERO_ADDRESS) return 'native';
  if (!EVM_ADDRESS_REGEX.test(lowered)) return null;
  return lowered;
}

function normalizeChainKeys(chainKeys: string[]) {
  return Array.from(
    new Set(
      chainKeys.map((value) => value.trim().toLowerCase()).filter(Boolean),
    ),
  );
}

function buildLiFiUrl(path: string, searchParams?: URLSearchParams) {
  const baseUrl = env.LIFI_BASE_URL.endsWith('/')
    ? env.LIFI_BASE_URL
    : `${env.LIFI_BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  const url = new URL(normalizedPath, baseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url;
}

function buildLiFiHeaders() {
  const headers = new Headers();
  if (env.LIFI_API_KEY) {
    headers.set(LIFI_API_KEY_HEADER, env.LIFI_API_KEY);
  }
  return headers;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function fetchLiFiJson<T>(
  path: string,
  searchParams?: URLSearchParams,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    env.LIFI_TIMEOUT_SECONDS * 1000,
  );

  try {
    const response = await fetch(buildLiFiUrl(path, searchParams), {
      method: 'GET',
      headers: buildLiFiHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallback = `LiFi API request failed (${response.status})`;
      const message = await response.text().catch(() => fallback);
      throw new LiFiApiError(message || fallback, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof LiFiApiError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new LiFiApiError(
        `LiFi API request timed out after ${env.LIFI_TIMEOUT_SECONDS}s`,
      );
    }

    const message =
      error instanceof Error ? error.message : 'LiFi API request failed';
    throw new LiFiApiError(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseChain(chain: LiFiChainApi): LiFiChainMetadata | null {
  const chainId = toFiniteNumber(chain.id ?? chain.chainId);
  const chainKey = toNonEmptyString(chain.key ?? chain.chainKey);
  const name = toNonEmptyString(chain.name ?? chain.chainName);
  if (!chainId || !chainKey || !name) return null;

  const rpcUrls = toStringArray(chain.metamask?.rpcUrls);
  const explorerUrls = toStringArray(chain.metamask?.blockExplorerUrls);

  return {
    chainId,
    chainKey: chainKey.toLowerCase(),
    name,
    nativeSymbol:
      toNonEmptyString(chain.coin) ??
      toNonEmptyString(chain.nativeToken?.symbol) ??
      'NATIVE',
    logoUri: toNonEmptyString(chain.logoURI ?? chain.logoUrl ?? chain.icon),
    rpcUrls,
    explorerUrl:
      explorerUrls[0] ??
      toNonEmptyString(chain.explorerUrl ?? chain.scanUrl),
    mainnet: typeof chain.mainnet === 'boolean' ? chain.mainnet : true,
    chainType: toNonEmptyString(chain.chainType),
  };
}

function parseToken(
  token: LiFiTokenApi,
  fallbackChainId: number | null,
): LiFiTokenMetadata | null {
  const chainId = toFiniteNumber(token.chainId) ?? fallbackChainId;
  const address = toNonEmptyString(token.address ?? token.tokenAddress);
  const symbol = toNonEmptyString(token.symbol);
  const name = toNonEmptyString(token.name);
  const decimals = toFiniteNumber(token.decimals);

  if (!chainId || !address || !symbol || !name || decimals === null) {
    return null;
  }

  const normalizedAddress = normalizeTokenAddress(address);
  if (!normalizedAddress) return null;

  const normalizedDecimals = Math.trunc(decimals);
  if (normalizedDecimals < 0) return null;

  return {
    chainId,
    address: normalizedAddress,
    symbol,
    name,
    decimals: normalizedDecimals,
    logoUri: toNonEmptyString(token.logoURI ?? token.logoUrl ?? token.icon),
  };
}

export async function fetchLiFiChains() {
  const payload = await fetchLiFiJson<{ chains?: LiFiChainApi[] | unknown }>(
    '/chains',
  );
  if (!Array.isArray(payload.chains)) {
    return [] as LiFiChainMetadata[];
  }

  const chains: LiFiChainMetadata[] = [];
  for (const chain of payload.chains) {
    if (!chain || typeof chain !== 'object') continue;
    const parsed = parseChain(chain as LiFiChainApi);
    if (parsed) chains.push(parsed);
  }
  return chains;
}

export async function fetchLiFiTokensForChainKeys(chainKeys: string[]) {
  const normalizedChainKeys = normalizeChainKeys(chainKeys);
  if (normalizedChainKeys.length === 0) {
    return [] as LiFiTokenMetadata[];
  }

  const payload = await fetchLiFiJson<{
    tokens?: Record<string, LiFiTokenApi[] | unknown> | unknown;
  }>('/tokens', new URLSearchParams({ chains: normalizedChainKeys.join(',') }));

  if (
    !payload.tokens ||
    typeof payload.tokens !== 'object' ||
    Array.isArray(payload.tokens)
  ) {
    return [] as LiFiTokenMetadata[];
  }

  const deduped = new Map<string, LiFiTokenMetadata>();

  for (const [groupChainId, groupTokens] of Object.entries(payload.tokens)) {
    if (!Array.isArray(groupTokens)) continue;
    const fallbackChainId = toFiniteNumber(groupChainId);

    for (const tokenEntry of groupTokens) {
      if (!tokenEntry || typeof tokenEntry !== 'object') continue;
      const token = parseToken(tokenEntry as LiFiTokenApi, fallbackChainId);
      if (!token) continue;

      const key = `${token.chainId}:${token.address}`;
      const existing = deduped.get(key);
      if (!existing || (!existing.logoUri && token.logoUri)) {
        deduped.set(key, token);
      }
    }
  }

  return Array.from(deduped.values());
}
