import { Decimal } from 'decimal.js';
import { ethers } from 'ethers'; // Import ethers for BigNumber-related utilities
import logger from './logger.js';
import { UNISWAP_V2_CONSTANTS } from './constants.js';


/**
 * Uniswap V2 Mathematical Engine
 * Implements exact AMM calculations using BigInt for on-chain precision
 */
export class UniswapV2Math {
    static FEE_DENOMINATOR = UNISWAP_V2_CONSTANTS.FEE_DENOMINATOR;
    static FEE_NUMERATOR = UNISWAP_V2_CONSTANTS.FEE_NUMERATOR;
    
    /**
     * Calculate exact output amount for a given input amount.
     * @param {BigInt} amountIn - Input amount (in wei)
     * @param {BigInt} reserveIn - Reserve of input token
     * @param {BigInt} reserveOut - Reserve of output token
     * @returns {BigInt} Output amount in wei
     */
    static getAmountOut(amountIn, reserveIn, reserveOut) {
        try {
            // Inputs must be BigInt
            if (typeof amountIn !== 'bigint' || typeof reserveIn !== 'bigint' || typeof reserveOut !== 'bigint') {
                throw new Error('Inputs to getAmountOut must be BigInts.');
            }

            // Validate inputs
            if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
                throw new Error('Invalid input: amounts and reserves must be positive');
            }
            
            // Perform calculations using BigInt
            const amountInWithFee = amountIn * 997n;
            const numerator = amountInWithFee * reserveOut;
            const denominator = reserveIn * 1000n + amountInWithFee;
            const amountOut = numerator / denominator;
            
            logger.debug('getAmountOut calculation', {
                amountIn: amountIn.toString(),
                reserveIn: reserveIn.toString(),
                reserveOut: reserveOut.toString(),
                amountOut: amountOut.toString()
            });
            
            return amountOut;
        } catch (error) {
            logger.error('Error in getAmountOut calculation', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Calculate exact input amount for a given output amount.
     * @param {BigInt} amountOut - Desired output amount (in wei)
     * @param {BigInt} reserveIn - Reserve of input token
     * @param {BigInt} reserveOut - Reserve of output token
     * @returns {BigInt} Input amount in wei
     */
    static getAmountIn(amountOut, reserveIn, reserveOut) {
        try {
            if (typeof amountOut !== 'bigint' || typeof reserveIn !== 'bigint' || typeof reserveOut !== 'bigint') {
                throw new Error('Inputs to getAmountIn must be BigInts.');
            }

            if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
                throw new Error('Invalid input: amounts and reserves must be positive');
            }
            
            if (amountOut >= reserveOut) {
                throw new Error('Insufficient liquidity: amountOut >= reserveOut');
            }
            
            const numerator = reserveIn * amountOut * this.FEE_DENOMINATOR;
            const denominator = (reserveOut - amountOut) * this.FEE_NUMERATOR;
            const amountIn = (numerator / denominator) + 1n;
            
            logger.debug('getAmountIn calculation', {
                amountOut: amountOut.toString(),
                reserveIn: reserveIn.toString(),
                reserveOut: reserveOut.toString(),
                amountIn: amountIn.toString()
            });
            
            return amountIn;
        } catch (error) {
            logger.error('Error in getAmountIn calculation', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Calculate amounts for multi-hop swaps
     * @param {BigInt} amountIn - Initial input amount
     * @param {Array} path - Array of token addresses representing the swap path
     * @param {Array} reserves - Array of [reserveIn, reserveOut] pairs for each hop
     * @returns {Array<BigInt>} Array of amounts for each token in the path
     */
    static getAmountsOut(amountIn, path, reserves) {
        try {
            if (path.length < 2) {
                throw new Error('Path must contain at least 2 tokens');
            }
            if (reserves.length !== path.length - 1) {
                throw new Error('Reserves array length must be path length - 1');
            }
            
            const amounts = new Array(path.length);
            amounts[0] = amountIn;
            
            for (let i = 0; i < path.length - 1; i++) {
                const [reserveIn, reserveOut] = reserves[i];
                amounts[i + 1] = this.getAmountOut(amounts[i], reserveIn, reserveOut);
            }
            
            logger.debug('getAmountsOut calculation', {
                path,
                amounts: amounts.map(amount => amount.toString())
            });
            
            return amounts;
        } catch (error) {
            logger.error('Error in getAmountsOut calculation', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Calculate input amounts for multi-hop swaps (reverse of getAmountsOut)
     * @param {BigInt} amountOut - Final output amount
     * @param {Array} path - Array of token addresses representing the swap path
     * @param {Array} reserves - Array of [reserveIn, reserveOut] pairs for each hop
     * @returns {Array<BigInt>} Array of amounts for each token in the path
     */
    static getAmountsIn(amountOut, path, reserves) {
        try {
            if (path.length < 2) {
                throw new Error('Path must contain at least 2 tokens');
            }
            if (reserves.length !== path.length - 1) {
                throw new Error('Reserves array length must be path length - 1');
            }
            
            const amounts = new Array(path.length);
            amounts[amounts.length - 1] = amountOut;
            
            for (let i = path.length - 1; i > 0; i--) {
                const [reserveIn, reserveOut] = reserves[i - 1];
                amounts[i - 1] = this.getAmountIn(amounts[i], reserveIn, reserveOut);
            }
            
            logger.debug('getAmountsIn calculation', {
                path,
                amounts: amounts.map(amount => amount.toString())
            });
            
            return amounts;
        } catch (error) {
            logger.error('Error in getAmountsIn calculation', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Calculate price impact for a given trade
     * @param {BigInt} amountIn - Input amount
     * @param {BigInt} reserveIn - Reserve of input token
     * @param {BigInt} reserveOut - Reserve of output token
     * @returns {number} Price impact as a decimal (0.01 = 1%)
     */
    static calculatePriceImpact(amountIn, reserveIn, reserveOut) {
        try {
            const amountInDecimal = new Decimal(amountIn.toString());
            const reserveInDecimal = new Decimal(reserveIn.toString());
            const reserveOutDecimal = new Decimal(reserveOut.toString());
            
            const spotPrice = reserveOutDecimal.div(reserveInDecimal);
            const amountOut = UniswapV2Math.getAmountOut(amountIn, reserveIn, reserveOut);
            const amountOutDecimal = new Decimal(amountOut.toString());
            const executionPrice = amountOutDecimal.div(amountInDecimal);
            const priceImpact = spotPrice.sub(executionPrice).div(spotPrice);
            
            return priceImpact.toNumber();
        } catch (error) {
            logger.error('Error calculating price impact', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Calculate optimal trade size using binary search.
     * @param {Object} poolA - First pool data
     * @param {Object} poolB - Second pool data
     * @param {BigInt} maxAmount - Maximum trade size to consider
     * @param {BigInt} gasCost - Gas cost in wei
     * @returns {Object} { optimalAmount: BigInt, maxProfit: BigInt }
     */
    static findOptimalTradeSize(poolA, poolB, maxAmount, gasCost) {
        try {
            const gasCostBigInt = BigInt(gasCost);
            
            let low = 1n;
            let high = maxAmount;
            let optimalAmount = 0n;
            let maxProfit = 0n;
            
            while (high - low > 1n) {
                const mid = low + (high - low) / 2n;
                
                if (mid <= 0n) {
                    low = mid + 1n;
                    continue;
                }
                
                try {
                    const amountOutB = this.getAmountOut(mid, poolA.reserveIn, poolA.reserveOut);
                    const amountOutA = this.getAmountOut(amountOutB, poolB.reserveIn, poolB.reserveOut);
                    const netProfit = amountOutA - mid - gasCostBigInt;
                    
                    if (netProfit > maxProfit) {
                        maxProfit = netProfit;
                        optimalAmount = mid;
                    }
                    
                    if (netProfit > 0n) {
                        low = mid;
                    } else {
                        high = mid;
                    }
                } catch (error) {
                    low = mid + 1n;
                }
            }
            
            logger.debug('Optimal trade size calculation', {
                optimalAmount: optimalAmount.toString(),
                maxProfit: maxProfit.toString(),
                gasCost: gasCost.toString()
            });
            
            return { optimalAmount, maxProfit };
        } catch (error) {
            logger.error('Error finding optimal trade size', { error: error.message });
            throw error;
        }
    }
}