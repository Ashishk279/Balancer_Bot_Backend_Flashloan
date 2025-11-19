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
  // NEIRO: new Token(1, '0xee2a03aa6dacf51c18679c516ad5283d8e7c2637', 9, 'NEIRO', 'Neiro Token'),
  DBAR: new Token(1, '0x444D8C5cF62ebC5F1f05D78FDB7148Ccd00583B5', 18, 'DBAR', 'Dbar Token'),
  ONI: new Token(1, '0x7777Cec341E7434126864195adEf9B05DCC3489C', 18, 'ONI', 'Oni Token'),
  // ITO: new Token(1, '0x8bcda22d51785a5540129feb90d47cb279826478', 9, 'ITO', 'Ito Token'),
  NXRA: new Token(1, '0x7777Cec341E7434126864195adEf9B05DCC3489C', 18, 'NXRA', 'Nxra Token'),
  // HACHI: new Token(1, '0xa7dd9c5932b621cdba215d3b4f57a878ad7d9248', 9, 'HACHI', 'Hachi Token'),
  // KEN: new Token(1, '0x7316d973b0269863bbfed87302e11334e25ea565', 9, 'KEN', 'ken Token'),
  PBAR: new Token(1, '0x1111b1ea9129f312aea5ea13a496d1839809f974', 18, 'PBAR', 'Pbar Token'),
  // TSUJI: new Token(1, '0x2E6a60492fB5b58F5b5D08c7cAFc75e740E6Dc8e', 9, 'TSUJI', 'Tsuji Token'),
  // Neiro: new Token(1, '0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee', 9, 'Neiro', 'Neiro Token'),
  // GINNAN: new Token(1, '0x812ba41e071c7b7fa4ebcfb62df5f45f6fa853ee', 9, 'GINNAN', 'Ginnam Token'),
  crvUSD: new Token(1, '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e', 18, 'crvUSD', 'Curve.Fi Token'),
  wDOGE: new Token(1, '0xbd262fc49a94e8fb9998c8007cb3c21212e0f008', 18, 'wDOGE', 'Wrapped Dogecoin'),
  // IRO: new Token(1, '0xba2ae4e0a9c6ecaf172015aa2cdd70a21f5a290b', 9, 'IRO', 'Iro Token'),
  // HITMAN: new Token(1, '0x0047a674f18afa0666fa292e1e213e3f9ea353eb', 9, 'HITMAN', 'Hitman Token'),
  BAR: new Token(1, '0x777be1c6075c20184c4fd76344b7b0b7c858fe6b', 18, 'BAR', 'Bar Token'),
  WAI: new Token(1, '0xfe8526a77a2c3590e5973ba81308b90bea21fbff', 18, 'WAI', 'Wai Token'),
  

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
      // SushiswapV2: { fee: 0, address: '0x24D3dD4a62e29770cf98810b09F89D3A90279E7a' },
      // UniswapV3_500: { fee: 500, address: '0x94E4b2E24523CF9B3e631A6943C346dF9687c723' },
      UniswapV3_3000: { fee: 3000, address: '0x2F62f2B4c5fcd7570a709DeC05D68EA19c82A9ec' },
      UniswapV3_10000: { fee: 10000, address: '0x5764a6F2212D502bC5970f9f129fFcd61e5D7563' }
    }
  },

  // NEIRO/WETH
  // {
  //   name: 'NEIRO/WETH',
  //    token0: getTokenInfo(TOKENS.NEIRO.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x3885fbe4CD8aeD7b7e9625923927Fa1CE30662A3' },
  //     UniswapV3_3000: { fee: 3000, address: '0xFA45c879Fd120d6Cc493113Ae212A853531F3d91' },
  //     UniswapV3_10000: { fee: 10000, address: '0x9073D1E814483e3c91E9B4D7b2A81C30B93229B1' }
  //   }
  // },
  // DBAR/WETH
  // {
  //   name: 'DBAR/WETH',
  //    token0: getTokenInfo(TOKENS.DBAR.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xC362281df381Ad275559c17803923B5E11A74852' },
  //   }
  // },
  // ONI/WETH
  // {
  //   name: 'ONI/WETH',
  //    token0: getTokenInfo(TOKENS.ONI.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x4103E658a8AcAB924a9a2d3750E6cf3Fb932A186' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x5024237f3d0cCaa4afE185a194eA8690E5Ac5F79' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xFFB4decCB4b9455aFAecdf209098fF06E54BeeBB'}
  //   }
  // },
  // ITO/WETH
  // {
  //   name: 'ITO/WETH',
  //    token0: getTokenInfo(TOKENS.ITO.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xaFEfd2124eEFB2eb634d3790D7ce0133c9732186' },
  //     UniswapV3_10000: { fee: 10000, address: '0xF803aAfF594139C50FB44D9548A1909ff2D54c9F'}
  //   }
  // },
  // NXRA/WETH
  // {
  //   name: 'NXRA/WETH',
  //    token0: getTokenInfo(TOKENS.NXRA.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV3_10000: { fee: 10000, address: '0x755F01736f93C91585b840C2179c560B754D69F3'}
  //   }
  // },
  // // HACHI/WETH
  // {
  //   name: 'HACHI/WETH',
  //    token0: getTokenInfo(TOKENS.HACHI.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x4c77eb65CEb6494F68720b306C2708b880953A6b'}
  //   }
  // },
  // KEN/WETH
  // {
  //   name: 'KEN/WETH',
  //    token0: getTokenInfo(TOKENS.KEN.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x60E3e9887DC92BD48756cf44F45fbc3b19F76927'},
  //     UniswapV3_10000: { fee: 10000, address: '0xeac5F0FcfA164D6d43a8C8c4e67B72560A41A0F6'}
  //   }
  // },
 
  // PBAR/WETH
  // {
  //   name: 'PBAR/WETH',
  //    token0: getTokenInfo(TOKENS.PBAR.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xdB177f8a2258529169CD1CeD8C1dA02e531D6991'},
  //     UniswapV3_10000: { fee: 10000, address: '0xA046601367BaDd07ec3082516d0C03484411A7Fe'},
  //   }
  // },
  // TSUJI/WETH
  // {
  //   name: 'TSUJI/WETH',
  //    token0: getTokenInfo(TOKENS.TSUJI.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x229C4580cc43D18bAe24bd541688983bCEfE0377'},
  //     UniswapV3_10000: { fee: 10000, address: '0x39095bcCfF01Df7F26C743441d324078dDE61049'},
  //   }
  // },
  // Neiro/WETH
  // {
  //   name: 'Neiro/WETH',
  //    token0: getTokenInfo(TOKENS.Neiro.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xC555D55279023E732CcD32D812114cAF5838fD46'},
  //     UniswapV3_500: { fee: 500, address: '0xb00779E5b3f48F631283C5B73150A42020B4c9Af'},
  //     UniswapV3_3000: { fee: 3000, address: '0x15153Da0E9e13cfC167b3D417d3721bF545479bB'},
  //     UniswapV3_10000: { fee: 10000, address: '0x79A6683D82F25535Ff3fD2753E03e0961060e882'},
  //   }
  // },
  // WBTC/WETH
  // {
  //   name: 'WBTC/WETH',
  //    token0: getTokenInfo(TOKENS.WBTC.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940'},
  //     UniswapV3_3000: { fee: 3000, address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD'},
  //     UniswapV3_500: { fee: 500, address: '0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0'},
  //     UniswapV3_10000: { fee: 10000, address: '0x6Ab3bba2F41e7eAA262fa5A1A9b3932fA161526F'},
  //   }
  // },
  // GINNAN/WETH
  // {
  //   name: 'GINNAN/WETH',
  //    token0: getTokenInfo(TOKENS.GINNAN.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xa5D739430718451756a7C97254939CbdD25A83EC'},
  //     UniswapV3_10000: { fee: 10000, address: '0x5D4001DFb655205984015F5a65eEdA76C8A609c9'},
  //   }
  // },
  // crvUSD/WETH
  // {
  //   name: 'crvUSD/WETH',
  //    token0: getTokenInfo(TOKENS.crvUSD.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xFd3Eb81D138B24EFCF2C533Ef117013614CCe4E3'},
  //     UniswapV3_500: { fee: 500, address: '0xFA30445306d4B4Db5cfa92076dd527A97d366aF9'},
  //   }
  // },
  // wDOGE/WETH
  // {
  //   name: 'wDOGE/WETH',
  //    token0: getTokenInfo(TOKENS.wDOGE.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xE276ca2a1252B6B9e0fe4847982863F8740e3746'}
  //   }
  // },
  // IRO/WETH
  // {
  //   name: 'IRO/WETH',
  //    token0: getTokenInfo(TOKENS.IRO.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x0c0C910c530246b55b517cdF2f2199b8a9193A80'}
  //   }
  // },
  // // HITMAN/WETH
  // {
  //   name: 'HITMAN/WETH',
  //    token0: getTokenInfo(TOKENS.HITMAN.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x337F39Bd6D52812f399a9CA01E046aD837765C6B'},
  //     UniswapV3_10000: { fee: 10000, address: '0x591395905D58aBf87180C1e652A06aF35D740C8f'},
  //   }
  // },
  // BAR/WETH
  // {
  //   name: 'BAR/WETH',
  //    token0: getTokenInfo(TOKENS.BAR.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xCe5deBe9Dd76f96BB5FA00Eb3cC084D43Ec0DBf3'},
  //     UniswapV3_3000: { fee: 3000, address: '0xA9783344C841d2117DAc3DfFed0C5bb29ae48cb0'},
  //     UniswapV3_10000: { fee: 10000, address: '0x87529624709101f2a731Ea0E3E393552d491375b'},
  //   }
  // },

   // WAI/WETH
  // {
  //   name: 'WAI/WETH',
  //    token0: getTokenInfo(TOKENS.WAI.address),
  //   token1: getTokenInfo(TOKENS.WETH.address),
  //   pools: {
  //     UniswapV3_3000: { fee: 3000, address: '0x51d1ac117aAdd99e7Fc56E802C86A7464cb6AB9d'}
  //   }
  // },



  // SHIB/USDC
  {
    name: 'SHIB/USDC',
    token0: getTokenInfo(TOKENS.SHIB.address),
    token1: getTokenInfo(TOKENS.USDC.address),
    pools: {
      // UniswapV2: { fee: 0, address: '0x881d5c98866a08f90A6F60E3F94f0e461093D049' },
      // UniswapV3_500: { fee: 500, address: '0xFFC048FB0d686d5dF9563441aaF3cAcDD3374E6c' },
      UniswapV3_3000: { fee: 3000, address: '0xe9131A276FD07AF729B5537A429346e8AfFc67e0' },
      UniswapV3_10000: { fee: 10000, address: '0xA15cc73E881c06D8DB06b50b7a3688B763C18350' }
    }
  },

  // SHIB/USDT
  // {
  //   name: 'SHIB/USDT',
  //   token0: getTokenInfo(TOKENS.SHIB.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     // UniswapV2: { fee: 0, address: '0x773dD321873fe70553ACC295b1b49A104d968CC8' },
  //     // UniswapV3_500: { fee: 500, address: '0x9470ebd69A50fbE965B5ff0e62a775F8D7Ed5ee0' },
  //     UniswapV3_3000: { fee: 3000, address: '0xB0cC75ed5AaBB0aCce7cbf0302531Bb260d259C4' }
  //   }
  // },

  // // SHIB/DAI
  // {
  //   name: 'SHIB/DAI',
  //   token0: getTokenInfo(TOKENS.SHIB.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     // UniswapV2: { fee: 0, address: '0x4e6e41306C7Ef6E53eCdb34e3155C73fCb7869F3' },
  //     SushiswapV2: { fee: 0, address: '0xb011EA8096cE5986f3e89B4C2c02f193c82AbEa8' }
  //   }
  // },

  // MATIC/WETH
  {
    name: 'MATIC/WETH',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x819f3450dA6f110BA6Ea52195B3beaFa246062dE' },
      // SushiswapV2: { fee: 0, address: '0x7f8F7Dd53D1F3ac1052565e3ff451D7fE666a311' },
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
      // UniswapV2: { fee: 0, address: '0x6A9e7f087a7D1057dd36A84AE148dAc2C07ea67e' },
      // SushiswapV2: { fee: 0, address: '0x7401B004f6e1553E33fd0E7a9EB67cBa6DaF94dB' },
      UniswapV3_500: { fee: 500, address: '0xB8eCed0C3cae8847454aA4900d7751d0BD8d23Cf' },
      UniswapV3_3000: { fee: 3000, address: '0x07A6E955bA4345BAe83Ac2A6fAa771fddd8A2011' },
      UniswapV3_10000: { fee: 10000, address: '0x9da1d1c9353B32C9E15aDF11faDbe9F0860fCcfa' }
    }
  },

  // MATIC/USDT
  // {
  //   name: 'MATIC/USDT',
  //   token0: getTokenInfo(TOKENS.MATIC.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x88C095C8Ba2C7A1353cF3D21E692c5d4d0F90793' },
  //     // UniswapV3_500: { fee: 500, address: '0x972f43Bb94B76B9e2D036553d818879860b6A114' },
  //     UniswapV3_3000: { fee: 3000, address: '0x68F73e2180024DB5B54E0E119d4F5128953F9417' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x9039093a644c466E43C28d06c303D751cdc07Cc2' }
  //   }
  // },

  // MATIC/DAI
  // {
  //   name: 'MATIC/DAI',
  //   token0: getTokenInfo(TOKENS.MATIC.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x8F400cFaa80A591d7d1ec51D928A7308f7cb099e' },
  //     SushiswapV2: { fee: 0, address: '0xdB394b854A103564FB320870c9dd53F6C279Ca40' },
  //     UniswapV3_3000: { fee: 3000, address: '0x07510b2DD84bF8187063a3c49533663518C2B6b7' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x98c8BE139D73aC27bd96A0be97F0Abf17EfcaD45' }
  //   }
  // },

  // MATIC/WBTC
  // {
  //   name: 'MATIC/WBTC',
  //   token0: getTokenInfo(TOKENS.MATIC.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x4500d866bEDB9D8fC280924b31C76Dacf7979Cae' }
  //   }
  // },

  // MATIC/LINK
  {
    name: 'MATIC/LINK',
    token0: getTokenInfo(TOKENS.MATIC.address),
    token1: getTokenInfo(TOKENS.LINK.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x01fb16A4f144419Da8fbE4F1f3F27321368456ef' },
      // UniswapV3_10000: { fee: 10000, address: '0xCFc389e23728f72558eEe13D04B326DdCdD88Be3' }
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
      // UniswapV3_500: { fee: 500, address: '0xfaA318479b7755b2dBfDD34dC306cb28B420Ad12' },
      UniswapV3_3000: { fee: 3000, address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801' },
      // UniswapV3_10000: { fee: 10000, address: '0x360b9726186C0F62cc719450685ce70280774Dc8' }
    }
  },

  // UNI/USDC
  // {
  //   name: 'UNI/USDC',
  //   token0: getTokenInfo(TOKENS.UNI.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xEBFb684dD2b01E698ca6c14F10e4f289934a54D6' },
  //     // UniswapV3_500: { fee: 500, address: '0xaB2044f105c43C25b1de3Ee27504f0B889CE5953' },
  //     UniswapV3_3000: { fee: 3000, address: '0xD0fC8bA7E267f2bc56044A7715A489d851dC6D78' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xE845469aAe04f8823202b011A848cf199420B4C1' }
  //   }
  // },

  // UNI/USDT
  // {
  //   name: 'UNI/USDT',
  //   token0: getTokenInfo(TOKENS.UNI.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x5ac13261c181a9c3938BfE1b649E65D10F98566B' },
  //     SushiswapV2: { fee: 0, address: '0x8b79c78F7AA289a7E9BDE311a21FfdBa4Ab493e3' },
  //     // UniswapV3_500: { fee: 500, address: '0x36F7273afb18A3F2fDd07e3Ac1c28E65d7ea8f07' },
  //     UniswapV3_3000: { fee: 3000, address: '0x3470447f3CecfFAc709D3e783A307790b0208d60' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xfe47DAD3d8072a7c5E38202bC4B82D322163E2b6' }
  //   }
  // },

  // UNI/DAI
  {
    name: 'UNI/DAI',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.DAI.address),
    pools: {
      // UniswapV2: { fee: 0, address: '0xf00e80f0DE9aEa0B33aA229a4014572777E422EE' },
      // SushiswapV2: { fee: 0, address: '0xd9CeDc999bE891D7fC65996C708fd827959F4C8A' },
      UniswapV3_500: { fee: 500, address: '0x57D7d040438730d4029794799dEEd8601E23fF80' },
      UniswapV3_3000: { fee: 3000, address: '0x7cf70eD6213F08b70316bD80F7c2ddDc94E41aC5' },
      UniswapV3_10000: { fee: 10000, address: '0xD6993E525FAdB23971a20bBb057Af9841eAE076F' }
    }
  },

  // UNI/WBTC
  {
    name: 'UNI/WBTC',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xAA873C9DA6541f13C89416C17271b4c21bf7B2d7' },
      UniswapV3_3000: { fee: 3000, address: '0x8F0CB37cdFF37E004E0088f563E5fe39E05CCC5B' },
      // UniswapV3_10000: { fee: 10000, address: '0x83819fB5184E2a418d9309bC1Ac46eDB67F89E7d' }
    }
  },

  // UNI/LINK
  {
    name: 'UNI/LINK',
    token0: getTokenInfo(TOKENS.UNI.address),
    token1: getTokenInfo(TOKENS.LINK.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x9b2662DC8b80B0fE79310AD316b943CB5Bb15e8b' },
      SushiswapV2: { fee: 0, address: '0xCf789E7f539151b18E442DC183E7C454edFb69Aa' },
      UniswapV3_3000: { fee: 3000, address: '0x9f178e86e42ddf2379cb3d2acf9ed67a1ed2550a' },
      // UniswapV3_10000: { fee: 10000, address: '0xA6B9a13B34db2A00284299c47DACF49FB62C1755' }
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
  // {
  //   name: 'LINK/USDC',
  //   token0: getTokenInfo(TOKENS.LINK.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xd8C8a2B125527bf97c8e4845b25dE7e964468F77' },
  //     SushiswapV2: { fee: 0, address: '0x2101072e369761435A532a83369984Ec3950aEF2' },
  //     // UniswapV3_500: { fee: 500, address: '0x22fe40544Ac2b387f9A68C6C53b9A8E34e4dd40E' },
  //     UniswapV3_3000: { fee: 3000, address: '0xFAD57d2039C21811C8F2B5D5B65308aa99D31559' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xd24B1542323096CcBf9cBA3b13c5b9eb4A92c506' }
  //   }
  // },

  // LINK/USDT
  // {
  //   name: 'LINK/USDT',
  //   token0: getTokenInfo(TOKENS.LINK.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x9Db10C305c671153662119D453C4D2c123725566' },
  //     SushiswapV2: { fee: 0, address: '0x665daa5E280edD60B81c67d583Ed85B9A5cC45A6' },
  //     // UniswapV3_500: { fee: 500, address: '0x55ec9256077A311256B2DaF81f70c0992d9fbd66' },
  //     UniswapV3_3000: { fee: 3000, address: '0xac5A2c404EbBa22a869998089AC7893ff4E1F0a7' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x106A1A525e9b404D02Db8A21Dbe4C30f4C807107' }
  //   }
  // },

  // LINK/DAI
  // {
  //   name: 'LINK/DAI',
  //   token0: getTokenInfo(TOKENS.LINK.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x6D4fd456eDecA58Cf53A8b586cd50754547DBDB2' },
  //     SushiswapV2: { fee: 0, address: '0x23a1081bAD58465e30a0A5083FBc8409c3d76960' },
  //     // UniswapV3_500: { fee: 500, address: '0x3209C64BF470FAFEcB8b87Db3D8ac1bAa3eCF629' },
  //     UniswapV3_3000: { fee: 3000, address: '0x091C0158ab410bd73ca1541409D5A22E90146a04' }
  //   }
  // },

  // LINK/WBTC
  {
    name: 'LINK/WBTC',
    token0: getTokenInfo(TOKENS.LINK.address),
    token1: getTokenInfo(TOKENS.WBTC.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x8a01BA64FBc7B12ee13F817DFa862881feC531b8' },
      UniswapV3_3000: { fee: 3000, address: '0x618004783d422DfB792D07D742549D5A24648dF2' }
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
      // UniswapV3_500: { fee: 500, address: '0x39d1FA498A4622c1039DB214096b043451334771' },
      UniswapV3_3000: { fee: 3000, address: '0x919Fa96e88d67499339577Fa202345436bcDaf79' },
      UniswapV3_10000: { fee: 10000, address: '0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e' }
    }
  },

  // CRV/USDC
  // {
  //   name: 'CRV/USDC',
  //   token0: getTokenInfo(TOKENS.CRV.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x210a97bA874a8e279C95b350aE8bA143A143C159' },
  //     // UniswapV3_500: { fee: 500, address: '0x09622B458F27C6f394455b9C0fb404ffAC05e37a' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x47bDE1364cB8Cfe45B59e261CC66AA551f1F7954' },
  //     UniswapV3_10000: { fee: 10000, address: '0x9445bd19767F73DCaE6f2De90e6cd31192F62589' }
  //   }
  // },

  // CRV/USDT
  // {
  //   name: 'CRV/USDT',
  //   token0: getTokenInfo(TOKENS.CRV.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x3eEd0Af1c5F350C6571525D9E3EEea7d2608af81' },
  //     // UniswapV3_500: { fee: 500, address: '0x224e94D1fa04195Df9Ad941c0d1529908401B23B' },
  //     UniswapV3_3000: { fee: 3000, address: '0x07B1c12BE0d62fe548a2b4b025Ab7A5cA8DEf21E' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x8e26E2fc8140280FbA3E34bFDca7fc1102C1ae04' }
  //   }
  // },

  // CRV/DAI
  // {
  //   name: 'CRV/DAI',
  //   token0: getTokenInfo(TOKENS.CRV.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xf00F7A64B170D41789C6f16a7eb680a75A050e6D' },
  //     SushiswapV2: { fee: 0, address: '0x747c9884d29474fe4334C477ebfd25f8a6f5B90D' }
  //   }
  // },

  // CRV/WBTC
  

  // MKR/WETH
  {
    name: 'MKR/WETH',
    token0: getTokenInfo(TOKENS.MKR.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xC2aDdA861F89bBB333c90c492cB837741916A225' },
      SushiswapV2: { fee: 0, address: '0xBa13afEcda9beB75De5c56BbAF696b880a5A50dD' },
      // UniswapV3_500: { fee: 500, address: '0x886072A44BDd944495eFF38AcE8cE75C1EacDAF6' },
      UniswapV3_3000: { fee: 3000, address: '0xe8c6c9227491C0a8156A0106A0204d881BB7E531' },
      // UniswapV3_10000: { fee: 10000, address: '0x3afdc5e6dfc0b0a507a8e023c9dce2cafc310316' }
    }
  },

  // MKR/USDC
  // {
  //   name: 'MKR/USDC',
  //   token0: getTokenInfo(TOKENS.MKR.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x340A5a2F73eBaa181eC2826802Fdf8ED21Fc759a' },
  //     // UniswapV3_500: { fee: 500, address: '0x936198FCac6D8cdeC3815F24BA250041F593f6c3' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x0F9d9d1cCE530C91f075455EfEf2D9386375df3d' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xC486Ad2764D55C7dc033487D634195d6e4A6917E' }
  //   }
  // },

  // MKR/USDT
  // {
  //   name: 'MKR/USDT',
  //   token0: getTokenInfo(TOKENS.MKR.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xa14DFBaa23EE8E8b69878381F8Fd1D0BC502c043' },
  //     // UniswapV3_500: { fee: 500, address: '0x0cbE2f86E2FD90040EBb557b99F83400bF8f3717' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x5cCcaD2332292cd5882365BB3584424241AB2210' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xB5F8d230523c4Bdcd00603EE354921441FDe39b4' }
  //   }
  // },

  // MKR/DAI
  // {
  //   name: 'MKR/DAI',
  //   token0: getTokenInfo(TOKENS.MKR.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x517F9dD285e75b599234F7221227339478d0FcC8' },
  //     UniswapV3_3000: { fee: 3000, address: '0x2A84E2BD2E961b1557D6e516cA647268b432cbA4' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xDFdD6dcC53Ae970D3A1A19C43197084cdca97DfF' }
  //   }
  // },

  // MKR/WBTC
  // {
  //   name: 'MKR/WBTC',
  //   token0: getTokenInfo(TOKENS.MKR.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     // UniswapV3_500: { fee: 500, address: '0x1EF0c7406A0c95d3859BE9d3f899c9F75Db474Dc' },
  //     UniswapV3_3000: { fee: 3000, address: '0xA2375dAd211FE6e538d29c98EC526246E38Be4EC' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x799A584267A95263106A387170e84e7D2f2B0Fc1' }
  //   }
  // },

  // AAVE/WETH
  {
    name: 'AAVE/WETH',
    token0: getTokenInfo(TOKENS.AAVE.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f' },
      SushiswapV2: { fee: 0, address: '0xD75EA151a61d06868E31F8988D28DFE5E9df57B4' },
      // UniswapV3_500: { fee: 500, address: '0x4674abc5796e1334B5075326b39B748bee9EaA34' },
      UniswapV3_3000: { fee: 3000, address: '0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB' },
      UniswapV3_10000: { fee: 10000, address: '0x1353fE67fFf8f376762b7034DC9066f0bE15a723' }
    }
  },

  // AAVE/USDC
  // {
  //   name: 'AAVE/USDC',
  //   token0: getTokenInfo(TOKENS.AAVE.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x674E114dAd81838d151d9BedA2271228eeAe0E8B' },
  //     // UniswapV3_500: { fee: 500, address: '0x493035412520336Ff4719d4CEE527bea55eCA844' },
  //     UniswapV3_3000: { fee: 3000, address: '0xdceaf5d0E5E0dB9596A47C0c4120654e80B1d706' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xa8e45Fe78BcF372D8F0a8F6a25868E66088a1365' }
  //   }
  // },

  // AAVE/USDT
  // {
  //   name: 'AAVE/USDT',
  //   token0: getTokenInfo(TOKENS.AAVE.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x1f447690A6ddF18400533b705516159E1312f892' },
  //     UniswapV3_3000: { fee: 3000, address: '0x4D1Ad4A9e61Bc0E5529d64F38199cCFca56f5a42' }
  //   }
  // },

  // AAVE/DAI
  // {
  //   name: 'AAVE/DAI',
  //   token0: getTokenInfo(TOKENS.AAVE.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x38E12fDd8DC51e48830863151e1Afa7799e6fE97' }
  //   }
  // },

  // AAVE/WBTC
  // {
  //   name: 'AAVE/WBTC',
  //   token0: getTokenInfo(TOKENS.AAVE.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x48978eF5BeB2d69e27DeF9C046cEbE18Ab5708Ad' },
  //     UniswapV3_3000: { fee: 3000, address: '0x98E45940d0c76898f5659b8FC78895F35A39eb43' }
  //   }
  // },

  // AAVE/LINK
  // {
  //   name: 'AAVE/LINK',
  //   token0: getTokenInfo(TOKENS.AAVE.address),
  //   token1: getTokenInfo(TOKENS.LINK.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xE9cc31da55080593369e3Cdf589BD1DE85E0151A' },
  //     SushiswapV2: { fee: 0, address: '0xE49a6762135236348663B90FBa515E5B3328c173' },
  //     // UniswapV3_500: { fee: 500, address: '0xd701A4A7EBb5A7a273b7a6DdD95B17Ef42FE75f7' },
  //     UniswapV3_3000: { fee: 3000, address: '0x14243EA6bB3d64C8d54A1f47B077e23394D6528A' }
  //   }
  // },

  // COMP/WETH
  {
    name: 'COMP/WETH',
    token0: getTokenInfo(TOKENS.COMP.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f' },
      SushiswapV2: { fee: 0, address: '0x31503dcb60119A812feE820bb7042752019F2355' },
      // UniswapV3_500: { fee: 500, address: '0x877c5f87Ea6A1bBE4c4fbdFEb37ABe2A693267b1' },
      UniswapV3_3000: { fee: 3000, address: '0xea4Ba4CE14fdd287f380b55419B1C5b6c3f22ab6' },
      // UniswapV3_10000: { fee: 10000, address: '0x5598931BfBb43EEC686fa4b5b92B5152ebADC2f6' }
    }
  },

  // COMP/USDC
  // {
  //   name: 'COMP/USDC',
  //   token0: getTokenInfo(TOKENS.COMP.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x6F81d90E771B551451382b4c8B41C86B978d3420' },
  //     SushiswapV2: { fee: 0, address: '0x6f908e82E94e088f726e456E3403aAa00723e6e3' },
  //     // UniswapV3_3000: { fee: 3000, address: '0xF15054BC50c39ad15FDC67f2AedD7c2c945ca5f6' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x4786BB29A1589854204A4E62DcbE26a571224c0F' }
  //   }
  // },

  // COMP/USDT
  // {
  //   name: 'COMP/USDT',
  //   token0: getTokenInfo(TOKENS.COMP.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x942Be9e8a12cFAAF997Cd266487Eaf8553B119d2' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x68C5ea31AefE12713642AeC96999df9319942641' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xC1bb3B83233b555dB0e7e17e38Bcb94538C204af' }
  //   }
  // },

  // COMP/DAI
  // {
  //   name: 'COMP/DAI',
  //   token0: getTokenInfo(TOKENS.COMP.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     // UniswapV2: { fee: 0, address: '0xf3194E22d3212A6F930a7C6A88003d43F68befAb' },
  //     SushiswapV2: { fee: 0, address: '0xeEEe1573F733983Ddfe8ed77Aaa6710c5B626086' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x1D84F218038e78FCe2E447623DFC46360D8AB5A4' }
  //   }
  // },

  // COMP/LINK
  // {
  //   name: 'COMP/LINK',
  //   token0: getTokenInfo(TOKENS.COMP.address),
  //   token1: getTokenInfo(TOKENS.LINK.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xcf4A0967C6c0b0fCD416283b8664f735391a36EC' }
  //   }
  // },
 

  // SNX/WETH
  {
    name: 'SNX/WETH',
    token0: getTokenInfo(TOKENS.SNX.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x43AE24960e5534731Fc831386c07755A2dc33D47' },
      SushiswapV2: { fee: 0, address: '0xA1d7b2d891e3A1f9ef4bBC5be20630C2FEB1c470' },
      // UniswapV3_3000: { fee: 3000, address: '0xEDe8dd046586d22625Ae7fF2708F879eF7bdb8CF' },
      UniswapV3_10000: { fee: 10000, address: '0xf5ce0293C24FD0990E0a5758E53f66a36cA0118f' }
    }
  },

  // SNX/USDC
  // {
  //   name: 'SNX/USDC',
  //   token0: getTokenInfo(TOKENS.SNX.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x3A1B4f6Dce585eF469a5DAA73A6EB87ce13E859D' },
  //     SushiswapV2: { fee: 0, address: '0xaa85CEC1Ffeb1EC5001112CE18cF863fDbbAdcE1' },
  //     // UniswapV3_500: { fee: 500, address: '0x96036d3cD78D364cdA5BbDe9479222b05b3E8cbd' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x19FA87f7C7d9EDEe00e60f8a1A00E0903b5DeD85' },
  //     UniswapV3_10000: { fee: 10000, address: '0x020C349A0541D76C16F501Abc6B2E9c98AdAe892' }
  //   }
  // },

  // SNX/USDT
  // {
  //   name: 'SNX/USDT',
  //   token0: getTokenInfo(TOKENS.SNX.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xe5eDEef795A4Ac7eF477cB3068f5e5d12788B6Cb' },
  //     SushiswapV2: { fee: 0, address: '0xD04fb79F5F9682a5a587c16341CB10BB90fCa04B' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x398695cEB1E044207E93cc430273b138Ca727a8f' }
  //   }
  // },

  // SNX/DAI
  // {
  //   name: 'SNX/DAI',
  //   token0: getTokenInfo(TOKENS.SNX.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xcA9B553d9f8cCD9D6ad546707f1EC3B9150292b1' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x7FfB95d27152D79Aba7a74C7737822525feAAfD1' },
  //     // UniswapV3_10000: { fee: 10000, address: '0x0C1887e602da2AA96Aa0642A37a32DbC2a142213' }
  //   }
  // },

  // SNX/LINK
  // {
  //   name: 'SNX/LINK',
  //   token0: getTokenInfo(TOKENS.SNX.address),
  //   token1: getTokenInfo(TOKENS.LINK.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x5A3Cb6B3E42C8101Cbc0AB4c35DA4f92e0Dd2586' }
  //   }
  // },

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
      // UniswapV3_500: { fee: 500, address: '0x5EB837c4B76239Dcbe770BE1dE9A198B98078FAF' },
      // UniswapV3_3000: { fee: 3000, address: '0x04916039B1f59D9745Bf6E0a21f191D1e0A84287' },
      // UniswapV3_10000: { fee: 10000, address: '0x2E8dAf55F212BE91D3fA882ccEAb193A08fddeB2' }
    }
  },

  // YFI/USDC
  // {
  //   name: 'YFI/USDC',
  //   token0: getTokenInfo(TOKENS.YFI.address),
  //   token1: getTokenInfo(TOKENS.USDC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xdE37cD310c70e7Fa9d7eD3261515B107D5Fe1F2d' },
  //     SushiswapV2: { fee: 0, address: '0x3a5747cf4E21861E2D0D3d51a0e8737Ab4dfadc8' },
  //     // UniswapV3_3000: { fee: 3000, address: '0xa090FB79f31A6E6AaD75E31EA396022253355Fc2' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xbfAcdf75F59988f18700d46f85095CDA600E2192' }
  //   }
  // },

  // YFI/USDT
  // {
  //   name: 'YFI/USDT',
  //   token0: getTokenInfo(TOKENS.YFI.address),
  //   token1: getTokenInfo(TOKENS.USDT.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xAcD2556F64D4BE9Aaa205278895653D3e6d639aE' },
  //     SushiswapV2: { fee: 0, address: '0xF5FBC6CA5c677F1c977Ed3a064B9DDA14c5E241b' }
  //   }
  // },

  // YFI/DAI
  // {
  //   name: 'YFI/DAI',
  //   token0: getTokenInfo(TOKENS.YFI.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x3CD132ac73A4043Bb4f1674369E70BE6f88EdD73' }
  //   }
  // },

  // YFI/WBTC
  // {
  //   name: 'YFI/WBTC',
  //   token0: getTokenInfo(TOKENS.YFI.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xbAe1264CeC9371238da484C42b56B0dC8C31c6B9' },
  //     SushiswapV2: { fee: 0, address: '0x1D108372A83Fbc3A0Bfb7Ca4D0e427449E7a5ca2' },
  //     // UniswapV3_3000: { fee: 3000, address: '0x775d0C18B291B889aB3D7f16338183bbFAF63F7a' }
  //   }
  // },

  // YFI/LINK
  // {
  //   name: 'YFI/LINK',
  //   token0: getTokenInfo(TOKENS.YFI.address),
  //   token1: getTokenInfo(TOKENS.LINK.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xB49Ac553Aeff303B1c73af00A8511Cb1585c1204' },
  //     // UniswapV3_10000: { fee: 10000, address: '0xd92bA9b67b74305B5534aBd2b1F5119b59b24871' }
  //   }
  // },

  // Core pairs (already in your original list – kept for completeness)
  {
    name: 'USDC/WETH',
    token0: getTokenInfo(TOKENS.USDC.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc' },
      SushiswapV2: { fee: 0, address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0' },
      UniswapV3_3000: { fee: 3000, address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8' },

      SushiswapV3_500: { fee: 500, address: '0x35644Fb61aFBc458bf92B15AdD6ABc1996Be5014' },
      SushiswapV3_3000: { fee: 3000, address: '0x763d3b7296e7C9718AD5B058aC2692A19E5b3638'  },
      SushiswapV3_10000: { fee: 10000, address: '0x1D437AC0a77d9d0Ab6A512A6b054930Aa582A5B7' },

      PancakeswapV3_500: { fee: 500, address: '0x1ac1A8FEaAEa1900C4166dEeed0C11cC10669D36' },
      PancakeswapV3_10000: { fee: 10000, address: '0xBAa22bc3b7D9Ed30a3B1DDbC6446AC397a4c80a4'  },
    }
  },
  {
    name: 'DAI/WETH',
    token0: getTokenInfo(TOKENS.DAI.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11' },
      SushiswapV2: { fee: 0, address: '0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f' },
      UniswapV3_3000: { fee: 3000, address: '0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8' },
      SushiswapV3_500: { fee: 500, address: '0xabb097C772AcDc0b743EF85c59040E9bD8F8bDa4'  },
      SushiswapV3_3000: { fee: 3000, address: '0x769DB46F39C42ee7AD5f71F4167c47EdD281E767'  },
    }
  },
  // {
  //   name: 'WETH/WBTC',
  //   token0: getTokenInfo(TOKENS.WETH.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940' },
  //     SushiswapV2: { fee: 0, address: '0xCEfF51756c56CeFFCA006cD410B03FFC46dd3a58' },
  //     UniswapV3: { fee: 3000, address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD' },
  //   }
  // },
  {
    name: 'USDT/WETH',
    token0: getTokenInfo(TOKENS.USDT.address),
    token1: getTokenInfo(TOKENS.WETH.address),
    pools: {
      UniswapV2: { fee: 0, address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852' },
      SushiswapV2: { fee: 0, address: '0x06da0fd433C1A5d7a4faa01111c044910A184553' },
      UniswapV3_500: { fee: 500, address: '0x11b815efB8f581194ae79006d24E0d814B7697F6' },
      UniswapV3_3000: { fee: 3000, address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36' },
      SushiswapV3_500: { fee: 500, address: '0x72c2178E082feDB13246877B5aA42ebcE1b72218'  },
      SushiswapV3_3000: { fee: 3000, address: '0x6a11ED98B1a3ac36A768ebbbbA36DED101Da5a3f'  },
      PancakeswapV3_500: { fee: 500, address: '0x6CA298D2983aB03Aa1dA7679389D955A4eFEE15C'  },
      PancakeswapV3_10000: { fee: 10000, address: '0x486B54c7FFbA86246652C7444dc9498e8D8b627c'  },
    }
  },
  // {
  //   name: 'DAI/WBTC',
  //   token0: getTokenInfo(TOKENS.DAI.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x231B7589426Ffe1b75405526fC32aC09D44364c4' },
  //     UniswapV3_3000: { fee: 3000, address: '0x391e8501b626c623d39474afca6f9e46c2686649' }
  //   }
  // },
  // {
  //   name: 'DAI/USDC',
  //   token0: getTokenInfo(TOKENS.USDC.address),
  //   token1: getTokenInfo(TOKENS.DAI.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5' },
  //     SushiswapV2: { fee: 0, address: '0xAaF5110db6e744ff70fB339DE037B990A20bdace' },
  //     UniswapV3: { fee: 3000, address: '0xa63b490aA077f541c9d64bFc1Cc0db2a752157b5' },
  //   }
  // },
  // {
  //   name: 'USDC/WBTC',
  //   token0: getTokenInfo(TOKENS.USDC.address),
  //   token1: getTokenInfo(TOKENS.WBTC.address),
  //   pools: {
  //     UniswapV2: { fee: 0, address: '0x004375Dff511095CC5A197A54140a24eFEF3A416' },
  //     UniswapV3: { fee: 3000, address: '0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35' },
  //   }
  // },
];

// Final export
export default {
  TOKENS,
  DIRECT_SWAP_PAIRS,
};