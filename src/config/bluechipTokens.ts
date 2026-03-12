import type { RiskEvaluation } from '../types/security.js'

const BLUECHIP_TOKENS_BY_CHAIN: Record<number, string[]> = {
  // Ethereum (1)
  1: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0x853d955acef822db058eb8505911ed77f175b99e', // FRAX
  ],
  // OP Mainnet (10)
  10: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x4200000000000000000000000000000000000042', // OP
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC.e
    '0x4200000000000000000000000000000000000006', // WETH
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0x68f180fcce6836688e9084f035309e29bf0a2095', // WBTC
  ],
  // Flare (14)
  14: [
    '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6', // USDC.e
    '0x1502fa4be69d526124d453619276faccab275d3d', // WETH
    '0x0b38e83b86d491735feaa0a791f65c2b99535396', // USDT
  ],
  // Cronos (25)
  25: [
    '0xf44acfdc916898449e39062934c2b496799b6abe', // WETH
    '0xf951ec28187d9e5ca673da8fe6757e6f0be5f77c', // USDC.e
  ],
  // Rootstock (30)
  30: [
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0x74c9f2b00581f1b11aa7ff05aa9f608b7389de67', // USDC.e
    '0xaf368c91793cb22739386dfcbbb2f1a9e4bcbebf', // USDT
  ],
  // TelosEVM (40)
  40: [
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0xbab93b7ad7fe8692a878b95a8e689423437cc500', // WETH
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC.e
    '0x674843c06ff83502ddb4d37c2e09c01cda38cbc8', // USDT
  ],
  // XDC (50)
  50: [
    '0xa7348290de5cf01772479c48d50dec791c3fc212', // WETH
    '0xcc0587aebda397146cc828b445db130a94486e74', // USDC.e
    '0xcda5b77e2e2268d9e09c874c1b9a4c3f07b37555', // USDT
    '0xfa2958cb79b0491cc627c1557f441ef849ca8eb1', // USDC
  ],
  // BNB Chain (56)
  56: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // WETH
  ],
  // Gnosis (100) — no native ETH on Gnosis (uses xDAI as native)
  100: [
    '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1', // WETH
    '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0', // USDC.e
  ],
  // Fuse (122)
  122: [
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0xc6bc407706b7140ee8eef2f86f9504651b63e7f9', // USDC.e
    '0x3695dd1d1d43b794c0b13eb8be8419eb3ac22bf7', // USDT
  ],
  // Unichain (130)
  130: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x078d782b760474a361dda0af3839290b0ef57ad6', // USDC
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
  ],
  // Polygon (137)
  137: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
  ],
  // Monad (143)
  143: [
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x754704bc059f8c67012fed69bc8a327a5aafb603', // USDC
    '0xee8c0e9f1bffb4eb878d8f15f368a02a35481242', // WETH
  ],
  // Sonic (146)
  146: [
    '0x29219dd400f2bf60e5a23d13be72b486d4038894', // USDC
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
  ],
  // Redbelly (151)
  151: [
    '0x5a7e19089909c92ae07a1bd33d3fef428312deba', // WETH
    '0xe08ded898d7782b085cd240d7b234063696765ad', // USDC.e
  ],
  // Manta (169)
  169: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // X Layer (196)
  196: [
    '0x80eede496655fb9047dd39d9f418d5483ed600df', // FRAX
  ],
  // opBNB (204)
  204: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // TAC (239)
  239: [
    '0x61d66bc21fed820938021b06e9b2291f3fb91945', // WETH
  ],
  // Fantom (250)
  250: [
    '0x28a92dde19d9989f39a49905d7c9c2fac7799bdf', // USDC
    '0xcc1b99ddac1a33c201a742a1851662e87bc7f22c', // USDT
    '0x695921034f0387eac4e11620ee91b1b15a6a09fe', // WETH
    '0x91a40c733c97a6e1bf876eaf9ed8c08102eb491f', // DAI
  ],
  // Fraxtal (252)
  252: [
    'native',
  ],
  // Orderly (291)
  291: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xda6087e69c51e7d31b6dbad276a3c44703dfdcad', // USDC.e
  ],
  // zkSync Era (324)
  324: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Worldchain (480)
  480: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x79a02482a880bce3f13e09da970dc34db4cd24d1', // USDC
  ],
  // Camp (484)
  484: [
    '0x60219c44e146baf36002ea73767820238ebc1db6', // WETH
    '0x8a2b28364102bea189d99a475c494330ef2bdd0b', // USDC.e
  ],
  // Flow (747)
  747: [
    '0x717dae2baf7656be9a9b01dee31d571a9d4c9579', // WBTC
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0x674843c06ff83502ddb4d37c2e09c01cda38cbc8', // USDT
  ],
  // Stable (988)
  988: [
    '0x783129e4d7ba0af0c896c239e57c06df379aae8c', // WETH
    '0x8a2b28364102bea189d99a475c494330ef2bdd0b', // USDC.e
  ],
  // HyperEVM (999)
  999: [
    '0xb88339cb7199b77e23db6e890353e22632ba630f', // USDC
  ],
  // Metis (1088)
  1088: [
    '0x909dbde1ebe906af95660033e478d59efe831fed', // FRAX
    '0x420000000000000000000000000000000000000a', // WETH
  ],
  // Core Chain (1116)
  1116: [
    '0xa4151b2b3e269645181dccf2d426ce75fcbdeca9', // USDC
    '0x900101d06a7426441ae63e9ab3b9b0f63be145f1', // USDT
  ],
  // Lisk (1135)
  1135: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Glue (1300)
  1300: [
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0xee45ed3f6c675f319bb9de62991c1e78b484e0b8', // USDC.e
    '0xe1ad845d93853fff44990ae0dcecd8575293681e', // USDT
  ],
  // Somnia (5031)
  5031: [
    '0x28bec7e30e6faee657a03e19bf1128aad7632a00', // USDC.e
    '0xc5098b3ca516784323872f17235fa074e167d3d2', // WBTC
    '0x936ab8c674bcb567cd5deb85d8a216494704e9d8', // WETH
    '0x67b302e35aef5eee8c32d934f5856869ef428330', // USDT
  ],
  // Nibiru (6900)
  6900: [
    '0xcda5b77e2e2268d9e09c874c1b9a4c3f07b37555', // WETH
    '0x0829f361a05d993d5ceb035ca6df3446b060970b', // USDC.e
    '0x43f2376d5d03553ae72f4a8093bbe9de4336eb08', // USDT
  ],
  // Mantle (5000)
  5000: [
    '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9', // USDC
    '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae', // USDT
    '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111', // WETH
  ],
  // Kaia (8217)
  8217: [
    '0x55acee547df909cf844e32dd66ee55a6f81dc71b', // WETH
    '0xe2053bcf56d2030d2470fb454574237cf9ee3d4b', // USDC.e
    '0x9025095263d1e548dc890a7589a4c78038ac40ab', // USDT
  ],
  // Base (8453)
  8453: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x909dbde1ebe906af95660033e478d59efe831fed', // FRAX
    '0x4200000000000000000000000000000000000006', // WETH
    '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT
  ],
  // IOTA EVM (8822)
  8822: [
    '0x160345fc359604fc6e70e3c5facbde5f7a9342d8', // WETH
    '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6', // USDC.e
    '0xc1b8045a6ef2934cf0f78b0dbd489969fa9be7e4', // USDT
  ],
  // Apex Fusion Nexus (9069)
  9069: [
    '0x8a2b28364102bea189d99a475c494330ef2bdd0b', // USDC.e
  ],
  // Plasma (9745)
  9745: [
    '0x9895d81bb462a195b4922ed7de0e3acd007c32cb', // WETH
  ],
  // Gate Layer (10088)
  10088: [
    '0x60219c44e146baf36002ea73767820238ebc1db6', // WETH
    '0x8a2b28364102bea189d99a475c494330ef2bdd0b', // USDC.e
  ],
  // 0G (16661)
  16661: [
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x564770837ef8bbf077cfe54e5f6106538c815b22', // WETH
  ],
  // Cyber (7560)
  7560: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Arbitrum (42161)
  42161: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', // WBTC
    '0x912ce59144191c1204e64559fe8253a0e49e6548', // ARB
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
  ],
  // Hemi (43111)
  43111: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xad11a8beb98bbf61dbb1aa0f6d6f2ecd87b35afa', // USDC.e
    '0xbb0d083fb1be0a9f6157ec484b6c79e0a4e31c2e', // USDT
  ],
  // Avalanche (43114)
  43114: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // USDC
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', // USDT
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab', // WETH.e
  ],
  // Zircuit (48900)
  48900: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Superposition (55244)
  55244: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x6c030c5cc283f791b26816f325b9c632d964f8a1', // USDC.e
  ],
  // Ink (57073)
  57073: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC.e
    '0x2d270e6886d130d724215a266106e6832161eaed', // USDC
  ],
  // Linea (59144)
  59144: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', // USDC
  ],
  // BOB (60808)
  60808: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
  ],
  // Codex (81224)
  81224: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Bera (80094)
  80094: [
    '0x549943e04f40284185054145c6e4e9568c1d3241', // USDC.e
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
  ],
  // Blast (81457)
  81457: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x909dbde1ebe906af95660033e478d59efe831fed', // FRAX
  ],
  // Soneium (1868)
  1868: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369', // USDC.e
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
  ],
  // SEI (1329)
  1329: [
    '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392', // USDC
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    '0x80eede496655fb9047dd39d9f418d5483ed600df', // FRAX
    '0x160345fc359604fc6e70e3c5facbde5f7a9342d8', // WETH
    '0xb75d0b03c06a926e488e2659df1a861f860bd3d1', // USDT
  ],
  // Vana (1480)
  1480: [
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC.e
    '0x88853d410299bcbfe5fcc9eef93c03115e908279', // USDT
  ],
  // Story (1514)
  1514: [
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC.e
    '0xbab93b7ad7fe8692a878b95a8e689423437cc500', // WETH
    '0x674843c06ff83502ddb4d37c2e09c01cda38cbc8', // USDT
  ],
  // Gravity (1625)
  1625: [
    '0xf6f832466cd6c21967e0d954109403f36bc8ceaa', // WETH
    '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6', // USDC.e
    '0x816e810f9f787d669fb71932deabf6c83781cd48', // USDT
  ],
  // Injective EVM (1776)
  1776: [
    '0xe9aba835f813ca05e50a6c0ce65d0d74390f7de7', // WETH
  ],
  // TAIKO (167000)
  167000: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x19e26b0638bf63aa9fa4d14c6baf8d52ebe86c5c', // USDC.e
    '0x9c2dc7377717603eb92b2655c5f2e7997a4945bd', // USDT
  ],
  // Ape (33139)
  33139: [
    '0xf4d9235269a96aadafc9adae454a0618ebe37949', // WETH
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC.e
    '0x674843c06ff83502ddb4d37c2e09c01cda38cbc8', // USDT
  ],
  // Mode (34443)
  34443: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x80eede496655fb9047dd39d9f418d5483ed600df', // FRAX
  ],
  // EDU (41923)
  41923: [
    '0x12a272a581fee5577a5dfa371afeb4b2f3a8c2f8', // USDC.e
  ],
  // Scroll (534352)
  534352: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', // USDC
  ],
  // Kava (2222)
  2222: [
    '0x2dfd4de5ae386cd3f4fc8e2cb39240852e47f5e8', // WETH
    '0x919c1c267bc06a7039e03fcc2ef738525769109c', // USDT
  ],
  // GOAT (2345)
  2345: [
    'native',
    '0x3a1293bdb83bbbdd5ebf4fac96605ad2021bbc0f', // WETH
    '0x3022b87ac063de95b1570f46f5e470f8b53112d8', // USDC.e
    '0xe1ad845d93853fff44990ae0dcecd8575293681e', // USDT
  ],
  // Abstract (2741)
  2741: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x84a71ccd554cc1b02749b35d22f684cc8ec987e1', // USDC.e
    '0x0709f39376deee2a2dfc94a58edeb2eb9df012bd', // USDT
  ],
  // Peaq (3338)
  3338: [
    '0xf4d9235269a96aadafc9adae454a0618ebe37949', // USDT
    '0x6694340fc020c5e6b96567843da2df01b2ce1eb6', // WETH
    '0xbba60da06c2c5424f03f7434542280fcad453d10', // USDC
  ],
  // Botanix (3637)
  3637: [
    'native',
    '0x3292c42e8e9ab3c6a12cfda556bbcb6f113b1e28', // WETH
    '0x29ee6138dd4c9815f46d34a4a1ed48f46758a402', // USDC.e
  ],
  // Citrea (4114)
  4114: [
    '0xe045e6c36cf77faa2cfb54466d71a3aef7bbe839', // USDC.e
  ],
  // Morph (2818)
  2818: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xcfb1186f4e93d60e60a8bdd997427d1f33bc372b', // USDC
  ],
  // MegaETH (4326)
  4326: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x4200000000000000000000000000000000000006', // WETH
  ],
  // Lightlink (1890)
  1890: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xbcf8c1b03bbdda88d579330bdf236b58f8bb2cfd', // USDC.e
    '0x808d7c71ad2ba3fa531b068a2417c63106bc0949', // USDT
  ],
  // Swell (1923)
  1923: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
  ],
  // Polygon zkEVM (1101)
  1101: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Horizen (26514)
  26514: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xdf7108f8b10f9b9ec1aba01cca057268cbf86b6c', // USDC.e
  ],
  // Plume (98866)
  98866: [
    '0x78add880a697070c1e765ac44d65323a0dcce913', // USDC.e
    '0xca59ca09e5602fae8b629dee83ffa819741f14be', // WETH
    '0xda6087e69c51e7d31b6dbad276a3c44703dfdcad', // USDT
    '0x222365ef19f7947e5484218551b56bb3965aa7af', // USDC
  ],
  // Doma (97477)
  97477: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x31eef89d5215c305304a2fa5376a1f1b6c5dc477', // USDC.e
  ],
  // Katana (747474)
  747474: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Zora (7777777)
  7777777: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ],
  // Degen (666666666)
  666666666: [
    '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590', // WETH
    '0xf1815bd50389c46847f0bda824ec8da914045d14', // USDC
  ],
  // Aurora (1313161554)
  1313161554: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x368ebb46aca6b8d0787c96b2b20bd3cc3f2c45f7', // USDC
  ],
  // Rari Chain (1380012617)
  1380012617: [
    'native',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6', // USDC.e
    '0x362fae9a75b27bbc550aac28a7c1f96c8d483120', // USDT
  ],
}

// Build a fast lookup: chainId -> Set<lowercaseAddress>
const BLUECHIP_LOOKUP = new Map<number, Set<string>>()
for (const [chainIdStr, addresses] of Object.entries(BLUECHIP_TOKENS_BY_CHAIN)) {
  BLUECHIP_LOOKUP.set(
    Number(chainIdStr),
    new Set(addresses.map((a) => a.toLowerCase())),
  )
}

export function isBluechipToken(chainId: number, tokenAddress: string): boolean {
  return (
    BLUECHIP_LOOKUP.get(chainId)?.has(tokenAddress.toLowerCase()) ?? false
  )
}

export function getBluechipEvaluation(): RiskEvaluation {
  return {
    decision: 'ALLOW',
    securityLevel: 'verified',
    criticalFlags: [],
    reasons: ['Token is a verified blue-chip asset.'],
    badges: [
      {
        id: 'bluechip_verified',
        label: 'Verified',
        detail: 'Major blue-chip asset with a long track record of security.',
        level: 'info',
      },
    ],
  }
}
