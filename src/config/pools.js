
// ═══════════════════════════════════════════════════════════════════════════════
// POOL CONFIGURATIONS - Major DEX pools to monitor
// ═══════════════════════════════════════════════════════════════════════════════

export const POOLS_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // WETH/USDC Pools
  // ═══════════════════════════════════════════════════════════════════════════
  'UniswapV2_WETH_USDC': {
    address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
    dex: 'UniswapV2',
    version: 'V2',
    token0: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'SushiswapV2_WETH_USDC': {
    address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
    dex: 'SushiSwap',
    version: 'V2',
    token0: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'UniswapV3_WETH_USDC_500': {
    address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    dex: 'UniswapV3',
    version: 'V3',
    fee: 0.0005,
    token0: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
  },
  'UniswapV3_WETH_USDC_3000': {
    address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
    dex: 'UniswapV3',
    version: 'V3',
    fee: 0.003,
    token0: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WETH/USDT Pools
  // ═══════════════════════════════════════════════════════════════════════════
  'UniswapV2_WETH_USDT': {
    address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
    dex: 'UniswapV2',
    version: 'V2',
    token0: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    token1: { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    fee: 0.003
  },
  'SushiswapV2_WETH_USDT': {
    address: '0x06da0fd433C1A5d7a4faa01111c044910A184553',
    dex: 'SushiSwap',
    version: 'V2',
    token0: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    token1: { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    fee: 0.003
  },
  'UniswapV3_WETH_USDT_500': {
    address: '0x11b815efB8f581194ae79006d24E0d814B7697F6',
    dex: 'UniswapV3',
    version: 'V3',
    fee: 0.0005,
    token0: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    token1: { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LINK/WETH Pools
  // ═══════════════════════════════════════════════════════════════════════════
  'UniswapV2_LINK_WETH': {
    address: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974',
    dex: 'UniswapV2',
    version: 'V2',
    token0: { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'SushiswapV2_LINK_WETH': {
    address: '0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967',
    dex: 'SushiSwap',
    version: 'V2',
    token0: { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'UniswapV3_LINK_WETH_3000': {
    address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8',
    dex: 'UniswapV3',
    version: 'V3',
    fee: 0.003,
    token0: { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNI/WETH Pools
  // ═══════════════════════════════════════════════════════════════════════════
  'UniswapV2_UNI_WETH': {
    address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17',
    dex: 'UniswapV2',
    version: 'V2',
    token0: { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'SushiswapV2_UNI_WETH': {
    address: '0xDafd66636E2561b0284EDdE37e42d192F2844D40',
    dex: 'SushiSwap',
    version: 'V2',
    token0: { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    fee: 0.003
  },
  'UniswapV3_UNI_WETH_3000': {
    address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801',
    dex: 'UniswapV3',
    version: 'V3',
    fee: 0.003,
    token0: { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
    token1: { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
  }
};

export default POOLS_CONFIG;