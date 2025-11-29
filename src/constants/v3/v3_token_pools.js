import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';

// Token definitions for major tokens
export const TOKENS = {
  WETH: new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
  USDC: new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin'),
  USDT: new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD'),
  DAI: new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin'),
  WBTC: new Token(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin'),
  UNI: new Token(1, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 18, 'UNI', 'Uniswap'),
  LINK: new Token(1, '0x514910771af9ca656af840dff83e8264ecf986ca', 18, 'LINK', 'Chainlink'),
  AAVE: new Token(1, '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', 18, 'AAVE', 'Aave'),
  COMP: new Token(1, '0xc00e94Cb662C3520282E6f5717214004A7f26888', 18, 'COMP', 'Compound'),
  SNX: new Token(1, '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', 18, 'SNX', 'Synthetix'),
  CRV: new Token(1, '0xd533a949740bb3306d119cc777fa900ba034cd52', 18, 'CRV', 'Curve DAO Token'),
  MKR: new Token(1, '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', 18, 'MKR', 'Maker'),
  YFI: new Token(1, '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', 18, 'YFI', 'yearn.finance'),
  MATIC: new Token(1, '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', 18, 'MATIC', 'Matic Token'),
  SHIB: new Token(1, '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', 18, 'SHIB', 'Shiba Inu'),
  SAND: new Token(1, '0x3845badAde8e6dFF049820680d1F14bD3903a5d0', 18, 'SAND', 'SAND'),
  LDO: new Token(1, '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 18, 'LDO', 'Lido DAO Token'),
  PEPE: new Token(1, '0x6982508145454Ce325dDbE47a25d4ec3d2311933', 18, 'PEPE', 'Pepe'),
  FTM: new Token(1, '0x4E15361FD6b4BB609Fa63C81A2be19d873717870', 18, 'FTM', 'Fantom Token'),
  GRT: new Token(1, '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, 'GRT', 'Graph Token'),
  MANA: new Token(1, '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', 18, 'MANA', 'Decentraland MANA'),
  IMX: new Token(1, '0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF', 18, 'IMX', 'Immutable X'),
  '1INCH': new Token(1, '0x111111111117dC0aa78b770fA6A738034120C302', 18, '1INCH', '1INCH Token'),
  ENJ: new Token(1, '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c', 18, 'ENJ', 'Enjin Coin'),
  BAT: new Token(1, '0x0D8775F648430679A709E98d2b0Cb6250d2887EF', 18, 'BAT', 'Basic Attention Token'),
  SUSHI: new Token(1, '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', 18, 'SUSHI', 'SushiToken'),
  DOGE: new Token(1, '0x4206931337dc273a630d328dA6441786BfaD668f', 8, 'DOGE', 'Dogecoin'),
  ZRX: new Token(1, '0xE41d2489571d322189246DaFA5ebDe1F4699F498', 18, 'ZRX', '0x Protocol Token'),
  BAL: new Token(1, '0xba100000625a3754423978a60c9317c58a424e3D', 18, 'BAL', 'Balancer'),
  REN: new Token(1, '0x408e41876cCCDC0F92210600ef50372656052a38', 18, 'REN', 'Republic Token'),
  UMA: new Token(1, '0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828', 18, 'UMA', 'UMA Voting Token v1'),
  OCEAN: new Token(1, '0x967da4048cD07aB37855c090aAF366e4ce1b9F48', 18, 'OCEAN', 'Ocean Token'),
  ANKR: new Token(1, '0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4', 18, 'ANKR', 'Ankr Network'),
  IOTX: new Token(1, '0x6fB3e0A217407EFFf7Ca062D46c26E5d60a14d69', 18, 'IOTX', 'IoTeX Network'),
  STORJ: new Token(1, '0xB64ef51C888972c908CFacf59B47C1AfBC0Ab8aC', 8, 'STORJ', 'StorjToken'),
  LRC: new Token(1, '0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD', 18, 'LRC', 'LoopringCoin V2'),
  NMR: new Token(1, '0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671', 18, 'NMR', 'Numeraire'),
  RSR: new Token(1, '0x320623b8E4fF03373931769A31Fc52A4E78B5d70', 18, 'RSR', 'Reserve Rights'),
  PAXG: new Token(1, '0x45804880De22913dAFE09f4980848ECE6EcbAf78', 18, 'PAXG', 'PAX Gold (PAXG)'),
  RPL: new Token(1, '0xD33526068D116cE69F19A9ee46F0bd304F21A51f', 18, 'RPL', 'Rocket Pool Protocol'),
  CVX: new Token(1, '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', 18, 'CVX', 'Convex Token'),
  APE: new Token(1, '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, 'APE', 'ApeCoin'),
  CRO: new Token(1, '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b', 8, 'CRO', 'Cronos'),
  CHZ: new Token(1, '0x3506424F91fD33084466F402d5D97f05F8e3b4AF', 18, 'CHZ', 'Chiliz'),
  FXS: new Token(1, '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0', 18, 'FXS', 'Frax Share'),
  '3Crv': new Token(1, '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', 18, '3Crv', 'Curve.fi DAI/USDC/USDT'),
};

// Helper to get token info by address
const getTokenInfo = (address) => {
  const token = Object.values(TOKENS).find(t => t.address.toLowerCase() === address.toLowerCase());
  if (!token) throw new Error(`Token not found for address: ${address}`);
  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals
  };
};

// =============================
// STEP 1: Build DIRECT SWAPS (Only real pools)
// =============================


export const DIRECT_SWAP_PAIRS = [
  // SHIB/USDT
  {
    name: 'SHIB/USDT',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x9470ebd69A50fbE965B5ff0e62a775F8D7Ed5ee0' },
      UniswapV3_3000: { fee: 3000, address: '0xB0cC75ed5AaBB0aCce7cbf0302531Bb260d259C4' }
    }
  },

  // MATIC/USDC
  {
    name: 'MATIC/USDC',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x07A6E955bA4345BAe83Ac2A6fAa771fddd8A2011' },
    }
  },

  // MATIC/DAI
  {
    name: 'MATIC/DAI',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x07510b2DD84bF8187063a3c49533663518C2B6b7' },
    }
  },

  // CRV/USDC
  {
    name: 'CRV/USDC',
    token0: getTokenInfo(TOKENS.CRV.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x9445bd19767F73DCaE6f2De90e6cd31192F62589' }
    }
  },

  // CRV/USDT
  {
    name: 'CRV/USDT',
    token0: getTokenInfo(TOKENS.CRV.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x07B1c12BE0d62fe548a2b4b025Ab7A5cA8DEf21E' },
    }
  },

  // MKR/WETH
  {
    name: 'MKR/WETH',
    token0: getTokenInfo(TOKENS.MKR.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xC2aDdA861F89bBB333c90c492cB837741916A225' },
      SushiswapV2: { fee: 0, address: '0xBa13afEcda9beB75De5c56BbAF696b880a5A50dD' },
      UniswapV3_3000: { fee: 3000, address: '0xe8c6c9227491C0a8156A0106A0204d881BB7E531' },
      UniswapV3_10000: { fee: 10000, address: '0x3aFdC5e6DfC0B0a507A8e023c9Dce2CAfC310316' },
    }
  },

  // MKR/WBTC
  {
    name: 'MKR/WBTC',
    token0: getTokenInfo(TOKENS.MKR.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xA2375dAd211FE6e538d29c98EC526246E38Be4EC' },
    }
  },

  // AAVE/USDT
  {
    name: 'AAVE/USDT',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x4D1Ad4A9e61Bc0E5529d64F38199cCFca56f5a42' }
    }
  },

  // AAVE/WBTC
  {
    name: 'AAVE/WBTC',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x98E45940d0c76898f5659b8FC78895F35A39eb43' }
    }
  },

  // AAVE/LINK
  {
    name: 'AAVE/LINK',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.LINK.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x14243EA6bB3d64C8d54A1f47B077e23394D6528A' }
    }
  },

  // SNX/WBTC
  {
    name: 'SNX/WBTC',
    token0: getTokenInfo(TOKENS.SNX.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x15C11B1E07CB763aB75723BB55877B36f56C39B1' }
    }
  },

  // WETH/WBTC
  {
    name: 'WETH/WBTC',
    token0: getTokenInfo(TOKENS.WETH.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940' },
      SushiswapV2: { fee: 0, address: '0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58' },
      UniswapV3_3000: { fee: 3000, address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD' },
    }
  },

  // DAI/USDC
  {
    name: 'DAI/USDC',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5' },
    }
  },

  // 1INCH/DAI
  // {
  //   name: '1INCH/DAI',
  //   token0: getTokenInfo(TOKENS['1INCH'].address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV3_3000: { fee: 3000, address: '0xF4410C58D13820D5eBa1a563e592ED015c4e3c80' },
  //     UniswapV3_10000: { fee: 10000, address: '0xd921A81445Ff6A9114deb7Db011F5ef8353F0bBc' },
  //   }
  // },

  // 1INCH/LINK
  {
    name: '1INCH/LINK',
    token0: getTokenInfo(TOKENS['1INCH'].address),
    token1: getTokenInfo(TOKENS.LINK.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x28028CB848361930d2dc1F502439050A6EE5E4c2' },
    }
  },

  // 1INCH/USDC
  {
    name: '1INCH/USDC',
    token0: getTokenInfo(TOKENS['1INCH'].address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x62773f00cd3e0df3D70bECA5Aee342B0151fE78a' },
      UniswapV3_10000: { fee: 10000, address: '0x9feBc984504356225405e26833608b17719c82Ae' },
    }
  },

  // 1INCH/USDT
  {
    name: '1INCH/USDT',
    token0: getTokenInfo(TOKENS['1INCH'].address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x1dEe9d7b7cFd8Febf38982bC8Ab715eC8c3050d1' },
      UniswapV3_10000: { fee: 10000, address: '0xa21Ed0Af81d7cdaEbD06d1150C166821cFCD64FF' },
    }
  },

  // 1INCH/WETH
  {
    name: '1INCH/WETH',
    token0: getTokenInfo(TOKENS['1INCH'].address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2' },
      UniswapV3_3000: { fee: 3000, address: '0xd35EFAE4097d005720608Eaf37E42a5936C94B44' },
      UniswapV3_10000: { fee: 10000, address: '0xE931b03260B2854e77e8dA8378A1BC017b13cb97' },
    }
  },

  // 3Crv/DAI
  {
    name: '3Crv/DAI',
    token0: getTokenInfo(TOKENS['3Crv'].address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x58B8a1cAE4c8eedE897c0c9987Ff4B5714eF3975' },
    }
  },

  // 3Crv/USDC
  {
    name: '3Crv/USDC',
    token0: getTokenInfo(TOKENS['3Crv'].address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x00cEf0386Ed94d738c8f8A74E8BFd0376926d24C' },
    }
  },

  // 3Crv/USDT
  {
    name: '3Crv/USDT',
    token0: getTokenInfo(TOKENS['3Crv'].address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0xd5Ad5EC825caC700D7deAfE3102Dc2B6Da6D195d' },
    }
  },

  // 3Crv/WETH
  {
    name: '3Crv/WETH',
    token0: getTokenInfo(TOKENS['3Crv'].address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x000ea4a83ACefdd62b1b43e9cCc281f442651520' },
      UniswapV3_10000: { fee: 10000, address: '0x4Ff7E1E713E30b0D1Fb9CD00477cEF399ff9D493' },
    }
  },

  // AAVE/LINK
  {
    name: 'AAVE/LINK',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.LINK.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x14243EA6bB3d64C8d54A1f47B077e23394D6528A' },
    }
  },

  // AAVE/USDC
  {
    name: 'AAVE/USDC',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xdceaf5d0E5E0dB9596A47C0c4120654e80B1d706' },
    }
  },

  // AAVE/WETH
  {
    name: 'AAVE/WETH',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      SushiswapV2: { fee: 0, address: '0xD75EA151a61d06868E31F8988D28DFE5E9df57B4' },
      UniswapV2: { fee: 0, address: '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f' },
      UniswapV3_3000: { fee: 3000, address: '0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB' },
    }
  },

  // ANKR/WETH
  {
    name: 'ANKR/WETH',
    token0: getTokenInfo(TOKENS.ANKR.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x13dC0a39dc00F394E030B97b0B569dedBe634c0d' },
      PancakeswapV3_10000: { fee: 10000, address: '0x0D5904169c549C9FD9FE796450C5450460c15F2c' },
    }
  },

  // APE/USDC
  {
    name: 'APE/USDC',
    token0: getTokenInfo(TOKENS.APE.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xB07Fe2F407F971125D4EB1977f8aCEe8846C7324' },
    }
  },

  // APE/WETH
  {
    name: 'APE/WETH',
    token0: getTokenInfo(TOKENS.APE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xAc4b3DacB91461209Ae9d41EC517c2B9Cb1B7DAF' },
      UniswapV3_10000: { fee: 10000, address: '0xF79fC43494ce8a4613Cb0b2a67A1b1207fD05D27' },
    }
  },

  // BAL/USDT
  {
    name: 'BAL/USDT',
    token0: getTokenInfo(TOKENS.BAL.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x099BDe3538bD8c597EA627FBebec9653b1dd0af0' },
    }
  },

  // BAL/WETH
  {
    name: 'BAL/WETH',
    token0: getTokenInfo(TOKENS.BAL.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9' },
    }
  },

  // BAT/WBTC
  {
    name: 'BAT/WBTC',
    token0: getTokenInfo(TOKENS.BAT.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x6fd7E2e1835a26A92d44878814fBF04f4cad1EF4' },
    }
  },

  // BAT/WETH
  {
    name: 'BAT/WETH',
    token0: getTokenInfo(TOKENS.BAT.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB6909B960DbbE7392D405429eB2b3649752b4838' },
      UniswapV3_3000: { fee: 3000, address: '0xAE614a7a56cB79c04Df2aeBA6f5dAB80A39CA78E' },
    }
  },

  // CHZ/USDC
  {
    name: 'CHZ/USDC',
    token0: getTokenInfo(TOKENS.CHZ.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x6f0C491f22c959D2280eD7F020fE1cd41BC285F8' },
    }
  },

  // CHZ/WETH
  {
    name: 'CHZ/WETH',
    token0: getTokenInfo(TOKENS.CHZ.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x1314AE4CF2A9440303fEf6Ae0FDc9ea5aD7a2A37' },
      UniswapV3_10000: { fee: 10000, address: '0x325365ED8275f6a74cac98917b7f6FaCe8da533b' },
    }
  },

  // COMP/USDC
  {
    name: 'COMP/USDC',
    token0: getTokenInfo(TOKENS.COMP.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xF15054BC50c39ad15FDC67f2AedD7c2c945ca5f6' },
    }
  },

  // COMP/WETH
  {
    name: 'COMP/WETH',
    token0: getTokenInfo(TOKENS.COMP.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f' },
      SushiswapV2: { fee: 0, address: '0x31503dcb60119A812feE820bb7042752019F2355' },
      UniswapV3_3000: { fee: 3000, address: '0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6' },
      UniswapV3_10000: { fee: 10000, address: '0x5598931BfBb43EEC686fa4b5b92B5152ebADC2f6' },
    }
  },

  // CRO/WETH
  {
    name: 'CRO/WETH',
    token0: getTokenInfo(TOKENS.CRO.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x87B1d1B59725209879CC5C5adEb99d8BC9EcCf12' },
    }
  },

  // CRV/WBTC
  {
    name: 'CRV/WBTC',
    token0: getTokenInfo(TOKENS.CRV.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x42A25A0fd1A1B4D4bdF9299C8e0e1078a65FD131' },
    }
  },

  // CRV/WETH
  {
    name: 'CRV/WETH',
    token0: getTokenInfo(TOKENS.CRV.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE' },
      SushiswapV2: { fee: 0, address: '0x58Dc5a51fE44589BEb22E8CE67720B5BC5378009' },
      UniswapV3_3000: { fee: 3000, address: '0x919Fa96e88d67499339577Fa202345436bcDaf79' },
      UniswapV3_10000: { fee: 10000, address: '0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e' },
    }
  },

  // CVX/WETH
  {
    name: 'CVX/WETH',
    token0: getTokenInfo(TOKENS.CVX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      SushiswapV2: { fee: 0, address: '0x05767d9EF41dC40689678fFca0608878fb3dE906' },
      UniswapV3_10000: { fee: 10000, address: '0x2E4784446A0a06dF3D1A040b03e1680Ee266c35a' },
    }
  },


  // LDO/DAI
  {
    name: 'LDO/DAI',
    token0: getTokenInfo(TOKENS.LDO.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xbBa38B5Bdd5A04AB5A9F52db87e64efc299B6bD5' },
    }
  },


  // DAI/REN
  {
    name: 'REN/DAI',
    token0: getTokenInfo(TOKENS.REN.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      // UniswapV3_3000: { fee: 3000, address: '0x509e47fa60138b8aFF8B943491907f411751F831' },
      UniswapV3_10000: { fee: 10000, address: '0x633397C54dACBFDe12cc8B09222fC658f1c569B0' },
    }
  },

  // DAI/USDC
  {
    name: 'DAI/USDC',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5' },
      UniswapV3_500: { fee: 500, address: '0x6c6Bc977E13Df9b0de53b251522280BB72383700' },
      UniswapV3_3000: { fee: 3000, address: '0xa63b490aA077f541c9d64bFc1Cc0db2a752157b5' },
      UniswapV3_10000: { fee: 10000, address: '0x6958686b6348c3D6d5f2dCA3106A5C09C156873a' },
    }
  },

  // DAI/USDT
  {
    name: 'DAI/USDT',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405' },
      UniswapV3_500: { fee: 500, address: '0x6f48ECa74B38d2936B02ab603FF4e36A6C0E3A77' },
      UniswapV3_3000: { fee: 3000, address: '0x4773E2C1c0B400a16DfeC4ca6E305141859a5542' },
    }
  },

  // DAI/WBTC
  {
    name: 'DAI/WBTC',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x391e8501b626c623d39474afca6f9e46c2686649' }
    }
  },

  // DAI/WETH
  {
    name: 'DAI/WETH',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11' },
      SushiswapV2: { fee: 0, address: '0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f' },
      SushiswapV3_500: { fee: 500, address: '0xabb097C772AcDc0b743EF85c59040E9bD8F8bDa4'  },
    }
  },

  // DOGE/USDT
  {
    name: 'DOGE/USDT',
    token0: getTokenInfo(TOKENS.DOGE.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xfCd13EA0B906f2f87229650b8D93A51B2e839EBD' },
      UniswapV3_3000: { fee: 3000, address: '0x1ab3E7bf6c2670C9905e635a95Aa84E982c9B1B2' },
    }
  },

  // DOGE/WETH
  {
    name: 'DOGE/WETH',
    token0: getTokenInfo(TOKENS.DOGE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xc0067d751FB1172DBAb1FA003eFe214EE8f419b6' },
    }
  },

  // ENJ/WETH
  {
    name: 'ENJ/WETH',
    token0: getTokenInfo(TOKENS.ENJ.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xE56c60B5f9f7B5FC70DE0eb79c6EE7d00eFa2625' },
      UniswapV3_3000: { fee: 3000, address: '0xe16Be1798F860bC1EB0FEb64cD67Ca00AE9b6E58' },
    }
  },

  // FTM/USDC
  {
    name: 'FTM/USDC',
    token0: getTokenInfo(TOKENS.FTM.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xC04C717941d17AAf37F645e9e96CA0Aa42fe244A' },
    }
  },

  // FTM/WETH
  {
    name: 'FTM/WETH',
    token0: getTokenInfo(TOKENS.FTM.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      SushiswapV2: { fee: 0, address: '0x0E26A21013f2F8C0362cFae608b4e69a249D5EFc' },
      UniswapV3_10000: { fee: 10000, address: '0x3B685307C8611AFb2A9E83EBc8743dc20480716E' },
    }
  },

  // FXS/WETH
  {
    name: 'FXS/WETH',
    token0: getTokenInfo(TOKENS.FXS.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xCD8286b48936cDAC20518247dBD310ab681A9fBf' },
    }
  },

  // GRT/USDC
  {
    name: 'GRT/USDC',
    token0: getTokenInfo(TOKENS.GRT.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xB06E7Ed37CFA8F0f2888355DD1913e45412798c5' },
    }
  },

  // GRT/WETH
  {
    name: 'GRT/WETH',
    token0: getTokenInfo(TOKENS.GRT.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x2e81eC0B8B4022fAC83A21B2F2B4B8f5ED744D70' },
      SushiswapV2: { fee: 0, address: '0x7B504a15ef05F4EED1C07208C5815c49022A0C19' },
      UniswapV3_3000: { fee: 3000, address: '0x0e2c4bE9F3408E5b1FF631576D946Eb8C224b5ED' },
      UniswapV3_10000: { fee: 10000, address: '0x46add4B3F80672989b9A1eAF62caD5206F5E2164' },
    }
  },

  // IMX/WETH
  {
    name: 'IMX/WETH',
    token0: getTokenInfo(TOKENS.IMX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x0149ebe930260CcfdaAA8e3081B4C39446b6F491' },
      SushiswapV2: { fee: 0, address: '0x18Cd890F4e23422DC4aa8C2D6E0Bd3F3bD8873d8' },
      UniswapV3_3000: { fee: 3000, address: '0x81fbBc40Cf075FD7De6AfCe1bc72EDA1BB0e13aa' },
      SushiswapV3_3000: { fee: 3000, address: '0x3Cc01DB5D1f99b262BCE9965ff6d5D7F9F9DBC68' },
      UniswapV3_10000: { fee: 10000, address: '0xFd76bE67FFF3BAC84E3D5444167bbC018f5968b6' },
    }
  },

  // IOTX/WETH
  {
    name: 'IOTX/WETH',
    token0: getTokenInfo(TOKENS.IOTX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x489cEbE6Cd5DC5dcB7047A1F0D4F358a5d2fB295' },
    }
  },

  // LDO/USDC
  {
    name: 'LDO/USDC',
    token0: getTokenInfo(TOKENS.LDO.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x78235D08B2aE7a3E00184329212a4d7AcD2F9985' },
    }
  },

  // LDO/WETH
  {
    name: 'LDO/WETH',
    token0: getTokenInfo(TOKENS.LDO.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x454F11D58E27858926d7a4ECE8bfEA2c33E97B13' },
      SushiswapV2: { fee: 0, address: '0xC558F600B34A5f69dD2f0D06Cb8A88d829B7420a' },
      UniswapV3_3000: { fee: 3000, address: '0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74' },
      UniswapV3_10000: { fee: 10000, address: '0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B' },
    }
  },

  // LINK/UNI
  {
    name: 'LINK/UNI',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.UNI.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x9f178e86E42DDF2379CB3D2AcF9Ed67A1eD2550a' },
    }
  },

  // LINK/USDC
  {
    name: 'LINK/USDC',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xFAD57d2039C21811C8F2B5D5B65308aa99D31559' },
    }
  },

  // LINK/USDT
  {
    name: 'LINK/USDT',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xac5A2c404EbBa22a869998089AC7893ff4E1F0a7' },
    }
  },

  // LINK/WBTC
  {
    name: 'LINK/WBTC',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x618004783d422DfB792D07D742549D5A24648dF2' },
    }
  },

  // LINK/WETH
  {
    name: 'LINK/WETH',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974' },
      SushiswapV2: { fee: 0, address: '0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967' },
      UniswapV3_500: { fee: 500, address: '0x5d4F3C6fA16908609BAC31Ff148Bd002AA6b8c83' },
      SushiswapV3_500: { fee: 500, address: '0xD60A872163A6A9C7b157dA621768c8C065778432' },
      UniswapV3_3000: { fee: 3000, address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8' },
      SushiswapV3_3000: { fee: 3000, address: '0xA5F43B0EBaEfbEd5B1f1bFc809AF15254EA1e9c4' },
      UniswapV3_10000: { fee: 10000, address: '0x3A0f221eA8B150f3D3d27DE8928851aB5264bB65' },
    }
  },

  // LRC/WETH
  {
    name: 'LRC/WETH',
    token0: getTokenInfo(TOKENS.LRC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x8878Df9E1A7c87dcBf6d3999D997f262C05D8C70' },
      UniswapV3_3000: { fee: 3000, address: '0xe1d92f1De49CAEC73514f696FEa2a7d5441498E5' },
      UniswapV3_10000: { fee: 10000, address: '0x3589697F57218bd57290aC18aE1c11b269AD964a' },
    }
  },

  // MANA/USDT
  {
    name: 'MANA/USDT',
    token0: getTokenInfo(TOKENS.MANA.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x065ff88d5Cf1963DAe5C1644f3F07550a2CB82dC' },
    }
  },

  // MANA/WETH
  {
    name: 'MANA/WETH',
    token0: getTokenInfo(TOKENS.MANA.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x11b1f53204d03E5529F09EB3091939e4Fd8c9CF3' },
      SushiswapV2: { fee: 0, address: '0x1bEC4db6c3Bc499F3DbF289F5499C30d541FEc97' },
      UniswapV3_3000: { fee: 3000, address: '0x8661aE7918C0115Af9e3691662f605e9c550dDc9' },
      SushiswapV3_3000: { fee: 3000, address: '0x5B02adAc06a5D8D688c63E7B7B54965fF9247Fd3' },
    }
  },

  // MATIC/USDT
  {
    name: 'MATIC/USDT',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x68F73e2180024DB5B54E0E119d4F5128953F9417' },
    }
  },

  // MATIC/WETH
  {
    name: 'MATIC/WETH',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x819f3450dA6f110BA6Ea52195B3beaFa246062dE' },
      UniswapV3_500: { fee: 500, address: '0xe3baA96aD46457d9e6cDD4e32ABC11e2C124eC49' },
      UniswapV3_3000: { fee: 3000, address: '0x290A6a7460B308ee3F19023D2D00dE604bcf5B42' },
      UniswapV3_10000: { fee: 10000, address: '0x99C7550be72F05ec31c446cD536F8a29C89fdB77' },
    }
  },

  // NMR/WETH
  {
    name: 'NMR/WETH',
    token0: getTokenInfo(TOKENS.NMR.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB784CED6994c928170B417BBd052A096c6fB17E2' },
      UniswapV3_3000: { fee: 3000, address: '0x4b1F895066058662B9fA885E87a4E4159bE0798a' },
      UniswapV3_10000: { fee: 10000, address: '0x8DF016708A66377DAE191Ca6F9ffF4705a3D951F' },
    }
  },

  // OCEAN/WETH
  {
    name: 'OCEAN/WETH',
    token0: getTokenInfo(TOKENS.OCEAN.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x9b7DaD79FC16106b47a3DAb791F389C167e15Eb0' },
      SushiswapV2: { fee: 0, address: '0xeE35E548C7457FcDd51aE95eD09108be660Ea374' },
      UniswapV3_3000: { fee: 3000, address: '0x283E2E83b7f3e297C4B7c02114Ab0196B001a109' },
    }
  },

  // PAXG/USDC
  {
    name: 'PAXG/USDC',
    token0: getTokenInfo(TOKENS.PAXG.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x5aE13BAAEF0620FdaE1D355495Dc51a17adb4082' },
      UniswapV3_3000: { fee: 3000, address: '0xB431c70f800100D87554ac1142c4A94C5Fe4C0C4' },
      UniswapV3_10000: { fee: 10000, address: '0x1D61fB4c87361F27bD3BE39A06d1A19f0c5d696B' },
    }
  },

  // PAXG/USDT
  {
    name: 'PAXG/USDT',
    token0: getTokenInfo(TOKENS.PAXG.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x7Cb85f75e61226060453a997a7733F76707Df337' },
      UniswapV3_10000: { fee: 10000, address: '0x91A76255ddEEe3F03267C9Cbe5A28311A6ABB58d' },
    }
  },

  // PAXG/WBTC
  {
    name: 'PAXG/WBTC',
    token0: getTokenInfo(TOKENS.PAXG.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x5A2AbDC02EcC86Fa3d015f498EC2f2C190C11700' },
    }
  },

  // PAXG/WETH
  {
    name: 'PAXG/WETH',
    token0: getTokenInfo(TOKENS.PAXG.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x9C4Fe5FFD9A9fC5678cFBd93Aa2D4FD684b67C4C' },
      UniswapV3_3000: { fee: 3000, address: '0x8A7e585048bdA875e64024118c506B14f78166dd' },
      UniswapV3_10000: { fee: 10000, address: '0xcb1Abb2731a48D8819f03808013C0a0E48D9B3d9' },
    }
  },

  // PEPE/USDC
  {
    name: 'PEPE/USDC',
    token0: getTokenInfo(TOKENS.PEPE.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xcEE31C846CbF003F4cEB5Bbd234cBA03C6e940C7' },
    }
  },

  // PEPE/USDT
  {
    name: 'PEPE/USDT',
    token0: getTokenInfo(TOKENS.PEPE.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x9B96128A3F770FAF7a882Af4b0156E6976feD3d0' },
      UniswapV3_3000: { fee: 3000, address: '0xa7BC6c09907fa2ded89F1c8D05374621cB1F88c5' },
    }
  },

  // PEPE/WBTC
  {
    name: 'PEPE/WBTC',
    token0: getTokenInfo(TOKENS.PEPE.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x992C59D45DD67706d7AAa118Beb331C203858417' },
    }
  },

  // PEPE/WETH
  {
    name: 'PEPE/WETH',
    token0: getTokenInfo(TOKENS.PEPE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f' },
      UniswapV3_3000: { fee: 3000, address: '0x11950d141EcB863F01007AdD7D1A342041227b58' },
      UniswapV3_10000: { fee: 10000, address: '0xF239009A101B6B930A527DEaaB6961b6E7deC8a6' },
      PancakeswapV3_10000: { fee: 10000, address: '0x3202AcfD55232f3706aa81a4F18A98686B5e1d1B' },
    }
  },

  // REN/WETH
  {
    name: 'REN/WETH',
    token0: getTokenInfo(TOKENS.REN.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x2dD56b633FAa1A5B46107d248714C9cCB6e20920' },
      SushiswapV3_3000: { fee: 3000, address: '0xBF9760b95639f23202425B9feEdE894224A5a7Ed' },
    }
  },

  // RPL/WETH
  {
    name: 'RPL/WETH',
    token0: getTokenInfo(TOKENS.RPL.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xe42318eA3b998e8355a3Da364EB9D48eC725Eb45' },
    }
  },

  // RSR/USDC
  {
    name: 'RSR/USDC',
    token0: getTokenInfo(TOKENS.RSR.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x167a3874664561B1c4F8F99C40CFB268Df1a5A21' },
    }
  },

  // RSR/WETH
  {
    name: 'RSR/WETH',
    token0: getTokenInfo(TOKENS.RSR.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x32D9259e6792B2150FD50395D971864647FA27B2' },
      UniswapV3_10000: { fee: 10000, address: '0xA3a9a863Ed908aa95cB17e1781Aa97E6693bF604' },
    }
  },

  // SAND/USDC
  {
    name: 'SAND/USDC',
    token0: getTokenInfo(TOKENS.SAND.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x5864DEa5f1750D1f8887F9FB7f3a50F15789514E' },
    }
  },

  // SAND/WETH
  {
    name: 'SAND/WETH',
    token0: getTokenInfo(TOKENS.SAND.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x3dd49f67E9d5Bc4C5E6634b3F70BfD9dc1b6BD74' },
      UniswapV3_500: { fee: 500, address: '0xb3fe3BAD93B4F2e35FEa390F6D607B35550BAF97' },
      UniswapV3_3000: { fee: 3000, address: '0x5859ebE6Fd3BBC6bD646b73a5DbB09a5D7B6e7B7' },
      UniswapV3_10000: { fee: 10000, address: '0x5b97B125CF8aF96834F2D08c8f1291BD47724939' },
    }
  },

  // SHIB/USDC
  {
    name: 'SHIB/USDC',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xA15cc73E881c06D8DB06b50b7a3688B763C18350' },
    }
  },

  // SHIB/USDT
  {
    name: 'SHIB/USDT',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0x9470ebd69A50fbE965B5ff0e62a775F8D7Ed5ee0' },
      UniswapV3_3000: { fee: 3000, address: '0xB0cC75ed5AaBB0aCce7cbf0302531Bb260d259C4' }
    }
  },

  // SHIB/WETH
  {
    name: 'SHIB/WETH',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x811beEd0119b4AfCE20D2583EB608C6F7AF1954f' },
      UniswapV3_500: { fee: 500, address: '0x94E4b2E24523CF9B3e631A6943C346dF9687c723' },
      UniswapV3_3000: { fee: 3000, address: '0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec' },
      UniswapV3_10000: { fee: 10000, address: '0x5764a6F2212D502bC5970f9f129fFcd61e5D7563' },
    }
  },

  // SNX/USDC
  {
    name: 'SNX/USDC',
    token0: getTokenInfo(TOKENS.SNX.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x020C349A0541D76C16F501Abc6B2E9c98AdAe892' },
    }
  },

  // SNX/WETH
  {
    name: 'SNX/WETH',
    token0: getTokenInfo(TOKENS.SNX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x43AE24960e5534731Fc831386c07755A2dc33D47' },
      SushiswapV2: { fee: 0, address: '0xA1d7b2d891e3A1f9ef4bBC5be20630C2FEB1c470' },
      UniswapV3_3000: { fee: 3000, address: '0xEDe8dd046586d22625Ae7fF2708F879eF7bdb8CF' },
      SushiswapV3_3000: { fee: 3000, address: '0x23F12937456Fb34688d0f6aeB8C78429f60873A7' },
      UniswapV3_10000: { fee: 10000, address: '0xf5ce0293C24FD0990E0a5758E53f66a36cA0118f' },
    }
  },

  // SUSHI/USDC
  {
    name: 'SUSHI/USDC',
    token0: getTokenInfo(TOKENS.SUSHI.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0x184C33b7B1089747440057e46B4E2Bb61F09Bc8D' },
    }
  },

  // SUSHI/WETH
  {
    name: 'SUSHI/WETH',
    token0: getTokenInfo(TOKENS.SUSHI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xCE84867c3c02B05dc570d0135103d3fB9CC19433' },
      SushiswapV2: { fee: 0, address: '0x795065dCc9f64b5614C407a6EFDC400DA6221FB0' },
      UniswapV3_3000: { fee: 3000, address: '0x73A6a761FE483bA19DeBb8f56aC5bbF14c0cdad1' },
      SushiswapV3_3000: { fee: 3000, address: '0x87C7056BBE6084f03304196Be51c6B90B6d85Aa2' },
    }
  },

  // UMA/WETH
  {
    name: 'UMA/WETH',
    token0: getTokenInfo(TOKENS.UMA.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      SushiswapV2: { fee: 0, address: '0x001b6450083E531A5a7Bf310BD2c1Af4247E23D4' },
      UniswapV3_3000: { fee: 3000, address: '0x157Dfa656Fdf0D18E1bA94075a53600D81cB3a97' },
    }
  },

  // UNI/USDC
  {
    name: 'UNI/USDC',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xD0fC8bA7E267f2bc56044A7715A489d851dC6D78' },
    }
  },

  // UNI/USDT
  {
    name: 'UNI/USDT',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x3470447f3CecfFAc709D3e783A307790b0208d60' },
    }
  },

  // UNI/WBTC
  {
    name: 'UNI/WBTC',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x8F0CB37cdFF37E004E0088f563E5fe39E05CCC5B' },
    }
  },

  // UNI/WETH
  {
    name: 'UNI/WETH',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17' },
      SushiswapV2: { fee: 0, address: '0xDafd66636E2561b0284EDdE37e42d192F2844D40' },
      UniswapV3_500: { fee: 500, address: '0xfaA318479b7755b2dBfDD34dC306cb28B420Ad12' },
      UniswapV3_3000: { fee: 3000, address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801' },
      UniswapV3_10000: { fee: 10000, address: '0x360b9726186C0F62cc719450685ce70280774Dc8' },
    }
  },

  // USDC/USDT
  {
    name: 'USDC/USDT',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f' },
      UniswapV3_500: { fee: 500, address: '0x7858E59e0C01EA06Df3aF3D20aC7B0003275D4Bf' },
      UniswapV3_3000: { fee: 3000, address: '0xEe4Cf3b78A74aFfa38C6a926282bCd8B5952818d' },
    }
  },

  // USDC/WBTC
  {
    name: 'WBTC/USDC',
    token0: getTokenInfo(TOKENS.WBTC.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x004375Dff511095CC5A197A54140a24eFEF3A416' },
      UniswapV3_3000: { fee: 3000, address: '0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35' },
      UniswapV3_10000: { fee: 10000, address: '0xCBFB0745b8489973Bf7b334d54fdBd573Df7eF3c' },
    }
  },

  // USDC/WETH
  {
    name: 'USDC/WETH',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc' },
      SushiswapV2: { fee: 0, address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0' },
      UniswapV3_500: { fee: 500, address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640' },
      SushiswapV3_500: { fee: 500, address: '0x35644Fb61aFBc458bf92B15AdD6ABc1996Be5014' },
      PancakeswapV3_500: { fee: 500, address: '0x1ac1A8FEaAEa1900C4166dEeed0C11cC10669D36' },
      UniswapV3_3000: { fee: 3000, address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8' },
      SushiswapV3_3000: { fee: 3000, address: '0x763d3b7296e7C9718AD5B058aC2692A19E5b3638' },
      UniswapV3_10000: { fee: 10000, address: '0x7BeA39867e4169DBe237d55C8242a8f2fcDcc387' },
      SushiswapV3_10000: { fee: 10000, address: '0x1D437AC0a77d9d0Ab6A512A6b054930Aa582A5B7' },
    }
  },

  // USDC/YFI
  {
    name: 'YFI/USDC',
    token0: getTokenInfo(TOKENS.YFI.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_10000: { fee: 10000, address: '0xbfAcdf75F59988f18700d46f85095CDA600E2192' },
    }
  },

  // USDT/WBTC
  {
    name: 'WBTC/USDT',
    token0: getTokenInfo(TOKENS.WBTC.address),
    token1: getTokenInfo(TOKENS.USDT.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x9Db9e0e53058C89e5B94e29621a205198648425B' },
    }
  },

  // USDT/WETH
  {
    name: 'USDT/WETH',
    token0: getTokenInfo(TOKENS.USDT.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852' },
      SushiswapV2: { fee: 0, address: '0x06da0fd433C1A5d7a4faa01111c044910A184553' },
      UniswapV3_500: { fee: 500, address: '0x11b815efB8f581194ae79006d24E0d814B7697F6' },
      SushiswapV3_500: { fee: 500, address: '0x72c2178E082feDB13246877B5aA42ebcE1b72218' },
      PancakeswapV3_500: { fee: 500, address: '0x6CA298D2983aB03Aa1dA7679389D955A4eFEE15C' },
      UniswapV3_3000: { fee: 3000, address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36' },
      SushiswapV3_3000: { fee: 3000, address: '0x6a11ED98B1a3ac36A768ebbbbA36DED101Da5a3f' },
      UniswapV3_10000: { fee: 10000, address: '0xC5aF84701f98Fa483eCe78aF83F11b6C38ACA71D' },
    }
  },

  // WBTC/WETH
  {
    name: 'WBTC/WETH',
    token0: getTokenInfo(TOKENS.WBTC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940' },
      SushiswapV2: { fee: 0, address: '0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58' },
    }
  },

  // YFI/WETH
  {
    name: 'YFI/WETH',
    token0: getTokenInfo(TOKENS.YFI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x2fDbAdf3C4D5A8666Bc06645B8358ab803996E28' },
      SushiswapV2: { fee: 0, address: '0x088ee5007C98a9677165D78dD2109AE4a3D04d0C' },
    }
  },

  // WETH/ZRX
  {
    name: 'ZRX/WETH',
    token0: getTokenInfo(TOKENS.ZRX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xc6F348dd3B91a56D117ec0071C1e9b83C0996De4' },
      UniswapV3_3000: { fee: 3000, address: '0x14424eEeCbfF345B38187d0B8b749E56FAA68539' },
    }
  },

  { name: 'RSR/USDC', token0: getTokenInfo(TOKENS.RSR.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0x167a3874664561B1c4F8F99C40CFB268Df1a5A21' }}},
  { name: 'RSR/WETH', token0: getTokenInfo(TOKENS.RSR.address), token1: getTokenInfo(TOKENS.WETH.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0x32D9259e6792B2150FD50395D971864647FA27B2' }}},

  // PEPE – insane volume
  { name: 'PEPE/USDC', token0: getTokenInfo(TOKENS.PEPE.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0xcEE31C846CbF003F4cEB5Bbd234cBA03C6e940C7' }}},
  { name: 'PEPE/USDT', token0: getTokenInfo(TOKENS.PEPE.address), token1: getTokenInfo(TOKENS.USDT.address),
    pools: { UniswapV3_500: { fee: 500, address: '0x9B96128A3F770FAF7a882Af4b0156E6976feD3d0' }}},

  // LDO (Lido) – top 15 token
  { name: 'LDO/USDC', token0: getTokenInfo(TOKENS.LDO.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0x78235D08B2aE7a3E00184329212a4d7AcD2F9985' }}},

  // 1INCH
  { name: '1INCH/USDC', token0: getTokenInfo(TOKENS['1INCH'].address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_500: { fee: 500, address: '0x62773f00cd3e0df3D70bECA5Aee342B0151fE78a' }}},

  // SHIB direct stable pairs
  { name: 'SHIB/USDC', token0: getTokenInfo(TOKENS.SHIB.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0xA15cc73E881c06D8DB06b50b7a3688B763C18350' }}},

  // LINK direct stables
  { name: 'LINK/USDC', token0: getTokenInfo(TOKENS.LINK.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0xFAD57d2039C21811C8F2B5D5B65308aa99D31559' }}},

  // UNI direct stables
  { name: 'UNI/USDC', token0: getTokenInfo(TOKENS.UNI.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0xD0fC8bA7E267f2bc56044A7715A489d851dC6D78' }}},

  // AAVE stables
  { name: 'AAVE/USDC', token0: getTokenInfo(TOKENS.AAVE.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0xdceaf5d0E5E0dB9596A47C0c4120654e80B1d706' }}},

  // CRV stables
  { name: 'CRV/USDC', token0: getTokenInfo(TOKENS.CRV.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0x9445bd19767F73DCaE6f2De90e6cd31192F62589' }}},

  // SAND stables
  { name: 'SAND/USDC', token0: getTokenInfo(TOKENS.SAND.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0x5864DEa5f1750D1f8887F9FB7f3a50F15789514E' }}},

  // MANA stables
  { name: 'MANA/USDC', token0: getTokenInfo(TOKENS.MANA.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0x7BeA39867e4169DBe237d55C8242a8f2fcDcc387' }}},

  // APE stables
  { name: 'APE/USDC', token0: getTokenInfo(TOKENS.APE.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0xB07Fe2F407F971125D4EB1977f8aCEe8846C7324' }}},

  // GRT stables
  { name: 'GRT/USDC', token0: getTokenInfo(TOKENS.GRT.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0xB06E7Ed37CFA8F0f2888355DD1913e45412798c5' }}},

  // MATIC stables
  { name: 'MATIC/USDC', token0: getTokenInfo(TOKENS.MATIC.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_3000: { fee: 3000, address: '0x07A6E955bA4345BAe83Ac2A6fAa771fddd8A2011' }}},
  

  // Extra cross pairs that create triangles
  { name: 'LDO/DAI', token0: getTokenInfo(TOKENS.LDO.address), token1: getTokenInfo(TOKENS.DAI.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0xbBa38B5Bdd5A04AB5A9F52db87e64efc299B6bD5' }}},
  { name: 'FXS/USDC', token0: getTokenInfo(TOKENS.FXS.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_10000: { fee: 10000, address: '0xCD8286b48936cDAC20518247dBD310ab681A9fBf' }}},

  // Final killer triangles
  { name: 'WETH/USDC', token0: getTokenInfo(TOKENS.WETH.address), token1: getTokenInfo(TOKENS.USDC.address),
    pools: { UniswapV3_500: { fee: 500, address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640' }}},
  { name: 'WETH/USDT', token0: getTokenInfo(TOKENS.WETH.address), token1: getTokenInfo(TOKENS.USDT.address),
    pools: { UniswapV3_500: { fee: 500, address: '0x11b815efB8f581194ae79006d24E0d814B7697F6' }}},
  { name: 'USDC/USDT', token0: getTokenInfo(TOKENS.USDC.address), token1: getTokenInfo(TOKENS.USDT.address),
    pools: { UniswapV3_500: { fee: 500, address: '0x7858E59e0C01EA06Df3aF3D20aC7B0003275D4Bf' }}},
];


// Final export
export default {
  TOKENS,
  DIRECT_SWAP_PAIRS,
};