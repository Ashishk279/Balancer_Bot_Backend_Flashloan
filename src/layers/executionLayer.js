import { consumeTopOpportunity, completeOpportunity, appendOpportunityToArrayFile } from '../services/opportunity.js';
import FlashbotExecutor from "../services/v3/arbitrageEngin/flashbotExecuter.js";
import { ethers } from 'ethers';
import ws from '../provider/websocket.js';
import logger from '../utils/logger.js';
import { createDirectExecutionPayload, createFlashLoanPayload, getMinAmountOutWithSlippage } from '../services/v3/arbitrageEngin/payload.js';
import Decimal from 'decimal.js';
import ABI from '../services/v3/abi/abi.js';
import redis from '../config/radis.js';
import { createDirectExecutionPayloadWithSDK } from '../services/v3/arbitrageEngin/payload1.js';
import { MIN_TRADE_AMOUNTS, TOKEN_SYMBOLS } from '../config/index.js';

const wsProvider = ws.getProvider();
let flashbotExecutor = null;
const httpProvider = new ethers.JsonRpcProvider('https://eth-mainnet.ws.alchemyapi.io/v2/xo70m5QSzeEkOivsSU3rd')
const EXECUTION_TIMEOUT = 60000; // 60 seconds timeout for transaction confirmation

// Minimum trade amounts for profitability
// const MIN_TRADE_AMOUNTS = {
//   WETH: ethers.parseEther('1'),      // Minimum 1 ETH
//   USDC: ethers.parseUnits('5000', 6), // Minimum $5000 USDC
//   USDT: ethers.parseUnits('5000', 6), // Minimum $5000 USDT
//   LINK: ethers.parseEther('100'),     // Minimum 100 LINK
// };

// Token address to symbol mapping (add more as needed)


async function getFlashbotExecutor() {
  if (flashbotExecutor) return flashbotExecutor;
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    logger.warn('FlashbotExecutor not initialized: PRIVATE_KEY missing', { service: 'executionLayer' });
    return null;
  }
  try {
    const wallet = new ethers.Wallet(privateKey, wsProvider);
    flashbotExecutor = new FlashbotExecutor(wsProvider, wallet, {
      contractAddress: process.env.ARBITRAGE_CONTRACT_ADDRESS,
      flashbotsRelay: process.env.FLASHBOTS_RELAY
    });
    await flashbotExecutor.initialize();
    return flashbotExecutor;
  } catch (error) {
    logger.error(`Failed to initialize FlashbotExecutor: ${error.message}, { service: 'executionLayer' }`);
    return null;
  }
}

/**
 * Get token symbol from address
 * @param {string} tokenAddress - Token contract address
 * @returns {string} Token symbol or null
 */
function getTokenSymbol(tokenAddress) {
  return TOKEN_SYMBOLS[tokenAddress] || null;
}

/**
 * Validate loan amount against minimum trade threshold
 * @param {string|bigint} loanAmount - Loan amount in Wei
 * @param {string} tokenSymbol - Token symbol (WETH, USDC, etc.)
 * @returns {boolean} True if valid, false otherwise
 */
function validateLoanAmount(loanAmount, tokenSymbol) {
  const minAmount = MIN_TRADE_AMOUNTS[tokenSymbol];
  if (!minAmount) {
    // No minimum defined for this token, allow it
    return true;
  }

  const loanAmountBigInt = typeof loanAmount === 'bigint' ? loanAmount : BigInt(loanAmount);
  if (loanAmountBigInt < minAmount) {
    logger.warn(`Loan amount ${loanAmount} below minimum ${minAmount}`, {
      token: tokenSymbol,
      service: 'executionLayer'
    });
    return false;
  }
  return true;
}

/**
 * Check if opportunity is profitable after gas costs
 * @param {Object} opportunity - Opportunity object with expectedProfit
 * @param {Object} provider - Ethers provider
 * @param {number} gasEstimate - Estimated gas units (default 400000 for flash loan)
 * @returns {Promise<boolean>} True if profitable after gas, false otherwise
 */
async function isProfitableAfterGas(opportunity, provider, gasEstimate = 400000n) {
  try {
    const gasPrices = await calculateGasPrices(provider, opportunity.estimated_profit || 0);
    const gasCostWei = BigInt(gasEstimate) * gasPrices.maxFeePerGas;

    // Convert profit to Wei for comparison
    let profitWei;
    if (typeof opportunity.estimated_profit === 'string') {
      profitWei = ethers.parseEther(opportunity.estimated_profit);
    } else if (typeof opportunity.estimated_profit === 'number') {
      profitWei = ethers.parseEther(opportunity.estimated_profit.toString());
    } else {
      profitWei = BigInt(opportunity.estimated_profit || 0);
    }

    // Require at least 3x gas cost in profit
    const minRequiredProfit = gasCostWei * 3n;

    if (profitWei < minRequiredProfit) {
      console.log(`
❌ Unprofitable after gas:
   Expected Profit: ${ethers.formatEther(profitWei)} ETH
   Gas Cost: ${ethers.formatEther(gasCostWei)} ETH (${gasEstimate} gas units)
   Min Required: ${ethers.formatEther(minRequiredProfit)} ETH (3x gas cost)
      `);
      logger.warn('Opportunity unprofitable after gas costs', {
        expectedProfit: ethers.formatEther(profitWei),
        gasCost: ethers.formatEther(gasCostWei),
        minRequired: ethers.formatEther(minRequiredProfit),
        service: 'executionLayer'
      });
      return false;
    }

    console.log(`✅ Profitable after gas: ${ethers.formatEther(profitWei)} ETH profit > ${ethers.formatEther(minRequiredProfit)} ETH required`);
    return true;
  } catch (error) {
    logger.error(`Error checking profitability: ${error.message}`, { service: 'executionLayer' });
    return false;
  }
}

export async function executeOpportunities() {

  while (true) {
    const lock = await redis.get('execution_lock');
    if (lock) {
      console.log('Execution locked, waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    try {
      const opp = await consumeTopOpportunity();
      if (!opp) {
        logger.info('No opportunities available. Waiting...', { service: 'executionLayerV3' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // console.log("opp==========", opp);

      logger.info(`Consuming opportunity: ${opp.key}, { service: 'executionLayerV3' }`);

      // const executor = await getFlashbotExecutor();
      // if (!executor) {
      //   await completeOpportunity(opp.key, false, null);
      //   continue;
      // }
      const FlashLoan = true
      let execution_payload;
      if (FlashLoan === true) {
        execution_payload = await createFlashLoanPayload(opp, wsProvider);
      } else {
        execution_payload = await createDirectExecutionPayload(opp, wsProvider)
      }



      // console.log("execution, ", execution_payload)

      try {
        // Map Redis opp to execOpp
         const execOpp = {
          id: opp.key ? opp.key.split(':')[1] : null, // Extract opportunity ID from Redis key
          type: opp.strategy || opp.type || 'v3_direct', // Strategy type, fallback to opp.type or default
          timestamp: Date.now(), // Current execution timestamp in milliseconds
          estimated_profit: opp.expectedProfit || opp.profit || '0', // Use expected or actual profit
          execution_payload: opp.execution_payload || null, // Full calldata/payload from Redis (already parsed)
          pair: opp.poolId || `${opp.tokenA.symbol}/${opp.tokenB.symbol}`, // Fallback to symbol pair if poolId missing
          buyDex: opp.buyDex,
          sellDex: opp.sellDex,
          txHash: opp.txHash || null, // Victim transaction hash (for sandwich/MEV tracking)
          buyPoolAddress: opp.buyPoolAddress || null, // Required for V2 pool validation
          sellPoolAddress: opp.sellPoolAddress || null, // Required for V2 pool validation
          // Additional useful fields (optional, for logging/debugging)
          amountIn: opp.amountIn,
          amountOut: opp.amountOut,
          profit: opp.profit,
          path: opp.path,
          tokenA: opp.tokenA,
          tokenB: opp.tokenB,
          gasEstimation: opp.gasEstimation || '0',
          priorityFee: opp.priorityFee || '0',
          spread: opp.spread || '0',
          timestamp: opp.timestamp || null
        };

        console.log("eddfweaf---", execOpp)

        const profit = new Decimal(execOpp.estimated_profit || '0'); // Ensure Decimal is used here if needed
        if (profit.lessThan(new Decimal('0'))) {
          logger.warn('Opportunity not profitable, skipping', { key: opp.key, service: 'executionLayer' });
          continue;
        }


        // if (execOpp.estimated_profit !== undefined  && (execOpp.pair.endsWith('USDC') || execOpp.pair.endsWith('USDT'))) {
        //   const execute = await executeTransaction(execOpp, wsProvider)

        //   console.log("execute", execute)
        // }


       let execute;
        if (execOpp.estimated_profit !== undefined) {

          if (FlashLoan) {
             execute = await executeFlashLoanTransaction(execOpp, wsProvider, opp)
            console.log("execute", execute)
          }
          else {

           execute = await executeTransaction(execOpp, wsProvider)

            console.log("execute", execute)
          }
        }



        // const result = await executor.executeArbitrage(execOpp);
        await completeOpportunity(opp.key, execute.success, execOpp);

        if (execute.success) {
          // logger.info(Opportunity ${opp.key} executed successfully, { bundleHash: execute.bundleHash, service: 'executionLayer' });
          await completeOpportunity(opp.key, execute.success, execOpp);
        } else {
          logger.warn(`Opportunity ${opp.key} execution failed, { error: execute.error, service: 'executionLayer' }`);
        }
      } catch (error) {
        logger.error(`Error executing ${opp.key}: ${error.message}, { service: 'executionLayer' }`);
        // await completeOpportunity(opp.key, false, null);
      }
    } catch (error) {
      logger.error(`Execution loop error: ${error.message}, { service: 'executionLayer' }`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

}



// Fixed section of executionLayer.js
// export async function executeOpportunities() {
//     while (true) {
//         try {
//             const opp = await consumeTopOpportunity();
//             if (!opp) {
//                 logger.info('No opportunities available. Waiting...', { service: 'executionLayerV3' });
//                 await new Promise(resolve => setTimeout(resolve, 1000));
//                 continue;
//             }

//             logger.info(Consuming opportunity: ${opp.key}, { service: 'executionLayerV3' });

//             // const executor = await getFlashbotExecutor();
//             // if (!executor) {
//             //     await completeOpportunity(opp.key, false, null);
//             //     continue;
//             // }

//             // Parse the Redis data properly
//             let tokenA, tokenB;
//             try {
//                 tokenA = typeof opp.tokenA === 'string' ? JSON.parse(opp.tokenA) : opp.tokenA;
//                 tokenB = typeof opp.tokenB === 'string' ? JSON.parse(opp.tokenB) : opp.tokenB;
//             } catch (e) {
//                 logger.error(Failed to parse token data: ${e.message}, { service: 'executionLayerV3' });
//                 await completeOpportunity(opp.key, false, null);
//                 continue;
//             }

//             // Create proper opportunity object with parsed data
//             const parsedOpp = {
//                 ...opp,
//                 tokenA: tokenA,
//                 tokenB: tokenB,
//                 fee1: parseFloat(opp.fee1),
//                 fee2: parseFloat(opp.fee2) ,
//                 amount_in: opp.amountIn || opp.amount_in,
//                 profit: opp.expectedProfit || opp.profit
//             };

//             console.log("Parsed Opportunity: ", parsedOpp);

//             // Create execution payload with parsed data
//             let execution_payload;
//             try {
//                 execution_payload = await createDirectExecutionPayload(parsedOpp, wsProvider);
//             } catch (e) {
//                 logger.error(Failed to create execution payload: ${e.message}, { service: 'executionLayerV3' });
//                 await completeOpportunity(opp.key, false, null);
//                 continue;
//             }

//             try {
//                 // Map Redis opp to execOpp
//                 const execOpp = {
//                     id: opp.key.split(':')[1],
//                     type: opp.strategy || 'v3_direct',
//                     timestamp: Date.now(),
//                     estimated_profit: parsedOpp.profit,
//                     execution_payload: execution_payload,
//                     pair: opp.poolId,
//                     buyDex: opp.buyDex,
//                     sellDex: opp.sellDex,
//                     txHash: opp.txHash,
//                 };

//                 // Validate profit before execution
//                 const profit = new Decimal(execOpp.estimated_profit || '0');
//                 if (profit.lessThan(new Decimal('0'))) {
//                     logger.warn('Opportunity not profitable, skipping', { key: opp.key, service: 'executionLayerV3' });
//                     await completeOpportunity(opp.key, false, null);
//                     continue;
//                 }

//                 if (execOpp.estimated_profit !== undefined && (execOpp.pair.endsWith('USDC') || execOpp.pair.endsWith('USDT') || execOpp.pair.endsWith('WETH'))) {
//                     const execute = await executeTransaction(execOpp, wsProvider);
//                     logger.info(Execution result for ${opp.key}: ${JSON.stringify(execute)}, { service: 'executionLayerV3' });
//                     await completeOpportunity(opp.key, execute.success, execOpp);
//                 }
//             } catch (error) {
//                 logger.error(Error executing ${opp.key}: ${error.message}, { service: 'executionLayer' });
//                 await completeOpportunity(opp.key, false, null);
//             }
//         } catch (error) {
//             logger.error(Execution loop error: ${error.message}, { service: 'executionLayer' });
//             await new Promise(resolve => setTimeout(resolve, 1000));
//         }
//     }
// }

/**
 * Validate execution profitability before sending transaction
 * @param {Object} opportunity - The opportunity object
 * @param {Object} provider - Ethers provider
 * @returns {Object} Validation result with success flag and details
 */
async function validateExecutionProfitability(opportunity, provider) {
  try {
    console.log('\n🔍 Validating execution profitability...');

    // Validate and extract execution payload
    if (!opportunity.execution_payload || !opportunity.execution_payload.path) {
      return {
        success: false,
        error: 'Invalid execution payload: missing path'
      };
    }

    const { path, amountIn } = opportunity.execution_payload;

    // Validate path structure
    if (!Array.isArray(path) || path.length !== 2) {
      return {
        success: false,
        error: `Invalid execution path: expected 2 steps, got ${path.length}`
      };
    }

    // Validate each step in the path
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      if (!step || !step.router || !step.tokenIn || !step.tokenOut) {
        return {
          success: false,
          error: `Invalid step ${i + 1} in path: ${JSON.stringify(step)}`
        };
      }
    }

    const amountInBigInt = BigInt(amountIn);
    const step1 = path[0];
    const step2 = path[1];

    // Helper function to determine if a DEX is V3
    function isV3Pool(dexName) {
      return dexName.includes('V3') || dexName.includes('v3');
    }

    // Determine DEX types from opportunity DEX names (for proper quoter/router selection)
    const dexType1 = isV3Pool(opportunity.buyDex) ? 'V3' : 'V2';
    const dexType2 = isV3Pool(opportunity.sellDex) ? 'V3' : 'V2';

    // Get token decimals properly
    const step1TokenInDecimals = parseInt(opportunity.tokenBDecimals || 18);
    const step1TokenOutDecimals = parseInt(opportunity.tokenADecimals || 18);
    const step2TokenInDecimals = step1TokenOutDecimals;
    const step2TokenOutDecimals = step1TokenInDecimals;

    // Get USD value for dynamic slippage (estimate from amountIn)
    const amountUSD = '5000'; // Default, can be improved

    // Get fresh quote for Step 1
    let step1Quote;
    try {
      const step1Params = {
        provider,
        dexType: dexType1,
        amountIn: amountIn.toString(),
        tokenIn: step1.tokenIn,
        tokenOut: step1.tokenOut,
        tokenInDecimals: step1TokenInDecimals,
        tokenOutDecimals: step1TokenOutDecimals, // ✅ Use correct decimals
        amountUSD: amountUSD
      };

      if (dexType1 === 'V2') {
        step1Params.routerAddress = step1.router;
        step1Params.pairAddress = opportunity.buyPoolAddress;

        // Validate that pool address exists for V2
        if (!step1Params.pairAddress) {
          return {
            success: false,
            error: `Missing buyPoolAddress for V2 pool: ${opportunity.buyDex}`
          };
        }
      } else {
        step1Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
        step1Params.fee = parseInt(step1.fee);
      }

      step1Quote = await getMinAmountOutWithSlippage(step1Params);
    } catch (error) {
      return {
        success: false,
        error: `Step 1 quote failed: ${error.message}`
      };
    }

    // Validate step 1 quote
    if (!step1Quote || !step1Quote.expectedAmountOut) {
      return {
        success: false,
        error: 'Step 1 quote invalid'
      };
    }

    // Display with CORRECT decimals
    const step1OutputHuman = ethers.formatUnits(
      step1Quote.expectedAmountOut,
      step1TokenOutDecimals // ✅ Use actual token decimals
    );

    console.log(`Step 1 Output: ${step1OutputHuman} ${opportunity.tokenA ? JSON.parse(opportunity.tokenA).symbol : 'tokens'}`);

    // Get fresh quote for Step 2 using Step 1's output
    let step2Quote;
    try {
      const step2AmountIn = step1Quote.expectedAmountOut.toString();

      const step2Params = {
        provider,
        dexType: dexType2,
        amountIn: step2AmountIn,
        tokenIn: step2.tokenIn,
        tokenOut: step2.tokenOut,
        tokenInDecimals: step2TokenInDecimals,
        tokenOutDecimals: step2TokenOutDecimals,
        amountUSD: amountUSD
      };

      if (dexType2 === 'V2') {
        step2Params.routerAddress = step2.router;
        step2Params.pairAddress = opportunity.sellPoolAddress;

        // Validate that pool address exists for V2
        if (!step2Params.pairAddress) {
          return {
            success: false,
            error: `Missing sellPoolAddress for V2 pool: ${opportunity.sellDex}`
          };
        }
      } else {
        step2Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
        step2Params.fee = parseInt(step2.fee);
      }

      step2Quote = await getMinAmountOutWithSlippage(step2Params);
    } catch (error) {
      return {
        success: false,
        error: `Step 2 quote failed: ${error.message}`
      };
    }

    // Validate step 2 quote
    if (!step2Quote || !step2Quote.expectedAmountOut) {
      return {
        success: false,
        error: 'Step 2 quote invalid'
      };
    }

    // Convert to BigInt for comparison
    const finalOutput = typeof step2Quote.expectedAmountOut === 'bigint'
      ? step2Quote.expectedAmountOut
      : BigInt(step2Quote.expectedAmountOut);

    // Calculate actual profit (can be negative for loss)
    const actualProfit = finalOutput - amountInBigInt;
    const actualProfitPercent = (Number(actualProfit) * 100) / Number(amountInBigInt);

    // Get gas price info for profitability calculations
    const gasPrice = await provider.getFeeData();
    const estimatedGas = 400000n;
    const gasCostWei = estimatedGas * (gasPrice.maxFeePerGas || gasPrice.gasPrice || ethers.parseUnits('5', 'gwei'));
    const minProfitRequired = gasCostWei * 3n; // 3x gas cost

    // ✅ CRITICAL CHECK: Ensure we don't lose money
    if (finalOutput <= amountInBigInt) {
      const loss = amountInBigInt - finalOutput;
      const lossPercent = (Number(loss) * 100) / Number(amountInBigInt);

      console.log(`
❌ EXECUTION BLOCKED - LOSS TRADE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detection Expected: ${opportunity.estimated_profit || 'N/A'} profit
Execution Reality: ${ethers.formatUnits(loss, step2TokenOutDecimals)} loss (${lossPercent.toFixed(2)}%)

Reason: Price changed between detection and execution
Time Gap: ${opportunity.timestamp ? Date.now() - opportunity.timestamp : 'N/A'}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
      opportunity.actualProfit = actualProfit.toString();
      opportunity.actualProfitPercent = actualProfitPercent;
      opportunity.gasCost = gasCostWei.toString();
      opportunity.minProfitRequired = minProfitRequired.toString();
      opportunity.gasPriceUsed = gasPrice.maxFeePerGas ? gasPrice.maxFeePerGas.toString() : (gasPrice.gasPrice ? gasPrice.gasPrice.toString() : ethers.parseUnits('5', 'gwei').toString());
      await appendOpportunityToArrayFile(opportunity);
      return {
        success: false,
        error: 'Opportunity became unprofitable',
        detectedProfit: opportunity.estimated_profit,
        actualResult: 'loss',
        lossAmount: ethers.formatUnits(loss, step2TokenOutDecimals)
      };
    }

    console.log(`
✅ Execution Validation:
   Amount In: ${ethers.formatUnits(amountInBigInt, step1TokenInDecimals)} ${opportunity.tokenB ? JSON.parse(opportunity.tokenB).symbol : 'WETH'}
   Step 1 Out: ${step1OutputHuman} ${opportunity.tokenA ? JSON.parse(opportunity.tokenA).symbol : ''}
   Step 2 Out: ${ethers.formatUnits(finalOutput, step2TokenOutDecimals)} ${opportunity.tokenB ? JSON.parse(opportunity.tokenB).symbol : 'WETH'}
   Actual Profit: ${ethers.formatUnits(actualProfit, step2TokenOutDecimals)} ${opportunity.tokenB ? JSON.parse(opportunity.tokenB).symbol : 'WETH'} (${actualProfitPercent.toFixed(3)}%)
   Min Required: ${ethers.formatUnits(minProfitRequired, step2TokenOutDecimals)} ${opportunity.tokenB ? JSON.parse(opportunity.tokenB).symbol : 'WETH'}
   Gas Cost: ${ethers.formatUnits(gasCostWei, step2TokenOutDecimals)} ${opportunity.tokenB ? JSON.parse(opportunity.tokenB).symbol : 'WETH'}
    `);

    if (actualProfit < minProfitRequired) {
      return {
        success: false,
        error: 'Profit below minimum threshold',
        actualProfit: ethers.formatUnits(actualProfit, step2TokenOutDecimals),
        minRequired: ethers.formatUnits(minProfitRequired, step2TokenOutDecimals)
      };
    }

    return {
      success: true,
      actualProfit: ethers.formatUnits(actualProfit, step2TokenOutDecimals),
      actualProfitPercent: actualProfitPercent.toFixed(3),
      step1Quote,
      step2Quote
    };
  } catch (error) {
    console.error('Profitability validation error:', error.message);
    return {
      success: false,
      error: `Validation error: ${error.message}`
    };
  }
}

/**
 * Calculate optimal gas prices with smart network congestion analysis
 * @param {Object} provider - Ethers provider
 * @param {number} expectedProfit - Expected profit in ETH (optional, for dynamic priority fee)
 * @returns {Object} Gas price information
 */
async function calculateGasPrices(provider, expectedProfit = 0) {
  try {
    const block = await provider.getBlock('latest');
    const baseFee = block.baseFeePerGas;

    // Get current network congestion via fee history
    let avgPriorityFee;
    try {
      const feeHistory = await provider.send('eth_feeHistory', [10, 'latest', [50]]);
      avgPriorityFee = feeHistory.reward
        .map(r => BigInt(r[0]))
        .reduce((a, b) => a + b) / BigInt(feeHistory.reward.length);
    } catch (feeHistoryError) {
      // Fallback if fee history is not available
      avgPriorityFee = ethers.parseUnits('0.5', 'gwei');
    }

    // Smart gas calculation based on base fee
    const baseFeeGwei = Number(ethers.formatUnits(baseFee, 'gwei'));

    let priorityFee;
    if (baseFeeGwei < 5) {
      // Low network congestion - use minimal priority
      priorityFee = ethers.parseUnits('0.1', 'gwei');
    } else if (baseFeeGwei < 20) {
      // Medium congestion - use average from network
      priorityFee = avgPriorityFee;
    } else {
      // High congestion - use competitive but capped
      priorityFee = ethers.parseUnits('1', 'gwei');
    }

    // Dynamic priority fee based on profit (if provided)
    if (expectedProfit > 0) {
      const profitInWei = ethers.parseEther(expectedProfit.toString());
      // Use 1% of profit for priority fee, min 0.1 gwei, max 2 gwei
      const dynamicPriority = profitInWei / 100n;
      const minPriority = ethers.parseUnits('0.1', 'gwei');
      const maxPriority = ethers.parseUnits('2', 'gwei');

      if (dynamicPriority >= minPriority && dynamicPriority <= maxPriority) {
        priorityFee = dynamicPriority;
      } else if (dynamicPriority > maxPriority) {
        priorityFee = maxPriority;
      }
    }

    // Calculate max fee with 10% buffer on base
    const maxFeePerGas = baseFee * 110n / 100n + priorityFee;

    logger.info('Smart Gas Pricing', {
      baseFeeGwei: ethers.formatUnits(baseFee, 'gwei'),
      priorityFeeGwei: ethers.formatUnits(priorityFee, 'gwei'),
      maxFeeGwei: ethers.formatUnits(maxFeePerGas, 'gwei'),
      networkCongestion: baseFeeGwei < 5 ? 'Low' : baseFeeGwei < 20 ? 'Medium' : 'High',
      profitBasedPriority: expectedProfit > 0,
      service: 'executionLayer'
    });

    return {
      maxFeePerGas,
      maxPriorityFeePerGas: priorityFee,
      baseFee,
      gasPrice: maxFeePerGas
    };
  } catch (error) {
    logger.error(`Error calculating gas prices: ${error.message}`, { service: 'executionLayer' });

    // Fallback to minimal fees for low-cost execution
    return {
      maxFeePerGas: ethers.parseUnits('5', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('0.1', 'gwei'),
      baseFee: ethers.parseUnits('4.9', 'gwei'),
      gasPrice: ethers.parseUnits('5', 'gwei')
    };
  }
}

export async function executeTransaction(payload, provider) {
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.ARBITRAGE_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    return {
      success: false,
      error: 'Missing PRIVATE_KEY or ARBITRAGE_CONTRACT_ADDRESS in environment'
    };
  }
  const wallet = new ethers.Wallet(privateKey, provider);

  try {
    // ✅ Validate execution profitability BEFORE gas estimation
    const validation = await validateExecutionProfitability(payload, provider);

    if (!validation.success) {
      console.log(`❌ Execution validation failed: ${validation.error}`);
      return {
        success: false,
        error: validation.error,
        validationDetails: validation
      };
    }

    console.log(`✅ Execution validation passed - proceeding with transaction`);

    // ✅ Check profitability after gas costs (direct execution typically uses ~200k gas)
    const isProfitable = await isProfitableAfterGas(payload, provider, 200000n);
    if (!isProfitable) {
      return {
        success: false,
        error: 'Opportunity not profitable after gas costs'
      };
    }

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ABI, wallet);

    // Calculate optimal gas prices with priority fee (with profit-based priority)
    const gasPrices = await calculateGasPrices(provider, payload.estimated_profit || 0);
    console.log("Gas Price", gasPrices)

    // === LOW BASE FEE PROTECTION (< 0.5 Gwei) ===
    const baseFeeGwei = Number(ethers.formatUnits(gasPrices.baseFee, 'gwei'));
    const MIN_BASE_FEE_THRESHOLD = 0.5; // Gwei
    const FLOOR_PRIORITY_FEE = ethers.parseUnits('2', 'gwei'); // 2 Gwei tip
    const FLOOR_MAX_FEE = ethers.parseUnits('2.1', 'gwei'); // 2.1 Gwei cap

    let finalMaxFeePerGas;
    let finalMaxPriorityFeePerGas = gasPrices.maxPriorityFeePerGas;

    if (baseFeeGwei < MIN_BASE_FEE_THRESHOLD) {
      console.log(`⚡ Base fee too low (${baseFeeGwei.toFixed(4)} Gwei < 0.5 Gwei). Applying floor fees for fast inclusion.`);

      // Force minimum priority fee
      finalMaxPriorityFeePerGas = FLOOR_PRIORITY_FEE;

      // maxFeePerGas = baseFee * 2 + priority (EIP-1559 rule), but enforce floor
      const suggestedMaxFee = gasPrices.baseFee * 2n + FLOOR_PRIORITY_FEE;
      finalMaxFeePerGas = suggestedMaxFee > FLOOR_MAX_FEE ? suggestedMaxFee : FLOOR_MAX_FEE;
    } else {
      // Normal case: use network suggestions
      finalMaxFeePerGas = gasPrices.maxFeePerGas;
      finalMaxPriorityFeePerGas = gasPrices.maxPriorityFeePerGas > FLOOR_PRIORITY_FEE
        ? gasPrices.maxPriorityFeePerGas
        : FLOOR_PRIORITY_FEE; // still bump a bit if too low
    }

    console.log("Final Gas Settings:", {
      baseFeeGwei: baseFeeGwei.toFixed(4),
      maxFeePerGas: ethers.formatUnits(finalMaxFeePerGas, 'gwei') + ' Gwei',
      maxPriorityFeePerGas: ethers.formatUnits(finalMaxPriorityFeePerGas, 'gwei') + ' Gwei',
      lowBaseFeeMode: baseFeeGwei < MIN_BASE_FEE_THRESHOLD
    });


    // Prepare path array as 2D array [ [router, tokenIn, tokenOut, dexType, fee, minAmountOut], ... ]
    const formattedPath = payload.execution_payload.path.map(step => [
      step.router,           // address
      step.tokenIn,          // address
      step.tokenOut,         // address
      step.dexType || 0,     // uint8
      step.fee || 0,         // uint24
      step.minAmountOut      // uint256 (already formatted as BigInt-compatible string)
    ]);

    logger.info('Formatted path for execution', {
      path: JSON.stringify(formattedPath, null, 2),
      service: 'executionLayer'
    });

    // Extract scalar values
    const amountIn = payload.execution_payload.amountIn;  // uint256 (BigInt-compatible string)
    const minProfit = payload.execution_payload.minProfit; // uint256 (BigInt-compatible string)
    const deadline = payload.execution_payload.deadline;  // uint256

    // Validate inputs
    // if (!Array.isArray(formattedPath) || formattedPath.length === 0) {
    //     throw new Error("Invalid or empty path array");
    // }
    // if (!ethers.BigNumber.from(amountIn).gt(0)) {
    //     throw new Error("amountIn must be positive");
    // }
    // if (deadline < Math.floor(Date.now() / 1000)) {
    //     throw new Error("Deadline has expired");
    // }

    console.log("Executing with params:", {
      formattedPath,
      amountIn,
      minProfit,
      deadline
    });

    // Estimate gas
    logger.info('Estimating gas...', { service: 'executionLayerV3' });
    let gasEstimate;

    // console.log("maxPriorityFeePerGas", gasPrices, ethers.formatUnits(gasPrices.maxPriorityFeePerGas, 'gwei'))
    try {
      gasEstimate = await contract.executeArbitrage.estimateGas(
        formattedPath,
        amountIn,
        minProfit,
        deadline,
      );
    } catch (gasError) {
      if (gasError.message.includes('overflow') || gasError.message.includes('Panic')) {
        logger.error('Likely underflow (finalAmount < amountIn) during gas estimation');
      }
      // logger.error('Gas estimation failed', {
      //   error: gasError.message,
      //   service: 'executionLayer'
      // });
      throw gasError;
    }

    const gasToUse = (gasEstimate * BigInt(130)) / BigInt(100); // 30% buffer for safety
    logger.info(`Gas to use (with 30% buffer): ${gasToUse.toString()}, { service: 'executionLayer' }`);

    // Prepare transaction options with EIP-1559 parameters
    const txOptions = {
      gasLimit: gasToUse,
      maxFeePerGas: finalMaxFeePerGas,
      maxPriorityFeePerGas: finalMaxPriorityFeePerGas,
      type: 2
    };

    // Log transaction details
    // logger.info('Sending transaction with priority fee', {
    //   gasLimit: gasToUse.toString(),
    //   maxFeePerGas: ethers.formatUnits(gasPrices.maxFeePerGas, 'gwei') + ' Gwei',
    //   maxPriorityFeePerGas: ethers.formatUnits(gasPrices.maxPriorityFeePerGas, 'gwei') + ' Gwei',
    //   estimatedCost: ethers.formatEther(gasToUse * gasPrices.maxFeePerGas) + ' ETH',
    //   service: 'executionLayer'
    // });

    // Send transaction with priority fee
    const tx = await contract.executeArbitrage(
      formattedPath,
      amountIn,
      minProfit,
      deadline,
      {
        gasLimit: gasToUse, // Use dynamic gas
        maxFeePerGas: finalMaxFeePerGas,
        maxPriorityFeePerGas: finalMaxPriorityFeePerGas,
        type: 2
      }
      // {
      //    maxPriorityFeePerGas: ethers.parseUnits('1.43', 'gwei')
      // }
      // txOptions
    );

    console.log(`✅ Transaction sent: ${tx.hash}, ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`⏳ Waiting for confirmation...`);
    console.log(`💰 Priority Fee: ${ethers.formatUnits(finalMaxPriorityFeePerGas, 'gwei')} Gwei`);
    console.log(`💰 Max Fee: ${ethers.formatUnits(finalMaxFeePerGas, 'gwei')} Gwei`);

    const receipt = await tx.wait();

    const actualGasPrice = receipt.effectiveGasPrice;
    const gasCost = receipt.gasUsed * actualGasPrice;
    const gasCostEth = ethers.formatEther(gasCost);

    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`💵 Effective Gas Price: ${ethers.formatUnits(actualGasPrice, 'gwei')} Gwei`);
    console.log(`💸 Total Gas Cost: ${gasCostEth} ETH`);

    logger.info('Transaction confirmed', {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: ethers.formatUnits(actualGasPrice, 'gwei') + ' Gwei',
      gasCost: gasCostEth + ' ETH',
      status: receipt.status === 1 ? 'Success' : 'Failed',
      lowBaseFeeMode: baseFeeGwei < MIN_BASE_FEE_THRESHOLD,
      service: 'executionLayer'
    });

    return {
      success: receipt.status === 1,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: ethers.formatUnits(actualGasPrice, 'gwei'),
      gasCost: gasCostEth,
      priorityFeeUsed: ethers.formatUnits(finalMaxPriorityFeePerGas, 'gwei'),
      maxFeeUsed: ethers.formatUnits(finalMaxFeePerGas, 'gwei'),
      lowBaseFeeMode: baseFeeGwei < MIN_BASE_FEE_THRESHOLD
    };
  } catch (error) {
    console.error(`❌ Transaction failed: ${error.message}`);
    logger.error(`Transaction execution failed: ${error.message}, {
      error: error.stack,
      service: 'executionLayer'
    }`);

    return {
      success: false,
      error: error.message,
    };
  }
}


export async function executeFlashLoanTransaction(payload, provider, opp = null) {
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.ARBITRAGE_CONTRACT_ADDRESS;

  if (!privateKey || !contractAddress) {
    return {
      success: false,
      error: 'Missing PRIVATE_KEY or ARBITRAGE_CONTRACT_ADDRESS in environment'
    };
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  try {
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ABI, wallet);

    // Prepare path array as 2D array [ [router, tokenIn, tokenOut, dexType, fee, minAmountOut], ... ]
    const formattedPath = payload.execution_payload.path.map(step => [
      step.router,           // address
      step.tokenIn,          // address
      step.tokenOut,         // address
      step.dexType || 0,     // uint8
      step.fee || 0,         // uint24
      step.minAmountOut      // uint256 (already formatted as BigInt-compatible string)
    ]);

    logger.info('Formatted path for flash loan execution', {
      path: JSON.stringify(formattedPath, null, 2),
      service: 'flashLoanExecutionLayer'
    });

    // Extract scalar values
    const loanToken = payload.execution_payload.loanToken; // address
    const loanAmount = payload.execution_payload.loanAmount; // uint256 (BigInt-compatible string)
    const minProfit = payload.execution_payload.minProfit; // uint256 (BigInt-compatible string)
    const deadline = payload.execution_payload.deadline; // uint256

    // Validate inputs
    if (!ethers.isAddress(loanToken)) {
      throw new Error("Invalid loanToken address");
    }

    // ✅ VALIDATION: Check minimum loan amount
    const tokenSymbol = getTokenSymbol(loanToken);
    if (tokenSymbol && !validateLoanAmount(loanAmount, tokenSymbol)) {
      return {
        success: false,
        error: `Loan amount below minimum profitable threshold for ${tokenSymbol}`
      };
    }
    if (BigInt(loanAmount) <= 0n) {
      throw new Error("loanAmount must be positive");
    }
    const currentTime = Math.floor(Date.now() / 1000);
    if (parseInt(deadline) < currentTime) {
      logger.warn('Deadline has expired', {
        deadline: deadline,
        currentTime: currentTime,
        service: 'flashLoanExecutionLayer'
      });
      return {
        success: false,
        error: 'Deadline has expired'
      };
    }

    // ✅ Validate execution profitability BEFORE gas estimation
    const validation = await validateExecutionProfitability(payload, provider);

    if (!validation.success) {
      console.log(`❌ Flash loan validation failed: ${validation.error}`);
      return {
        success: false,
        error: validation.error,
        validationDetails: validation
      };
    }

    console.log(`✅ Flash loan validation passed - proceeding with transaction`);

    console.log("Executing flash loan with params:", {
      formattedPath,
      loanToken,
      loanAmount,
      minProfit,
      deadline
    });

    // ✅ Check profitability after gas costs (flash loans typically use ~400k gas)
    const isProfitable = await isProfitableAfterGas(payload, provider, 400000n);
    if (!isProfitable) {
      return {
        success: false,
        error: 'Flash loan not profitable after gas costs'
      };
    }

    // Estimate gas
    logger.info('Estimating gas for flash loan...', { service: 'flashLoanExecutionLayer' });
    let gasEstimate;
    try {
      gasEstimate = await contract.flashArbitrage.estimateGas(
        formattedPath,
        loanToken,
        loanAmount,
        minProfit,
        deadline,
      );
      logger.info(`Gas estimate: ${gasEstimate.toString()}, { service: 'flashLoanExecutionLayer' }`);
    } catch (gasError) {
      logger.error('Gas estimation failed', {
        error: gasError.message,
        service: 'flashLoanExecutionLayer'
      });
      return {
        success: false,
        error: `Gas estimation failed: ${gasError.message}`
      };
    }

    // Gas prices will be calculated below
    logger.info('Proceeding with flash loan execution', {
      loanAmount: ethers.formatEther(loanAmount),
      minProfit: ethers.formatEther(minProfit),
      service: 'flashLoanExecutionLayer'
    });

    const gasToUse = (gasEstimate * BigInt(130)) / BigInt(100); // 30% buffer for safety
    logger.info(`Gas to use (with 30% buffer): ${gasToUse.toString()}, { service: 'flashLoanExecutionLayer' }`);

    // Calculate optimal gas prices with priority fee (with profit-based priority)
    const gasPrices = await calculateGasPrices(provider, payload.estimated_profit || 0);

    // === LOW BASE FEE PROTECTION (< 0.5 Gwei) ===
    const baseFeeGwei = Number(ethers.formatUnits(gasPrices.baseFee, 'gwei'));
    const MIN_BASE_FEE_THRESHOLD = 0.5; // Gwei
    const FLOOR_PRIORITY_FEE = ethers.parseUnits('2', 'gwei'); // 2 Gwei tip
    const FLOOR_MAX_FEE = ethers.parseUnits('2.1', 'gwei'); // 2.1 Gwei cap

    let finalMaxFeePerGas;
    let finalMaxPriorityFeePerGas = gasPrices.maxPriorityFeePerGas;

    if (baseFeeGwei < MIN_BASE_FEE_THRESHOLD) {
      console.log(`⚡ Base fee too low (${baseFeeGwei.toFixed(4)} Gwei < 0.5 Gwei). Applying floor fees for fast inclusion.`);

      // Force minimum priority fee
      finalMaxPriorityFeePerGas = FLOOR_PRIORITY_FEE;

      // maxFeePerGas = baseFee * 2 + priority (EIP-1559 rule), but enforce floor
      const suggestedMaxFee = gasPrices.baseFee * 2n + FLOOR_PRIORITY_FEE;
      finalMaxFeePerGas = suggestedMaxFee > FLOOR_MAX_FEE ? suggestedMaxFee : FLOOR_MAX_FEE;
    } else {
      // Normal case: use network suggestions
      finalMaxFeePerGas = gasPrices.maxFeePerGas;
      finalMaxPriorityFeePerGas = gasPrices.maxPriorityFeePerGas > FLOOR_PRIORITY_FEE
        ? gasPrices.maxPriorityFeePerGas
        : FLOOR_PRIORITY_FEE; // still bump a bit if too low
    }

    console.log("Final Gas Settings:", {
      baseFeeGwei: baseFeeGwei.toFixed(4),
      maxFeePerGas: ethers.formatUnits(finalMaxFeePerGas, 'gwei') + ' Gwei',
      maxPriorityFeePerGas: ethers.formatUnits(finalMaxPriorityFeePerGas, 'gwei') + ' Gwei',
      lowBaseFeeMode: baseFeeGwei < MIN_BASE_FEE_THRESHOLD
    });

    // Send flash loan transaction
    const tx = await contract.flashArbitrage(
      formattedPath,
      loanToken,
      loanAmount,
      minProfit,
      deadline,
      {
        gasLimit: gasToUse, // Use dynamic gas
        maxFeePerGas: finalMaxFeePerGas,
        maxPriorityFeePerGas: finalMaxPriorityFeePerGas,
        type: 2
      }
    );

    console.log(`Flash loan transaction sent: ${tx.hash}, ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`Waiting for confirmation...`);

    // Wait for transaction to be mined with timeout
    let receipt;
    try {
      receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), EXECUTION_TIMEOUT)
        )
      ]);
      const data = JSON.stringify(receipt);
      console.log(`Flash loan transaction confirmed: ${data}, ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
    } catch (timeoutError) {
      if (timeoutError.message === 'Transaction confirmation timeout') {
        logger.warn('Transaction confirmation timed out', {
          txHash: tx.hash,
          timeout: EXECUTION_TIMEOUT,
          service: 'flashLoanExecutionLayer'
        });
        return {
          success: false,
          error: `Transaction confirmation timeout after ${EXECUTION_TIMEOUT / 1000}s`,
          txHash: tx.hash
        };
      }
      throw timeoutError; // Re-throw if it's a different error
    }

    // Save to database if successful and opp is provided
    // TODO: Implement saveTradeToDatabase function or import it
    // if (opp && receipt) {
    //   await saveTradeToDatabase(payload, receipt, opp, 'flashArbitrage');
    // }

    return {
      success: true,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
      receipt: receipt
    };
  } catch (error) {
    console.error(`Flash loan transaction failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
