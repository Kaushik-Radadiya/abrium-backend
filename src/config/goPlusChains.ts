export type ChainConfig = {
  id: number;
  name: string;
  defiLlamaName: string | null;
  geckoTerminalNetwork: string | null;
};

const CHAIN_LIST: ChainConfig[] = [
  { id: 1,       name: 'Ethereum',      defiLlamaName: 'Ethereum',   geckoTerminalNetwork: 'eth' },
  { id: 56,      name: 'BSC',           defiLlamaName: 'BSC',        geckoTerminalNetwork: 'bsc' },
  { id: 42161,   name: 'Arbitrum',      defiLlamaName: 'Arbitrum',   geckoTerminalNetwork: 'arbitrum' },
  { id: 137,     name: 'Polygon',       defiLlamaName: 'Polygon',    geckoTerminalNetwork: 'polygon_pos' },
  { id: 324,     name: 'zkSync Era',    defiLlamaName: 'zkSync Era', geckoTerminalNetwork: 'zksync' },
  { id: 59144,   name: 'Linea',         defiLlamaName: 'Linea',      geckoTerminalNetwork: 'linea' },
  { id: 8453,    name: 'Base',          defiLlamaName: 'Base',       geckoTerminalNetwork: 'base' },
  { id: 534352,  name: 'Scroll',        defiLlamaName: 'Scroll',     geckoTerminalNetwork: 'scroll' },
  { id: 10,      name: 'Optimism',      defiLlamaName: 'Optimism',   geckoTerminalNetwork: 'optimism' },
  { id: 43114,   name: 'Avalanche',     defiLlamaName: 'Avalanche',  geckoTerminalNetwork: 'avax' },
  { id: 250,     name: 'Fantom',        defiLlamaName: 'Fantom',     geckoTerminalNetwork: 'fantom' },
  { id: 25,      name: 'Cronos',        defiLlamaName: 'Cronos',     geckoTerminalNetwork: 'cronos' },
  { id: 66,      name: 'OKC',           defiLlamaName: 'OKExChain',  geckoTerminalNetwork: 'okc' },
  { id: 128,     name: 'HECO',          defiLlamaName: 'Heco',       geckoTerminalNetwork: 'heco' },
  { id: 100,     name: 'Gnosis',        defiLlamaName: 'Xdai',       geckoTerminalNetwork: 'xdai' },
  { id: 321,     name: 'KCC',           defiLlamaName: 'KCC',        geckoTerminalNetwork: 'kcc' },
  { id: 201022,  name: 'FON',           defiLlamaName: null,         geckoTerminalNetwork: null },
  { id: 5000,    name: 'Mantle',        defiLlamaName: 'Mantle',     geckoTerminalNetwork: 'mantle' },
  { id: 204,     name: 'opBNB',         defiLlamaName: 'op_bnb',     geckoTerminalNetwork: 'opbnb' },
  { id: 42766,   name: 'ZKFair',        defiLlamaName: null,         geckoTerminalNetwork: 'zkfair' },
  { id: 81457,   name: 'Blast',         defiLlamaName: 'Blast',      geckoTerminalNetwork: 'blast' },
  { id: 169,     name: 'Manta Pacific', defiLlamaName: 'Manta',      geckoTerminalNetwork: 'manta-pacific' },
  { id: 80094,   name: 'Berachain',     defiLlamaName: 'Berachain',  geckoTerminalNetwork: 'berachain' },
  { id: 2741,    name: 'Abstract',      defiLlamaName: null,         geckoTerminalNetwork: 'abstract' },
  { id: 177,     name: 'Hashkey Chain', defiLlamaName: null,         geckoTerminalNetwork: 'hashkey' },
  { id: 146,     name: 'Sonic',         defiLlamaName: 'Sonic',      geckoTerminalNetwork: 'sonic' },
  { id: 1514,    name: 'Story',         defiLlamaName: null,         geckoTerminalNetwork: 'story' },
  { id: 130,     name: 'Unichain',      defiLlamaName: 'Unichain',   geckoTerminalNetwork: 'unichain' },
  { id: 480,     name: 'World Chain',   defiLlamaName: null,         geckoTerminalNetwork: 'worldchain' },
  { id: 1868,    name: 'Soneium',       defiLlamaName: 'Soneium',    geckoTerminalNetwork: 'soneium' },
  { id: 48900,   name: 'Zircuit',       defiLlamaName: 'Zircuit',    geckoTerminalNetwork: 'zircuit' },
  { id: 5734951, name: 'Jovay',         defiLlamaName: null,         geckoTerminalNetwork: null },
  { id: 143,     name: 'Monad',         defiLlamaName: null,         geckoTerminalNetwork: null },
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
