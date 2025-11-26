import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';
import logger from './logger.js';

/**
 * Safe decimal conversion with validation
 * Converts wei to human-readable format with proper error handling
 */
export function safeFormatUnits(amount, decimals) {
  try {
    // Validate inputs
    if (amount === null || amount === undefined) {
      throw new Error('Amount is null or undefined');
    }

    if (decimals === null || decimals === undefined) {
      throw new Error('Decimals is null or undefined');
    }

    // Normalize decimals
    const normalizedDecimals = typeof decimals === 'bigint' ? Number(decimals) : decimals;

    if (normalizedDecimals < 0 || normalizedDecimals > 77) {
      throw new Error(`Invalid decimals: ${normalizedDecimals}. Must be between 0 and 77`);
    }

    // Convert amount to BigInt if it's not already
    const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount.toString());

    // Use ethers formatUnits
    const formatted = ethers.formatUnits(amountBigInt, normalizedDecimals);

    // Validate result is a valid number
    const asDecimal = new Decimal(formatted);
    if (!asDecimal.isFinite()) {
      throw new Error(`Invalid formatted result: ${formatted}`);
    }

    return formatted;
  } catch (error) {
    logger.error('Error in safeFormatUnits', { amount, decimals, error: error.message });
    throw error;
  }
}

/**
 * Validate output amounts are reasonable
 * Rejects if output is 10x or 0.1x of input (for similar-value tokens)
 * This prevents the "1 ETH -> 22,000 ETH" bug
 */
export function isValidOutputAmount(inputAmount, outputAmount, tokenInDecimals, tokenOutDecimals) {
  try {
    // Convert to Decimal for comparison
    const inputDec = new Decimal(inputAmount.toString());
    const outputDec = new Decimal(outputAmount.toString());

    // Check if both are valid
    if (!inputDec.isFinite() || !outputDec.isFinite()) {
      logger.warn('Invalid input or output amount (not finite)', { inputAmount, outputAmount });
      return false;
    }

    if (inputDec.lte(0) || outputDec.lte(0)) {
      logger.warn('Invalid input or output amount (<=0)', { inputAmount, outputAmount });
      return false;
    }

    // Normalize amounts to same decimals for comparison
    const decimalDiff = tokenOutDecimals - tokenInDecimals;
    const normalizedOutput = decimalDiff !== 0
      ? outputDec.div(new Decimal(10).pow(Math.abs(decimalDiff)))
      : outputDec;

    const ratio = normalizedOutput.div(inputDec);

    // For similar value tokens, ratio should be between 0.1 and 10
    if (ratio.gt(10) || ratio.lt(0.1)) {
      logger.warn('❌ Absurd price ratio detected', {
        inputAmount: inputDec.toString(),
        outputAmount: outputDec.toString(),
        ratio: ratio.toString(),
        tokenInDecimals,
        tokenOutDecimals
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in isValidOutputAmount', { error: error.message });
    return false;
  }
}

/**
 * Validate triangular arbitrage path
 * Ensures the path returns to the same token and amounts are reasonable
 */
export function validateTriangularPath(step1Output, step2Output, amountIn, path) {
  try {
    // 1. Validate triangular paths return to same token
    if (path && path.length > 0) {
      const inputToken = path[0];
      const outputToken = path[path.length - 1];

      if (inputToken !== outputToken) {
        logger.warn('❌ Invalid triangular path: does not return to same token', {
          inputToken,
          outputToken,
          path: path.map ? path.map(t => t.symbol || t).join(' -> ') : path.join(' -> ')
        });
        return false;
      }
    }

    // 2. Validate amounts are BigInt or can be converted
    const amountInBigInt = typeof amountIn === 'bigint' ? amountIn : BigInt(amountIn.toString());
    const step1OutBigInt = typeof step1Output === 'bigint' ? step1Output : BigInt(step1Output.toString());
    const step2OutBigInt = typeof step2Output === 'bigint' ? step2Output : BigInt(step2Output.toString());

    // 3. Check for zero or negative amounts
    if (amountInBigInt <= 0n || step1OutBigInt <= 0n || step2OutBigInt <= 0n) {
      logger.warn('❌ Zero or negative amount detected in triangular path', {
        amountIn: amountInBigInt.toString(),
        step1Output: step1OutBigInt.toString(),
        step2Output: step2OutBigInt.toString()
      });
      return false;
    }

    // 4. Reject absurd ratios between steps
    const step1Ratio = new Decimal(step1OutBigInt.toString()).div(new Decimal(amountInBigInt.toString()));
    const step2Ratio = new Decimal(step2OutBigInt.toString()).div(new Decimal(step1OutBigInt.toString()));

    // Each step should have reasonable ratios
    if (step1Ratio.gt(10) || step1Ratio.lt(0.1)) {
      logger.warn('❌ Absurd ratio in step 1', {
        amountIn: amountInBigInt.toString(),
        step1Output: step1OutBigInt.toString(),
        ratio: step1Ratio.toString()
      });
      return false;
    }

    if (step2Ratio.gt(10) || step2Ratio.lt(0.1)) {
      logger.warn('❌ Absurd ratio in step 2', {
        step1Output: step1OutBigInt.toString(),
        step2Output: step2OutBigInt.toString(),
        ratio: step2Ratio.toString()
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in validateTriangularPath', { error: error.message });
    return false;
  }
}

/**
 * Validate that profit is positive after accounting for gas costs
 */
export function isValidProfit(estimatedProfit, gasCost) {
  try {
    const profitDec = new Decimal(estimatedProfit.toString());
    const gasCostDec = new Decimal(gasCost.toString());

    if (!profitDec.isFinite() || !gasCostDec.isFinite()) {
      logger.warn('Invalid profit or gas cost (not finite)', { estimatedProfit, gasCost });
      return false;
    }

    const netProfit = profitDec.minus(gasCostDec);

    if (netProfit.lte(0)) {
      logger.debug('Profit <= 0 after gas costs', {
        estimatedProfit: profitDec.toString(),
        gasCost: gasCostDec.toString(),
        netProfit: netProfit.toString()
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in isValidProfit', { error: error.message });
    return false;
  }
}
