import { ethers } from "ethers";

export const MIN_TRADE_AMOUNTS = {
    WETH: ethers.parseEther('1'),      // Minimum 1 ETH
    USDC: ethers.parseUnits('5000', 6), // Minimum $5000 USDC
    USDT: ethers.parseUnits('5000', 6), // Minimum $5000 USDT
    LINK: ethers.parseEther('50'),     // Minimum 100 LINK
    WBTC: ethers.parseUnits('0.1', 8),   // Minimum 0.5 WBTC
    UNI: ethers.parseEther('100'),     // Minimum 100 UNI
};

// export const MIN_TRADE_AMOUNTS = {
//     WETH: ethers.parseEther('0.05'),      // Minimum 1 ETH
//     USDC: ethers.parseUnits('100', 6), // Minimum $5000 USDC
//     USDT: ethers.parseUnits('100', 6), // Minimum $5000 USDT
//     LINK: ethers.parseEther('10'),     // Minimum 100 LINK
//     WBTC: ethers.parseUnits('0.0005', 8),   // Minimum 0.5 WBTC
//     UNI: ethers.parseEther('20'),     // Minimum 100 UNI
// };


export const MIN_SPREADS = {
  stablecoin:    0.01,   // USDC, USDT, DAI, FRAX, BUSD, LUSD, USDD
  ethDerivative: 0.05,   // stETH, rETH, wstETH, cbETH
  major:         0.10,   // WETH, WBTC, UNI, LINK, AAVE, COMP, SNX, CRV, MKR, YFI, SUSHI, BAL, CVX, ARB, OP
  volatile:      0.30    // SHIB, PEPE, FLOKI
}

export const TOKEN_CATEGORIES = {
  WETH: 'major', USDC: 'stablecoin', USDT: 'stablecoin', DAI: 'stablecoin',
  WBTC: 'major', UNI: 'major', LINK: 'major', AAVE: 'major', COMP: 'major',
  SNX: 'major', CRV: 'major', MKR: 'major', YFI: 'major', MATIC: 'major',
  SHIB: 'volatile', FRAX: 'stablecoin', BUSD: 'stablecoin', LUSD: 'stablecoin',
  BAR: 'major', WAI: 'major',

  stETH: 'ethDerivative', rETH: 'ethDerivative', wstETH: 'ethDerivative',
  SUSHI: 'major', BAL: 'major', CRV: 'major', CVX: 'major',
  USDD: 'stablecoin',
  cbETH: 'ethDerivative',
  ARB: 'major', OP: 'major',
  PEPE: 'volatile', FLOKI: 'volatile'
};


export const TOKEN_SYMBOLS = {
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH', // WETH mainnet
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC', // USDC mainnet
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT', // USDT mainnet
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': 'LINK', // LINK mainnet
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC', // WBTC mainnet
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': 'UNI', // UNI mainnet
};