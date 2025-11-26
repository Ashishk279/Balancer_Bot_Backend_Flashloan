import { Decimal } from 'decimal.js';
import logger from '../../../utils/logger.js';

/**
 * Arbitrage Validator Class
 * Validates arbitrage opportunities to prevent false positives and calculation errors
 */
class ArbitrageValidator {
  constructor() {
    this.MAX_PRICE_RATIO = 10; // Maximum acceptable price ratio (prevents 1 ETH -> 22,000 ETH bugs)
    this.MIN_PRICE_RATIO = 0.1; // Minimum acceptable price ratio
    this.MIN_PROFIT_THRESHOLD = new Decimal('0.00001'); // Minimum profit threshold
    this.STRICT_VALIDATION = process.env.ENABLE_STRICT_VALIDATION === 'true';
    this.LOG_ALL = process.env.LOG_ALL_OPPORTUNITIES === 'true';
  }

  /**
   * Validate triangular arbitrage opportunity
   * @param {Object} opportunity - The arbitrage opportunity to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  validateTriangularArbitrage(opportunity) {
    try {
      if (!opportunity) {
        logger.warn('❌ Validator: Opportunity is null or undefined');
        return false;
      }

      // 1. Validate path exists and returns to same token
      if (!this.validatePath(opportunity)) {
        return false;
      }

      // 2. Validate amounts are reasonable
      if (!this.validateAmounts(opportunity)) {
        return false;
      }

      // 3. Validate profit calculations
      if (!this.validateProfit(opportunity)) {
        return false;
      }

      // 4. Validate price ratios between steps
      if (!this.validatePriceRatios(opportunity)) {
        return false;
      }

      if (this.LOG_ALL) {
        logger.info('✅ Triangular opportunity passed validation', {
          path: opportunity.path.join(' -> '),
          profit: opportunity.netProfitFormatted
        });
      }

      return true;
    } catch (error) {
      logger.error('❌ Error in validateTriangularArbitrage', { error: error.message });
      return false;
    }
  }

  /**
   * Validate the arbitrage path
   */
  validatePath(opportunity) {
    if (!opportunity.path || !Array.isArray(opportunity.path) || opportunity.path.length < 3) {
      logger.warn('❌ Validator: Invalid path structure', { path: opportunity.path });
      return false;
    }

    // Check if path returns to same token (triangular)
    const inputToken = opportunity.path[0];
    const outputToken = opportunity.path[opportunity.path.length - 1];

    if (inputToken !== outputToken) {
      logger.warn('❌ Validator: Path does not return to same token', {
        inputToken,
        outputToken,
        path: opportunity.path.join(' -> ')
      });
      return false;
    }

    return true;
  }

  /**
   * Validate amounts are reasonable and non-zero
   */
  validateAmounts(opportunity) {
    if (!opportunity.amounts || !Array.isArray(opportunity.amounts)) {
      logger.warn('❌ Validator: Invalid amounts structure', { amounts: opportunity.amounts });
      return false;
    }

    // Check all amounts are positive and finite
    for (let i = 0; i < opportunity.amounts.length; i++) {
      const amount = new Decimal(opportunity.amounts[i]);

      if (!amount.isFinite() || amount.lte(0)) {
        logger.warn('❌ Validator: Invalid amount at step', {
          step: i,
          amount: amount.toString(),
          path: opportunity.path ? opportunity.path.join(' -> ') : 'unknown'
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Validate profit is positive
   */
  validateProfit(opportunity) {
    // Check gross profit
    if (!opportunity.grossProfit) {
      logger.warn('❌ Validator: No gross profit defined');
      return false;
    }

    const grossProfit = new Decimal(opportunity.grossProfit);

    if (!grossProfit.isFinite() || grossProfit.lte(0)) {
      if (this.LOG_ALL) {
        logger.debug('Validator: Gross profit <= 0', {
          grossProfit: grossProfit.toString(),
          path: opportunity.path ? opportunity.path.join(' -> ') : 'unknown'
        });
      }
      return false;
    }

    // Check net profit if available
    if (opportunity.profit !== undefined) {
      const netProfit = new Decimal(opportunity.profit);

      if (!netProfit.isFinite() || netProfit.lte(0)) {
        if (this.LOG_ALL) {
          logger.debug('Validator: Net profit <= 0 after gas', {
            netProfit: netProfit.toString(),
            grossProfit: grossProfit.toString(),
            path: opportunity.path ? opportunity.path.join(' -> ') : 'unknown'
          });
        }
        return false;
      }
    }

    return true;
  }

  /**
   * Validate price ratios between steps are reasonable
   */
  validatePriceRatios(opportunity) {
    if (!opportunity.amounts || opportunity.amounts.length < 2) {
      return true; // Skip if no amounts to compare
    }

    for (let i = 0; i < opportunity.amounts.length - 1; i++) {
      const amountIn = new Decimal(opportunity.amounts[i]);
      const amountOut = new Decimal(opportunity.amounts[i + 1]);

      if (!amountIn.isFinite() || !amountOut.isFinite()) {
        continue;
      }

      if (amountIn.lte(0)) {
        logger.warn('❌ Validator: Zero or negative input amount at step', { step: i });
        return false;
      }

      const ratio = amountOut.div(amountIn);

      // Check for absurd ratios (prevents 1 ETH -> 22,000 ETH bug)
      if (ratio.gt(this.MAX_PRICE_RATIO) || ratio.lt(this.MIN_PRICE_RATIO)) {
        logger.warn('❌ Validator: Absurd price ratio detected', {
          step: i,
          fromToken: opportunity.path ? opportunity.path[i] : 'unknown',
          toToken: opportunity.path ? opportunity.path[i + 1] : 'unknown',
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          ratio: ratio.toString()
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Validate direct arbitrage opportunity
   * @param {Object} opportunity - The direct arbitrage opportunity
   * @returns {boolean} - True if valid, false otherwise
   */
  validateDirectArbitrage(opportunity) {
    try {
      if (!opportunity) {
        logger.warn('❌ Validator: Direct opportunity is null or undefined');
        return false;
      }

      // 1. Validate input and output amounts exist
      if (!opportunity.amount_in || !opportunity.amount_out) {
        logger.warn('❌ Validator: Missing amount_in or amount_out', {
          pair: opportunity.pair,
          amount_in: opportunity.amount_in,
          amount_out: opportunity.amount_out
        });
        return false;
      }

      // 2. Validate amounts are reasonable
      const amountIn = new Decimal(opportunity.amount_in.toString());
      const amountOut = new Decimal(opportunity.amount_out.toString());

      if (!amountIn.isFinite() || !amountOut.isFinite()) {
        logger.warn('❌ Validator: Invalid amounts (not finite)', {
          pair: opportunity.pair,
          amount_in: amountIn.toString(),
          amount_out: amountOut.toString()
        });
        return false;
      }

      if (amountIn.lte(0) || amountOut.lte(0)) {
        logger.warn('❌ Validator: Zero or negative amounts', {
          pair: opportunity.pair,
          amount_in: amountIn.toString(),
          amount_out: amountOut.toString()
        });
        return false;
      }

      // 3. Validate output > input (must be profitable)
      if (amountOut.lte(amountIn)) {
        if (this.LOG_ALL) {
          logger.debug('Validator: Output <= Input, not profitable', {
            pair: opportunity.pair,
            amount_in: amountIn.toString(),
            amount_out: amountOut.toString()
          });
        }
        return false;
      }

      // 4. Validate price ratio is reasonable
      const ratio = amountOut.div(amountIn);
      if (ratio.gt(this.MAX_PRICE_RATIO) || ratio.lt(this.MIN_PRICE_RATIO)) {
        logger.warn('❌ Validator: Absurd price ratio in direct arbitrage', {
          pair: opportunity.pair,
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
          amount_in: amountIn.toString(),
          amount_out: amountOut.toString(),
          ratio: ratio.toString()
        });
        return false;
      }

      // 5. Validate profit if available
      if (opportunity.profit) {
        const profit = new Decimal(opportunity.profit);
        if (!profit.isFinite() || profit.lte(0)) {
          if (this.LOG_ALL) {
            logger.debug('Validator: Invalid or zero profit', {
              pair: opportunity.pair,
              profit: profit.toString()
            });
          }
          return false;
        }
      }

      if (this.LOG_ALL) {
        logger.info('✅ Direct opportunity passed validation', {
          pair: opportunity.pair,
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
          profit: opportunity.profit ? opportunity.profit.toString() : 'N/A'
        });
      }

      return true;
    } catch (error) {
      logger.error('❌ Error in validateDirectArbitrage', {
        error: error.message,
        pair: opportunity?.pair
      });
      return false;
    }
  }
}

// Export singleton instance
const validator = new ArbitrageValidator();
export default validator;
