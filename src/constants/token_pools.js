export const TOKEN_POOLS = [
  {
    name: 'WETH/LINK',
    token0: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    token1: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    pools: {
      'UniswapV2': '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974',
      'SushiV2': '0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967',
      'ShibaV2': '0xf15FD4DC6a1D3C0aA8bBAb46dB6400F53A49f737',
    }
  },
  {
    name: 'WETH/SHIB',
    token0: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    token1: {
      symbol: 'SHIB',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      decimals: 18,
    },
    pools: {
      'UniswapV2': '0x811beEd0119b4AfCE20D2583EB608C6F7AF1954f',
      'SushiV2': '0x24D3dD4a62e29770cf98810b09F89D3A90279E7a',
      'ShibaV2': '0xCF6dAAB95c476106ECa715D48DE4b13287ffDEAa',
    }
  },
  {
    name: 'WETH/USDC',
    token0: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
      'SushiV2': '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
      'ShibaV2': '0x20E95253e54490D8d30ea41574b24F741ee70201',
    }
  },
  {
    name: 'WETH/USDT',
    token0: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    token1: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
      'SushiV2': '0x06da0fd433C1A5d7a4faa01111c044910A184553',
      'ShibaV2': '0x703b120F15Ab77B986a24c6f9262364d02f9432f',
    }
  },
  {
    name: 'WETH/DAI',
    token0: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    token1: {
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    pools: {
      'UniswapV2': '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
      'SushiV2': '0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f',
      'ShibaV2': '0x8faf958E36c6970497386118030e6297fFf8d275',
    }
  },
  {
    name: 'LINK/SHIB',
    token0: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    token1: {
      symbol: 'SHIB',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      decimals: 18,
    },
    pools: {
      'ShibaV2': '0xFD250955CE777CfD672EF3163238175E360Ba8c2',
    }
  },
  {
    name: 'LINK/USDC',
    token0: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0xd8C8a2B125527bf97c8e4845b25dE7e964468F77',
      'SushiV2': '0x2101072e369761435A532a83369984Ec3950aEF2',
    }
  },
  {
    name: 'LINK/USDT',
    token0: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    token1: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0x9Db10C305c671153662119D453C4D2c123725566',
      'SushiV2': '0x665daa5E280edD60B81c67d583Ed85B9A5cC45A6',
    }
  },
  {
    name: 'LINK/DAI',
    token0: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
    },
    token1: {
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    pools: {
      'UniswapV2': '0x6D4fd456eDecA58Cf53A8b586cd50754547DBDB2',
      'SushiV2': '0x23a1081bAD58465e30a0A5083FBc8409c3d76960',
    }
  },
  {
    name: 'SHIB/DAI',
    token0: {
      symbol: 'SHIB',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      decimals: 18,
    },
    token1: {
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    pools: {
      'UniswapV2': '0x4e6e41306C7Ef6E53eCdb34e3155C73fCb7869F3',
      'SushiV2': '0xb011EA8096cE5986f3e89B4C2c02f193c82AbEa8',
      'ShibaV2': '0xd00f09C2acdB2aACA842060029FB9ddC05739b28',
    }
  },
  {
    name: 'SHIB/USDC',
    token0: {
      symbol: 'SHIB',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0x881d5c98866a08f90A6F60E3F94f0e461093D049',
      'ShibaV2': '0x9379F5e035CF6148c6bbEE1D6415795cc773b0A4',
    }
  },
  {
    name: 'SHIB/USDT',
    token0: {
      symbol: 'SHIB',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      decimals: 18,
    },
    token1: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0x773dD321873fe70553ACC295b1b49A104d968CC8',
      'ShibaV2': '0x98C2b0681d8BF07767826eA8BD3b11b0Ca421631',
    }
  },
  {
    name: 'USDC/USDT',
    token0: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    token1: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    pools: {
      'UniswapV2': '0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f',
      'ShibaV2': '0xD86A120a06255Df8D4e2248aB04d4267E23aDfaA',
    }
  },
  {
    name: 'DAI/USDC',
    token0: {
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'ShibaV2': '0xAaF5110db6e744ff70fB339DE037B990A20bdace',
    }
  },
  {
    name: 'USDT/MOCA',
    token0: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    token1: {
      symbol: 'MOCA',
      address: '0xF944e35f95E819E752f3cCB5Faf40957d311e8c5',
      decimals: 18,
    },
    pools: {
      'UiswapV2': '0x0b07188b12e3BbA6A680E553E23c4079e98A034b',
    }
  },
   {
    name: 'DG/USDC',
    token0: {
      symbol: 'DG',
      address: '0x53C8395465A84955c95159814461466053DedEDE',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'UiswapV2': '0x873056A02255872514F05249d93228D788Fe4Fb4',
    }
  },
  {
    name: 'RAD/USDC',
    token0: {
      symbol: 'RAD',
      address: '0x31c8EAcBFFdD875c74b94b077895Bd78CF1E64A3',
      decimals: 18,
    },
    token1: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    pools: {
      'UiswapV2': '0x8C1c499b1796D7F3C2521AC37186B52De024e58c',
    }
  },
];