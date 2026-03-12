import { AppDataSource } from '../db/dataSource.js';
import { CatalogToken } from '../entities/CatalogToken.js';
import { getChainConfig } from '../config/goPlusChains.js';
import { fetchCoinGeckoOnchainToken } from '../integrations/coingecko.js';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export type ImportTokenResult = {
  token: CatalogToken;
  created: boolean;
};

function makeStatusError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export async function importToken(
  chainId: number,
  address: string,
): Promise<ImportTokenResult> {
  const normalizedAddress = address.trim().toLowerCase();

  if (!EVM_ADDRESS_REGEX.test(normalizedAddress)) {
    throw makeStatusError('Invalid token address', 400);
  }

  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw makeStatusError(`Unsupported chain: ${chainId}`, 400);
  }

  const { geckoTerminalNetwork } = chainConfig;
  if (!geckoTerminalNetwork) {
    throw makeStatusError(
      `CoinGecko onchain is not supported for chain ${chainId}`,
      422,
    );
  }

  const tokenData = await fetchCoinGeckoOnchainToken(
    geckoTerminalNetwork,
    normalizedAddress,
  );
  if (!tokenData) {
    throw makeStatusError(
      `Token not found on CoinGecko for chain ${chainId}, address ${normalizedAddress}`,
      404,
    );
  }

  const repository = AppDataSource.getRepository(CatalogToken);
  const existing = await repository.findOne({
    where: { chainId, address: normalizedAddress },
  });

  if (existing) {
    existing.name = tokenData.name;
    existing.symbol = tokenData.symbol;
    existing.decimals = tokenData.decimals;
    if (tokenData.imageUrl !== null) existing.logoUri = tokenData.imageUrl;
    if (tokenData.coingeckoCoinId !== null)
      existing.coingeckoCoinId = tokenData.coingeckoCoinId;
    if (tokenData.priceUsd !== null) existing.priceUsd = tokenData.priceUsd;
    if (tokenData.volume24hUsd !== null)
      existing.volume24hUsd = tokenData.volume24hUsd;
    existing.updatedAt = new Date();
    const saved = await repository.save(existing);
    return { token: saved, created: false };
  }

  const token = repository.create({
    chainId,
    address: normalizedAddress,
    name: tokenData.name,
    symbol: tokenData.symbol,
    decimals: tokenData.decimals,
    logoUri: tokenData.imageUrl,
    coingeckoCoinId: tokenData.coingeckoCoinId,
    priceUsd: tokenData.priceUsd,
    volume24hUsd: tokenData.volume24hUsd,
    updatedAt: new Date(),
  });

  const saved = await repository.save(token);
  return { token: saved, created: true };
}
