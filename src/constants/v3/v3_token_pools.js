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
  // SHIB/WETH
  {
    name: 'SHIB/WETH',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x811beEd0119b4AfCE20D2583EB608C6F7AF1954f' },
      UniswapV3_3000: { fee: 3000, address: '0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec' },
      UniswapV3_10000: { fee: 10000, address: '0x5764a6F2212D502bC5970f9f129fFcd61e5D7563' }
    }
  },

  // WBTC/WETH
  {
    name: 'WBTC/WETH',
     token0: getTokenInfo(TOKENS.WBTC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940'},
      SushiswapV2: { fee: 0, address: '0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58' },
    }
  },
  
  


  // SHIB/USDC
  {
    name: 'SHIB/USDC',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0xe9131A276FD07AF729B5537A429346e8AfFc67e0' },
      UniswapV3_10000: { fee: 10000, address: '0xA15cc73E881c06D8DB06b50b7a3688B763C18350' }
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


  // MATIC/WETH
  {
    name: 'MATIC/WETH',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x819f3450dA6f110BA6Ea52195B3beaFa246062dE' },
      UniswapV3_500: { fee: 500, address: '0xe3baA96aD46457d9e6cDD4e32ABC11e2C124eC49' },
      UniswapV3_3000: { fee: 3000, address: '0x290A6a7460B308ee3F19023D2D00dE604bcf5B42' },
      UniswapV3_10000: { fee: 10000, address: '0x99C7550be72F05ec31c446cD536F8a29C89fdB77' }
    }
  },

  // MATIC/USDC
  {
    name: 'MATIC/USDC',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      UniswapV3_500: { fee: 500, address: '0xB8eCed0C3cae8847454aA4900d7751d0BD8d23Cf' },
      UniswapV3_3000: { fee: 3000, address: '0x07A6E955bA4345BAe83Ac2A6fAa771fddd8A2011' },
      UniswapV3_10000: { fee: 10000, address: '0x9da1d1c9353B32C9E15aDF11faDbe9F0860fCcfa' }
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

  // MATIC/DAI
  {
    name: 'MATIC/DAI',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x07510b2DD84bF8187063a3c49533663518C2B6b7' },
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
      UniswapV3_3000: { fee: 3000, address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801' },
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

  // LINK/WETH
  {
    name: 'LINK/WETH',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974' },
      SushiswapV2: { fee: 0, address: '0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967' },
      UniswapV3_500: { fee: 500, address: '0x5d4F3C6fA16908609BAC31Ff148Bd002AA6b8c83' },
      UniswapV3_3000: { fee: 3000, address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8' },
      UniswapV3_10000: { fee: 10000, address: '0x3A0f221eA8B150f3D3d27DE8928851aB5264bB65' },
      SushiswapV3_500: { fee: 500, address: '0xD60A872163A6A9C7b157dA621768c8C065778432' },
      SushiswapV3_3000: { fee: 3000, address: '0xA5F43B0EBaEfbEd5B1f1bFc809AF15254EA1e9c4' },
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

  // CRV/WETH
  {
    name: 'CRV/WETH',
    token0: getTokenInfo(TOKENS.CRV.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE' },
      SushiswapV2: { fee: 0, address: '0x58Dc5a51fE44589BEb22E8CE67720B5BC5378009' },
      UniswapV3_3000: { fee: 3000, address: '0x919Fa96e88d67499339577Fa202345436bcDaf79' },
      UniswapV3_10000: { fee: 10000, address: '0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e' }
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

  // AAVE/WETH
  {
    name: 'AAVE/WETH',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f' },
      SushiswapV2: { fee: 0, address: '0xD75EA151a61d06868E31F8988D28DFE5E9df57B4' },
      UniswapV3_3000: { fee: 3000, address: '0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB' },
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

  // COMP/WETH
  {
    name: 'COMP/WETH',
    token0: getTokenInfo(TOKENS.COMP.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f' },
      SushiswapV2: { fee: 0, address: '0x31503dcb60119A812feE820bb7042752019F2355' },
      UniswapV3_3000: { fee: 3000, address: '0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6' },
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
      UniswapV3_10000: { fee: 10000, address: '0xf5ce0293C24FD0990E0a5758E53f66a36cA0118f' }
    }
  },

  // SNX/USDC
  {
    name: 'SNX/USDC',
    token0: getTokenInfo(TOKENS.SNX.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      
      UniswapV3_10000: { fee: 10000, address: '0x020C349A0541D76C16F501Abc6B2E9c98AdAe892' }
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

  // YFI/WETH
  {
    name: 'YFI/WETH',
    token0: getTokenInfo(TOKENS.YFI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x2fdbadf3c4d5a8666bc06645b8358ab803996e28' },
      SushiswapV2: { fee: 0, address: '0x088ee5007C98a9677165D78dD2109AE4a3D04d0C' },
    }
  },

  // Core pairs (already in your original list – kept for completeness)
  {
    name: 'USDC/WETH',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc' },
      SushiswapV2: { fee: 0, address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0' },
      UniswapV3_3000: { fee: 3000, address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8' },

      SushiswapV3_3000: { fee: 3000, address: '0x763d3b7296e7C9718AD5B058aC2692A19E5b3638'  },
      SushiswapV3_10000: { fee: 10000, address: '0x1D437AC0a77d9d0Ab6A512A6b054930Aa582A5B7' },

      PancakeswapV3_500: { fee: 500, address: '0x1ac1A8FEaAEa1900C4166dEeed0C11cC10669D36' },
    }
  },
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
  {
    name: 'WETH/WBTC',
    token0: getTokenInfo(TOKENS.WETH.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940' },
      SushiswapV2: { fee: 0, address: '0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58' },
      UniswapV3: { fee: 3000, address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD' },
    }
  },
  {
    name: 'USDT/WETH',
    token0: getTokenInfo(TOKENS.USDT.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852' },
      SushiswapV2: { fee: 0, address: '0x06da0fd433C1A5d7a4faa01111c044910A184553' },
      UniswapV3_500: { fee: 500, address: '0x11b815efB8f581194ae79006d24E0d814B7697F6' },
      UniswapV3_3000: { fee: 3000, address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36' },
      SushiswapV3_3000: { fee: 3000, address: '0x6a11ED98B1a3ac36A768ebbbbA36DED101Da5a3f'  },
      PancakeswapV3_500: { fee: 500, address: '0x6CA298D2983aB03Aa1dA7679389D955A4eFEE15C'  },
      PancakeswapV3_10000: { fee: 10000, address: '0x486B54c7FFbA86246652C7444dc9498e8D8b627c'  },
    }
  },
  {
    name: 'DAI/WBTC',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV3_3000: { fee: 3000, address: '0x391e8501b626c623d39474afca6f9e46c2686649' }
    }
  },
  {
    name: 'DAI/USDC',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5' },
    }
  },
  {
    name: 'USDC/WBTC',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x004375Dff511095CC5A197A54140a24eFEF3A416' },
      UniswapV3_3000: { fee: 3000, address: '0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35' },
    }
  },
];

// Final export
export default {
  TOKENS,
  DIRECT_SWAP_PAIRS,
};