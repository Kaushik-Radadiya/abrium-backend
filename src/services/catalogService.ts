import { AppDataSource, initializeDataSource } from '../db/dataSource.js';
import { CatalogChain } from '../entities/CatalogChain.js';
import { CatalogToken } from '../entities/CatalogToken.js';
import {
  fetchCoinGeckoChains,
  fetchCoinGeckoCoinIdsByContracts,
  fetchCoinGeckoTokenMarketsByCoinIds,
} from '../integrations/coingecko.js';
import { fetchDefiLlamaTokenApyByChain } from '../integrations/defillama.js';
import {
  fetchStargateChains,
  fetchStargateTokensForChainKeys,
} from '../integrations/stargate.js';
import { env } from '../config/env.js';
import type { SecurityLevel } from '../types/security.js';

const UPSERT_BATCH_SIZE = 500;

type CacheRefreshInput = {
  forceRefresh?: boolean;
};

type CatalogTokensInput = CacheRefreshInput & {
  chainId: number;
};

export type CatalogChainItem = {
  id: number;
  chainKey: string;
  name: string;
  nativeSymbol: string;
  logoURI?: string;
  scope: 'production' | 'development';
};

export type CatalogTokenItem = {
  chainId: number;
  address: `0x${string}` | 'native';
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUsd?: number | null;
  priceChange1hPercent?: number | null;
  priceChange24hPercent?: number | null;
  priceChange7dPercent?: number | null;
  volume24hUsd?: number | null;
  apy?: number | null;
  apyPoolId?: string | null;
  apyUpdatedAt?: string | null;
  securityLevel?: SecurityLevel | null;
  securityBadges?: object[] | null;
  securityUpdatedAt?: string | null;
};

type CacheMetadata = {
  hasData: boolean;
  latestUpdatedAt: Date | null;
};

function isCacheFresh(updatedAt: Date | null, ttlSeconds: number) {
  if (!updatedAt) return false;
  if (ttlSeconds <= 0) return false;
  return Date.now() - updatedAt.getTime() <= ttlSeconds * 1000;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
}

function mapCatalogChain(entity: CatalogChain): CatalogChainItem {
  return {
    id: entity.chainId,
    chainKey: entity.chainKey,
    name: entity.name,
    nativeSymbol: entity.nativeSymbol,
    logoURI: entity.logoUri ?? undefined,
    scope: entity.mainnet ? 'production' : 'development',
  };
}

function mapCatalogChains(entities: CatalogChain[]) {
  return entities.map(mapCatalogChain);
}

function mapCatalogToken(entity: CatalogToken): CatalogTokenItem {
  return {
    chainId: entity.chainId,
    address:
      entity.address === 'native'
        ? 'native'
        : (entity.address as `0x${string}`),
    symbol: entity.symbol,
    name: entity.name,
    decimals: entity.decimals,
    logoURI: entity.logoUri ?? undefined,
    priceUsd: entity.priceUsd ?? null,
    priceChange1hPercent: entity.priceChange1hPercent ?? null,
    priceChange24hPercent: entity.priceChange24hPercent ?? null,
    priceChange7dPercent: entity.priceChange7dPercent ?? null,
    volume24hUsd: entity.volume24hUsd ?? null,
    apy: entity.apy ?? null,
    apyPoolId: entity.apyPoolId ?? null,
    apyUpdatedAt: entity.apyUpdatedAt
      ? entity.apyUpdatedAt.toISOString()
      : null,
    securityLevel: entity.securityLevel ?? null,
    securityBadges: entity.securityBadges ?? null,
    securityUpdatedAt: entity.securityUpdatedAt
      ? entity.securityUpdatedAt.toISOString()
      : null,
  };
}

function mapCatalogTokens(entities: CatalogToken[]) {
  return entities.map(mapCatalogToken);
}

function buildStatusError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function readCachedChains() {
  const repository = AppDataSource.getRepository(CatalogChain);
  const [items, latestRows] = await Promise.all([
    repository.find({ order: { chainId: 'ASC' } }),
    repository.find({ order: { updatedAt: 'DESC' }, take: 1 }),
  ]);
  const latest = latestRows[0] ?? null;

  return {
    items,
    metadata: {
      hasData: items.length > 0,
      latestUpdatedAt: latest?.updatedAt ?? null,
    } satisfies CacheMetadata,
  };
}

async function readCachedTokensByChain(chainId: number) {
  const repository = AppDataSource.getRepository(CatalogToken);
  const [items, latestRows] = await Promise.all([
    repository.find({
      where: { chainId },
      order: { symbol: 'ASC', address: 'ASC' },
    }),
    repository.find({
      where: { chainId },
      order: { updatedAt: 'DESC' },
      take: 1,
    }),
  ]);
  const latest = latestRows[0] ?? null;

  return {
    items,
    metadata: {
      hasData: items.length > 0,
      latestUpdatedAt: latest?.updatedAt ?? null,
    } satisfies CacheMetadata,
  };
}

async function syncChainsFromStargate() {
  const [remoteChains, coinGeckoChains] = await Promise.all([
    fetchStargateChains(),
    fetchCoinGeckoChains().catch(() => []),
  ]);
  if (remoteChains.length === 0) {
    throw new Error('Stargate did not return any supported chains');
  }
  const coingeckoByChainId = new Map(
    coinGeckoChains.map((chain) => [chain.chainId, chain] as const),
  );

  const syncTimestamp = new Date();
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(CatalogChain);
    const rows = remoteChains.map((item) => ({
        chainId: item.chainId,
        chainKey: item.chainKey,
        name: coingeckoByChainId.get(item.chainId)?.name ?? item.name,
        nativeSymbol: item.nativeSymbol,
        logoUri: coingeckoByChainId.get(item.chainId)?.logoUri ?? item.logoUri,
        mainnet: item.mainnet,
        chainType: item.chainType,
        updatedAt: syncTimestamp,
      }));

    for (const chunk of chunkItems(rows, UPSERT_BATCH_SIZE)) {
      await repository.upsert(chunk, ['chainId']);
    }

    await repository
      .createQueryBuilder()
      .delete()
      .where('updated_at < :syncTimestamp', {
        syncTimestamp: syncTimestamp.toISOString(),
      })
      .execute();
  });
}

async function resolveChainKey(chainId: number) {
  const repository = AppDataSource.getRepository(CatalogChain);
  let chain = await repository.findOne({ where: { chainId } });
  if (chain?.chainKey) return chain.chainKey;

  await syncChainsFromStargate();
  chain = await repository.findOne({ where: { chainId } });
  if (chain?.chainKey) return chain.chainKey;

  throw buildStatusError(`Chain ${chainId} is not supported by Stargate`, 404);
}

async function resolveCoinGeckoChainMeta(chainId: number) {
  const chains = await fetchCoinGeckoChains();
  const chain = chains.find((c) => c.chainId === chainId);
  return {
    platformId: chain?.coingeckoId ?? null,
    nativeCoinId: chain?.nativeCoinId ?? null,
  };
}

type MarketData = {
  priceUsd: number | null;
  priceChange1hPercent: number | null;
  priceChange24hPercent: number | null;
  priceChange7dPercent: number | null;
  volume24hUsd: number | null;
};

function getMarketField<K extends keyof MarketData>(
  marketDataByCoinId: Map<string, MarketData>,
  coinId: string | null | undefined,
  key: K,
): number | null {
  if (!coinId) return null;
  return marketDataByCoinId.get(coinId.toLowerCase())?.[key] ?? null;
}

async function syncTokensByChainId(chainId: number, chainKey: string) {
  const chainTokens = await fetchStargateTokensForChainKeys([chainKey]);
  let coinIdByAddress = new Map<string, string>();
  let apyByAddress = new Map<
    string,
    { apy: number | null; apyPoolId: string | null }
  >();
  let hasApySyncData = false;

  const { platformId, nativeCoinId } = await resolveCoinGeckoChainMeta(chainId).catch(
    () => ({ platformId: null, nativeCoinId: null }),
  );
  if (platformId) {
    coinIdByAddress = await fetchCoinGeckoCoinIdsByContracts(
      platformId,
      chainTokens.map((token) => token.address),
    ).catch(() => new Map<string, string>());
  }

  // Native token (ETH, MATIC, etc.) has address "native" which fails EVM
  // address validation in fetchCoinGeckoCoinIdsByContracts. Inject its
  // CoinGecko coin ID directly from the chain metadata instead.
  const hasNativeToken = chainTokens.some((t) => t.address === 'native');
  if (hasNativeToken && nativeCoinId) {
    coinIdByAddress.set('native', nativeCoinId);
  }

  const withCoinIds = chainTokens.map((token) => ({
    ...token,
    coingeckoCoinId: coinIdByAddress.get(token.address) ?? null,
  }));
  const marketDataByCoinId = await fetchCoinGeckoTokenMarketsByCoinIds(
    withCoinIds
      .map((token) => token.coingeckoCoinId)
      .filter((id): id is string => Boolean(id)),
  );

  try {
    apyByAddress = await fetchDefiLlamaTokenApyByChain({
      chainId,
      addresses: chainTokens.map((token) => token.address),
    });
    hasApySyncData = true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'DefiLlama APY lookup failed';
    console.warn(
      `Catalog token APY sync failed for chain ${chainId}: ${message}`,
    );
  }

  const syncTimestamp = new Date();
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(CatalogToken);
    const existingApyByAddress = new Map<
      string,
      {
        apy: number | null;
        apyPoolId: string | null;
        apyUpdatedAt: Date | null;
      }
    >();

    if (!hasApySyncData) {
      const existingRows = await repository.find({ where: { chainId } });
      for (const row of existingRows) {
        existingApyByAddress.set(row.address.toLowerCase(), {
          apy: row.apy ?? null,
          apyPoolId: row.apyPoolId ?? null,
          apyUpdatedAt: row.apyUpdatedAt ?? null,
        });
      }
    }

    const rows = withCoinIds.map((item) => {
      const normalizedAddress = item.address.toLowerCase();
      const syncedApy = apyByAddress.get(normalizedAddress);
      const existingApy = existingApyByAddress.get(normalizedAddress);

      return {
        chainId,
        address: item.address,
        symbol: item.symbol,
        name: item.name,
        decimals: item.decimals,
        logoUri: item.logoUri,
        coingeckoCoinId: item.coingeckoCoinId,
        priceUsd: getMarketField(marketDataByCoinId, item.coingeckoCoinId, 'priceUsd'),
        priceChange1hPercent: getMarketField(marketDataByCoinId, item.coingeckoCoinId, 'priceChange1hPercent'),
        priceChange24hPercent: getMarketField(marketDataByCoinId, item.coingeckoCoinId, 'priceChange24hPercent'),
        priceChange7dPercent: getMarketField(marketDataByCoinId, item.coingeckoCoinId, 'priceChange7dPercent'),
        volume24hUsd: getMarketField(marketDataByCoinId, item.coingeckoCoinId, 'volume24hUsd'),
        apy: hasApySyncData
          ? (syncedApy?.apy ?? null)
          : (existingApy?.apy ?? null),
        apyPoolId: hasApySyncData
          ? (syncedApy?.apyPoolId ?? null)
          : (existingApy?.apyPoolId ?? null),
        apyUpdatedAt: hasApySyncData
          ? syncTimestamp
          : (existingApy?.apyUpdatedAt ?? null),
        updatedAt: syncTimestamp,
      };
    });

    for (const chunk of chunkItems(rows, UPSERT_BATCH_SIZE)) {
      await repository.upsert(chunk, ['chainId', 'address']);
    }

    if (rows.length === 0) {
      await repository.delete({ chainId });
      return;
    }

    await repository
      .createQueryBuilder()
      .delete()
      .where('chain_id = :chainId and updated_at < :syncTimestamp', {
        chainId,
        syncTimestamp: syncTimestamp.toISOString(),
      })
      .execute();
  });
}

export async function getCatalogChains(input: CacheRefreshInput = {}) {
  await initializeDataSource();
  const { items: cachedChains, metadata } = await readCachedChains();

  const cachedCatalogChains = mapCatalogChains(cachedChains);

  const hasFreshCache =
    !input.forceRefresh &&
    metadata.hasData &&
    isCacheFresh(
      metadata.latestUpdatedAt,
      env.CATALOG_CHAINS_CACHE_TTL_SECONDS,
    );

  if (hasFreshCache) {
    return cachedCatalogChains;
  }

  try {
    await syncChainsFromStargate();
  } catch (error) {
    if (metadata.hasData) {
      return cachedCatalogChains;
    }
    throw error;
  }

  const { items: syncedChains } = await readCachedChains();
  return mapCatalogChains(syncedChains);
}

export async function getCatalogTokens(input: CatalogTokensInput) {
  await initializeDataSource();
  const { items: cachedTokens, metadata } = await readCachedTokensByChain(
    input.chainId,
  );
  const cachedCatalogTokens = mapCatalogTokens(cachedTokens);

  const hasFreshCache =
    !input.forceRefresh &&
    metadata.hasData &&
    isCacheFresh(
      metadata.latestUpdatedAt,
      env.CATALOG_TOKENS_CACHE_TTL_SECONDS,
    );

  if (hasFreshCache) {
    return cachedCatalogTokens;
  }

  let chainKey = '';
  try {
    chainKey = await resolveChainKey(input.chainId);
  } catch (error) {
    if (metadata.hasData) {
      return cachedCatalogTokens;
    }
    throw error;
  }

  try {
    await syncTokensByChainId(input.chainId, chainKey);
  } catch (error) {
    if (metadata.hasData) {
      return cachedCatalogTokens;
    }
    throw error;
  }

  const { items: syncedTokens } = await readCachedTokensByChain(input.chainId);
  return mapCatalogTokens(syncedTokens);
}
