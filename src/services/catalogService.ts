import { AppDataSource, initializeDataSource } from '../db/dataSource.js';
import { CatalogChain } from '../entities/CatalogChain.js';
import { CatalogToken } from '../entities/CatalogToken.js';
import {
  fetchLiFiChains,
  fetchLiFiTokensForChainKeys,
} from '../integrations/liFi.js';
import { env } from '../config/env.js';

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
  rpcUrls: string[];
  explorerUrl: string;
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
    rpcUrls: entity.rpcUrls ?? [],
    explorerUrl: entity.explorerUrl ?? '',
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

async function syncChainsFromLiFi() {
  const remoteChains = await fetchLiFiChains();
  if (remoteChains.length === 0) {
    throw new Error('LiFi did not return any supported chains');
  }

  const syncTimestamp = new Date();
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(CatalogChain);
    const rows = remoteChains.map((item) => ({
      chainId: item.chainId,
      chainKey: item.chainKey,
      name: item.name,
      nativeSymbol: item.nativeSymbol,
      logoUri: item.logoUri,
      rpcUrls: item.rpcUrls,
      explorerUrl: item.explorerUrl,
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

  await syncChainsFromLiFi();
  chain = await repository.findOne({ where: { chainId } });
  if (chain?.chainKey) return chain.chainKey;

  throw buildStatusError(`Chain ${chainId} is not supported by LiFi`, 404);
}

async function syncTokensByChainId(chainId: number, chainKey: string) {
  const remoteTokens = await fetchLiFiTokensForChainKeys([chainKey]);

  const chainTokens = remoteTokens.filter((token) => token.chainId === chainId);

  const syncTimestamp = new Date();
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(CatalogToken);
    const rows = chainTokens.map((item) => ({
      chainId: item.chainId,
      address: item.address,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals,
      logoUri: item.logoUri,
      updatedAt: syncTimestamp,
    }));

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
    isCacheFresh(metadata.latestUpdatedAt, env.LIFI_CHAINS_CACHE_TTL_SECONDS);

  if (hasFreshCache) {
    return cachedCatalogChains;
  }

  try {
    await syncChainsFromLiFi();
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
    isCacheFresh(metadata.latestUpdatedAt, env.LIFI_TOKENS_CACHE_TTL_SECONDS);

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
