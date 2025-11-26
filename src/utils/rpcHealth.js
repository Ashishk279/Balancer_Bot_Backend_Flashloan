import { ethers } from 'ethers';

/**
 * Check RPC node health and performance
 * Tests block retrieval, gas price fetching, and sample contract calls
 * @param {ethers.Provider} provider - The provider to test
 * @returns {Object} Health check results with timing metrics
 */
export async function checkRPCHealth(provider) {
  const startTime = Date.now();

  try {
    // Test 1: Get block number
    const blockNumber = await provider.getBlockNumber();
    const blockTime = Date.now() - startTime;

    // Test 2: Get gas price
    const gasPriceStart = Date.now();
    const gasPrice = await provider.getFeeData();
    const gasPriceTime = Date.now() - gasPriceStart;

    // Test 3: Sample contract call (Uniswap V3 Quoter)
    const quoterStart = Date.now();
    const quoter = new ethers.Contract(
      '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      ['function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'],
      provider
    );

    try {
      await quoter.quoteExactInputSingle.staticCall({
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amountIn: ethers.parseEther('0.01'),
        fee: 3000,
        sqrtPriceLimitX96: 0
      });
      const quoterTime = Date.now() - quoterStart;

      const isHealthy = blockTime < 500 && quoterTime < 1000;

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 RPC HEALTH CHECK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Block Number: ${blockNumber}
Block Time: ${blockTime}ms ${blockTime > 500 ? '⚠️ SLOW' : '✅'}
Gas Price Time: ${gasPriceTime}ms ${gasPriceTime > 500 ? '⚠️ SLOW' : '✅'}
Quoter Time: ${quoterTime}ms ${quoterTime > 1000 ? '⚠️ SLOW' : '✅'}

Status: ${isHealthy ? '✅ HEALTHY' : '⚠️ DEGRADED'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      return {
        healthy: isHealthy,
        blockNumber,
        blockTime,
        gasPriceTime,
        quoterTime
      };
    } catch (quoterError) {
      console.error('❌ Quoter call failed:', quoterError.message);
      return {
        healthy: false,
        error: quoterError.message,
        blockNumber,
        blockTime,
        gasPriceTime
      };
    }

  } catch (error) {
    console.error('❌ RPC Health check failed:', error.message);
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Perform a quick health check without detailed logging
 * @param {ethers.Provider} provider - The provider to test
 * @returns {boolean} True if healthy, false otherwise
 */
export async function quickHealthCheck(provider) {
  try {
    const startTime = Date.now();
    await provider.getBlockNumber();
    const blockTime = Date.now() - startTime;

    return blockTime < 500;
  } catch (error) {
    return false;
  }
}
