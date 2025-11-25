import { Decimal } from 'decimal.js';
import { normalizeDecimals } from './v3Utilites.js';

export function calculateDynamicInputAmount(priceData, liquidityPercentage = 0.015) {
  const tokenB = priceData.tokenB.symbol;
  const tokenBDecimals = normalizeDecimals(priceData.tokenB.decimals);

  // Get liquidity in tokenB (already in human-readable format from calculateV3Liquidity/calculateV2Liquidity)
  let liquidityInTokenB = new Decimal(priceData.liquidityInTokenB || '0');

  if (liquidityInTokenB.lte(0)) {
    console.warn(`⚠️ No liquidity data for ${priceData.poolName}, using fallback amount`);
    return getFallbackAmount(tokenB);
  }

  // Skip pools with extremely low liquidity (< 0.1 WETH / < $300)
  const minLiquidity = new Decimal('0.1');
  if (liquidityInTokenB.lt(minLiquidity)) {
    console.warn(`⚠️ Pool ${priceData.poolName} has very low liquidity (${liquidityInTokenB.toFixed(4)} ${tokenB}), skipping`);
    return null; // Return null to skip this pool
  }

  // Calculate amount as percentage of liquidity (0.5-2.5% to minimize slippage)
  let calculatedAmount = liquidityInTokenB.mul(liquidityPercentage);

  // Apply token-specific constraints
  const constraints = getTokenConstraints(tokenB);

  // Ensure amount is within min/max bounds
  if (calculatedAmount.lt(constraints.min)) {
    console.log(`📊 ${priceData.poolName}: Calculated amount ${calculatedAmount.toFixed(4)} below min, using ${constraints.min}`);
    calculatedAmount = new Decimal(constraints.min);
  }

  if (calculatedAmount.gt(constraints.max)) {
    console.log(`📊 ${priceData.poolName}: Calculated amount ${calculatedAmount.toFixed(4)} above max, using ${constraints.max}`);
    calculatedAmount = new Decimal(constraints.max);
  }

  // Log the calculation
  console.log(`💧 ${priceData.poolName} (${priceData.dex}):`);
  console.log(`   Liquidity: ${liquidityInTokenB.toFixed(4)} ${tokenB}`);
  console.log(`   Using: ${calculatedAmount.toFixed(6)} ${tokenB} (${(liquidityPercentage * 100).toFixed(2)}%)`);

  return calculatedAmount;
}

/**
 * Get token-specific constraints for input amounts
 * @param {string} tokenSymbol - Token symbol
 * @returns {Object} - Min and max amounts for the token
 */
export function getTokenConstraints(tokenSymbol) {
  const constraints = {
    // High-value tokens
    'WETH': { min: 0.1, max: 5.0 },       // $300 - $15,000
    'ETH': { min: 0.1, max: 5.0 },
    'WBTC': { min: 0.005, max: 0.1 },     // $325 - $6,500
    'YFI': { min: 0.05, max: 1.0 },       // $400 - $8,000
    'MKR': { min: 0.2, max: 3.0 },        // $300 - $4,500

    // Mid-value tokens
    'LINK': { min: 20, max: 500 },        // $300 - $7,500
    'UNI': { min: 50, max: 1000 },        // $350 - $7,000
    'AAVE': { min: 2, max: 50 },          // $300 - $7,500
    'COMP': { min: 10, max: 150 },        // $500 - $7,500
    'SNX': { min: 200, max: 3000 },       // $400 - $6,000
    'CRV': { min: 500, max: 10000 },      // $250 - $5,000

    // Stablecoins
    'USDC': { min: 500, max: 5000 },      // $500 - $5,000
    'USDT': { min: 500, max: 5000 },
    'DAI': { min: 500, max: 5000 },
    'crvUSD': { min: 500, max: 5000 },

    // Low-value tokens
    'MATIC': { min: 1000, max: 15000 },
    'SHIB': { min: 20000000, max: 500000000 },

    // Default for unknown tokens
    'DEFAULT': { min: 500, max: 5000 }
  };

  return constraints[tokenSymbol] || constraints['DEFAULT'];
}

/**
 * Get fallback amount when liquidity data is unavailable
 * @param {string} tokenSymbol - Token symbol
 * @returns {Decimal} - Fallback amount
 */
export function getFallbackAmount(tokenSymbol) {
  const fallbacks = {
    'WETH': new Decimal('2.0'),
    'ETH': new Decimal('2.0'),
    'USDC': new Decimal('5000'),
    'USDT': new Decimal('5000'),
    'DAI': new Decimal('5000'),
    'WBTC': new Decimal('0.05'),
    'LINK': new Decimal('300'),
    'UNI': new Decimal('600'),
    'AAVE': new Decimal('30'),
    'SNX': new Decimal('2500'),
    'MKR': new Decimal('3'),
    'COMP': new Decimal('100'),
    'MATIC': new Decimal('6000'),
    'CRV': new Decimal('8000'),
    'YFI': new Decimal('1'),
    'SHIB': new Decimal('400000000'),
    'DEFAULT': new Decimal('3000')
  };
  
  return fallbacks[tokenSymbol] || fallbacks['DEFAULT'];
}

/**
 * Enhanced version: Calculate input amount with adaptive liquidity percentage
 * Uses smaller percentage for high liquidity pools, larger for low liquidity
 * @param {Object} priceData - Price data containing liquidity information
 * @returns {Decimal} - Calculated input amount in human-readable format
 */
export function calculateAdaptiveInputAmount(priceData) {
  const tokenB = priceData.tokenB.symbol;
  const tokenBDecimals = normalizeDecimals(priceData.tokenB.decimals);

  // Get liquidity in tokenB (already in human-readable format)
  let liquidityInTokenB = new Decimal(priceData.liquidityInTokenB || '0');

  if (liquidityInTokenB.lte(0)) {
    console.log(`⚠️ No liquidity for ${priceData.poolName}, using fallback`);
    return getFallbackAmount(tokenB);
  }

  // Adaptive percentage based on liquidity size (in human-readable format)
  let liquidityPercentage;

  if (liquidityInTokenB.gte(50000)) {
    // Very high liquidity (>50K WETH or >$150M): use 0.5%
    liquidityPercentage = 0.005;
    console.log(`📊 Very high liquidity pool: using 0.5%`);
  } else if (liquidityInTokenB.gte(10000)) {
    // High liquidity (>10K WETH or >$30M): use 1%
    liquidityPercentage = 0.01;
    console.log(`📊 High liquidity pool: using 1%`);
  } else if (liquidityInTokenB.gte(5000)) {
    // Medium liquidity (>5K WETH or >$15M): use 1.5%
    liquidityPercentage = 0.015;
    console.log(`📊 Medium liquidity pool: using 1.5%`);
  } else if (liquidityInTokenB.gte(1000)) {
    // Lower liquidity (>1K WETH or >$3M): use 2%
    liquidityPercentage = 0.02;
    console.log(`📊 Lower liquidity pool: using 2%`);
  } else {
    // Very low liquidity (<1K WETH or <$3M): use 2.5%
    liquidityPercentage = 0.025;
    console.log(`📊 Very low liquidity pool: using 2.5%`);
  }

  return calculateDynamicInputAmount(priceData, liquidityPercentage);
}

/**
 * Alternative: Use recommendedMaxTradeInB from maxTradeSize
 * This uses the pre-calculated safe trade size (80% of max with 2% slippage)
 * @param {Object} priceData - Price data containing maxTradeSize
 * @returns {Decimal} - Recommended input amount
 */
export function useRecommendedMaxTrade(priceData) {
  const tokenB = priceData.tokenB.symbol;
  const tokenBDecimals = normalizeDecimals(priceData.tokenB.decimals);
  
  // Use the pre-calculated recommendedMaxTradeInB
  if (priceData.recommendedMaxTradeInB) {
    const recommendedMax = new Decimal(priceData.recommendedMaxTradeInB);
    
    // Use 50% of recommended max for extra safety
    const inputAmount = recommendedMax.mul(0.5);
    
    // Apply constraints
    const constraints = getTokenConstraints(tokenB);
    
    if (inputAmount.lt(constraints.min)) {
      console.log(`📊 Recommended amount ${inputAmount.toFixed(4)} below min, using ${constraints.min}`);
      return new Decimal(constraints.min);
    }
    
    if (inputAmount.gt(constraints.max)) {
      console.log(`📊 Recommended amount ${inputAmount.toFixed(4)} above max, using ${constraints.max}`);
      return new Decimal(constraints.max);
    }
    
    console.log(`💧 ${priceData.poolName}: Using 50% of recommended max = ${inputAmount.toFixed(6)} ${tokenB}`);
    return inputAmount;
  }
  
  // Fallback to adaptive if recommendedMaxTradeInB not available
  return calculateAdaptiveInputAmount(priceData);
}