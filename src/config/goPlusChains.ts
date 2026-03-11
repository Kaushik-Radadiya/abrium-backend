export type ChainConfig = {
  id: number;
  name: string;
  defiLlamaName: string | null;
};

const CHAIN_LIST: ChainConfig[] = [
  { id: 1,       name: 'Ethereum',      defiLlamaName: 'Ethereum' },
  { id: 56,      name: 'BSC',           defiLlamaName: 'BSC' },
  { id: 42161,   name: 'Arbitrum',      defiLlamaName: 'Arbitrum' },
  { id: 137,     name: 'Polygon',       defiLlamaName: 'Polygon' },
  { id: 324,     name: 'zkSync Era',    defiLlamaName: 'zkSync Era' },
  { id: 59144,   name: 'Linea',         defiLlamaName: 'Linea' },
  { id: 8453,    name: 'Base',          defiLlamaName: 'Base' },
  { id: 534352,  name: 'Scroll',        defiLlamaName: 'Scroll' },
  { id: 10,      name: 'Optimism',      defiLlamaName: 'Optimism' },
  { id: 43114,   name: 'Avalanche',     defiLlamaName: 'Avalanche' },
  { id: 250,     name: 'Fantom',        defiLlamaName: 'Fantom' },
  { id: 25,      name: 'Cronos',        defiLlamaName: 'Cronos' },
  { id: 66,      name: 'OKC',           defiLlamaName: 'OKExChain' },
  { id: 128,     name: 'HECO',          defiLlamaName: 'Heco' },
  { id: 100,     name: 'Gnosis',        defiLlamaName: 'Xdai' },
  { id: 321,     name: 'KCC',           defiLlamaName: 'KCC' },
  { id: 201022,  name: 'FON',           defiLlamaName: null },
  { id: 5000,    name: 'Mantle',        defiLlamaName: 'Mantle' },
  { id: 204,     name: 'opBNB',         defiLlamaName: 'op_bnb' },
  { id: 42766,   name: 'ZKFair',        defiLlamaName: null },
  { id: 81457,   name: 'Blast',         defiLlamaName: 'Blast' },
  { id: 169,     name: 'Manta Pacific', defiLlamaName: 'Manta' },
  { id: 80094,   name: 'Berachain',     defiLlamaName: 'Berachain' },
  { id: 2741,    name: 'Abstract',      defiLlamaName: null },
  { id: 177,     name: 'Hashkey Chain', defiLlamaName: null },
  { id: 146,     name: 'Sonic',         defiLlamaName: 'Sonic' },
  { id: 1514,    name: 'Story',         defiLlamaName: null },
  { id: 130,     name: 'Unichain',      defiLlamaName: 'Unichain' },
  { id: 480,     name: 'World Chain',   defiLlamaName: null },
  { id: 1868,    name: 'Soneium',       defiLlamaName: 'Soneium' },
  { id: 48900,   name: 'Zircuit',       defiLlamaName: 'Zircuit' },
  { id: 5734951, name: 'Jovay',         defiLlamaName: null },
  { id: 143,     name: 'Monad',         defiLlamaName: null },
];

export const CHAIN_CONFIG_BY_ID = new Map<number, ChainConfig>(
  CHAIN_LIST.map((chain) => [chain.id, chain]),
);

export const GOPLUS_SUPPORTED_CHAIN_IDS = new Set<number>(
  CHAIN_LIST.map((chain) => chain.id),
);

export function isGoPlusSupportedChain(chainId: number): boolean {
  return GOPLUS_SUPPORTED_CHAIN_IDS.has(chainId);
}

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIG_BY_ID.get(chainId);
}
