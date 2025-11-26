import Decimal from "decimal.js";
import { ethers } from "ethers";
import { MIN_SPREADS, TOKEN_CATEGORIES } from "../config/index.js";

/**
 * ✅ IMPROVED: Normalize token decimals with validation and logging
 * Ensures decimals are within valid range (0-18) for ERC20 tokens
 * @param {number|string} decimals - The decimals value to normalize
 * @returns {number} - Normalized decimals (defaults to 18 if invalid)
 */
function normalizeDecimals(decimals) {
    const parsed = parseInt(decimals);

    // Invalid or out-of-range decimals - log warning and default to 18
    if (isNaN(parsed)) {
        console.warn(`⚠️ Invalid decimals value (NaN): ${decimals}, defaulting to 18`);
        return 18;
    }

    if (parsed < 0) {
        console.warn(`⚠️ Negative decimals value: ${parsed}, defaulting to 18`);
        return 18;
    }

    if (parsed > 18) {
        console.warn(`⚠️ Decimals value exceeds 18: ${parsed}, capping to 18`);
        return 18;
    }

    return parsed;
}




/**
 * Convert a human amount (string | Decimal | number) -> BigInt string (token smallest units)
 * Example: toTokenUnits('5', 6) -> '5000000' (for USDC)
 */
function toTokenUnits(humanAmount, decimals) {
    try {
        const normalizedDecimals = normalizeDecimals(decimals);
        const amount = new Decimal(humanAmount);
        const multiplier = new Decimal(10).pow(normalizedDecimals);
        return amount.mul(multiplier).toFixed(0);
    } catch (error) {
        console.error(`Error in toTokenUnits: ${error.message}`);
        return '0';
    }
}


/**
 * Calculate gas cost in ETH
 */
async function calculateGasCost(provider, gasUnits = 350000) {
    try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei'); // Update to recent avg (Oct 2025: ~20 gwei)
        const gasCost = BigInt(gasUnits) * gasPrice;
        return ethers.formatEther(gasCost);
    } catch (error) {
        console.error(`Error calculating gas cost: ${error.message}`);
        return '0.007'; // Updated fallback: 350k * 20 gwei = ~0.007 ETH (~$32 at $4520/ETH)
    }
}


function gasWeiToTokenHuman(gasCostWei, ethPriceInUSD, tokenPriceInUSD) {
    try {
        const gasCostETH = new Decimal(ethers.formatEther(gasCostWei));
        const gasCostUSD = gasCostETH.mul(ethPriceInUSD);
        const gasCostInToken = gasCostUSD.div(tokenPriceInUSD);
        return gasCostInToken;
    } catch (error) {
        console.error(`Error in gasWeiToTokenHuman: ${error.message}`);
        return new Decimal('0');
    }
}



function deriveTokenPriceInUSD(tokenSymbol, allPrices) {
    try {
        // Try to find a pair with USDC/USDT/DAI
        for (const price of allPrices) {
            const { tokenA, tokenB, priceOfAinB, priceOfBinA } = price;

            if (tokenA.symbol === tokenSymbol) {
                if (['USDC', 'USDT', 'DAI'].includes(tokenB.symbol)) {
                    return new Decimal(priceOfAinB);
                }
                if (tokenB.symbol === 'WETH') {
                    return new Decimal(priceOfAinB).mul(4520); // Updated Oct 6, 2025 price
                }
            }

            if (tokenB.symbol === tokenSymbol) {
                if (['USDC', 'USDT', 'DAI'].includes(tokenA.symbol)) {
                    return new Decimal(priceOfBinA);
                }
                if (tokenA.symbol === 'WETH') {
                    return new Decimal(priceOfBinA).mul(4500);
                }
            }
        }

        // Fallback: assume $1 for unknown tokens
        return new Decimal('1');
    } catch (error) {
        console.error(`Error deriving price for ${tokenSymbol}: ${error.message}`);
        return new Decimal('1');
    }
}

function calculatePriceImpact(amountIn, liquidityData, isV3 = false) {
    try {
        const tradeAmount = new Decimal(amountIn);
        const reserveIn = new Decimal(liquidityData.liquidityInTokenB || '0');
        const reserveOut = new Decimal(liquidityData.liquidityInTokenA || '0');
        const fee = new Decimal('0.003'); // 0.3% default

        if (reserveIn.lte(0) || reserveOut.lte(0)) {
            return { priceImpact: new Decimal('100'), warning: 'No liquidity' };
        }

        const amountInAfterFee = tradeAmount.mul(Decimal(1).sub(fee));
        let impact;
        if (!isV3) {
            // V2: Exact slippage impact
            const amountOut = amountInAfterFee.mul(reserveOut).div(reserveIn.add(amountInAfterFee));
            const effectivePrice = tradeAmount.div(amountOut); // tokenB per tokenA
            const originalPrice = reserveIn.div(reserveOut);
            impact = effectivePrice.sub(originalPrice).div(originalPrice).mul(100).abs();
        } else {
            // V3: Approximate (lower impact due to concentration; use half V2 for simplicity)
            const v2Impact = tradeAmount.div(reserveIn.add(tradeAmount)).mul(100); // Basic
            impact = v2Impact.mul(0.5); // Adjust down for V3
        }

        impact = Decimal.min(impact, new Decimal('99.99')); // Cap
        const warning = impact.gt(isV3 ? 3 : 5) ? `High price impact ${isV3 ? 'for V3 ' : ''}(>${isV3 ? 3 : 5}%)` : null;
        return { priceImpact: impact, warning }; // Return Decimal
    } catch (error) {
        console.error(`Error calculating price impact: ${error.message}`);
        return { priceImpact: new Decimal('0'), warning: null };
    }
}
/**
 * Convert smallest units (BigInt string | BigInt) -> Decimal human units
 * Example: fromTokenUnits('5000000', 6) -> Decimal('5')
 */
function fromTokenUnits(amountWeiLike, decimals) {
    // ethers.formatUnits accepts BigInt/Number/string
    const humanStr = ethers.formatUnits(amountWeiLike.toString(), decimals);
    return new Decimal(humanStr);
}


function getMinSpreadForPair(
    tokenA,
    tokenB
) {
    const catA = TOKEN_CATEGORIES[tokenA.symbol] ?? 'major';
    const catB = TOKEN_CATEGORIES[tokenB.symbol] ?? 'major';

    const spreadA = MIN_SPREADS[catA];
    const spreadB = MIN_SPREADS[catB];

    // take the more conservative (larger) requirement
    return Math.max(spreadA, spreadB) / 100;   // % → decimal
}


export { normalizeDecimals, toTokenUnits, getMinSpreadForPair, gasWeiToTokenHuman, fromTokenUnits, calculateGasCost, deriveTokenPriceInUSD, calculatePriceImpact };