import { ethers } from 'ethers';
import Decimal from 'decimal.js';

// ABIs
const V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

const V3_POOL_ABI = [
  'function liquidity() external view returns (uint128)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

const ERC20_ABI = [
  'function balanceOf(address) external view returns (uint256)'
];

/**
 * Calculate actual token reserves for Uniswap V2 pools
 * Returns liquidity in both tokens
 */
function calculateV2Liquidity(priceData) {
  if (!priceData.rawReserves || priceData.rawReserves.length !== 2) {
    console.warn(`Missing rawReserves for ${priceData.poolName} on ${priceData.dex}`);
    return {
      token0Liquidity: '0',
      token1Liquidity: '0',
      liquidityInTokenA: '0',
      liquidityInTokenB: '0'
    };
  }

  const [reserve0Raw, reserve1Raw] = priceData.rawReserves;
  const token0Decimals = priceData.tokenA.decimals;
  const token1Decimals = priceData.tokenB.decimals;

  // Convert from wei to human-readable
  const reserve0 = new Decimal(reserve0Raw.toString()).div(new Decimal(10).pow(token0Decimals));
  const reserve1 = new Decimal(reserve1Raw.toString()).div(new Decimal(10).pow(token1Decimals));

  return {
    token0Liquidity: reserve0.toString(),
    token1Liquidity: reserve1.toString(),
    liquidityInTokenA: reserve0.toString(), // tokenA reserves
    liquidityInTokenB: reserve1.toString(), // tokenB reserves
    totalLiquidityUSD: null // Calculate separately if needed
  };
}

/**
 * Calculate actual token reserves for Uniswap V3 pools
 * V3 uses concentrated liquidity, so we need to calculate virtual reserves at current price
 */
function calculateV3Liquidity(priceData) {
  // V3 liquidity is the L value (sqrt(x*y))
  const L = new Decimal(priceData.liquidity || '0');

  if (L.lte(0)) {
    return {
      token0Liquidity: '0',
      token1Liquidity: '0',
      liquidityInTokenA: '0',
      liquidityInTokenB: '0'
    };
  }

  // Get current price (priceOfAinB means how much B per A)
  const priceAinB = new Decimal(priceData.priceOfAinB);
  const priceBinA = new Decimal(priceData.priceOfBinA);

  // Get token decimals
  const token0Decimals = priceData.tokenA.decimals;
  const token1Decimals = priceData.tokenB.decimals;

  // For V3, virtual reserves at current price:
  // x (token0/tokenA) = L / sqrt(P)
  // y (token1/tokenB) = L * sqrt(P)
  // where P is price of token1 in terms of token0

  const sqrtPrice = priceBinA.sqrt(); // sqrt of (tokenA price in tokenB)

  // Calculate virtual reserves in base units (Wei)
  const token0ReserveWei = L.div(sqrtPrice);
  const token1ReserveWei = L.mul(sqrtPrice);

  // Convert from Wei to human-readable format
  const token0Reserve = token0ReserveWei.div(new Decimal(10).pow(token0Decimals));
  const token1Reserve = token1ReserveWei.div(new Decimal(10).pow(token1Decimals));

  return {
    token0Liquidity: token0Reserve.toString(),
    token1Liquidity: token1Reserve.toString(),
    liquidityInTokenA: token0Reserve.toString(),
    liquidityInTokenB: token1Reserve.toString(),
    note: 'V3 uses concentrated liquidity - these are virtual reserves at current price'
  };
}

/**
 * Batch fetch V2 reserves using multicall
 */
async function batchFetchV2Reserves(poolAddresses, provider, multicallAddress) {
  const MULTICALL3_ABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)'
  ];

  const multicallIface = new ethers.Interface(MULTICALL3_ABI);
  const pairIface = new ethers.Interface(V2_PAIR_ABI);

  const calls = poolAddresses.map(address => ({
    target: ethers.getAddress(address),
    allowFailure: true,
    callData: pairIface.encodeFunctionData('getReserves', [])
  }));

  try {
    const multicallData = multicallIface.encodeFunctionData('aggregate3', [calls]);
    const result = await provider.call({
      to: multicallAddress,
      data: multicallData
    });

    const decodedResults = multicallIface.decodeFunctionResult('aggregate3', result)[0];
    const reservesMap = new Map();

    decodedResults.forEach((res, i) => {
      if (res.success) {
        try {
          const [reserve0, reserve1] = pairIface.decodeFunctionResult('getReserves', res.returnData);
          reservesMap.set(poolAddresses[i].toLowerCase(), {
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString()
          });
        } catch (err) {
          console.warn(`Failed to decode reserves for pool ${poolAddresses[i]}: ${err.message}`);
        }
      }
    });

    return reservesMap;
  } catch (error) {
    console.error(`Batch fetch V2 reserves failed: ${error.message}`);
    return new Map();
  }
}

/**
 * Calculate maximum trade size based on liquidity and acceptable slippage
 * @param {object} liquidity - Liquidity object with token reserves
 * @param {number} maxSlippage - Maximum acceptable slippage (e.g., 0.01 = 1%)
 * @param {boolean} isV3 - Whether this is a V3 pool
 * @returns {object} Maximum trade sizes in both directions
 */
function calculateMaxTradeSize(liquidity, maxSlippage = 0.01, isV3 = false) {
  const liquidityA = new Decimal(liquidity.liquidityInTokenA || '0');
  const liquidityB = new Decimal(liquidity.liquidityInTokenB || '0');

  if (liquidityA.lte(0) || liquidityB.lte(0)) {
    return {
      maxTradeInA: '0',
      maxTradeInB: '0',
      warning: 'Insufficient liquidity'
    };
  }

  // For V2: use constant product formula (x*y=k)
  // Maximum trade to keep slippage under threshold:
  // maxTradeIn = reserveIn * (1 - sqrt(1 - maxSlippage))
  
  if (!isV3) {
    // V2 calculation
    const slippageFactor = new Decimal(1).minus(new Decimal(maxSlippage));
    const sqrtSlippage = slippageFactor.sqrt();
    
    const maxTradeA = liquidityB.mul(new Decimal(1).minus(sqrtSlippage));
    const maxTradeB = liquidityA.mul(new Decimal(1).minus(sqrtSlippage));

    return {
      maxTradeInA: maxTradeA.toString(),
      maxTradeInB: maxTradeB.toString(),
      recommendedMaxA: maxTradeA.mul(0.8).toString(), // Use 80% of max for safety
      recommendedMaxB: maxTradeB.mul(0.8).toString(),
      type: 'V2'
    };
  } else {
    // V3 calculation (simplified - actual V3 has concentrated liquidity ranges)
    // Use conservative estimate: 5% of virtual reserves
    const maxTradeA = liquidityB.mul(0.05);
    const maxTradeB = liquidityA.mul(0.05);

    return {
      maxTradeInA: maxTradeA.toString(),
      maxTradeInB: maxTradeB.toString(),
      recommendedMaxA: maxTradeA.mul(0.8).toString(),
      recommendedMaxB: maxTradeB.mul(0.8).toString(),
      type: 'V3',
      note: 'V3 has concentrated liquidity - actual max depends on tick range'
    };
  }
}

/**
 * Calculate price impact for a given trade size
 * @param {string} amountIn - Amount to trade (in human units)
 * @param {object} liquidity - Liquidity object
 * @param {boolean} isV3 - Whether this is V3 pool
 * @returns {object} Price impact information
 */
function calculatePriceImpact(amountIn, liquidity, isV3 = false) {
  const tradeAmount = new Decimal(amountIn);
  const reserveIn = new Decimal(liquidity.liquidityInTokenB || '0'); // Assuming trading tokenB
  const reserveOut = new Decimal(liquidity.liquidityInTokenA || '0');

  if (reserveIn.lte(0) || reserveOut.lte(0)) {
    return { priceImpact: '100', executionPrice: '0', warning: 'No liquidity' };
  }

  if (!isV3) {
    // V2: constant product formula
    // amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOut = tradeAmount.mul(reserveOut).div(reserveIn.add(tradeAmount));
    
    // Execution price
    const executionPrice = tradeAmount.div(amountOut);
    
    // Spot price (before trade)
    const spotPrice = reserveIn.div(reserveOut);
    
    // Price impact
    const priceImpact = executionPrice.minus(spotPrice).div(spotPrice).mul(100);

    return {
      priceImpact: priceImpact.abs().toFixed(4),
      executionPrice: executionPrice.toString(),
      spotPrice: spotPrice.toString(),
      amountOut: amountOut.toString(),
      warning: priceImpact.abs().gt(5) ? 'High price impact (>5%)' : null
    };
  } else {
    // V3: simplified calculation (actual V3 is more complex with ticks)
    const ratio = tradeAmount.div(reserveIn);
    const priceImpact = ratio.mul(100); // Rough estimate

    return {
      priceImpact: priceImpact.toFixed(4),
      executionPrice: 'N/A',
      spotPrice: 'N/A',
      warning: priceImpact.gt(3) ? 'High price impact for V3 (>3%)' : null,
      note: 'V3 price impact depends on concentrated liquidity distribution'
    };
  }
}

/**
 * Enhanced liquidity processing for the fetchAllPricesOptimized function
 */
async function enhancePricesWithLiquidity(allPrices, provider, multicallAddress) {
  // Separate V2 pools that need reserve fetching
  const v2PoolsNeedingReserves = allPrices.filter(
    price => !price.dex.includes('UniswapV3') && !price.rawReserves
  );

  // Batch fetch missing V2 reserves
  let v2ReservesMap = new Map();
  if (v2PoolsNeedingReserves.length > 0) {
    const v2Addresses = v2PoolsNeedingReserves.map(p => p.poolAddress);
    v2ReservesMap = await batchFetchV2Reserves(v2Addresses, provider, multicallAddress);
  }

  // Process each price data
  for (const priceData of allPrices) {
    const isV3 = priceData.dex.includes('UniswapV3');

    // Add missing rawReserves for V2
    if (!isV3 && !priceData.rawReserves) {
      const reserves = v2ReservesMap.get(priceData.poolAddress?.toLowerCase());
      if (reserves) {
        priceData.rawReserves = [BigInt(reserves.reserve0), BigInt(reserves.reserve1)];
      }
    }

    // Calculate liquidity
    let liquidityData;
    if (isV3) {
      liquidityData = calculateV3Liquidity(priceData);
    } else {
      liquidityData = calculateV2Liquidity(priceData);
    }

    // Add liquidity data to price object
    priceData.liquidityData = liquidityData;
    priceData.liquidityInTokenA = liquidityData.liquidityInTokenA;
    priceData.liquidityInTokenB = liquidityData.liquidityInTokenB;

    // Calculate max trade size
    const maxTrade = calculateMaxTradeSize(liquidityData, 0.02, isV3); // 2% max slippage
    priceData.maxTradeSize = maxTrade;

    // Add to legacy liquidity field for compatibility
    priceData.liquidity = liquidityData.liquidityInTokenB; // Keep tokenB liquidity as main
  }

  return allPrices;
}

export {
  calculateV2Liquidity,
  calculateV3Liquidity,
  calculateMaxTradeSize,
  calculatePriceImpact,
  batchFetchV2Reserves,
  enhancePricesWithLiquidity
};