import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';

/**
 * Unit Converter - Handles all token decimal conversions safely
 * Prevents unit mismatches that could lead to massive losses
 */
export class UnitConverter {
    
    /**
     * Convert amount from one token to another with proper decimal handling
     * @param {string|BigInt} amount - Amount in wei
     * @param {number} fromDecimals - Source token decimals
     * @param {number} toDecimals - Target token decimals
     * @returns {string} Converted amount as string
     */
    static convertDecimals(amount, fromDecimals, toDecimals) {
        try {
            const amountBigInt = BigInt(amount.toString());
            
            if (fromDecimals === toDecimals) {
                return amountBigInt.toString();
            }
            
            if (fromDecimals > toDecimals) {
                // Convert from higher precision to lower precision
                const divisor = BigInt(10 ** (fromDecimals - toDecimals));
                return (amountBigInt / divisor).toString();
            } else {
                // Convert from lower precision to higher precision
                const multiplier = BigInt(10 ** (toDecimals - fromDecimals));
                return (amountBigInt * multiplier).toString();
            }
        } catch (error) {
            console.error('Error in convertDecimals:', error);
            throw new Error(`Decimal conversion failed: ${error.message}`);
        }
    }
    
    /**
     * Format amount to human-readable format with proper decimals
     * @param {string|BigInt} amount - Amount in wei
     * @param {number} decimals - Token decimals
     * @returns {string} Formatted amount
     */
    static formatAmount(amount, decimals) {
        try {
            return ethers.formatUnits(amount.toString(), decimals);
        } catch (error) {
            console.error('Error in formatAmount:', error);
            throw new Error(`Amount formatting failed: ${error.message}`);
        }
    }
    
    /**
     * Parse human-readable amount to wei with proper decimals
     * @param {string} amount - Human-readable amount
     * @param {number} decimals - Token decimals
     * @returns {BigInt} Amount in wei
     */
    static parseAmount(amount, decimals) {
        try {
            return ethers.parseUnits(amount, decimals);
        } catch (error) {
            console.error('Error in parseAmount:', error);
            throw new Error(`Amount parsing failed: ${error.message}`);
        }
    }
    
    /**
     * Convert gas cost from ETH to target token with proper decimal handling
     * @param {Decimal} gasCostEth - Gas cost in ETH (18 decimals)
     * @param {Object} targetToken - Target token object with symbol and decimals
     * @param {Map} priceMap - Map of price objects for conversion
     * @returns {Decimal} Gas cost in target token
     */
    static convertGasCostToToken(gasCostEth, targetToken, priceMap) {
        try {
            const wethSymbol = 'WETH';
            
            // If target token is WETH, no conversion needed
            if (targetToken.symbol === wethSymbol) {
                return gasCostEth;
            }
            
            // Find conversion rate from WETH to target token
            const pathEthToTarget = `${wethSymbol}->${targetToken.symbol}`;
            const pathTargetToEth = `${targetToken.symbol}->${wethSymbol}`;
            
            let conversionRate;
            
            if (priceMap.has(pathEthToTarget)) {
                // Direct conversion: WETH -> Target
                conversionRate = priceMap.get(pathEthToTarget).priceOfAinB;
            } else if (priceMap.has(pathTargetToEth)) {
                // Inverse conversion: Target -> WETH, so invert
                const inverseRate = priceMap.get(pathTargetToEth).priceOfAinB;
                if (inverseRate.gt(0)) {
                    conversionRate = new Decimal(1).div(inverseRate);
                } else {
                    throw new Error(`Invalid conversion rate for ${targetToken.symbol}`);
                }
            } else {
                throw new Error(`No price data found for ${wethSymbol}/${targetToken.symbol} conversion`);
            }
            
            // Convert gas cost: ETH * (Target/ETH) = Target
            // But we need to account for the decimal differences
            const gasCostInTarget = gasCostEth.mul(conversionRate);
            
            // The conversion rate should already account for decimals, but let's validate
            console.log(`Gas conversion: ${gasCostEth.toString()} ETH * ${conversionRate.toString()} = ${gasCostInTarget.toString()} ${targetToken.symbol}`);
            
            return gasCostInTarget;
            
        } catch (error) {
            console.error('Error converting gas cost:', error);
            throw new Error(`Gas cost conversion failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate profit with proper unit handling for triangular arbitrage
     * @param {BigInt} amountIn - Input amount in wei
     * @param {BigInt} amountOut - Output amount in wei
     * @param {Object} inputToken - Input token object
     * @param {Object} outputToken - Output token object
     * @returns {Decimal} Profit in input token units
     */
    static calculateProfit(amountIn, amountOut, inputToken, outputToken) {
        try {
            // Format both amounts to their respective token units
            const amountInFormatted = this.formatAmount(amountIn, inputToken.decimals);
            const amountOutFormatted = this.formatAmount(amountOut, outputToken.decimals);
            
            const amountInDecimal = new Decimal(amountInFormatted);
            const amountOutDecimal = new Decimal(amountOutFormatted);
            
            // For profit calculation, we need to convert output to input token units
            // This requires knowing the exchange rate between the tokens
            // For now, we'll assume they're the same token (triangular arbitrage)
            // In a real implementation, you'd need the exchange rate
            
            // If it's the same token, direct comparison
            if (inputToken.symbol === outputToken.symbol) {
                const profit = amountOutDecimal.sub(amountInDecimal);
                return profit;
            } else {
                // For different tokens, we need exchange rate
                // This is a simplified version - in production you'd get the actual rate
                console.warn(`Profit calculation between different tokens (${inputToken.symbol} -> ${outputToken.symbol}) requires exchange rate`);
                return new Decimal(0);
            }
            
        } catch (error) {
            console.error('Error calculating profit:', error);
            throw new Error(`Profit calculation failed: ${error.message}`);
        }
    }
    
    /**
     * Validate that amounts are in the correct decimal format
     * @param {string|BigInt} amount - Amount to validate
     * @param {number} expectedDecimals - Expected decimal places
     * @returns {boolean} True if valid
     */
    static validateAmount(amount, expectedDecimals) {
        try {
            const amountBigInt = BigInt(amount.toString());
            const formatted = this.formatAmount(amountBigInt, expectedDecimals);
            const reparsed = this.parseAmount(formatted, expectedDecimals);
            
            return reparsed === amountBigInt;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get token decimals from symbol
     * @param {string} symbol - Token symbol
     * @returns {number} Token decimals
     */
    static getTokenDecimals(symbol) {
        const tokenDecimals = {
            'WETH': 18,
            'LINK': 18,
            'SHIB': 18,
            'USDC': 6,
            'USDT': 6,
            'DAI': 18
        };
        
        return tokenDecimals[symbol] || 18; // Default to 18 if not found
    }
    
    /**
     * Normalize reserves to a common decimal precision for price calculations
     * @param {BigInt} reserve - Reserve amount in wei
     * @param {number} tokenDecimals - Token decimals
     * @param {number} targetDecimals - Target decimal precision (default 18)
     * @returns {BigInt} Normalized reserve
     */
    static normalizeReserve(reserve, tokenDecimals, targetDecimals = 18) {
        try {
            if (tokenDecimals === targetDecimals) {
                return BigInt(reserve.toString());
            }
            
            return BigInt(this.convertDecimals(reserve, tokenDecimals, targetDecimals));
        } catch (error) {
            console.error('Error normalizing reserve:', error);
            throw new Error(`Reserve normalization failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate price with normalized reserves
     * @param {BigInt} reserveA - Reserve A in wei
     * @param {BigInt} reserveB - Reserve B in wei
     * @param {Object} tokenA - Token A object
     * @param {Object} tokenB - Token B object
     * @returns {Decimal} Price of A in terms of B
     */
    static calculatePrice(reserveA, reserveB, tokenA, tokenB) {
        try {
            // Normalize both reserves to 18 decimals for consistent calculation
            const normalizedReserveA = this.normalizeReserve(reserveA, tokenA.decimals, 18);
            const normalizedReserveB = this.normalizeReserve(reserveB, tokenB.decimals, 18);
            
            const reserveADecimal = new Decimal(normalizedReserveA.toString());
            const reserveBDecimal = new Decimal(normalizedReserveB.toString());
            
            if (reserveADecimal.isZero()) {
                throw new Error('Reserve A cannot be zero');
            }
            
            // Price = ReserveB / ReserveA (normalized to 18 decimals)
            const price = reserveBDecimal.div(reserveADecimal);
            
            return price;
            
        } catch (error) {
            console.error('Error calculating price:', error);
            throw new Error(`Price calculation failed: ${error.message}`);
        }
    }
}

export default UnitConverter;
