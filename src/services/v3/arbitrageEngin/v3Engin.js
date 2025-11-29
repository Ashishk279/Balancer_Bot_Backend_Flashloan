
import { ethers, Interface } from 'ethers';
import PriceFetcher from '../../priceFetcher.js';
import { DEXPriceFetcherV3 } from '../../v3/priceFetcherV3.js';
import logger from '../../../utils/logger.js';
// import { storeOpportunity } from '../../opportunity.js';
import { Decimal } from 'decimal.js';
import db from '../../../db.js';

import { MULTICALL3_ABI, MULTICALL3_ADDRESS } from '../../../constants/v3/multiCall.js';
import { transformOpportunityForDB } from './transform.js';
import { calculateGasCost, calculatePriceImpact, deriveTokenPriceInUSD, gasWeiToTokenHuman, getMinSpreadForPair, normalizeDecimals, toTokenUnits } from '../../../utils/v3Utilites.js';
import { detectAndStoreOpportunity } from '../../../layers/detectionLayer.js';
import { initializePriceFeed, getPriceFeed } from '../../priceFeed.js';

import { calculateMaxTradeSize, calculateV2Liquidity, calculateV3Liquidity } from './liquidityCalulations.js';
import validator from './arbitrageValidator.js';
import { validateTriangularPath, isValidOutputAmount } from '../../../utils/decimalFix.js';
import { MIN_TRADE_AMOUNTS } from '../../../config/index.js';
import { calculateAdaptiveInputAmount, calculateSafeTradeAmount } from '../../../utils/dynamicAmount.js';

// ==================== PARALLEL PROCESSING IMPORTS ====================
import parallelQuoteFetcher from '../../../utils/parallelQuoteFetcher.js';
import quoteCache from '../../../utils/quoteCache.js';
import performanceMonitor from '../../../utils/performanceMonitor.js';
import { QUOTE_CONFIG, ANALYSIS_CONFIG } from '../../../config/parallelConfig.js';

// ==================== PROVIDER SETUP (SmartRPCRouter) ====================
// Provider will be set via initializeProvider() function
let wsProvider = null;
let priceFetcherV3 = null;
let priceFetcher = null;
let priceFeed = null;

// ═══════════════════════════════════════════════════════════════════════
// ✅ REMOVED: Single quoter address - now using DEX-specific quoters below
// ═══════════════════════════════════════════════════════════════════════
const dexName = 'UniswapV3';

/**
 * Initialize provider and all dependent services
 * This should be called with the SmartRPCRouter provider
 */
function initializeProvider(provider) {
  if (!provider) {
    throw new Error('Provider is required for v3Engin initialization');
  }

  wsProvider = provider;

  // ✅ Use Uniswap V3 quoter for the main price fetcher
  // Note: DEXPriceFetcherV3 is only used for initial price fetching (Uniswap V3)
  // Individual quotes use DEX-specific quoters via getQuote()
  const uniswapV3Quoter = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
  priceFetcherV3 = new DEXPriceFetcherV3(uniswapV3Quoter, dexName, wsProvider);
  priceFetcher = new PriceFetcher(wsProvider);
  priceFeed = initializePriceFeed(wsProvider);

  logger.info('✅ v3Engin initialized with SmartRPCRouter provider');
}

// Optimized configuration
const BATCH_SIZE = 10; // Increased for better parallelization
const INPUT_AMOUNT = new Decimal('5');
const MIN_LIQUIDITY = new Decimal('50000');
const MIN_LIQUIDITY_USD = ethers.parseUnits('10000', 6); // $10K minimum liquidity in USDC
const MAX_DEPTH = 3;
const MAX_BRANCHING = 8; // Increased for better coverage
const TOP_TOKENS_LIMIT = 20; // Increased

const INPUT_AMOUNT_USD = "1000"

// Minimum trade amounts for profitability



// Performance optimization constants
const MAX_DIRECT_PAIRS = 100; // Limit for direct arbitrage
const MAX_TRIANGULAR_COMBINATIONS = 50; // Limit triangular combinations
const PARALLEL_BATCH_SIZE = 5; // For parallel processing
const MAX_FLASH_LOAN_FEE = new Decimal('0.0009');
const PRIORITY_FEE = new Decimal('0.001'); // 0.1%
const MIN_TRADE_SIZE = new Decimal('0.0001');

// PROFIT THRESHOLDS (after gas costs, using Balancer free flash loans!)
// Minimum net profit must exceed gas costs (0.001 ETH) to be worthwhile
const MIN_PROFIT_THRESHOLD = new Decimal('0.0001'); // 0.0001 ETH minimum net profit (~$0.30) after gas
const MIN_PROFIT_PERCENTAGE = new Decimal('0.003'); // 0.3% return minimum after gas costs
const MAX_SLIPPAGE = new Decimal('0.03'); // 3% max slippage
const MAX_GAS_PRICE_GWEI = 100; // 100 Gwei max gas price


// Token' decimals mapping
const tokenDecimals = {
  'USDC': 6, 'DAI': 18, 'LINK': 18, 'WBTC': 8, 'UNI': 18, 'WETH': 18, 'SHIB': 18, 'USDT': 6, 'AAVE': 18, 'MATIC': 18, 'SUSHI': 18, 'CRV': 18, '1INCH': 18, 'YFI': 18, 'COMP': 18, 'MKR': 18, 'SNX': 18,

};

let isProcessing = false;
let allPrices = [];



// ═══════════════════════════════════════════════════════════════════════
// ✅ DEX ADDRESSES - CRITICAL: Each V3 DEX has its OWN quoter!
// ═══════════════════════════════════════════════════════════════════════
const DEX_ADDRESSES = {
  // Uniswap V3 (all fee tiers use same factory and quoter)
  UniswapV3: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    quoter_address: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",  // QuoterV2
    quoter_v1_address: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6" // QuoterV1 (fallback)
  },
  UniswapV3_500: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    quoter_address: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
  },
  UniswapV3_3000: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    quoter_address: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
  },
  UniswapV3_10000: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    quoter_address: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"
  },

  // Sushiswap V3 - DIFFERENT quoter than Uniswap!
  SushiswapV3: {
    factory_address: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
    quoter_address: "0x64e8802FE490fa7cc61d3463958199161Bb608A7"
  },
  SushiswapV3_500: {
    factory_address: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
    quoter_address: "0x64e8802FE490fa7cc61d3463958199161Bb608A7"
  },
  SushiswapV3_3000: {
    factory_address: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
    quoter_address: "0x64e8802FE490fa7cc61d3463958199161Bb608A7"
  },
  SushiswapV3_10000: {
    factory_address: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
    quoter_address: "0x64e8802FE490fa7cc61d3463958199161Bb608A7"
  },

  // PancakeSwap V3 - DIFFERENT quoter than Uniswap!
  PancakeswapV3: {
    factory_address: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    quoter_address: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"
  },
  PancakeswapV3_500: {
    factory_address: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    quoter_address: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"
  },
  PancakeswapV3_2500: {
    factory_address: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    quoter_address: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"
  },

  // V2 DEXes
  UniswapV2: {
    router_address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    factory_address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  },
  SushiswapV2: {
    router_address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    factory_address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
  },
  PancakeSwap: {
    router_address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory_address: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  },
};

// Enhanced logging with performance metrics
function logToMain(message, level = 'info') {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] ${message}`);
  try {
    if (typeof logger[level] === 'function') {
      logger[level](message, { service: 'arbitrageEngine' });
    }
  } catch (error) {
    console.warn(`Logger error: ${error.message}`);
  }
}

/*
   Create execution payload for direct arbitrage
 */


/**
 * Create execution payload for cross arbitrage
 */
function createCrossExecutionPayload(opportunity) {
  const [tokenA, tokenB] = opportunity.poolName.split('/');
  const tokenADecimals = getTokenDecimals(tokenA);
  const tokenBDecimals = getTokenDecimals(tokenB);

  // Handle undefined values properly
  const profit = opportunity.profit ?
    new Decimal(opportunity.profit) :
    new Decimal('0');

  return {
    path: [
      {
        router: getRouterAddress(opportunity.buyDex),
        dexType: getDexType(opportunity.buyDex),
        tokenIn: getTokenAddress(tokenB),
        tokenOut: getTokenAddress(tokenA)
      },
      {
        router: getRouterAddress(opportunity.sellDex),
        dexType: getDexType(opportunity.sellDex),
        tokenIn: getTokenAddress(tokenA),
        tokenOut: getTokenAddress(tokenB)
      }
    ],
    loanToken: getTokenAddress(tokenB),
    minProfit: profit.mul(new Decimal(10).pow(tokenBDecimals)).floor().toString(),
    loanAmount: INPUT_AMOUNT.mul(new Decimal(10).pow(tokenBDecimals)).floor().toString()
  };
}

/**
 * Create execution payload for triangular arbitrage
 */
function createTriangularExecutionPayload(opportunity) {
  const path = [];
  const startToken = opportunity.path[0];
  const startDecimals = getTokenDecimals(startToken);

  for (let i = 0; i < opportunity.path.length - 1; i++) {
    path.push({
      router: getRouterAddress(opportunity.dexes[i]),
      dexType: getDexType(opportunity.dexes[i]),
      tokenIn: getTokenAddress(opportunity.path[i]),
      tokenOut: getTokenAddress(opportunity.path[i + 1])
    });
  }

  // Handle undefined values properly
  const profit = opportunity.profit ?
    new Decimal(opportunity.profit) :
    new Decimal('0');

  return {
    path,
    loanToken: getTokenAddress(startToken),
    minProfit: profit.mul(new Decimal(10).pow(startDecimals)).floor().toString(),
    loanAmount: opportunity.amounts[0].mul(new Decimal(10).pow(startDecimals)).floor().toString()
  };
}

/**
 * Get router address for DEX
 */
function getRouterAddress(dex) {
  const routers = {
    'uniswapV2': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    'sushiswapv2': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    'pancakeswapv2': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    'UniswapV3_3000': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    'UniswapV3_500': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    'UniswapV3_10000': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
  };

  return routers[dex] || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Default to Uniswap V2
}

/**
 * Get DEX type (0 = V2, 1 = V3)
 */
function getDexType(dex) {
  return dex.includes('V3') ? 1 : 0;
}

/**
 * Get token address by symbol
 */
function getTokenAddress(symbol) {
  const addresses = {
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'SHIB': '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    'LINK': '0x514910771AF9CA656af840dff83E8264EcF986CA',
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WBTC': '0x2260FAC5E5542a773Aa44fBcfeD66C55FA2Fd333',
    'UNI': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'
  };

  return addresses[symbol] || '0x0000000000000000000000000000000000000000';
}

/**
 * Get token decimals by symbol
 */
function getTokenDecimals(symbol) {
  return tokenDecimals[symbol] || 18;
}

/**
 * Store opportunity in database
 */
async function storeOpportunityInDB(opportunity) {


  try {
    const dbData = transformOpportunityForDB(opportunity);
    const result = await db.insertV3Scan(dbData);

    if (!result || !result.rows || !Array.isArray(result.rows) || result.rows.length === 0) {
      throw new Error(`Invalid database response: ${JSON.stringify(result)}`);
    }

    const dbId = result.rows[0].id;
    console.log(`✅ Stored ${opportunity.type} opportunity in database with ID: ${dbId}`);
    return dbId;
  } catch (error) {
    console.error(`❌ Error storing ${opportunity.type} opportunity in database: ${error.message}`);
    console.error(`Attempted to store: ${JSON.stringify(opportunity, null, 2)}`);
    return null;
  }
}

// ==================== COMPREHENSIVE LOGGING FUNCTIONS ====================

/**
 * Log Direct Arbitrage Opportunity with detailed breakdown
 */
function logDirectArbitrageOpportunity(opportunity) {
  const { poolName, buyDex, sellDex, buyPrice, sellPrice, optimalInput, amountA, output, gasEstimation, profit, grossProfit, formatted } = opportunity;
  const [tokenA, tokenB] = poolName.split('/');

  console.log('\n🚨🚨🚨 DIRECT ARBITRAGE OPPORTUNITY 🚨🚨🚨');
  console.log('═'.repeat(60));
  console.log(`📊 ARBITRAGE TYPE: Direct`);
  console.log(`💱 TRADING PAIR: ${poolName}`);
  console.log(`🔄 ARBITRAGE PATH:`);
  console.log(`   📈 BUY:  ${tokenA} on ${buyDex} at ${buyPrice} ${tokenB}`);
  console.log(`   📉 SELL: ${tokenA} on ${sellDex} at ${sellPrice} ${tokenB}`);
  console.log(`💰 FINANCIAL BREAKDOWN:`);
  console.log(`   💵 INPUT AMOUNT:  ${formatted.input} ${tokenB} (${optimalInput} wei)`);
  console.log(`   💸 INTERMEDIATE:  ${formatted.amountA} ${tokenA}`);
  console.log(`   💸 OUTPUT AMOUNT: ${formatted.output} ${tokenB}`);
  console.log(`   📊 GROSS PROFIT:  ${formatted.grossProfit} ${tokenB}`);
  console.log(`   ⛽ GAS ESTIMATION: ${formatted.gasCost} ${tokenB}`);
  console.log(`   💎 NET PROFIT:    ${formatted.netProfit} ${tokenB}`);
  console.log(`✅ PROFITABILITY: ${profit.gt(0) ? '✅ PROFITABLE' : '❌ UNPROFITABLE'}`);
  console.log(`📈 SPREAD: ${sellPrice.minus(buyPrice).div(buyPrice).mul(100)}%`);
  console.log('═'.repeat(60));
}

function logCrossArbitrageOpportunity(opportunity) {
  const { poolName, buyDex, sellDex, buyPrice, sellPrice, optimalInput, amountA, output, gasEstimation, profit, grossProfit, formatted } = opportunity;
  const [tokenA, tokenB] = poolName.split('/');

  console.log('\n🚨🚨🚨 CROSS ARBITRAGE OPPORTUNITY 🚨🚨🚨');
  console.log('═'.repeat(60));
  console.log(`📊 ARBITRAGE TYPE: Cross-Protocol (V2 vs V3)`);
  console.log(`💱 TRADING PAIR: ${poolName}`);
  console.log(`🔄 ARBITRAGE PATH:`);
  console.log(`   📈 BUY:  ${tokenA} on ${buyDex} at ${buyPrice} ${tokenB}`);
  console.log(`   📉 SELL: ${tokenA} on ${sellDex} at ${sellPrice} ${tokenB}`);
  console.log(`💰 FINANCIAL BREAKDOWN:`);
  console.log(`   💵 INPUT AMOUNT:  ${formatted.input} ${tokenB} (${optimalInput} wei)`);
  console.log(`   💸 INTERMEDIATE:  ${formatted.amountA} ${tokenA}`);
  console.log(`   💸 OUTPUT AMOUNT: ${formatted.output} ${tokenB}`);
  console.log(`   📊 GROSS PROFIT:  ${formatted.grossProfit} ${tokenB}`);
  console.log(`   ⛽ GAS ESTIMATION: ${formatted.gasCost} ${tokenB}`);
  console.log(`   💎 NET PROFIT:    ${formatted.netProfit} ${tokenB}`);
  console.log(`✅ PROFITABILITY: ${profit.gt(0) ? '✅ PROFITABLE' : '❌ UNPROFITABLE'}`);
  console.log(`📈 SPREAD: ${sellPrice.minus(buyPrice).div(buyPrice).mul(100)}%`);
  console.log('═'.repeat(60));
}


function logTriangularArbitrageOpportunity(opportunity) {
  const { cycle, path, amountsFormatted, dexes, feesFormatted, gasEstimationFormatted, profit, grossProfitFormatted, totalFeesFormatted, netProfitFormatted } = opportunity;

  console.log('\n🚨🚨🚨 TRIANGULAR ARBITRAGE OPPORTUNITY 🚨🚨🚨');
  console.log('═'.repeat(70));
  console.log(`📊 ARBITRAGE TYPE: Triangular`);
  console.log(`🔄 CYCLE: ${cycle}`);
  console.log(`🛤️ ARBITRAGE PATH:`);

  for (let i = 0; i < path.length - 1; i++) {
    console.log(`   Step ${i + 1}: ${path[i]} → ${path[i + 1]} on ${dexes[i]}`);
    console.log(`      💰 Input:  ${amountsFormatted[i]} ${path[i]}`);
    console.log(`      🏦 Fees:   ${feesFormatted[i]} ${path[i + 1]} (Platform: ${new Decimal(dexes[i].includes('V3') ? opportunity.fees[i].div(opportunity.amounts[i + 1]).mul(100) : 0.3)}%, Priority: ${PRIORITY_FEE.mul(100)}%)`);
    console.log(`      💸 Output: ${amountsFormatted[i + 1]} ${path[i + 1]}`);
    console.log('');
  }

  console.log(`💰 FINANCIAL BREAKDOWN:`);
  console.log(`   💵 START AMOUNT:  ${amountsFormatted[0]} ${path[0]} (${opportunity.amounts[0]} wei)`);
  console.log(`   💸 FINAL AMOUNT:  ${amountsFormatted[amounts.length - 1]} ${path[0]}`);
  console.log(`   📊 GROSS PROFIT:  ${grossProfitFormatted} ${path[0]}`);
  console.log(`   🏦 TOTAL FEES:    ${totalFeesFormatted} ${path[0]}`);
  console.log(`   ⛽ GAS ESTIMATION: ${gasEstimationFormatted} ${path[0]}`);
  console.log(`   💎 NET PROFIT:    ${netProfitFormatted} ${path[0]}`);
  console.log(`✅ PROFITABILITY: ${profit.gt(0) ? '✅ PROFITABLE' : '❌ UNPROFITABLE'}`);
  console.log(`📈 TOTAL RETURN: ${opportunity.amounts[opportunity.amounts.length - 1].div(opportunity.amounts[0]).minus(1).mul(100)}%`);
  console.log('═'.repeat(70));
}

/**
 * Log opportunity summary for quick overview
 */
function logOpportunitySummary(opportunities) {
  const direct = opportunities.filter(o => o.type === 'v3_direct');
  const cross = opportunities.filter(o => o.type === 'v3_cross');
  const triangular = opportunities.filter(o => o.type === 'v3_triangular');

  console.log('\n📊 ARBITRAGE OPPORTUNITIES SUMMARY');
  console.log('═'.repeat(50));
  console.log(`🎯 Total Opportunities Found: ${opportunities.length}`);
  console.log(`   📈 Direct: ${direct.length}`);
  console.log(`   🔄 Cross: ${cross.length}`);
  console.log(`   🔺 Triangular: ${triangular.length}`);

  if (opportunities.length > 0) {
    const totalProfit = opportunities.reduce((sum, o) => sum.add(o.profit), new Decimal(0));
    const avgProfit = opportunities.length > 0 ? totalProfit.div(opportunities.length) : new Decimal(0);
    const profitable = opportunities.filter(o => o.isProfitable).length;
    const unprofitable = opportunities.length - profitable;
    const bestOpportunity = opportunities.reduce((best, current) =>
      current.profit.gt(best.profit) ? current : best
    );

    console.log(`💰 FINANCIAL OVERVIEW:`);
    console.log(`   💎 Total Potential Profit: ${totalProfit}`);
    console.log(`   📊 Average Profit: ${avgProfit}`);
    console.log(`   ✅ Profitable Opportunities: ${profitable}`);
    console.log(`   ❌ Unprofitable Opportunities: ${unprofitable}`);
    console.log(`🏆 Best Opportunity: ${bestOpportunity.type} - ${bestOpportunity.profit} profit`);
  }
  console.log('═'.repeat(50));
}
// Performance timer utility
class PerformanceTimer {
  constructor() {
    this.startTime = Date.now();
    this.checkpoints = {};
  }

  checkpoint(name) {
    this.checkpoints[name] = Date.now() - this.startTime;
    logToMain(`⏱️  ${name}: ${this.checkpoints[name]}ms`);
  }

  getTotalTime() {
    return Date.now() - this.startTime;
  }
}

// Optimized price fetching with parallel processing
async function fetchAllPricesOptimized(pairs, batchSize = BATCH_SIZE) {
  const timer = new PerformanceTimer();
  logToMain(`🚀 Starting optimized price fetching for ${pairs.length} pairs`);

  allPrices = [];
  const pricePromises = [];

  // Create all price fetch promises upfront
  for (const pair of pairs) {
    const { name, token0, token1, pools } = pair;

    for (const [dexName, poolInfo] of Object.entries(pools)) {
      pricePromises.push(
        fetchSinglePrice(name, token0, token1, dexName, poolInfo)
      );
    }
  }

  timer.checkpoint('Price promises created');

  // Process in parallel batches
  const results = [];
  for (let i = 0; i < pricePromises.length; i += PARALLEL_BATCH_SIZE) {
    const batch = pricePromises.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch);

    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });

    // Small delay to prevent overwhelming the RPC
    if (i + PARALLEL_BATCH_SIZE < pricePromises.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  allPrices = results;

  // console.log("====All Prices", allPrices)
  timer.checkpoint('All prices fetched');

  logToMain(`✅ Fetched ${allPrices.length} valid prices in ${timer.getTotalTime()}ms`);
  return allPrices;
}

// Optimized single price fetch
async function fetchSinglePrice(name, token0, token1, dexName, poolInfo) {
  try {
    let priceData;

    if (dexName.includes('UniswapV3') || dexName.includes('UniswapV3_500') || dexName.includes('UniswapV3_3000') || dexName.includes('UniswapV3_10000')) {
      // const v3Fee = convertFeeForV3(poolInfo.fee);
      priceData = await priceFetcherV3.getPrice(token0, token1, poolInfo.fee, poolInfo.address);

      if (priceData) {
        // Add liquidity data for V3
        const liquidity = await getV3Liquidity(poolInfo.address, token0, token1);
        priceData.liquidity = liquidity;
        priceData.poolAddress = poolInfo.address;
        priceData.fee = new Decimal(poolInfo.fee).div(1e6);
      }
    } else {
      priceData = await priceFetcher.getPoolPrice(poolInfo.address, dexName, token0, token1);

      if (priceData) {
        // Calculate liquidity for V2
        const liquidity = calculateV2Liquidity(priceData, token0, token1);
        priceData.liquidity = liquidity;
        priceData.poolAddress = poolInfo.address;
        priceData.fee = new Decimal('0.003'); // Default V2 fee
      }
    }

    // console.log("===priceData", priceData)

    if (priceData && new Decimal(priceData.priceOfAinB).gt(0) && new Decimal(priceData.priceOfBinA).gt(0)) {
      priceData.dex = dexName;
      priceData.poolName = name;
      priceData.tokenA = { ...priceData.tokenA, decimals: priceData.tokenA.decimals || 18 };
      priceData.tokenB = { ...priceData.tokenB, decimals: priceData.tokenB.decimals || 18 };
      return priceData;
    }

    return null;
  } catch (error) {
    logToMain(`Error fetching price for ${name} on ${dexName}: ${error.message}`, 'warn');
    return null;
  }
}

// async function fetchAllPricesOptimized1(pairs, batchSize = 10) {
//   const timer = new PerformanceTimer();
//   logToMain(`🚀 Starting optimized price fetching for ${pairs.length} pairs`);

//   // Collect V3 and V2 queries with better validation
//   const v3Queries = [];
//   const v2Queries = [];

//   for (const pair of pairs) {
//     const { name, token0, token1, pools } = pair;

//     // Strict validation
//     if (!token0 || !token1 || !name || !pools) {
//       console.warn(`Skipping pair: ${name || 'unknown'} (missing core data)`);
//       continue;
//     }
//     if (!token0.address || !token1.address || !token0.decimals || !token1.decimals || !token0.symbol || !token1.symbol) {
//       console.warn(`Skipping pair: ${name} (invalid token data)`);
//       continue;
//     }

//     // Checksum addresses
//     let token0Address, token1Address;
//     try {
//       token0Address = ethers.getAddress(token0.address);
//       token1Address = ethers.getAddress(token1.address);
//     } catch (err) {
//       console.warn(`Skipping pair ${name}: Invalid token address - ${err.message}`);
//       continue;
//     }

//     for (const [dexName, poolInfo] of Object.entries(pools)) {
//       if (!poolInfo || !poolInfo.address) {
//         console.warn(`Skipping ${dexName} for ${name}: Missing pool info/address`);
//         continue;
//       }

//       let poolAddress;
//       try {
//         poolAddress = ethers.getAddress(poolInfo.address);
//       } catch (err) {
//         console.warn(`Skipping ${dexName} for ${name}: Invalid pool address ${poolInfo.address} - ${err.message}`);
//         continue;
//       }

//       if (dexName.includes('UniswapV3') || dexName.includes('UniswapV3_500') ||
//         dexName.includes('UniswapV3_3000') || dexName.includes('UniswapV3_10000')) {
//         if (!poolInfo.fee || !Number.isInteger(poolInfo.fee)) {
//           console.warn(`Skipping ${dexName} for ${name}: Invalid fee ${poolInfo.fee}`);
//           continue;
//         }
//         v3Queries.push({
//           tokenA: { ...token0, address: token0Address },
//           tokenB: { ...token1, address: token1Address },
//           fee: poolInfo.fee,
//           poolAddress,
//           poolName: name
//         });
//       } else {
//         v2Queries.push({
//           poolAddress,
//           dexName,
//           tokenA: { ...token0, address: token0Address },
//           tokenB: { ...token1, address: token1Address },
//           poolName: name
//         });
//       }
//     }
//   }

//   console.log(`Collected ${v3Queries.length} valid V3 queries and ${v2Queries.length} valid V2 queries`);

//   // Batch fetch prices with smaller chunk sizes to avoid issues
//   const v3Prices = await priceFetcherV3.getPricesBatchedV3(v3Queries, 60); // Reduced from 20
//   const v2Prices = await priceFetcher.getPoolPricesBatchedV2(v2Queries, 60);

//   // console.log("====v3Prices", v3Prices)

//   // Combine
//   let allPrices = [...v3Prices, ...v2Prices];
//   console.log(`Fetched ${allPrices.length} total prices (V3: ${v3Prices.length}, V2: ${v2Prices.length})`);
//   // Batch V3 liquidity with better error handling
//   const V3_POOL_ABI = ['function liquidity() external view returns (uint128)'];
//   const multicallIface = new Interface(MULTICALL3_ABI);
//   const poolIface = new Interface(V3_POOL_ABI);

//   const liquidityCalls = allPrices
//     .filter(price => price.poolAddress && price.dex.includes('UniswapV3') &&
//       price.priceOfAinB !== 0 && price.priceOfBinA !== 0)
//     .map(price => {
//       try {
//         const checksumAddress = ethers.getAddress(price.poolAddress);
//         return {
//           target: checksumAddress,
//           allowFailure: true,
//           callData: poolIface.encodeFunctionData('liquidity', [])
//         };
//       } catch (err) {
//         console.warn(`Skipping liquidity call for ${price.poolName} (${price.poolAddress}): ${err.message}`);
//         return null;
//       }
//     })
//     .filter(call => call !== null);

//   let liquidityMap = new Map();
//   if (liquidityCalls.length > 0) {
//     try {
//       const multicallData = multicallIface.encodeFunctionData('aggregate3', [liquidityCalls]);
//       let result;
//       for (let attempt = 1; attempt <= 3; attempt++) {
//         try {
//           result = await wsProvider.call({
//             to: MULTICALL3_ADDRESS,
//             data: multicallData
//           });
//           break;
//         } catch (error) {
//           console.warn(`V3 liquidity batch attempt ${attempt} failed: ${error.message}`);
//           if (attempt === 3) {
//             console.error(`V3 liquidity batch completely failed after 3 attempts`);
//             break;
//           }
//           await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
//         }
//       }

//       if (result) {
//         const decodedLiquidity = multicallIface.decodeFunctionResult('aggregate3', result)[0];
//         decodedLiquidity.forEach((res, i) => {
//           if (res.success && liquidityCalls[i]) {
//             try {
//               const liquidity = poolIface.decodeFunctionResult('liquidity', res.returnData)[0];
//               liquidityMap.set(liquidityCalls[i].target.toLowerCase(), liquidity.toString());
//             } catch (err) {
//               console.warn(`Failed to decode liquidity for call ${i}: ${err.message}`);
//             }
//           }
//         });
//       }
//     } catch (error) {
//       console.error(`V3 liquidity batch failed: ${error.message}`);
//     }
//   }

//   // Add liquidity and finalize
//   for (const priceData of allPrices) {
//     if (priceData.dex.includes('UniswapV3')) {
//       const poolKey = priceData.poolAddress?.toLowerCase();
//       priceData.liquidity = liquidityMap.get(poolKey) || '0';
//       priceData.fee = new Decimal(priceData.fee).div(1e6);
//     } else {
//       priceData.liquidity = calculateV2Liquidity(priceData, priceData.tokenA, priceData.tokenB);
//       priceData.fee = new Decimal('0.003');
//     }

//     // Ensure poolName is set
//     priceData.poolName = priceData.poolName ||
//       pairs.find(p =>
//         p.token0.address.toLowerCase() === priceData.tokenA.address.toLowerCase() &&
//         p.token1.address.toLowerCase() === priceData.tokenB.address.toLowerCase()
//       )?.name ||
//       `${priceData.tokenA.symbol}/${priceData.tokenB.symbol}`;

//     // Ensure decimals are set
//     priceData.tokenA.decimals = priceData.tokenA.decimals || 18;
//     priceData.tokenB.decimals = priceData.tokenB.decimals || 18;
//   }

//   // Filter valid prices
//   allPrices = allPrices.filter(priceData =>
//     priceData &&
//     priceData.priceOfAinB &&
//     priceData.priceOfBinA &&
//     new Decimal(priceData.priceOfAinB).gt(0) &&
//     new Decimal(priceData.priceOfBinA).gt(0)
//   );

//   timer.checkpoint('All prices fetched');
//   logToMain(`✅ Fetched ${allPrices.length} valid prices in ${timer.getTotalTime()}ms`);
//   return allPrices;
// }


// Get V3 liquidity efficiently

async function fetchTokenDecimalsOnChain(tokenAddress) {
  try {
    const erc20 = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], wsProvider);
    const d = await erc20.decimals();
    return Number(d);
  } catch (err) {
    return 18; // fallback
  }
}

// async function fetchAllPricesOptimized1(pairs, batchSize = 10) {
//   const timer = new PerformanceTimer();
//   logToMain(`🚀 Starting optimized price fetching for ${pairs.length} pairs`);

//   // Collect V3 and V2 queries with better validation
//   const v3Queries = [];
//   const v2Queries = [];

//   for (const pair of pairs) {
//     const { name, token0, token1, pools } = pair;

//     // Fetch decimals if missing
//     if (token0 && !token0.decimals) {
//       token0.decimals = await fetchTokenDecimalsOnChain(token0.address);
//     }
//     if (token1 && !token1.decimals) {
//       token1.decimals = await fetchTokenDecimalsOnChain(token1.address);
//     }

//     // Strict validation
//     if (!token0 || !token1 || !name || !pools) {
//       console.warn(`Skipping pair: ${name || 'unknown'} (missing core data)`);
//       continue;
//     }
//     if (!token0.address || !token1.address || !token0.decimals || !token1.decimals || !token0.symbol || !token1.symbol) {
//       console.warn(`Skipping pair: ${name} (invalid token data)`);
//       continue;
//     }

//     // Checksum addresses
//     let token0Address, token1Address;
//     try {
//       token0Address = ethers.getAddress(token0.address);
//       token1Address = ethers.getAddress(token1.address);
//     } catch (err) {
//       console.warn(`Skipping pair ${name}: Invalid token address - ${err.message}`);
//       continue;
//     }

//     for (const [dexName, poolInfo] of Object.entries(pools)) {
//       if (!poolInfo || !poolInfo.address) {
//         console.warn(`Skipping ${dexName} for ${name}: Missing pool info/address`);
//         continue;
//       }

//       let poolAddress;
//       try {
//         poolAddress = ethers.getAddress(poolInfo.address);
//       } catch (err) {
//         console.warn(`Skipping ${dexName} for ${name}: Invalid pool address ${poolInfo.address} - ${err.message}`);
//         continue;
//       }

//       if (dexName.includes('UniswapV3') || dexName.includes('UniswapV3_500') ||
//         dexName.includes('UniswapV3_3000') || dexName.includes('UniswapV3_10000')) {
//         if (!poolInfo.fee || !Number.isInteger(poolInfo.fee)) {
//           console.warn(`Skipping ${dexName} for ${name}: Invalid fee ${poolInfo.fee}`);
//           continue;
//         }
//         v3Queries.push({
//           tokenA: { ...token0, address: token0Address },
//           tokenB: { ...token1, address: token1Address },
//           fee: poolInfo.fee,
//           poolAddress,
//           poolName: name
//         });
//       } else {
//         v2Queries.push({
//           poolAddress,
//           dexName,
//           tokenA: { ...token0, address: token0Address },
//           tokenB: { ...token1, address: token1Address },
//           poolName: name
//         });
//       }
//     }
//   }

//   console.log(`Collected ${v3Queries.length} valid V3 queries and ${v2Queries.length} valid V2 queries`);

//   // Batch fetch prices with smaller chunk sizes to avoid issues
//   const v3Prices = await priceFetcherV3.getPricesBatchedV3(v3Queries, 20); // Reduced from 20
//   const v2Prices = await priceFetcher.getPoolPricesBatchedV2(v2Queries, 20);

//   // console.log("====v2Prices", v2Prices)

//   // Combine
//   let allPrices = [...v3Prices, ...v2Prices];
//   allPrices = allPrices.filter(p => new Decimal(p.priceOfAinB).gt(0) && new Decimal(p.priceOfBinA).gt(0));
//   console.log(`Fetched ${allPrices.length} total prices (V3: ${v3Prices.length}, V2: ${v2Prices.length})`);
//   // Batch V3 liquidity with better error handling
//   const V3_POOL_ABI = ['function liquidity() external view returns (uint128)'];
//   const multicallIface = new Interface(MULTICALL3_ABI);
//   const poolIface = new Interface(V3_POOL_ABI);

//   const liquidityCalls = allPrices
//     .filter(price => price.poolAddress && price.dex.includes('UniswapV3') &&
//       price.priceOfAinB !== 0 && price.priceOfBinA !== 0)
//     .map(price => {
//       try {
//         const checksumAddress = ethers.getAddress(price.poolAddress);
//         return {
//           target: checksumAddress,
//           allowFailure: true,
//           callData: poolIface.encodeFunctionData('liquidity', [])
//         };
//       } catch (err) {
//         console.warn(`Skipping liquidity call for ${price.poolName} (${price.poolAddress}): ${err.message}`);
//         return null;
//       }
//     })
//     .filter(call => call !== null);

//   let liquidityMap = new Map();
//   if (liquidityCalls.length > 0) {
//     try {
//       const multicallData = multicallIface.encodeFunctionData('aggregate3', [liquidityCalls]);
//       let result;
//       for (let attempt = 1; attempt <= 3; attempt++) {
//         try {
//           result = await wsProvider.call({
//             to: MULTICALL3_ADDRESS,
//             data: multicallData
//           });
//           break;
//         } catch (error) {
//           console.warn(`V3 liquidity batch attempt ${attempt} failed: ${error.message}`);
//           if (attempt === 3) {
//             console.error(`V3 liquidity batch completely failed after 3 attempts`);
//             break;
//           }
//           await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
//         }
//       }

//       if (result) {
//         const decodedLiquidity = multicallIface.decodeFunctionResult('aggregate3', result)[0];
//         decodedLiquidity.forEach((res, i) => {
//           if (res.success && liquidityCalls[i]) {
//             try {
//               const liquidity = poolIface.decodeFunctionResult('liquidity', res.returnData)[0];
//               liquidityMap.set(liquidityCalls[i].target.toLowerCase(), liquidity.toString());
//             } catch (err) {
//               console.warn(`Failed to decode liquidity for call ${i}: ${err.message}`);
//             }
//           }
//         });
//       }
//     } catch (error) {
//       console.error(`V3 liquidity batch failed: ${error.message}`);
//     }
//   }

//   // Add liquidity and finalize
//   for (const priceData of allPrices) {
//     if (priceData.dex.includes('UniswapV3')) {
//       const poolKey = priceData.poolAddress?.toLowerCase();
//       priceData.liquidity = liquidityMap.get(poolKey) || '0';
//       priceData.fee = new Decimal(priceData.fee).div(1e6);
//     } else {
//       priceData.liquidity = calculateV2Liquidity(priceData, priceData.tokenA, priceData.tokenB);
//       priceData.fee = new Decimal('0.003');
//     }

//     // Ensure poolName is set
//     priceData.poolName = priceData.poolName ||
//       pairs.find(p =>
//         p.token0.address.toLowerCase() === priceData.tokenA.address.toLowerCase() &&
//         p.token1.address.toLowerCase() === priceData.tokenB.address.toLowerCase()
//       )?.name ||
//       `${priceData.tokenA.symbol}/${priceData.tokenB.symbol}`;

//     // Normalize decimals
//     priceData.tokenA.decimals = normalizeDecimals(priceData.tokenA.decimals);
//     priceData.tokenB.decimals = normalizeDecimals(priceData.tokenB.decimals);
//   }

//   // Filter valid prices
//   allPrices = allPrices.filter(priceData =>
//     priceData &&
//     priceData.priceOfAinB &&
//     priceData.priceOfBinA &&
//     new Decimal(priceData.priceOfAinB).gt(0) &&
//     new Decimal(priceData.priceOfBinA).gt(0)
//   );

//   timer.checkpoint('All prices fetched');
//   logToMain(`✅ Fetched ${allPrices.length} valid prices in ${timer.getTotalTime()}ms`);
//   return allPrices;
// }


async function fetchAllPricesOptimized1(pairs, batchSize = 10) {
  const timer = new PerformanceTimer();
  logToMain(`🚀 Starting optimized price fetching for ${pairs.length} pairs`);

  // Collect V3 and V2 queries with better validation
  const v3Queries = [];
  const v2Queries = [];

  for (const pair of pairs) {
    const { name, token0, token1, pools } = pair;
    // console.log("===pair", pair)

    // Fetch decimals if missing
    if (token0 && !token0.decimals) {
      token0.decimals = await fetchTokenDecimalsOnChain(token0.address);
    }
    if (token1 && !token1.decimals) {
      token1.decimals = await fetchTokenDecimalsOnChain(token1.address);
    }

    // ✅ FIX: Validate decimals match expected values to prevent configuration errors
    const expectedDecimals = {
      'USDC': 6, 'USDT': 6,
      'WBTC': 8,
      'WETH': 18, 'DAI': 18, 'LINK': 18, 'UNI': 18, 'AAVE': 18,
      'COMP': 18, 'SNX': 18, 'CRV': 18, 'MKR': 18, 'YFI': 18,
      'MATIC': 18, 'SHIB': 18, 'DBAR': 18, 'ONI': 18, 'NXRA': 18,
      'PBAR': 18, 'crvUSD': 18, 'wDOGE': 18, 'BAR': 18, 'WAI': 18
    };

    if (token0.symbol && expectedDecimals[token0.symbol] && token0.decimals !== expectedDecimals[token0.symbol]) {
      console.warn(`⚠️ Decimal mismatch for ${token0.symbol}: has ${token0.decimals}, expected ${expectedDecimals[token0.symbol]}`);
    }
    if (token1.symbol && expectedDecimals[token1.symbol] && token1.decimals !== expectedDecimals[token1.symbol]) {
      console.warn(`⚠️ Decimal mismatch for ${token1.symbol}: has ${token1.decimals}, expected ${expectedDecimals[token1.symbol]}`);
    }

    // Strict validation
    if (!token0 || !token1 || !name || !pools) {
      console.warn(`Skipping pair: ${name || 'unknown'} (missing core data)`);
      continue;
    }
    if (!token0.address || !token1.address || !token0.decimals || !token1.decimals || !token0.symbol || !token1.symbol) {
      console.warn(`Skipping pair: ${name} (invalid token data)`);
      continue;
    }

    // Checksum addresses
    let token0Address, token1Address;
    try {
      token0Address = ethers.getAddress(token0.address);
      token1Address = ethers.getAddress(token1.address);
    } catch (err) {
      console.warn(`Skipping pair ${name}: Invalid token address - ${err.message}`);
      continue;
    }

    for (const [dexName, poolInfo] of Object.entries(pools)) {
      if (!poolInfo || !poolInfo.address) {
        console.warn(`Skipping ${dexName} for ${name}: Missing pool info/address`);
        continue;
      }

      let poolAddress;
      try {
        poolAddress = ethers.getAddress(poolInfo.address);
      } catch (err) {
        console.warn(`Skipping ${dexName} for ${name}: Invalid pool address ${poolInfo.address} - ${err.message}`);
        continue;
      }

      if (dexName.includes('UniswapV3') || dexName.includes('PancakeswapV3') || dexName.includes('SushiswapV3')) {
        if (!poolInfo.fee || !Number.isInteger(poolInfo.fee)) {
          console.warn(`Skipping ${dexName} for ${name}: Invalid fee ${poolInfo.fee}`);
          continue;
        }
        v3Queries.push({
          tokenA: { ...token0, address: token0Address },
          tokenB: { ...token1, address: token1Address },
          fee: poolInfo.fee,
          poolAddress,
          poolName: name,
          dexName: dexName
        });
      } else {
        v2Queries.push({
          poolAddress,
          dexName,
          tokenA: { ...token0, address: token0Address },
          tokenB: { ...token1, address: token1Address },
          poolName: name
        });
      }
    }
  }

  console.log(`Collected ${v3Queries.length} valid V3 queries and ${v2Queries.length} valid V2 queries`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 DEBUG: Show which queries were collected for specific pairs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n📊 QUERY COLLECTION DEBUG:`);
  const queryPairs = new Map();
  [...v3Queries, ...v2Queries].forEach(q => {
    const pairKey = q.poolName;
    if (!queryPairs.has(pairKey)) {
      queryPairs.set(pairKey, []);
    }
    queryPairs.get(pairKey).push(q.dexName);
  });

  console.log(`\n🎯 Queries collected for specific pairs:`);
  const checkPairs = ['DAI/WETH', 'WBTC/WETH', 'USDC/WETH', 'WETH/USDC'];
  for (const pairName of checkPairs) {
    const queries = queryPairs.get(pairName);
    if (queries) {
      console.log(`  ✅ ${pairName}: ${queries.length} queries (${queries.join(', ')})`);
    } else {
      console.log(`  ❌ ${pairName}: NO queries collected (pair might not exist in config or failed validation)`);
    }
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Batch fetch prices using slot0() multicall for V3
  const v3Prices = await priceFetcherV3.getPricesBatchedV3(v3Queries, 20);
  const v2Prices = await priceFetcher.getPoolPricesBatchedV2(v2Queries, 20);

  // console.log("====v3Prices", v3Prices)
  // Combine and filter
  let allPrices = [...v3Prices, ...v2Prices];
  allPrices = allPrices.filter(p =>
    new Decimal(p.priceOfAinB).gt(0) && new Decimal(p.priceOfBinA).gt(0)
  );

  console.log(`Fetched ${allPrices.length} total prices (V3: ${v3Prices.length}, V2: ${v2Prices.length})`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 DEBUG: Show which pairs were actually fetched
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n📊 FETCHED PRICES DEBUG:`);
  const fetchedPairs = new Map();
  allPrices.forEach(p => {
    const pairKey = p.poolName || `${p.tokenA?.symbol}/${p.tokenB?.symbol}`;
    if (!fetchedPairs.has(pairKey)) {
      fetchedPairs.set(pairKey, []);
    }
    fetchedPairs.get(pairKey).push({ dex: p.dex, price: p.priceOfAinB });
  });

  // Show specific pairs
  console.log(`\n🎯 Checking specific pairs in fetched prices:`);
  const checkPairsToInspect = ['DAI/WETH', 'WBTC/WETH', 'USDC/WETH', 'WETH/USDC'];
  for (const pairName of checkPairsToInspect) {
    const fetched = fetchedPairs.get(pairName);
    if (fetched) {
      console.log(`  ✅ ${pairName}: ${fetched.length} prices fetched`);
      fetched.forEach(({ dex, price }) => {
        console.log(`     - ${dex}: ${price}`);
      });
    } else {
      console.log(`  ❌ ${pairName}: NOT fetched (0 prices)`);
    }
  }

  console.log(`\nTotal unique pairs fetched: ${fetchedPairs.size}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // ==========================================
  // ENHANCED LIQUIDITY FETCHING
  // ==========================================

  // 1. Batch fetch V3 liquidity (the L value)
  const V3_POOL_ABI = ['function liquidity() external view returns (uint128)'];
  const multicallIface = new Interface(MULTICALL3_ABI);
  const poolIface = new Interface(V3_POOL_ABI);

  const v3LiquidityCalls = allPrices
    .filter(price => price.poolAddress && (price.dex.includes('UniswapV3') || price.dex.includes('PancakeswapV3') || price.dex.includes('SushiswapV3')))
    .map(price => {
      try {
        const checksumAddress = ethers.getAddress(price.poolAddress);
        return {
          target: checksumAddress,
          allowFailure: true,
          callData: poolIface.encodeFunctionData('liquidity', [])
        };
      } catch (err) {
        console.warn(`Skipping liquidity call for ${price.poolName}: ${err.message}`);
        return null;
      }
    })
    .filter(call => call !== null);

  let v3LiquidityMap = new Map();
  if (v3LiquidityCalls.length > 0) {
    try {
      const multicallData = multicallIface.encodeFunctionData('aggregate3', [v3LiquidityCalls]);
      const result = await wsProvider.call({
        to: MULTICALL3_ADDRESS,
        data: multicallData
      });

      const decodedLiquidity = multicallIface.decodeFunctionResult('aggregate3', result)[0];
      decodedLiquidity.forEach((res, i) => {
        if (res.success && v3LiquidityCalls[i]) {
          try {
            const liquidity = poolIface.decodeFunctionResult('liquidity', res.returnData)[0];
            v3LiquidityMap.set(v3LiquidityCalls[i].target.toLowerCase(), liquidity.toString());
          } catch (err) {
            console.warn(`Failed to decode liquidity for call ${i}: ${err.message}`);
          }
        }
      });
    } catch (error) {
      console.error(`V3 liquidity batch failed: ${error.message}`);
    }
  }

  // 2. Batch fetch V2 reserves (if not already present)
  const V2_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
  ];
  const pairIface = new Interface(V2_PAIR_ABI);

  const v2ReserveCalls = allPrices
    .filter(price => !price.dex.includes('UniswapV3') && !price.rawReserves)
    .map(price => {
      try {
        const checksumAddress = ethers.getAddress(price.poolAddress);
        return {
          target: checksumAddress,
          allowFailure: true,
          callData: pairIface.encodeFunctionData('getReserves', []),
          poolAddress: checksumAddress
        };
      } catch (err) {
        console.warn(`Skipping reserves call for ${price.poolName}: ${err.message}`);
        return null;
      }
    })
    .filter(call => call !== null);

  let v2ReservesMap = new Map();
  if (v2ReserveCalls.length > 0) {
    try {
      const multicallData = multicallIface.encodeFunctionData(
        'aggregate3',
        [v2ReserveCalls.map(c => ({ target: c.target, allowFailure: c.allowFailure, callData: c.callData }))]
      );
      const result = await wsProvider.call({
        to: MULTICALL3_ADDRESS,
        data: multicallData
      });

      const decodedReserves = multicallIface.decodeFunctionResult('aggregate3', result)[0];
      decodedReserves.forEach((res, i) => {
        if (res.success && v2ReserveCalls[i]) {
          try {
            const [reserve0, reserve1] = pairIface.decodeFunctionResult('getReserves', res.returnData);
            v2ReservesMap.set(v2ReserveCalls[i].poolAddress.toLowerCase(), {
              reserve0: reserve0.toString(),
              reserve1: reserve1.toString()
            });
          } catch (err) {
            console.warn(`Failed to decode reserves for call ${i}: ${err.message}`);
          }
        }
      });
    } catch (error) {
      console.error(`V2 reserves batch failed: ${error.message}`);
    }
  }

  // ==========================================
  // PROCESS AND ENHANCE EACH PRICE
  // ==========================================

  for (const priceData of allPrices) {
    const isV3 = priceData.dex.includes('UniswapV3') || priceData.dex.includes('PancakeswapV3') || priceData.dex.includes('SushiswapV3');

    // Add raw liquidity/reserves data
    if (isV3) {
      const poolKey = priceData.poolAddress?.toLowerCase();
      priceData.liquidity = v3LiquidityMap.get(poolKey) || '0';
      priceData.fee = new Decimal(priceData.fee || 3000).div(1e6); // Convert to decimal (3000 -> 0.003)
    } else {
      // Add missing rawReserves for V2
      if (!priceData.rawReserves) {
        const reserves = v2ReservesMap.get(priceData.poolAddress?.toLowerCase());
        if (reserves) {
          priceData.rawReserves = [BigInt(reserves.reserve0), BigInt(reserves.reserve1)];
        }
      }
      priceData.fee = new Decimal('0.003'); // V2 standard fee
    }

    // Calculate proper liquidity data
    let liquidityData;
    if (isV3) {
      liquidityData = calculateV3Liquidity(priceData);
    } else {
      liquidityData = calculateV2Liquidity(priceData);
    }

    // Add liquidity information to price data
    priceData.liquidityData = liquidityData;
    priceData.liquidityInTokenA = liquidityData.liquidityInTokenA;
    priceData.liquidityInTokenB = liquidityData.liquidityInTokenB;

    // Calculate maximum safe trade size (2% slippage tolerance)
    const maxTrade = calculateMaxTradeSize(liquidityData, 0.02, isV3);
    priceData.maxTradeSize = maxTrade;

    // Add recommended trade size (use 80% of max for safety)
    priceData.recommendedMaxTradeInA = maxTrade.recommendedMaxA;
    priceData.recommendedMaxTradeInB = maxTrade.recommendedMaxB;

    // Ensure poolName is set
    priceData.poolName = priceData.poolName ||
      pairs.find(p =>
        p.token0.address.toLowerCase() === priceData.tokenA.address.toLowerCase() &&
        p.token1.address.toLowerCase() === priceData.tokenB.address.toLowerCase()
      )?.name ||
      `${priceData.tokenA.symbol}/${priceData.tokenB.symbol}`;

    // Normalize decimals
    priceData.tokenA.decimals = normalizeDecimals(priceData.tokenA.decimals);
    priceData.tokenB.decimals = normalizeDecimals(priceData.tokenB.decimals);

    // Log liquidity info for debugging
    // if (liquidityData.liquidityInTokenB !== '0') {
    //   console.log(`📊 ${priceData.poolName} on ${priceData.dex}:,
    //     ${liquidityData.liquidityInTokenA} ${priceData.tokenA.symbol},,
    //     ${liquidityData.liquidityInTokenB} ${priceData.tokenB.symbol},,
    //     Max Trade: ${new Decimal(maxTrade.recommendedMaxB).toFixed(4)} ${priceData.tokenB.symbol}`);
    // }
  }

  // Filter valid prices and apply minimum liquidity threshold
  const minLiquidityDecimal = new Decimal(ethers.formatUnits(MIN_LIQUIDITY_USD, 6)); // Convert to decimal: 100000

  // Token price estimates in USD (for liquidity calculation)
  const tokenPriceEstimates = {
    'WETH': 3000,
    'ETH': 3000,
    'WBTC': 65000,
    'LINK': 15,
    'UNI': 7,
    'AAVE': 150,
    'COMP': 50,
    'SNX': 2,
    'CRV': 0.5,
    'MKR': 1500,
    'YFI': 8000,
    'MATIC': 0.8,
    'SHIB': 0.00001,
    // Stablecoins
    'USDC': 1,
    'USDT': 1,
    'DAI': 1,
    'crvUSD': 1
  };

  allPrices = allPrices.filter(priceData => {
    if (!priceData || !priceData.priceOfAinB || !priceData.priceOfBinA) return false;
    if (!new Decimal(priceData.priceOfAinB).gt(0) || !new Decimal(priceData.priceOfBinA).gt(0)) return false;
    if (!priceData.liquidityInTokenB || !new Decimal(priceData.liquidityInTokenB).gt(0)) return false;
    if (!priceData.liquidityInTokenA || !new Decimal(priceData.liquidityInTokenA).gt(0)) return false;

    // Get token symbols
    const tokenA = priceData.tokenA.symbol;
    const tokenB = priceData.tokenB.symbol;

    let liquidityUSD = null;

    // Strategy 1: Check if tokenB is a stablecoin
    if (tokenB === 'USDC' || tokenB === 'USDT' || tokenB === 'DAI' || tokenB === 'crvUSD') {
      liquidityUSD = new Decimal(priceData.liquidityInTokenB);
    }
    // Strategy 2: Check if tokenA is a stablecoin (use tokenA liquidity instead)
    else if (tokenA === 'USDC' || tokenA === 'USDT' || tokenA === 'DAI' || tokenA === 'crvUSD') {
      liquidityUSD = new Decimal(priceData.liquidityInTokenA);
    }
    // Strategy 3: Use price estimates for known tokens
    else if (tokenPriceEstimates[tokenB]) {
      liquidityUSD = new Decimal(priceData.liquidityInTokenB).mul(tokenPriceEstimates[tokenB]);
    }
    else if (tokenPriceEstimates[tokenA]) {
      liquidityUSD = new Decimal(priceData.liquidityInTokenA).mul(tokenPriceEstimates[tokenA]);
    }
    // Strategy 4: For unknown tokens, skip with warning
    else {
      console.warn(`⚠️ Cannot determine USD liquidity for ${priceData.poolName} (${tokenA}/${tokenB}) - skipping liquidity check for this pair`);
      // Return false to filter out pairs with unknown token prices for safety
      console.log(`🚫 Filtered out ${priceData.poolName} on ${priceData.dex}: Unknown token prices for ${tokenA}/${tokenB}`);
      return false;
    }

    // Filter: liquidity must be >= $100K
    const meetsMinLiquidity = liquidityUSD.gte(minLiquidityDecimal);

    // Debug logging for rejected pools
    if (!meetsMinLiquidity) {
      console.log(`🚫 Filtered out ${priceData.poolName} on ${priceData.dex}: Liquidity $${liquidityUSD.toFixed(2)} < $${minLiquidityDecimal.toFixed(2)}`);
    }

    return meetsMinLiquidity;
  });

  timer.checkpoint('All prices fetched with liquidity');
  logToMain(`✅ Fetched ${allPrices.length} valid prices with liquidity >= $100K in ${timer.getTotalTime()}ms`);

  return allPrices;
}

async function getV3Liquidity(poolAddress, token0, token1) {
  try {
    const poolContract = new ethers.Contract(poolAddress, [
      'function liquidity() view returns (uint128)'
    ], wsProvider);

    const liquidity = await poolContract.liquidity();
    return new Decimal(ethers.formatUnits(liquidity, token1.decimals)).toNumber();
  } catch (error) {
    return 0;
  }
}

// Calculate V2 liquidity
// function calculateV2Liquidity(priceData, token0, token1) {
//   try {
//     const { rawReserves } = priceData;
//     const reserveA = new Decimal(ethers.formatUnits(rawReserves[0], token0.decimals));
//     const reserveB = new Decimal(ethers.formatUnits(rawReserves[1], token1.decimals));

//     if (token1.symbol === 'USDC' || token1.symbol === 'USDT' || token1.symbol === 'DAI') {
//       return reserveB.toNumber();
//     } else if (token0.symbol === 'USDC' || token0.symbol === 'USDT' || token0.symbol === 'DAI') {
//       return reserveA.toNumber();
//     } else {
//       return reserveA.mul(priceData.priceOfAinB).toNumber();
//     }
//   } catch (error) {
//     return 0;
//   }
// }


// OPTIMIZED DIRECT ARBITRAGE - O(n²) instead of O(n³)
async function directArbitrageOptimized(allPrices) {
  const timer = new PerformanceTimer();
  logToMain('🔍 Starting optimized direct arbitrage analysis');

  const opportunities = [];
  const pricesByPool = new Map(); // Use Map for better performance

  // Group prices by pool efficiently
  for (const price of allPrices) {
    if (!pricesByPool.has(price.poolName)) {
      pricesByPool.set(price.poolName, []);
    }
    pricesByPool.get(price.poolName).push(price);
  }

  timer.checkpoint('Prices grouped by pool');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 DEBUG: Show how many pools each pair has
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n📊 PAIR GROUPING DEBUG:`);
  console.log(`Total unique pool names: ${pricesByPool.size}`);

  // Show all pairs and their pool counts
  const pairCounts = [];
  for (const [poolName, prices] of pricesByPool.entries()) {
    pairCounts.push({ poolName, count: prices.length, dexes: prices.map(p => p.dex) });
  }

  // Sort by count descending
  pairCounts.sort((a, b) => b.count - a.count);

  // Show all pairs
  console.log(`\n🔍 All pairs (sorted by pool count):`);
  pairCounts.forEach(({ poolName, count, dexes }) => {
    const status = count >= 2 ? '✅' : '❌';
    console.log(`  ${status} ${poolName} (${count} pools): ${dexes.join(', ')}`);
  });

  // Highlight specific pairs we're interested in
  console.log(`\n🎯 Specific pairs of interest:`);
  const pairsToCheck = ['DAI/WETH', 'WBTC/WETH', 'USDC/WETH', 'WETH/USDC'];
  for (const pairName of pairsToCheck) {
    const pairData = pairCounts.find(p => p.poolName === pairName);
    if (pairData) {
      console.log(`  ${pairData.count >= 2 ? '✅' : '❌'} ${pairName}: ${pairData.count} pools (${pairData.dexes.join(', ')})`);
    } else {
      console.log(`  ⚠️  ${pairName}: NOT FOUND in allPrices`);
    }
  }

  const filteredOut = pairCounts.filter(p => p.count < 2);
  console.log(`\n⚠️  ${filteredOut.length} pairs filtered out (< 2 pools)`);
  console.log(`✅ ${pairCounts.length - filteredOut.length} pairs will be analyzed (>= 2 pools)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Process pools in parallel
  const poolPromises = Array.from(pricesByPool.entries())
    .filter(([_, prices]) => prices.length >= 2)
    .slice(0, MAX_DIRECT_PAIRS) // Limit for performance
    .map(([poolName, prices]) =>
      processDirectArbitragePool(poolName, prices)
    );

  const poolResults = await Promise.allSettled(poolPromises);

  poolResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      opportunities.push(...result.value);
    }
  });

  timer.checkpoint('Direct arbitrage analysis completed');
  logToMain(`✅ Found ${opportunities.length} direct arbitrage opportunities`);

  // Log summary of all direct opportunities
  // if (opportunities.length > 0) {
  //   logOpportunitySummary(opportunities);
  // }

  return opportunities;
}

// Process individual pool for direct arbitrage
// async function processDirectArbitragePool(poolName, prices) {
//   const opportunities = [];
//   prices.sort((a, b) => new Decimal(a.priceOfAinB).minus(b.priceOfAinB).toNumber());

//   for (let i = 0; i < prices.length - 1; i++) {
//     const buyPriceObj = prices[i];
//     // console.log("buyPriceObj", buyPriceObj);
//     const buyPriceAinB = new Decimal(buyPriceObj.priceOfAinB);
//     if (!buyPriceAinB.isFinite() || buyPriceAinB.lte(0)) continue;

//     for (let j = i + 1; j < prices.length; j++) {
//       const sellPriceObj = prices[j];
//       if (buyPriceObj.dex === sellPriceObj.dex) continue;

//       const sellPriceAinB = new Decimal(sellPriceObj.priceOfAinB);
//       if (!sellPriceAinB.isFinite() || sellPriceAinB.lte(0)) continue;

//       const spread = sellPriceAinB.minus(buyPriceAinB).div(buyPriceAinB);
//       if (spread.lte(0.001)) break;

//       const tokenA = buyPriceObj.tokenA.symbol;
//       const tokenB = buyPriceObj.tokenB.symbol;
//       const tokenADecimals = buyPriceObj.tokenA.decimals;
//       const tokenBDecimals = buyPriceObj.tokenB.decimals;

//       const inputAmountHuman = '5';
//       const optimalInput = new Decimal(ethers.parseUnits(inputAmountHuman, tokenBDecimals).toString());
//       const platformFee1 = new Decimal(buyPriceObj.fee);
//       const platformFee2 = new Decimal(sellPriceObj.fee);

//       // Step 1: Buy A with B
//       const amountA = optimalInput.mul(new Decimal(1).minus(platformFee1).minus(PRIORITY_FEE)).div(buyPriceAinB);
//       // Step 2: Sell A for B
//       const output = amountA.mul(new Decimal(1).minus(platformFee2).minus(PRIORITY_FEE)).mul(sellPriceAinB);

//       // Calculate fees
//       const gasCostETH = await calculateGasCost(wsProvider, 350000);
//       const gasCostWei = ethers.parseEther(gasCostETH.toString());

//       // Flash loan fee (on the borrowed amount)
//       const flashLoanFee = optimalInput.mul(MAX_FLASH_LOAN_FEE);

//       // Convert gas cost to token B terms
//       let gasCost;
//       if (tokenB === 'ETH' || tokenB === 'WETH') {
//         gasCost = new Decimal(gasCostWei.toString());
//       } else {
//         // Convert ETH gas cost to tokenB - you should use actual price feeds here
//         const ethPriceInUSD = new Decimal('4146.96');
//         let tokenBPriceInUSD = new Decimal('1'); // Default for stablecoins

//         // Better price conversion based on token type
//         if (tokenB === 'USDC' || tokenB === 'USDT' || tokenB === 'DAI') {
//           tokenBPriceInUSD = new Decimal('1');
//         } else if (tokenB === 'WBTC') {
//           tokenBPriceInUSD = new Decimal('113753.18'); // Approximate BTC price
//         } else {
//           // For other tokens, try to derive from the price data
//           tokenBPriceInUSD = deriveTokenPriceInUSD(tokenB, prices);
//         }

//         gasCost = new Decimal(gasCostWei.toString())
//           .mul(ethPriceInUSD)
//           .div(tokenBPriceInUSD)
//           .div(new Decimal(10).pow(18 - tokenBDecimals)); // Adjust for token decimals
//       }


//       const grossProfit = output.minus(optimalInput);
//       const totalFees = gasCost.add(flashLoanFee);
//       const netProfit = grossProfit.minus(totalFees);

//       // Format amounts for logging
//       const inputFormatted = ethers.formatUnits(optimalInput.toFixed(0), tokenBDecimals);
//       const amountAFormatted = ethers.formatUnits(amountA.toFixed(0), tokenADecimals);
//       const outputFormatted = ethers.formatUnits(output.toFixed(0), tokenBDecimals);
//       const grossProfitFormatted = ethers.formatUnits(grossProfit.toFixed(0), tokenBDecimals);
//       const gasCostFormatted = ethers.formatUnits(gasCost.toFixed(0), tokenBDecimals);
//       const flashLoanFeeFormatted = ethers.formatUnits(flashLoanFee.toFixed(0), tokenBDecimals);
//       const netProfitFormatted = ethers.formatUnits(netProfit.toFixed(0), tokenBDecimals);

//       const opportunity = {
//         type: 'v3_direct',
//         poolName,
//         direction: `${tokenA}->${tokenB}->${tokenA}`,
//         buyDex: buyPriceObj.dex,
//         sellDex: sellPriceObj.dex,
//         buyPrice: buyPriceAinB,
//         sellPrice: sellPriceAinB,
//         pair: poolName,
//         amount_in: optimalInput.toString(),
//         amount_out: output.toFixed(0),
//         amountA: amountA.toFixed(0),
//         outputFormatted,
//         inputFormatted,
//         amountAFormatted,
//         gasEstimation: gasCost,
//         flashLoanFee: flashLoanFee, // Add flash loan fee to opportunity
//         profit: netProfit,
//         grossProfit: grossProfitFormatted,
//         grossProfitFormatted,
//         isProfitable: netProfit.gt(0),
//         formatted: {
//           input: `${inputFormatted} ${tokenB}`,
//           buyToken: `${tokenA} on ${buyPriceObj.dex} at ${buyPriceAinB}`,
//           platformFee1: `${platformFee1.mul(100)}%`,
//           priorityFee: `${PRIORITY_FEE.mul(100)}%`,
//           outputAmount: `${amountAFormatted} ${tokenA}`,
//           sellToken: `${tokenA} on ${sellPriceObj.dex} at ${sellPriceAinB}`,
//           platformFee2: `${platformFee2.mul(100)}%`,
//           outputAmountBack: `${outputFormatted} ${tokenB}`,
//           grossProfit: `${grossProfitFormatted} ${tokenB}`,
//           gasCost: `${gasCostFormatted} ${tokenB}`,
//           flashLoanFee: `${flashLoanFeeFormatted} ${tokenB}`, // Add to formatted output
//           netProfit: `${netProfitFormatted} ${tokenB}`,
//         }
//       };

//       console.log(
//         `\n🔍 Direct Arbitrage Opportunity`,
//         `\n  Pair: ${tokenA}/${tokenB}`,
//         `\n  Start: ${inputFormatted} ${tokenB} (${optimalInput} wei)`,
//         `\n  Step 1: Buy ${tokenA} on ${buyPriceObj.dex} at ${buyPriceAinB} ${tokenB}/${tokenA}`,
//         `\n    Platform Fee: ${platformFee1.mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%`,
//         `\n    Output: ${amountAFormatted} ${tokenA}`,
//         `\n  Step 2: Sell ${tokenA} on ${sellPriceObj.dex} at ${sellPriceAinB} ${tokenB}/${tokenA}`,
//         `\n    Platform Fee: ${platformFee2.mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%`,
//         `\n    Output: ${outputFormatted} ${tokenB}`,
//         `\n  Gross Profit: ${grossProfitFormatted} ${tokenB}`,
//         `\n  Gas Cost: ${gasCostFormatted} ${tokenB}`,
//         `\n  Flash Loan Fee: ${flashLoanFeeFormatted} ${tokenB} (${MAX_FLASH_LOAN_FEE.mul(100)}%)`,
//         `\n  Net Profit: ${netProfitFormatted} ${tokenB}`,
//         `\n  Profitable: ${netProfit.gt(0) ? '✅ YES' : '❌ NO'}`
//       );

//       const execResult = await executeDirectOpportunityIfProfitable(opportunity);
//       if (execResult) {
//         opportunity.execution = execResult;
//       }

//       const dbId = await storeOpportunityInDB(opportunity);
//       opportunity.dbId = dbId;
//       opportunities.push(opportunity);
//     }
//   }

//   return opportunities;
// }

/**
 * Helper function to get V2 quote from router
 */
async function getV2Quote(routerAddress, amountIn, tokenIn, tokenOut) {
  try {
    const router = new ethers.Contract(
      routerAddress,
      ['function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'],
      wsProvider
    );

    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return amounts[1]; // Return output amount
  } catch (error) {
    // console.error(`V2 quote failed: ${error.message}`);
    return null;
  }
}

/**
 * Helper function to get V3 quote from quoter
 */
// ═══════════════════════════════════════════════════════════════════════
// ✅ FIXED getV3Quote() - Takes quoter address as parameter
// ═══════════════════════════════════════════════════════════════════════
async function getV3Quote(quoterAddress, amountIn, tokenIn, tokenOut, fee) {
  // ✅ Validate fee tier
  const validFees = [100, 500, 2500, 3000, 10000];
  if (!validFees.includes(fee)) {
    console.log(`   ⚠️ Invalid fee tier: ${fee}, using 3000`);
    fee = 3000;
  }

  try {
    // Try QuoterV2 first (newer, more accurate)
    const quoter = new ethers.Contract(
      quoterAddress,
      ['function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'],
      wsProvider
    );

    const params = {
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      fee: fee,
      sqrtPriceLimitX96: 0
    };

    const result = await quoter.quoteExactInputSingle.staticCall(params);

    // ✅ Validate result
    if (!result || !result[0] || result[0] === 0n) {
      return null;
    }

    return result[0]; // Return amountOut

  } catch (error) {
    // Try QuoterV1 as fallback (for Uniswap only)
    if (DEX_ADDRESSES.UniswapV3.quoter_v1_address && quoterAddress === DEX_ADDRESSES.UniswapV3.quoter_address) {
      try {
        const quoterV1 = new ethers.Contract(
          DEX_ADDRESSES.UniswapV3.quoter_v1_address,
          ['function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'],
          wsProvider
        );

        const result = await quoterV1.quoteExactInputSingle.staticCall(
          tokenIn, tokenOut, fee, amountIn, 0
        );
        return result || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Get quote for any DEX (V2 or V3)
 */
/**
 * Normalize amount from one decimal precision to another
 * Useful for comparing amounts with different decimals
 */
function normalizeAmount(amount, fromDecimals, toDecimals) {
  if (fromDecimals === toDecimals) return amount;

  const diff = toDecimals - fromDecimals;
  if (diff > 0) {
    return amount * BigInt(10 ** diff);
  } else {
    return amount / BigInt(10 ** Math.abs(diff));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ✅ FIXED getQuote() - Routes to correct quoter per DEX
// ═══════════════════════════════════════════════════════════════════════
async function getQuote(dexName, amountIn, tokenIn, tokenOut, fee = 3000) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ INPUT VALIDATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!amountIn || amountIn === 0n) {
    return null;
  }

  if (!tokenIn || !tokenOut) {
    console.log(`   ⚠️ Missing token address`);
    return null;
  }

  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    return null;
  }

  try {
    let output = null;

    if (dexName.includes('V3')) {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ V3: Use DEX-SPECIFIC quoter
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let quoterAddress;

      if (dexName.includes('Sushiswap')) {
        quoterAddress = DEX_ADDRESSES.SushiswapV3?.quoter_address || DEX_ADDRESSES.SushiswapV3_3000?.quoter_address;
      } else if (dexName.includes('Pancakeswap')) {
        quoterAddress = DEX_ADDRESSES.PancakeswapV3?.quoter_address || DEX_ADDRESSES.PancakeswapV3_500?.quoter_address;
      } else {
        // Default to Uniswap V3
        quoterAddress = DEX_ADDRESSES.UniswapV3?.quoter_address || DEX_ADDRESSES.UniswapV3_3000?.quoter_address;
      }

      if (!quoterAddress) {
        console.log(`   ⚠️ No quoter address found for ${dexName}`);
        return null;
      }

      output = await getV3Quote(quoterAddress, amountIn, tokenIn, tokenOut, fee);

    } else {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // V2: Use correct router
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let routerAddress;

      if (dexName.includes('Sushiswap')) {
        routerAddress = DEX_ADDRESSES.SushiswapV2.router_address;
      } else if (dexName.includes('Pancakeswap')) {
        routerAddress = DEX_ADDRESSES.PancakeSwap.router_address;
      } else {
        routerAddress = DEX_ADDRESSES.UniswapV2.router_address;
      }

      output = await getV2Quote(routerAddress, amountIn, tokenIn, tokenOut);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ FINAL VALIDATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!output || output === 0n) {
      return null;
    }

    return output;

  } catch (error) {
    return null;
  }
}

// async function processDirectArbitragePool(poolName, prices) {
//   const opportunities = [];
//   prices.sort((a, b) => new Decimal(a.priceOfAinB).minus(b.priceOfAinB).toNumber());

//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // ✅ PARALLEL PROCESSING: Prepare all quote requests
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   const quotePairs = [];

//   console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
//   console.log(`🔍 DETECTING: ${poolName}`);
//   console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

//   const stats = {
//     totalCombinations: 0,
//     step1Success: 0,
//     step1Failed: 0,
//     step1FailReasons: {},
//     step2Success: 0,
//     step2Failed: 0,
//     step2FailReasons: {},
//     profitableFound: 0,
//     unprofitableSkipped: 0
//   };

//   const startTime = Date.now();


//   for (let i = 0; i < prices.length - 1; i++) {
//     const buyPriceObj = prices[i];
//     const buyPriceAinB = new Decimal(buyPriceObj.priceOfAinB);
//     if (!buyPriceAinB.isFinite() || buyPriceAinB.lte(0)) continue;

//     for (let j = i + 1; j < prices.length; j++) {
//       const sellPriceObj = prices[j];
//       if (buyPriceObj.dex === sellPriceObj.dex) continue;

//       stats.totalCombinations++;

//       const sellPriceAinB = new Decimal(sellPriceObj.priceOfAinB);
//       if (!sellPriceAinB.isFinite() || sellPriceAinB.lte(0)) continue;

//       // Quick spread check to filter obvious non-opportunities
//       const spread = sellPriceAinB.minus(buyPriceAinB).div(buyPriceAinB);
//       const minSpread = getMinSpreadForPair(buyPriceObj.tokenA, buyPriceObj.tokenB);
//       if (spread.lte(minSpread)) break; // 0.2% minimum spread


//       // console.log('🔍 Token Info:', {
//       //   tokenA: {
//       //     symbol: buyPriceObj.tokenA.symbol,
//       //     decimals: buyPriceObj.tokenA.decimals,
//       //     address: buyPriceObj.tokenA.address
//       //   },
//       //   tokenB: {
//       //     symbol: buyPriceObj.tokenB.symbol,
//       //     decimals: buyPriceObj.tokenB.decimals,
//       //     address: buyPriceObj.tokenB.address
//       //   }
//       // });

//       quotePairs.push({
//         buyPriceObj,
//         sellPriceObj,
//         buyPriceAinB,
//         sellPriceAinB,
//         pairIndex: `${i},${j}`
//       });
//     }
//   }

//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // ✅ PARALLEL QUOTER CALLS: Batch process all pairs
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   const batchSize = 10; // Process 10 pairs at a time
//   const results = [];

//   for (let batch = 0; batch < quotePairs.length; batch += batchSize) {
//     const batchPairs = quotePairs.slice(batch, batch + batchSize);

//     const batchPromises = batchPairs.map(async (pair) => {
//       const { buyPriceObj, sellPriceObj, buyPriceAinB, sellPriceAinB, pairIndex } = pair;

//       const platformFee1 = new Decimal(buyPriceObj.fee);
//       const platformFee2 = new Decimal(sellPriceObj.fee);
//       const tokenA = buyPriceObj.tokenA.symbol;
//       const tokenB = buyPriceObj.tokenB.symbol;
//       const tokenADecimals = normalizeDecimals(buyPriceObj.tokenA.decimals);
//       const tokenBDecimals = normalizeDecimals(buyPriceObj.tokenB.decimals);

//       // 🔍 DEBUG: Log token info for verification
//       // console.log('🔍 Token Info:', {
//       //   tokenA: {
//       //     symbol: buyPriceObj.tokenA.symbol,
//       //     decimals: tokenADecimals,
//       //     address: buyPriceObj.tokenA.address
//       //   },
//       //   tokenB: {
//       //     symbol: buyPriceObj.tokenB.symbol,
//       //     decimals: tokenBDecimals,
//       //     address: buyPriceObj.tokenB.address
//       //   },
//       //   buyDex: buyPriceObj.dex,
//       //   sellDex: sellPriceObj.dex
//       // });

//       // ✅ OPTIMIZED: Use smaller input amounts to reduce slippage and price impact
//       // These amounts are sized to find profitable opportunities with realistic slippage

//       let inputAmountHuman;
//       console.log("tokenB", tokenB);
//       if (tokenB === 'WETH' || tokenB === 'ETH') {
//         inputAmountHuman = new Decimal('1.0'); // ~$2,700 - Reduced from 3.3
//       } else if (tokenB === 'USDC' || tokenB === 'USDT' || tokenB === 'DAI') {
//         inputAmountHuman = new Decimal('3000'); // $3,000 - Reduced from 10,000
//       } else if (tokenB === 'WBTC') {
//         inputAmountHuman = new Decimal('0.03'); // ~$3,000 - Reduced from 0.11
//       } else if (tokenB === 'LINK') {
//         inputAmountHuman = new Decimal('200'); // ~$3,000 - Reduced from 750
//       } else if (tokenB === 'UNI') {
//         inputAmountHuman = new Decimal('400'); // ~$2,400 - Reduced from 1363
//       } else if (tokenB === 'AAVE') {
//         inputAmountHuman = new Decimal('20'); // ~$3,000 - Reduced from 90
//       } else if (tokenB === 'SNX') {
//         inputAmountHuman = new Decimal('4000'); // ~$800 - Reduced from 15000
//       } else if (tokenB === 'MKR') {
//         inputAmountHuman = new Decimal('2'); // ~$3,000 - Reduced from 9
//       } else if (tokenB === 'COMP') {
//         inputAmountHuman = new Decimal('80'); // ~$4,000 - Reduced from 315
//       } else if (tokenB === 'MATIC') {
//         inputAmountHuman = new Decimal('10000'); // ~$3,500 for low-price tokens
//       } else if (tokenB === 'CRV') {
//         inputAmountHuman = new Decimal('5000'); // ~$3,000
//       } else if (tokenB === 'YFI') {
//         inputAmountHuman = new Decimal('0.5'); // ~$3,000
//       } else if (tokenB === 'SHIB') {
//         inputAmountHuman = new Decimal('200000000'); // For meme tokens
//       } else {
//         // Default: aim for ~$2,000 equivalent
//         inputAmountHuman = new Decimal('2000');
//       }

//       const inputAmountWei = ethers.parseUnits(inputAmountHuman.toString(), tokenBDecimals);

//       // ✅ VALIDATION: Check minimum trade amount
//       const minTradeAmount = MIN_TRADE_AMOUNTS[tokenB];
//       if (minTradeAmount && inputAmountWei < minTradeAmount) {
//         console.log(`❌ Input amount ${ethers.formatUnits(inputAmountWei, tokenBDecimals)} ${tokenB} below minimum ${ethers.formatUnits(minTradeAmount, tokenBDecimals)} ${tokenB}`);
//         return null; // Skip this pair
//       }

//       // ✅ Step 1: Get ACTUAL quote for buy (tokenB -> tokenA) with error tracking
//       let step1Output;
//       try {
//         const step1Fee = buyPriceObj.dex.includes('V3')
//           ? Math.floor(platformFee1.mul(1000000).toNumber())
//           : 3000;

//         step1Output = await getQuote(
//           buyPriceObj.dex,
//           inputAmountWei,
//           buyPriceObj.tokenB.address,
//           buyPriceObj.tokenA.address,
//           step1Fee
//         );

//         if (!step1Output || step1Output === 0n) {
//           throw new Error('Zero output from quote');
//         }

//         // ✅ ENHANCED VALIDATION: Check for negative or absurdly large outputs (safety check)
//         if (step1Output < 0n) {
//           throw new Error('Negative output from quote (invalid)');
//         }

//         // ✅ VALIDATION: Check step1 output ratio (tokenA output vs tokenB input)
//         // Normalize to same decimals for fair comparison
//         const step1OutputNormalized = normalizeAmount(step1Output, tokenADecimals, 18);
//         const inputNormalized = normalizeAmount(inputAmountWei, tokenBDecimals, 18);
//         // ✅ FIX: Use Decimal to prevent precision loss for large amounts
//         const step1Ratio = new Decimal(step1OutputNormalized.toString())
//           .div(new Decimal(inputNormalized.toString()))
//           .toNumber();
//         console.log(`   Step1 Ratio Check: ${step1Ratio.toFixed(6)} (normalized to 18 decimals)`);


//         // // Reject if ratio is absurd (considering typical price ranges and fees)
//         // if (step1Ratio > 100000 || step1Ratio < 0.00001) {
//         //   logger.warn('❌ Rejected: Absurd step1 output ratio', {
//         //     pair: poolName,
//         //     tokenB: tokenB,
//         //     tokenA: tokenA,
//         //     inputAmount: inputAmountWei.toString(),
//         //     step1Output: step1Output.toString(),
//         //     ratio: step1Ratio
//         //   });
//         //   return null;
//         // }

//         stats.step1Success++;
//       } catch (error) {
//         stats.step1Failed++;
//         const reason = error.reason || error.message || 'Unknown';
//         const shortReason = reason.substring(0, 50);
//         stats.step1FailReasons[shortReason] = (stats.step1FailReasons[shortReason] || 0) + 1;
//         console.log(`❌ Step1 fail (${pairIndex}): ${shortReason}`);
//         return null; // Skip this pair
//       }

//       // ✅ Step 2: Get ACTUAL quote for sell (tokenA -> tokenB) with error tracking
//       let step2Output;
// try {
//   const step2Fee = sellPriceObj.dex.includes('V3')
//     ? Math.floor(platformFee2.mul(1000000).toNumber())
//     : 3000;

//   // ✅ CRITICAL FIX: Use sellPriceObj instead of buyPriceObj
//   step2Output = await getQuote(
//     sellPriceObj.dex,
//     step1Output,
//     sellPriceObj.tokenA.address,  // ✅ FIXED: Correct token order
//     sellPriceObj.tokenB.address,  // ✅ FIXED: Correct token order
//     step2Fee
//   );

//   if (!step2Output || step2Output === 0n) {
//     throw new Error('Zero output from quote');
//   }

//   // ✅ ENHANCED VALIDATION: Check for negative or absurdly large outputs (safety check)
//   if (step2Output < 0n) {
//     throw new Error('Negative output from quote (invalid)');
//   }

//   stats.step2Success++;
// } catch (error) {
//   stats.step2Failed++;
//   const reason = error.reason || error.message || 'Unknown';
//   const shortReason = reason.substring(0, 50);
//   stats.step2FailReasons[shortReason] = (stats.step2FailReasons[shortReason] || 0) + 1;
//   console.log(`❌ Step2 fail (${pairIndex}): ${shortReason}`);
//   return null; // Skip this pair
// }
      
      
//       // let step2Output;
//       // try {
//       //   const step2Fee = sellPriceObj.dex.includes('V3')
//       //     ? Math.floor(platformFee2.mul(1000000).toNumber())
//       //     : 3000;

//       //   step2Output = await getQuote(
//       //     sellPriceObj.dex,
//       //     step1Output,
//       //     buyPriceObj.tokenA.address,
//       //     buyPriceObj.tokenB.address,
//       //     step2Fee
//       //   );

//       //   if (!step2Output || step2Output === 0n) {
//       //     throw new Error('Zero output from quote');
//       //   }

//       //   stats.step2Success++;
//       // } catch (error) {
//       //   stats.step2Failed++;
//       //   const reason = error.reason || error.message || 'Unknown';
//       //   const shortReason = reason.substring(0, 50);
//       //   stats.step2FailReasons[shortReason] = (stats.step2FailReasons[shortReason] || 0) + 1;
//       //   console.log(`❌ Step2 fail (${pairIndex}): ${shortReason}`);
//       //   return null; // Skip this pair
//       // }

//       // ✅ ENHANCED: Decimal-aware logging with explicit token info
//       console.log('💰 Calculation Check:', {
//         tokenB: `${tokenB} (${tokenBDecimals} decimals)`,
//         tokenA: `${tokenA} (${tokenADecimals} decimals)`,
//         inputAmount: {
//           wei: inputAmountWei.toString(),
//           human: ethers.formatUnits(inputAmountWei, tokenBDecimals),
//           token: tokenB
//         },
//         step1Output: {
//           wei: step1Output.toString(),
//           human: ethers.formatUnits(step1Output, tokenADecimals),
//           token: tokenA,
//           dex: buyPriceObj.dex
//         },
//         step2Output: {
//           wei: step2Output.toString(),
//           human: ethers.formatUnits(step2Output, tokenBDecimals),
//           token: tokenB,
//           dex: sellPriceObj.dex
//         }
//       });

//       // ✅ VALIDATION LAYER 1: Reject absurd price ratios (both amounts are in tokenB decimals)
//       const outputInputRatio = new Decimal(step2Output.toString()).div(new Decimal(inputAmountWei.toString()));

//       // ✅ IMPROVED: More flexible ratio check - allow 50% loss to 10x gain for safety
//       // This catches decimal errors while allowing legitimate arbitrage opportunities
//       if (outputInputRatio.gt(10) || outputInputRatio.lt(0.5)) {
//         logger.warn('❌ Rejected: Absurd output/input ratio (possible decimal error)', {
//           pair: poolName,
//           tokenB: tokenB,
//           tokenBDecimals: tokenBDecimals,
//           inputAmountWei: inputAmountWei.toString(),
//           inputHuman: ethers.formatUnits(inputAmountWei, tokenBDecimals),
//           step2Output: step2Output.toString(),
//           outputHuman: ethers.formatUnits(step2Output, tokenBDecimals),
//           ratio: outputInputRatio.toFixed(4),
//           buyDex: buyPriceObj.dex,
//           sellDex: sellPriceObj.dex
//         });
//         return null; // Something is wrong with decimals or extreme slippage
//       }

//       // ✅ Calculate REAL profit from ACTUAL quotes
//       if (step2Output <= inputAmountWei) {
//         stats.unprofitableSkipped++;
//         return null; // Loss, skip
//       }


//       console.log(`\n🔹 Potential Opportunity Detected |||||||||||||||||||(${pairIndex}): ${poolName}`);
//       // console.log("step1Output", step1Output.toString());
//       // console.log("step2Output", step2Output.toString());
//       // console.log("inputAmountWei", inputAmountWei.toString());

//       // const grossProfitWei = step2Output - inputAmountWei;
//       // const grossProfit_human = new Decimal(ethers.formatUnits(grossProfitWei, tokenBDecimals));

//       const netProfit = new Decimal(step2Output.toString()).minus(new Decimal(inputAmountWei.toString()));
//       console.log(`   Net Profit (wei): ${netProfit}`);

//       //     // Gas cost calculation
//       //     const gasCostETH = await calculateGasCost(wsProvider, 350000);
//       //     const gasCostWei = ethers.parseEther(gasCostETH.toString());

//       //     // Fetch real-time ETH price
//       //     const ethPriceInUSD = await priceFeed.getETHPrice();
//       //     let tokenBPriceInUSD = new Decimal('1');

//       //     // Get dynamic token prices
//       //     if (tokenB === 'WBTC') {
//       //       tokenBPriceInUSD = await priceFeed.getPrice('WBTC', 'USD');
//       //     } else if (tokenB === 'WETH' || tokenB === 'ETH') {
//       //       tokenBPriceInUSD = ethPriceInUSD;
//       //     } else if (tokenB === 'USDC' || tokenB === 'USDT' || tokenB === 'DAI') {
//       //       tokenBPriceInUSD = new Decimal('1');
//       //     } else {
//       //       try {
//       //         tokenBPriceInUSD = await priceFeed.getPrice(tokenB, 'USD');
//       //       } catch (error) {
//       //         tokenBPriceInUSD = deriveTokenPriceInUSD(tokenB, prices);
//       //       }
//       //     }

//       //     const gasCost_human = gasWeiToTokenHuman(gasCostWei, ethPriceInUSD, tokenBPriceInUSD);
//       //     const flashLoanFee_human = inputAmountHuman.mul(MAX_FLASH_LOAN_FEE);

//       //     // Calculate net profit
//       //     const totalFees_human = gasCost_human.add(flashLoanFee_human);
//       //     const netProfit_human = grossProfit_human.minus(totalFees_human);
//       //     console.log(`💰 Opportunity analysis for ${poolName}:`);
//       //     console.log(`   Input: ${inputAmountHuman} ${tokenB}`);
//       //     console.log(`   Gross Profit: ${grossProfit_human.toFixed(6)} ${tokenB}
//       // (${grossProfit_human.div(inputAmountHuman).mul(100).toFixed(2)}%)`);
//       //     console.log(`   Gas Cost: ${gasCost_human.toFixed(6)} ${tokenB}
//       // (${gasCost_human.div(inputAmountHuman).mul(100).toFixed(2)}%)`);
//       //     console.log(`   Flash Loan Fee: ${flashLoanFee_human.toFixed(6)} ${tokenB}`);
//       //     console.log(`   Net Profit: ${netProfit_human.toFixed(6)} ${tokenB}
//       // (${netProfit_human.div(inputAmountHuman).mul(100).toFixed(2)}%)`);
//       //     console.log(`   Threshold: ${MIN_PROFIT_THRESHOLD} ${tokenB}`);
//       //     console.log(`   Profitable: ${netProfit_human.gt(MIN_PROFIT_THRESHOLD)}`);
//       //     // Skip if not profitable
//       //     if (netProfit_human.lte(0) || netProfit_human.lt(MIN_PROFIT_THRESHOLD)) {
//       //       return null;
//       //     }

//       //     const netProfitPercent = netProfit_human.div(inputAmountHuman).mul(100);
//       //     const spread = sellPriceAinB.minus(buyPriceAinB).div(buyPriceAinB);
//       //     const spreadPercent = spread.mul(100);

//       //     // Format amounts (converting from Wei back to human readable)
//       //     const amountA_human = new Decimal(ethers.formatUnits(step1Output, tokenADecimals));
//       //     const output_human = new Decimal(ethers.formatUnits(step2Output, tokenBDecimals));

//       //     const inputFormatted = inputAmountHuman.toFixed(tokenBDecimals);
//       //     const amountAFormatted = amountA_human.toFixed(tokenADecimals);
//       //     const outputFormatted = output_human.toFixed(tokenBDecimals);
//       //     const grossProfitFormatted = grossProfit_human.toFixed(tokenBDecimals);
//       //     const gasCostFormatted = gasCost_human.toFixed(tokenBDecimals);
//       //     const flashLoanFeeFormatted = flashLoanFee_human.toFixed(tokenBDecimals);
//       //     const netProfitFormatted = netProfit_human.toFixed(tokenBDecimals);

//       stats.profitableFound++;
//       // console.log(`✅ VALIDATED: ${buyPriceObj.dex} -> ${sellPriceObj.dex}: ${netProfitPercent.toFixed(3)}% profit`);

//       const opportunity = {
//         type: 'v3_direct',
//         // poolName,
//         direction: `${tokenB}->${tokenA}->${tokenB}`,
//         buyDex: buyPriceObj.dex,
//         sellDex: sellPriceObj.dex,
//         buyPrice: buyPriceAinB,
//         sellPrice: sellPriceAinB,
//         pair: poolName,
//         tokenA: buyPriceObj.tokenA,
//         tokenB: buyPriceObj.tokenB,
//         tokenADecimals: tokenADecimals,
//         tokenBDecimals: tokenBDecimals,
//         fee1: platformFee1,
//         fee2: platformFee2,
//         // priorityFee: PRIORITY_FEE,
//         amount_in: toTokenUnits(inputAmountHuman, tokenBDecimals),
//         amount_out: step2Output.toString(),
//         // amountA: toTokenUnits(amountA_human, tokenADecimals),
//         // gasEstimation: gasCost_human,
//         // flashLoanFee: flashLoanFee_human,
//         profit: netProfit,
//         // grossProfit: grossProfit_human,
//         // isProfitable: netProfit_human.gt(0),
//         // spread: spreadPercent,
//         buyPoolAddress: buyPriceObj.poolAddress,
//         sellPoolAddress: sellPriceObj.poolAddress,

//         // formatted: {
//         //   input: `${inputFormatted} ${tokenB}`,
//         //   buyToken: `${tokenA} on ${buyPriceObj.dex} at ${buyPriceAinB}`,
//         //   platformFee1: `${platformFee1.mul(100)}%`,
//         //   priorityFee: `${PRIORITY_FEE.mul(100)}%`,
//         //   outputAmount: `${amountAFormatted} ${tokenA}`,
//         //   sellToken: `${tokenA} on ${sellPriceObj.dex} at ${sellPriceAinB}`,
//         //   platformFee2: `${platformFee2.mul(100)}%`,
//         //   outputAmountBack: `${outputFormatted} ${tokenB}`,
//         //   grossProfit: `${grossProfitFormatted} ${tokenB}`,
//         //   gasCost: `${gasCostFormatted} ${tokenB}`,
//         //   flashLoanFee: `${flashLoanFeeFormatted} ${tokenB}`,
//         //   netProfit: `${netProfitFormatted} ${tokenB}`,
//         // }
//       };

//       // ✅ VALIDATION LAYER 2: Use validator to validate opportunity
//       if (!validator.validateDirectArbitrage(opportunity)) {
//         logger.warn('❌ Rejected invalid direct arbitrage calculation', {
//           pair: poolName,
//           buyDex: buyPriceObj.dex,
//           sellDex: sellPriceObj.dex,
//           amount_in: opportunity.amount_in.toString(),
//           amount_out: opportunity.amount_out.toString()
//         });
//         return null; // Don't save this opportunity
//       }

//       return opportunity;
//     });

//     // ✅ Wait for all quotes in this batch
//     const batchResults = await Promise.all(batchPromises);

//     // Filter out null results and add to results array
//     batchResults.forEach(result => {
//       if (result) {

//         // console.log(`✅ VALIDATED OPPORTUNITY (${poolName}): Buy on ${result.buyDex}, Sell on ${result.sellDex}, Profit: ${result.profit}`);
//         results.push(result);
//       }
//     });
//   }



//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // ✅ PROCESS RESULTS: Store and return profitable opportunities
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   for (const opportunity of results) {
//     if (opportunity.profit && opportunity.profit > MIN_PROFIT_THRESHOLD) {
//       await detectAndStoreOpportunity(opportunity);
//       opportunities.push(opportunity);
//     }
//   }

//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // ✅ PRINT COMPREHENSIVE DETECTION STATS
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   const detectionTime = Date.now() - startTime;

//   //   console.log(`
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // 📊 DETECTION STATS FOR ${poolName}:
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   // ⏱️  Time: ${detectionTime}ms
//   // 🔢 Combinations checked: ${stats.totalCombinations}

//   // Step 1 (Buy):
//   //   ✅ Success: ${stats.step1Success} (${stats.totalCombinations > 0 ? (stats.step1Success / stats.totalCombinations * 100).toFixed(1) : '0.0'}%)
//   //   ❌ Failed: ${stats.step1Failed} (${stats.totalCombinations > 0 ? (stats.step1Failed / stats.totalCombinations * 100).toFixed(1) : '0.0'}%)${Object.keys(stats.step1FailReasons).length > 0 ? '\n  Failure reasons:' : ''}
//   // ${Object.entries(stats.step1FailReasons).map(([reason, count]) =>
//   //     `     - ${reason}: ${count}`
//   //   ).join('\n')}

//   // Step 2 (Sell):
//   //   ✅ Success: ${stats.step2Success}
//   //   ❌ Failed: ${stats.step2Failed}${Object.keys(stats.step2FailReasons).length > 0 ? '\n  Failure reasons:' : ''}
//   // ${Object.entries(stats.step2FailReasons).map(([reason, count]) =>
//   //     `     - ${reason}: ${count}`
//   //   ).join('\n')}

//   // Results:
//   //   ✅ Profitable: ${stats.profitableFound}
//   //   ❌ Unprofitable: ${stats.unprofitableSkipped}
//   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   //   `);

//   return opportunities;
// }

/**
 * ✅ SPREAD PRE-CHECK: Quick test with small amount to avoid expensive quote calls
 * This saves RPC calls by detecting no-spread scenarios early
 * @param {Object} buyPriceObj - Buy pool data
 * @param {Object} sellPriceObj - Sell pool data
 * @param {Object} tokenA - Token A data
 * @param {Object} tokenB - Token B data
 * @returns {Object} - { hasSpread: boolean, spreadPercent: number, reason: string }
 */
async function checkSpreadExists(buyPriceObj, sellPriceObj, tokenA, tokenB) {
  const tokenBDecimals = normalizeDecimals(tokenB.decimals);
  const tokenADecimals = normalizeDecimals(tokenA.decimals);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ CRITICAL FIX: Validate token addresses match
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Ensure both pools have the same token pair (even if in different order)
  const buyTokens = new Set([
    buyPriceObj.tokenA.address.toLowerCase(),
    buyPriceObj.tokenB.address.toLowerCase()
  ]);
  const sellTokens = new Set([
    sellPriceObj.tokenA.address.toLowerCase(),
    sellPriceObj.tokenB.address.toLowerCase()
  ]);

  const tokensMatch =
    buyTokens.has(tokenA.address.toLowerCase()) &&
    buyTokens.has(tokenB.address.toLowerCase()) &&
    sellTokens.has(tokenA.address.toLowerCase()) &&
    sellTokens.has(tokenB.address.toLowerCase());

  if (!tokensMatch) {
    return {
      hasSpread: false,
      reason: 'TOKEN_MISMATCH',
      spreadPercent: 0
    };
  }

  // Use realistic test amount (~$1000 equivalent) for accurate spread estimation
  let testAmount;
  if (tokenB.symbol === 'USDT' || tokenB.symbol === 'USDC' || tokenB.symbol === 'DAI') {
    testAmount = ethers.parseUnits('1000', tokenBDecimals); // $1000 for stablecoins
  } else if (tokenB.symbol === 'WETH' || tokenB.symbol === 'ETH') {
    testAmount = ethers.parseUnits('1', tokenBDecimals); // 1 ETH
  } else if(tokenB.symbol === 'WBTC') {
    testAmount = ethers.parseUnits('0.01', tokenBDecimals); // 0.01 BTC
  } else if (tokenB.symbol === 'LINK') {
    testAmount = ethers.parseUnits('100', tokenBDecimals); // 100 LINK
  } else {
    testAmount = ethers.parseUnits('100', tokenBDecimals); // Default
  }

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: Buy tokenA with tokenB
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const platformFee1 = new Decimal(buyPriceObj.fee);
    const step1Fee = buyPriceObj.dex.includes('V3')
      ? Math.floor(platformFee1.mul(1000000).toNumber())
      : 3000;

    const buyOutput = await getQuote(
      buyPriceObj.dex,
      testAmount,
      buyPriceObj.tokenB.address,
      buyPriceObj.tokenA.address,
      step1Fee
    );

    if (!buyOutput || buyOutput === 0n) {
      return { hasSpread: false, reason: 'NO_BUY_QUOTE', spreadPercent: 0 };
    }

    // ✅ RELAXED SANITY CHECK: Only reject if buy output is completely absurd
    // Note: For extreme price differences (SHIB, PEPE), output can be 10^12+ times input
    // We rely on the "extreme loss" check later to catch real errors
    const decimalDiff = Math.abs(tokenADecimals - tokenBDecimals);
    const priceAdjustment = decimalDiff >= 12 ? 20 : (decimalDiff >= 6 ? 12 : 8);
    const maxReasonableBuyOutput = testAmount * BigInt(10 ** priceAdjustment);

    if (buyOutput > maxReasonableBuyOutput) {
      console.log(`   ⚠️ Suspicious buy output: ${buyOutput.toString().substring(0, 20)}... (testAmount: ${testAmount})`);
      return { hasSpread: false, reason: 'INVALID_BUY_OUTPUT', spreadPercent: 0 };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: Sell tokenA to get tokenB back
    // ✅ CRITICAL FIX: Use tokenA/tokenB addresses, NOT sellPriceObj tokens
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const platformFee2 = new Decimal(sellPriceObj.fee);
    const step2Fee = sellPriceObj.dex.includes('V3')
      ? Math.floor(platformFee2.mul(1000000).toNumber())
      : 3000;

    // Use the SAME token addresses as defined by buyPriceObj (tokenA and tokenB params)
    // NOT sellPriceObj.tokenA/tokenB which might be in different order!
    const sellOutput = await getQuote(
      sellPriceObj.dex,
      buyOutput,
      tokenA.address,  // ✅ FIX: Use parameter tokenA, not sellPriceObj.tokenA
      tokenB.address,  // ✅ FIX: Use parameter tokenB, not sellPriceObj.tokenB
      step2Fee
    );

    if (!sellOutput || sellOutput === 0n) {
      return { hasSpread: false, reason: 'NO_SELL_QUOTE', spreadPercent: 0 };
    }

    // ✅ SANITY CHECK: Sell output should be reasonably close to testAmount
    // After a roundtrip (tokenB → tokenA → tokenB), we expect to get back ~testAmount
    // Allow up to 10x profit (1000%) - anything more is likely a quote error
    // The "extreme loss" check below handles the lower bound
    const maxReasonableSellOutput = testAmount * BigInt(10);
    if (sellOutput > maxReasonableSellOutput) {
      console.log(`   ⚠️ Suspicious sell output: ${sellOutput.toString().substring(0, 20)}... (testAmount: ${testAmount}), ratio: ${Number(sellOutput) / Number(testAmount)}x`);
      return { hasSpread: false, reason: 'INVALID_SELL_OUTPUT', spreadPercent: 0 };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ ENHANCED LOGGING: Show complete quote flow
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const testAmountHuman = ethers.formatUnits(testAmount, tokenBDecimals);
    const buyOutputHuman = ethers.formatUnits(buyOutput, tokenADecimals);
    const sellOutputHuman = ethers.formatUnits(sellOutput, tokenBDecimals);

    console.log(`   📊 Quote Flow: ${testAmountHuman} ${tokenB.symbol} → ${buyOutputHuman} ${tokenA.symbol} → ${sellOutputHuman} ${tokenB.symbol}`);

    // Calculate spread percentage
    const ratio = Number(sellOutput) / Number(testAmount);
    const spreadPercent = (ratio - 1) * 100;

    // ✅ ENHANCED VALIDATION: More detailed error detection
    if (spreadPercent < -50) {
      console.log(`   ⚠️ Extreme loss detected: ${spreadPercent.toFixed(2)}% - likely pool/price error`);
      return {
        hasSpread: false,
        reason: 'POOL_ERROR',
        spreadPercent
      };
    }

    if (spreadPercent < -10) {
      return {
        hasSpread: false,
        reason: 'POOL_ERROR',
        spreadPercent
      };
    }

    // ✅ DYNAMIC MINIMUM: Adjust based on DEX types and fees
    // Calculate minimum spread needed to cover fees + gas
    // Note: platformFee1/2 are already in decimal format (0.003 = 0.3%), not basis points
    const buyFeePercent = platformFee1.mul(100).toNumber(); // Convert decimal to %
    const sellFeePercent = platformFee2.mul(100).toNumber();
    const totalFeePercent = buyFeePercent + sellFeePercent;
    const gasOverheadPercent = 0.15; // ~0.15% gas overhead estimate

    // Minimum spread = total fees + gas + 0.1% safety margin
    const MIN_SPREAD_PERCENT = totalFeePercent + gasOverheadPercent + 0.1;

    // Log the dynamic threshold for transparency
    console.log(`   💰 Min profitable spread: ${MIN_SPREAD_PERCENT.toFixed(2)}% (fees: ${totalFeePercent.toFixed(2)}% + gas: ${gasOverheadPercent}% + margin: 0.1%)`);
    if (spreadPercent < MIN_SPREAD_PERCENT) {
      return {
        hasSpread: false,
        reason: 'SPREAD_TOO_LOW',
        spreadPercent
      };
    }

    return {
      hasSpread: true,
      spreadPercent,
      testOutput: sellOutput
    };

  } catch (error) {
    console.log(`   ❌ Quote error: ${error.message}`);
    return {
      hasSpread: false,
      reason: error.message || 'QUOTE_ERROR',
      spreadPercent: 0
    };
  }
}


async function processDirectArbitragePool(poolName, prices) {
  const opportunities = [];
  prices.sort((a, b) => new Decimal(a.priceOfAinB).minus(b.priceOfAinB).toNumber());

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 DETECTING: ${poolName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const stats = {
    totalCombinations: 0,
    step1Success: 0,
    step1Failed: 0,
    step1FailReasons: {},
    step2Success: 0,
    step2Failed: 0,
    step2FailReasons: {},
    profitableFound: 0,
    unprofitableSkipped: 0
  };

  const startTime = Date.now();
  const quotePairs = [];

  // ✅ CHECK BOTH DIRECTIONS: Compare all pool pairs in both directions
  for (let i = 0; i < prices.length; i++) {
    const priceObj1 = prices[i];
    const price1AinB = new Decimal(priceObj1.priceOfAinB);
    if (!price1AinB.isFinite() || price1AinB.lte(0)) continue;

    for (let j = 0; j < prices.length; j++) {
      // Skip same pool
      if (i === j) continue;

      const priceObj2 = prices[j];

      // Skip same DEX
      if (priceObj1.dex === priceObj2.dex) continue;

      const price2AinB = new Decimal(priceObj2.priceOfAinB);
      if (!price2AinB.isFinite() || price2AinB.lte(0)) continue;

      stats.totalCombinations++;

      // Check if there's a price difference (spread)
      // Direction: Buy from priceObj1, Sell to priceObj2
      const spread = price2AinB.minus(price1AinB).div(price1AinB);
      // console.log(`   Checking Spread `, spread);
      const minSpread = getMinSpreadForPair(priceObj1.tokenA, priceObj1.tokenB);
      // console.log(`   Minimum Required Spread: `, minSpread);

      // Only proceed if spread is positive and meets minimum
      if (spread.lte(minSpread)) continue;

      quotePairs.push({
        buyPriceObj: priceObj1,
        sellPriceObj: priceObj2,
        buyPriceAinB: price1AinB,
        sellPriceAinB: price2AinB,
        pairIndex: `${i},${j}`
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ PARALLEL QUOTER CALLS with DYNAMIC INPUT AMOUNTS
  // Using QUOTE_CONFIG and ANALYSIS_CONFIG for optimal performance
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const batchSize = QUOTE_CONFIG.BATCH_SIZE || 20;  // ✅ Use config (20 instead of 10)
  const maxConcurrent = Math.min(
    Math.ceil(ANALYSIS_CONFIG.MAX_CONCURRENT_PAIRS / batchSize),
    5  // Max 5 concurrent batches to avoid RPC overload
  );
  const batchDelay = QUOTE_CONFIG.BATCH_DELAY || 50;  // 50ms delay between batches
  const results = [];

  // Helper function for delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Split into batches
  const allBatches = [];
  for (let i = 0; i < quotePairs.length; i += batchSize) {
    allBatches.push(quotePairs.slice(i, i + batchSize));
  }

  console.log(`   🚀 Processing ${quotePairs.length} pairs in ${allBatches.length} batches (${maxConcurrent} concurrent)`);

  // Process batches with controlled concurrency
  for (let i = 0; i < allBatches.length; i += maxConcurrent) {
    const concurrentBatches = allBatches.slice(i, i + maxConcurrent);

    // Process multiple batches in parallel
    const batchPromises = concurrentBatches.map(async (batchPairs, batchIndex) => {
      // Add staggered delay to prevent RPC rate limiting
      if (batchIndex > 0) {
        await delay(batchDelay * batchIndex);
      }

      // Process all pairs in this batch concurrently
      const pairPromises = batchPairs.map(async (pair) => {
      const { buyPriceObj, sellPriceObj, buyPriceAinB, sellPriceAinB, pairIndex } = pair;

      const platformFee1 = new Decimal(buyPriceObj.fee);
      const platformFee2 = new Decimal(sellPriceObj.fee);
      const tokenA = buyPriceObj.tokenA.symbol;
      const tokenB = buyPriceObj.tokenB.symbol;
      const tokenADecimals = normalizeDecimals(buyPriceObj.tokenA.decimals);
      const tokenBDecimals = normalizeDecimals(buyPriceObj.tokenB.decimals);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ SPREAD PRE-CHECK: Quick test to avoid expensive full quotes
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      console.log(`\n   🔄 Testing: ${buyPriceObj.dex} → ${sellPriceObj.dex}`);

      const spreadCheck = await checkSpreadExists(
        buyPriceObj,
        sellPriceObj,
        buyPriceObj.tokenA,
        buyPriceObj.tokenB
      );

      if (!spreadCheck.hasSpread) {
        console.log(`   ⏭️ Skip: ${spreadCheck.reason} (${spreadCheck.spreadPercent.toFixed(3)}%)`);
        stats.unprofitableSkipped++;
        return null;
      }

      console.log(`   ✅ Spread found: ${spreadCheck.spreadPercent.toFixed(3)}%`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ SAFE INPUT AMOUNT CALCULATION BASED ON BOTH POOLS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Calculate safe input amount based on MINIMUM of both pools
      // This prevents trades that would fail due to insufficient sell pool liquidity
      const inputAmountHuman = calculateSafeTradeAmount(buyPriceObj, sellPriceObj);

      // Skip if pools have insufficient liquidity
      if (!inputAmountHuman || inputAmountHuman === null) {
        console.log(`   ⏭️ Skip: Could not calculate safe amount (insufficient liquidity)`);
        return null;
      }

      console.log(`   💰 Using safe input: ${inputAmountHuman.toFixed(4)} ${tokenB}`);

      const inputAmountWei = ethers.parseUnits(inputAmountHuman.toString(), tokenBDecimals);

      // ✅ VALIDATION: Check minimum trade amount
      const minTradeAmount = MIN_TRADE_AMOUNTS[tokenB];
      if (minTradeAmount && inputAmountWei < minTradeAmount) {
        console.log(`❌ Input amount ${ethers.formatUnits(inputAmountWei, tokenBDecimals)} ${tokenB} below minimum ${ethers.formatUnits(minTradeAmount, tokenBDecimals)} ${tokenB}`);
        return null;
      }

      // ✅ Step 1: Get ACTUAL quote for buy (tokenB -> tokenA) with CACHING
      let step1Output;
      const step1Start = Date.now();
      try {
        const step1Fee = buyPriceObj.dex.includes('V3')
          ? Math.floor(platformFee1.mul(1000000).toNumber())
          : 3000;

        // Use cache for quote fetching (60-80% hit rate = major speedup!)
        const cacheKey = quoteCache.getCacheKey(
          buyPriceObj.dex,
          buyPriceObj.tokenB.address,
          buyPriceObj.tokenA.address,
          inputAmountWei.toString(),
          step1Fee
        );

        step1Output = await quoteCache.get(
          cacheKey,
          async () => await getQuote(
            buyPriceObj.dex,
            inputAmountWei,
            buyPriceObj.tokenB.address,
            buyPriceObj.tokenA.address,
            step1Fee
          ),
          100 // Estimated latency saved
        );

        if (!step1Output || step1Output === 0n) {
          throw new Error('Zero output from quote');
        }

        if (step1Output < 0n) {
          throw new Error('Negative output from quote (invalid)');
        }

        // Validation: Check step1 output ratio
        const step1OutputNormalized = normalizeAmount(step1Output, tokenADecimals, 18);
        const inputNormalized = normalizeAmount(inputAmountWei, tokenBDecimals, 18);
        const step1Ratio = new Decimal(step1OutputNormalized.toString())
          .div(new Decimal(inputNormalized.toString()))
          .toNumber();

        const step1Latency = Date.now() - step1Start;
        console.log(`   Step1 Ratio Check: ${step1Ratio.toFixed(6)} (${step1Latency}ms)`);

        // Track performance
        if (typeof performanceMonitor !== 'undefined' && performanceMonitor.trackQuoteFetch) {
          performanceMonitor.trackQuoteFetch(step1Latency, quoteCache.cache.has(cacheKey), true);
        }

        stats.step1Success++;
      } catch (error) {
        stats.step1Failed++;
        const reason = error.reason || error.message || 'Unknown';
        const shortReason = reason.substring(0, 50);
        stats.step1FailReasons[shortReason] = (stats.step1FailReasons[shortReason] || 0) + 1;
        console.log(`❌ Step1 fail (${pairIndex}): ${shortReason}`);

        // Track failed quote fetch
        const step1Latency = Date.now() - step1Start;
        if (typeof performanceMonitor !== 'undefined' && performanceMonitor.trackQuoteFetch) {
          performanceMonitor.trackQuoteFetch(step1Latency, false, false);
        }

        return null;
      }

      // ✅ Step 2: Get ACTUAL quote for sell (tokenA -> tokenB) with CACHING
      let step2Output;
      const step2Start = Date.now();
      try {
        const step2Fee = sellPriceObj.dex.includes('V3')
          ? Math.floor(platformFee2.mul(1000000).toNumber())
          : 3000;

        // Use cache for quote fetching (60-80% hit rate = major speedup!)
        const cacheKey = quoteCache.getCacheKey(
          sellPriceObj.dex,
          sellPriceObj.tokenA.address,
          sellPriceObj.tokenB.address,
          step1Output.toString(),
          step2Fee
        );

        step2Output = await quoteCache.get(
          cacheKey,
          async () => await getQuote(
            sellPriceObj.dex,
            step1Output,
            sellPriceObj.tokenA.address,
            sellPriceObj.tokenB.address,
            step2Fee
          ),
          100 // Estimated latency saved
        );

        if (!step2Output || step2Output === 0n) {
          throw new Error('Zero output from quote');
        }

        if (step2Output < 0n) {
          throw new Error('Negative output from quote (invalid)');
        }

        const step2Latency = Date.now() - step2Start;

        // Track performance
        if (typeof performanceMonitor !== 'undefined' && performanceMonitor.trackQuoteFetch) {
          performanceMonitor.trackQuoteFetch(step2Latency, quoteCache.cache.has(cacheKey), true);
        }

        stats.step2Success++;
      } catch (error) {
        stats.step2Failed++;
        const reason = error.reason || error.message || 'Unknown';
        const shortReason = reason.substring(0, 50);
        stats.step2FailReasons[shortReason] = (stats.step2FailReasons[shortReason] || 0) + 1;
        console.log(`❌ Step2 fail (${pairIndex}): ${shortReason}`);

        // Track failed quote fetch
        const step2Latency = Date.now() - step2Start;
        if (typeof performanceMonitor !== 'undefined' && performanceMonitor.trackQuoteFetch) {
          performanceMonitor.trackQuoteFetch(step2Latency, false, false);
        }

        return null;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ DETAILED TRADE SIMULATION LOGGING
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      console.log(`\n   📊 Full Simulation: ${ethers.formatUnits(inputAmountWei, tokenBDecimals)} ${tokenB}`);

      // Calculate prices
      const buyPrice = Number(step1Output) / Number(inputAmountWei);
      const sellPrice = Number(step1Output) / Number(step2Output);

      console.log(`   📥 Buy:  ${ethers.formatUnits(inputAmountWei, tokenBDecimals)} ${tokenB} → ${ethers.formatUnits(step1Output, tokenADecimals)} ${tokenA}`);
      console.log(`      DEX: ${buyPriceObj.dex}`);
      console.log(`      Price: ${buyPrice.toFixed(6)} ${tokenA}/${tokenB}`);

      console.log(`   📤 Sell: ${ethers.formatUnits(step1Output, tokenADecimals)} ${tokenA} → ${ethers.formatUnits(step2Output, tokenBDecimals)} ${tokenB}`);
      console.log(`      DEX: ${sellPriceObj.dex}`);
      console.log(`      Price: ${sellPrice.toFixed(6)} ${tokenA}/${tokenB}`);

      // ✅ VALIDATION: Reject absurd price ratios
      const outputInputRatio = new Decimal(step2Output.toString()).div(new Decimal(inputAmountWei.toString()));

      if (outputInputRatio.gt(10) || outputInputRatio.lt(0.5)) {
        logger.warn('❌ Rejected: Absurd output/input ratio (possible decimal error)', {
          pair: poolName,
          tokenB: tokenB,
          tokenBDecimals: tokenBDecimals,
          inputAmountWei: inputAmountWei.toString(),
          inputHuman: ethers.formatUnits(inputAmountWei, tokenBDecimals),
          step2Output: step2Output.toString(),
          outputHuman: ethers.formatUnits(step2Output, tokenBDecimals),
          ratio: outputInputRatio.toFixed(4),
          buyDex: buyPriceObj.dex,
          sellDex: sellPriceObj.dex
        });
        return null;
      }

      // ✅ Calculate REAL profit with gas costs (Balancer flash loans are FREE!)
      if (step2Output <= inputAmountWei) {
        stats.unprofitableSkipped++;
        return null;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ✅ DETAILED PROFIT CALCULATION
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Calculate gross profit (output - input)
      const grossProfit = new Decimal(step2Output.toString()).minus(new Decimal(inputAmountWei.toString()));
      const grossProfitPercent = grossProfit.div(new Decimal(inputAmountWei.toString())).mul(100);

      // Estimate gas cost in tokenB (realistic estimate for Balancer flash loan arbitrage)
      // Lowered from 0.003 to 0.001 ETH to match actual gas costs (~$3 at current prices)
      const gasEstimateEth = new Decimal('0.001'); // ~0.001 ETH for arbitrage tx (~$3 at current prices)
      let gasCostInTokenB;

      if (tokenB === 'WETH' || tokenB === 'ETH') {
        // Already in ETH
        gasCostInTokenB = ethers.parseUnits(gasEstimateEth.toString(), tokenBDecimals);
      } else {
        // Convert gas cost to tokenB using price
        const ethPriceInTokenB = new Decimal(buyPriceObj.priceOfBinA); // How much tokenB per ETH
        const gasCostInTokenBHuman = gasEstimateEth.mul(ethPriceInTokenB);
        gasCostInTokenB = ethers.parseUnits(gasCostInTokenBHuman.toFixed(tokenBDecimals), tokenBDecimals);
      }

      // Calculate net profit = gross profit - gas cost (NO flash loan fee with Balancer!)
      const netProfit = grossProfit.minus(gasCostInTokenB.toString());
      const netProfitPercent = netProfit.div(new Decimal(inputAmountWei.toString())).mul(100);

      console.log(`\n   💰 Profit Analysis:`);
      console.log(`      Input:        ${ethers.formatUnits(inputAmountWei, tokenBDecimals)} ${tokenB}`);
      console.log(`      Output:       ${ethers.formatUnits(step2Output, tokenBDecimals)} ${tokenB}`);
      console.log(`      Gross Profit: ${ethers.formatUnits(grossProfit.toString(), tokenBDecimals)} ${tokenB} (${grossProfitPercent.toFixed(3)}%)`);
      console.log(`      Gas Cost:     ${ethers.formatUnits(gasCostInTokenB.toString(), tokenBDecimals)} ${tokenB}`);
      console.log(`      Net Profit:   ${ethers.formatUnits(netProfit.toString(), tokenBDecimals)} ${tokenB} (${netProfitPercent.toFixed(3)}%)`);

      // Reject if not profitable after gas costs
      if (netProfit.lte(0)) {
        console.log(`   ❌ NOT PROFITABLE (net profit <= 0)`);
        stats.unprofitableSkipped++;
        return null;
      }

      console.log(`   ✅ PROFITABLE OPPORTUNITY!`);

      stats.profitableFound++;

      const opportunity = {
        type: 'v3_direct',
        direction: `${tokenB}->${tokenA}->${tokenB}`,
        buyDex: buyPriceObj.dex,
        sellDex: sellPriceObj.dex,
        buyPrice: buyPriceAinB,
        sellPrice: sellPriceAinB,
        pair: poolName,
        tokenA: buyPriceObj.tokenA,
        tokenB: buyPriceObj.tokenB,
        tokenADecimals: tokenADecimals,
        tokenBDecimals: tokenBDecimals,
        fee1: platformFee1,
        fee2: platformFee2,
        amount_in: toTokenUnits(inputAmountHuman, tokenBDecimals),
        amount_out: step2Output.toString(),
        profit: netProfit,
        buyPoolAddress: buyPriceObj.poolAddress,
        sellPoolAddress: sellPriceObj.poolAddress,
        // Add liquidity context for debugging
        liquidityContext: {
          buyPoolLiquidity: buyPriceObj.liquidityInTokenB,
          sellPoolLiquidity: sellPriceObj.liquidityInTokenB,
          inputAsPercentOfBuyLiquidity: new Decimal(inputAmountHuman.toString())
            .div(buyPriceObj.liquidityInTokenB)
            .mul(100)
            .toFixed(2)
        }
      };

      // ✅ VALIDATION: Use validator
      if (!validator.validateDirectArbitrage(opportunity)) {
        logger.warn('❌ Rejected invalid direct arbitrage calculation', {
          pair: poolName,
          buyDex: buyPriceObj.dex,
          sellDex: sellPriceObj.dex,
          amount_in: opportunity.amount_in.toString(),
          amount_out: opportunity.amount_out.toString()
        });
        return null;
      }

      return opportunity;
      });

      // Wait for all pairs in this batch
      return Promise.all(pairPromises);
    });

    // Wait for all concurrent batches to complete
    const concurrentBatchResults = await Promise.all(batchPromises);

    // Flatten and filter results
    concurrentBatchResults.forEach(batchResults => {
      batchResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ PROCESS RESULTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  for (const opportunity of results) {
    if (opportunity.profit && opportunity.profit > MIN_PROFIT_THRESHOLD) {
      await detectAndStoreOpportunity(opportunity);
      opportunities.push(opportunity);
    }
  }

  const detectionTime = Date.now() - startTime;

  return opportunities;
}



/**
 * Process direct arbitrage opportunities with proper liquidity constraints
 */
function calculateOptimalArbitrageAmount(buyPrice, sellPrice, buyLiquidity, sellLiquidity, buyFee, sellFee) {
  const priceBuy = new Decimal(buyPrice);
  const priceSell = new Decimal(sellPrice);
  const liquidityBuy = new Decimal(buyLiquidity.liquidityInTokenB || '0');
  const liquiditySell = new Decimal(sellLiquidity.liquidityInTokenB || '0');

  if (liquidityBuy.lte(0) || liquiditySell.lte(0)) {
    return '0';
  }

  const minLiquidity = Decimal.min(liquidityBuy, liquiditySell);
  const baseAmount = minLiquidity.mul(0.05); // 5% of min liquidity

  const spread = priceSell.minus(priceBuy).div(priceBuy);
  const spreadAdjustment = Decimal.min(spread.mul(10), new Decimal(1));

  const optimalAmount = baseAmount.mul(new Decimal(1).add(spreadAdjustment));

  return Decimal.min(optimalAmount, minLiquidity.mul(0.1)).toString();
}

/**
 * DEBUG VERSION: Process all opportunities and show both profitable and unprofitable
 */
// async function processDirectArbitragePool(poolName, prices, showAll = true) {
//   const opportunities = [];
//   prices.sort((a, b) => new Decimal(a.priceOfAinB).minus(b.priceOfAinB).toNumber());

//   console.log(`\n${'='.repeat(80)}`);
//   console.log(`📊 PROCESSING POOL: ${poolName}`);
//   console.log(`${'='.repeat(80)}`);
//   console.log(`Available DEXs: ${prices.map(p => p.dex).join(', ')}`);

//   let opportunityCount = 0;
//   let skippedLowSpread = 0;
//   let skippedLowLiquidity = 0;
//   let skippedHighImpact = 0;

//   for (let i = 0; i < prices.length - 1; i++) {
//     const buyPriceObj = prices[i];
//     const buyPriceAinB = new Decimal(buyPriceObj.priceOfAinB);

//     if (!buyPriceAinB.isFinite() || buyPriceAinB.lte(0)) {
//       console.log(`⚠️ Skipping ${buyPriceObj.dex} - invalid price`);
//       continue;
//     }

//     if (!buyPriceObj.liquidityData || new Decimal(buyPriceObj.liquidityInTokenB || '0').lte(0)) {
//       console.log(`⚠️ Skipping ${buyPriceObj.dex} - insufficient liquidity`);
//       skippedLowLiquidity++;
//       continue;
//     }

//     for (let j = i + 1; j < prices.length; j++) {
//       const sellPriceObj = prices[j];
//       if (buyPriceObj.dex === sellPriceObj.dex) continue;

//       const sellPriceAinB = new Decimal(sellPriceObj.priceOfAinB);
//       if (!sellPriceAinB.isFinite() || sellPriceAinB.lte(0)) continue;

//       if (!sellPriceObj.liquidityData || new Decimal(sellPriceObj.liquidityInTokenA || '0').lte(0)) {
//         skippedLowLiquidity++;
//         continue;
//       }

//       const spread = sellPriceAinB.minus(buyPriceAinB).div(buyPriceAinB);

//       if (spread.lte(0.0001) && !showAll) {
//         skippedLowSpread++;
//         continue;
//       }

//       opportunityCount++;
//       console.log(`\n${'─'.repeat(80)}`);
//       console.log(`🔍 OPPORTUNITY #${opportunityCount}`);
//       console.log(`${'─'.repeat(80)}`);

//       const tokenA = buyPriceObj.tokenA.symbol;
//       const tokenB = buyPriceObj.tokenB.symbol;
//       const tokenADecimals = normalizeDecimals(buyPriceObj.tokenA.decimals);
//       const tokenBDecimals = normalizeDecimals(buyPriceObj.tokenB.decimals);

//       const platformFee1 = new Decimal(buyPriceObj.fee);
//       const platformFee2 = new Decimal(sellPriceObj.fee);

//       console.log(`Pair: ${tokenA}/${tokenB}`);
//       console.log(`Spread: ${spread.mul(100).toFixed(4)}%`);
//       console.log(`Buy: ${buyPriceObj.dex} at ${buyPriceAinB} (liquidity: ${buyPriceObj.liquidityInTokenB} ${tokenB})`);
//       console.log(`Sell: ${sellPriceObj.dex} at ${sellPriceAinB} (liquidity: ${sellPriceObj.liquidityInTokenA} ${tokenA})`);

//       const optimalAmountCalc = calculateOptimalArbitrageAmount(
//         buyPriceAinB,
//         sellPriceAinB,
//         buyPriceObj.liquidityData,
//         sellPriceObj.liquidityData,
//         platformFee1,
//         platformFee2
//       );

//       const recommendedMaxBuy = new Decimal(buyPriceObj.recommendedMaxTradeInB || optimalAmountCalc);
//       let inputAmountHuman = new Decimal(optimalAmountCalc);
//       inputAmountHuman = Decimal.min(inputAmountHuman, recommendedMaxBuy);

//       console.log(`Calculated optimal trade: ${inputAmountHuman} ${tokenB}`);

//       if (inputAmountHuman.lt(MIN_TRADE_SIZE)) {
//         console.log(`❌ Trade size too small (< ${MIN_TRADE_SIZE}), skipping...`);
//         continue;
//       }

//       const buyImpact = calculatePriceImpact(
//         inputAmountHuman.toString(),
//         buyPriceObj.liquidityData,
//         buyPriceObj.dex.includes('UniswapV3')
//       );

//       console.log(`Buy price impact: ${buyImpact.priceImpact}%`);

//       if (new Decimal(buyImpact.priceImpact).gt(10)) {
//         if (!showAll) {
//           console.log(`❌ Buy price impact too high (${buyImpact.priceImpact}%)`);
//           skippedHighImpact++;
//           continue;
//         } else {
//           console.log(`⚠️ WARNING: Buy price impact very high (${buyImpact.priceImpact}%) - continuing for debug`);
//         }
//       }

//       const amountA_human = inputAmountHuman
//         .mul(new Decimal(1).minus(platformFee1).minus(PRIORITY_FEE))
//         .div(buyPriceAinB);

//       console.log(`After buy: ${amountA_human.toFixed(8)} ${tokenA}`);

//       const sellLiquidityA = new Decimal(sellPriceObj.liquidityInTokenA || '0');
//       if (amountA_human.gt(sellLiquidityA.mul(0.2))) {
//         if (!showAll) {
//           console.log(`❌ Sell amount exceeds 20% of liquidity`);
//           continue;
//         } else {
//           console.log(`⚠️ WARNING: Sell amount exceeds 20% of liquidity - continuing for debug`);
//         }
//       }

//       const sellImpact = calculatePriceImpact(
//         amountA_human.toString(),
//         {
//           liquidityInTokenB: sellPriceObj.liquidityInTokenB,
//           liquidityInTokenA: sellPriceObj.liquidityInTokenA
//         },
//         sellPriceObj.dex.includes('UniswapV3')
//       );

//       console.log(`Sell price impact: ${sellImpact.priceImpact}%`);

//       if (new Decimal(sellImpact.priceImpact).gt(10) && !showAll) {
//         console.log(`❌ Sell price impact too high (${sellImpact.priceImpact}%)`);
//         skippedHighImpact++;
//         continue;
//       }

//       const output_human = amountA_human
//         .mul(new Decimal(1).minus(platformFee2).minus(PRIORITY_FEE))
//         .mul(sellPriceAinB);

//       console.log(`After sell: ${output_human.toFixed(8)} ${tokenB}`);

//       const gasCostETH = await calculateGasCost(wsProvider, 350000);
//       const gasCostWei = ethers.parseEther(gasCostETH.toString());

//       const ethPriceInUSD = new Decimal('4146.96');
//       let tokenBPriceInUSD = new Decimal('1');

//       if (tokenB === 'WBTC') {
//         tokenBPriceInUSD = new Decimal('113753.18');
//       } else if (tokenB === 'WETH' || tokenB === 'ETH') {
//         tokenBPriceInUSD = ethPriceInUSD;
//       } else {
//         tokenBPriceInUSD = deriveTokenPriceInUSD(tokenB, prices);
//       }

//       const gasCost_human = gasWeiToTokenHuman(gasCostWei, ethPriceInUSD, tokenBPriceInUSD);
//       const flashLoanFee_human = inputAmountHuman.mul(MAX_FLASH_LOAN_FEE);

//       const totalPriceImpact = new Decimal(buyImpact.priceImpact)
//         .plus(new Decimal(sellImpact.priceImpact))
//         .div(100);
//       const priceImpactCost_human = inputAmountHuman.mul(totalPriceImpact);

//       const grossProfit_human = output_human.minus(inputAmountHuman);
//       const totalFees_human = gasCost_human.add(flashLoanFee_human).add(priceImpactCost_human);
//       const netProfit_human = grossProfit_human.minus(totalFees_human);

//       // Updated formatting using ethers.formatUnits
//       const inputUnits = toTokenUnits(inputAmountHuman, tokenBDecimals);
//       const amountAUnits = toTokenUnits(amountA_human, tokenADecimals);
//       const outputUnits = toTokenUnits(output_human, tokenBDecimals);
//       const grossProfitUnits = toTokenUnits(grossProfit_human, tokenBDecimals);
//       const gasCostUnits = toTokenUnits(gasCost_human, tokenBDecimals);
//       const flashLoanFeeUnits = toTokenUnits(flashLoanFee_human, tokenBDecimals);
//       const priceImpactCostUnits = toTokenUnits(priceImpactCost_human, tokenBDecimals);
//       const netProfitUnits = toTokenUnits(netProfit_human, tokenBDecimals);

//       const inputFormatted = ethers.formatUnits(inputUnits, tokenBDecimals);
//       const amountAFormatted = ethers.formatUnits(amountAUnits, tokenADecimals);
//       const outputFormatted = ethers.formatUnits(outputUnits, tokenBDecimals);
//       const grossProfitFormatted = ethers.formatUnits(grossProfitUnits, tokenBDecimals);
//       const gasCostFormatted = ethers.formatUnits(gasCostUnits, tokenBDecimals);
//       const flashLoanFeeFormatted = ethers.formatUnits(flashLoanFeeUnits, tokenBDecimals);
//       const priceImpactCostFormatted = ethers.formatUnits(priceImpactCostUnits, tokenBDecimals);
//       const netProfitFormatted = ethers.formatUnits(netProfitUnits, tokenBDecimals);

//       console.log(`\n💰 PROFIT CALCULATION:`);
//       console.log(`   Input: ${inputFormatted} ${tokenB}`);
//       console.log(`   Output: ${outputFormatted} ${tokenB}`);
//       console.log(`   Gross Profit: ${grossProfitFormatted} ${tokenB} (${grossProfit_human.div(inputAmountHuman).mul(100).toFixed(4)}%)`);
//       console.log(`   - Gas Cost: ${gasCostFormatted} ${tokenB}`);
//       console.log(`   - Flash Loan Fee: ${flashLoanFeeFormatted} ${tokenB}`);
//       console.log(`   - Price Impact Cost: ${priceImpactCostFormatted} ${tokenB}`);
//       console.log(`   = Net Profit: ${netProfitFormatted} ${tokenB}`);

//       const isProfitable = netProfit_human.gt(0);
//       console.log(`   ${isProfitable ? '✅ PROFITABLE' : '❌ NOT PROFITABLE'}`);

//       const opportunity = {
//         type: 'v3_direct',
//         poolName,
//         direction: `${tokenB}->${tokenA}->${tokenB}`,
//         buyDex: buyPriceObj.dex,
//         sellDex: sellPriceObj.dex,
//         buyPrice: buyPriceAinB.toString(),
//         sellPrice: sellPriceAinB.toString(),
//         spread: spread.toString(),
//         pair: poolName,
//         tokenA: JSON.stringify(buyPriceObj.tokenA),
//         tokenB: JSON.stringify(buyPriceObj.tokenB),
//         tokenADecimals: tokenADecimals,
//         tokenBDecimals: tokenBDecimals,
//         fee1: platformFee1.toNumber(),
//         fee2: platformFee2.toNumber(),
//         priorityFee: PRIORITY_FEE.toNumber(),

//         buyLiquidity: buyPriceObj.liquidityInTokenB,
//         sellLiquidity: sellPriceObj.liquidityInTokenA,
//         buyPriceImpact: buyImpact.priceImpact,
//         sellPriceImpact: sellImpact.priceImpact,

//         amount_in: toTokenUnits(inputAmountHuman, tokenBDecimals),
//         amount_out: toTokenUnits(output_human, tokenBDecimals),
//         amountA: toTokenUnits(amountA_human, tokenADecimals),

//         gasEstimation: gasCost_human.toString(),
//         flashLoanFee: flashLoanFee_human.toString(),
//         priceImpactCost: priceImpactCost_human.toString(),
//         profit: netProfit_human.toString(),
//         expectedProfit: netProfit_human.toString(),
//         grossProfit: grossProfit_human.toString(),
//         isProfitable: isProfitable,

//         optimalAmountIn: inputAmountHuman.toString(),
//         availableLiquidity: Decimal.min(
//           new Decimal(buyPriceObj.liquidityInTokenB || '0'),
//           new Decimal(sellPriceObj.liquidityInTokenA || '0')
//         ).toString(),

//         formatted: {
//           input: `${inputFormatted} ${tokenB}`,
//           output: `${outputFormatted} ${tokenB}`,
//           grossProfit: `${grossProfitFormatted} ${tokenB}`,
//           netProfit: `${netProfitFormatted} ${tokenB}`,
//           spread: `${spread.mul(100).toFixed(4)}%`,
//           buyPriceImpact: `${buyImpact.priceImpact}%`,
//           sellPriceImpact: `${sellImpact.priceImpact}%`,
//         }
//       };

//       // console.log("opportunity", opportunity);

//       opportunities.push(opportunity);

//       if (isProfitable && !showAll) {
//         console.log(`📝 Storing opportunity...`);
//         await detectAndStoreOpportunity(opportunity);
//       }
//     }
//   }

//   console.log(`\n${'='.repeat(80)}`);
//   console.log(`📈 SUMMARY FOR ${poolName}`);
//   console.log(`${'='.repeat(80)}`);
//   console.log(`Total opportunities analyzed: ${opportunityCount}`);
//   console.log(`Skipped (low spread): ${skippedLowSpread}`);
//   console.log(`Skipped (low liquidity): ${skippedLowLiquidity}`);
//   console.log(`Skipped (high impact): ${skippedHighImpact}`);
//   console.log(`Opportunities found: ${opportunities.length}`);
//   console.log(`Profitable: ${opportunities.filter(o => o.isProfitable).length}`);
//   console.log(`Unprofitable: ${opportunities.filter(o => !o.isProfitable).length}`);
//   console.log(`${'='.repeat(80)}\n`);

//   return opportunities;
// }
// async function crossArbitrageOptimized(allPrices) {
//   const timer = new PerformanceTimer();
//   logToMain('🔍 Starting optimized cross arbitrage analysis');

//   const opportunities = [];
//   const pricesByPool = new Map();

//   // Group by pool and separate V2/V3
//   for (const price of allPrices) {
//     if (!pricesByPool.has(price.poolName)) {
//       pricesByPool.set(price.poolName, { v2: [], v3: [] });
//     }

//     if (price.dex.includes('V3')) {
//       pricesByPool.get(price.poolName).v3.push(price);
//     } else {
//       pricesByPool.get(price.poolName).v2.push(price);
//     }
//   }

//   timer.checkpoint('Cross prices grouped');

//   // Process pools in parallel
//   const poolPromises = Array.from(pricesByPool.entries())
//     .filter(([_, poolData]) => poolData.v2.length > 0 && poolData.v3.length > 0)
//     .map(([poolName, poolData]) =>
//       processCrossArbitragePool(poolName, poolData)
//     );

//   const poolResults = await Promise.allSettled(poolPromises);

//   poolResults.forEach(result => {
//     if (result.status === 'fulfilled' && result.value) {
//       opportunities.push(...result.value);
//     }
//   });

//   timer.checkpoint('Cross arbitrage analysis completed');
//   logToMain(`✅ Found ${opportunities.length} cross arbitrage opportunities`);

//   // Log summary of all cross opportunities
//   if (opportunities.length > 0) {
//     logOpportunitySummary(opportunities);
//   }

//   return opportunities;
// }

// // Process individual pool for cross arbitrage
// async function processCrossArbitragePool(poolName, poolData) {
//   const { v2, v3 } = poolData;
//   const opportunities = [];

//   const bestV2 = v2.reduce((best, current) =>
//     new Decimal(current.priceOfAinB).lt(best.priceOfAinB) ? current : best,
//     { priceOfAinB: new Decimal(Infinity) }
//   );
//   const bestV3 = v3.reduce((best, current) =>
//     new Decimal(current.priceOfAinB).lt(best.priceOfAinB) ? current : best,
//     { priceOfAinB: new Decimal(Infinity) }
//   );

//   const v2PriceAinB = new Decimal(bestV2.priceOfAinB);
//   const v3PriceAinB = new Decimal(bestV3.priceOfAinB);

//   if (!v2PriceAinB.isFinite() || !v3PriceAinB.isFinite() || v2PriceAinB.lte(0) || v3PriceAinB.lte(0)) {
//     logToMain(`Skipping cross arbitrage for ${poolName}: Invalid prices (V2: ${v2PriceAinB}, V3: ${v3PriceAinB})`, 'warn');
//     return opportunities;
//   }

//   const buyPriceObj = v2PriceAinB.lt(v3PriceAinB) ? bestV2 : bestV3;
//   const sellPriceObj = v2PriceAinB.lt(v3PriceAinB) ? bestV3 : bestV2;
//   const buyPriceAinB = v2PriceAinB.lt(v3PriceAinB) ? v2PriceAinB : v3PriceAinB;
//   const sellPriceAinB = v2PriceAinB.lt(v3PriceAinB) ? v3PriceAinB : v2PriceAinB;

//   const spread = sellPriceAinB.minus(buyPriceAinB).div(buyPriceAinB);
//   if (spread.lte(0.001)) {
//     logToMain(`Skipping cross arbitrage for ${poolName}: Spread too low (${spread}%)`, 'debug');
//     return opportunities;
//   }

//   const tokenA = buyPriceObj.tokenA.symbol;
//   const tokenB = buyPriceObj.tokenB.symbol;
//   const tokenADecimals = getTokenDecimals(tokenA);
//   const tokenBDecimals = getTokenDecimals(tokenB);

//   // Use ethers.parseUnits for input amount
//   const inputAmountHuman = '5'; // 5 tokens
//   const optimalInput = new Decimal(ethers.parseUnits(inputAmountHuman, tokenBDecimals).toString());
//   const platformFee1 = new Decimal(buyPriceObj.fee);
//   const platformFee2 = new Decimal(sellPriceObj.fee);

//   // Step 1: Buy A with B
//   const amountA = optimalInput.mul(new Decimal(1).minus(platformFee1).minus(PRIORITY_FEE)).div(buyPriceAinB);
//   // Step 2: Sell A for B
//   const output = amountA.mul(new Decimal(1).minus(platformFee2).minus(PRIORITY_FEE)).mul(sellPriceAinB);
//   const gasCostETH = await calculateGasCost(wsProvider, 350000)
//   const gasCostWei = ethers.parseEther(gasCostETH.toString());

//   // Convert gas cost to token decimals (assuming tokenB has different decimals than ETH)
//   // If tokenB is not ETH, you need to convert using ETH/tokenB price
//   let gasCost;
//   if (tokenB === 'ETH' || tokenB === 'WETH') {
//     // Direct conversion for ETH
//     gasCost = new Decimal(gasCostWei.toString());
//   } else {
//     // For other tokens, you need ETH price in tokenB terms
//     // This is a simplified approach - you might need actual price conversion
//     const ethPriceInTokenB = new Decimal('2600'); // ETH price in USD, adjust as needed
//     const tokenBPriceInUSD = new Decimal('1'); // Adjust based on actual tokenB price
//     const ethPriceInTokenB_ratio = ethPriceInTokenB.div(tokenBPriceInUSD);

//     gasCost = new Decimal(gasCostWei.toString()).mul(ethPriceInTokenB_ratio);
//   }

//   const grossProfit = output.minus(optimalInput);
//   const netProfit = grossProfit.minus(gasCost);

//   // Format amounts for logging
//   const inputFormatted = ethers.formatUnits(optimalInput.toFixed(0), tokenBDecimals);
//   const amountAFormatted = ethers.formatUnits(amountA.toFixed(0), tokenADecimals);
//   const outputFormatted = ethers.formatUnits(output.toFixed(0), tokenBDecimals);
//   const grossProfitFormatted = ethers.formatUnits(grossProfit.toFixed(0), tokenBDecimals);
//   const gasCostFormatted = ethers.formatUnits(gasCost.toFixed(0), tokenBDecimals);
//   const netProfitFormatted = ethers.formatUnits(netProfit.toFixed(0), tokenBDecimals);

//   const opportunity = {
//     type: 'v3_cross',
//     poolName,
//     direction: `${tokenA}->${tokenB}->${tokenA}`,
//     buyDex: buyPriceObj.dex,
//     sellDex: sellPriceObj.dex,
//     buyPrice: buyPriceAinB,
//     sellPrice: sellPriceAinB,
//     pair: poolName,
//     amount_in: optimalInput.toString(),
//     amount_out: output.toFixed(0),
//     amountA: amountA.toFixed(0),
//     outputFormatted,
//     inputFormatted,
//     amountAFormatted,
//     gasEstimation: gasCost,
//     profit: netProfit,
//     grossProfit: grossProfit,
//     grossProfitFormatted,
//     isProfitable: netProfit.gt(0),
//     formatted: {
//       input: `${inputFormatted} ${tokenB}`,
//       buyToken: `${tokenA} on ${buyPriceObj.dex} at ${buyPriceAinB}`,
//       platformFee1: `${platformFee1.mul(100)}%`,
//       priorityFee: `${PRIORITY_FEE.mul(100)}%`,
//       outputAmount: `${amountAFormatted} ${tokenA}`,
//       sellToken: `${tokenA} on ${sellPriceObj.dex} at ${sellPriceAinB}`,
//       platformFee2: `${platformFee2.mul(100)}%`,
//       outputAmountBack: `${outputFormatted} ${tokenB}`,
//       grossProfit: `${grossProfitFormatted} ${tokenB}`,
//       gasCost: `${gasCostFormatted} ${tokenB}`,
//       netProfit: `${netProfitFormatted} ${tokenB}`,
//     }
//   };

//   // Log all opportunities, profitable or not
//   console.log(
//     `\n🔄 Cross Arbitrage Opportunity`,
//     `\n  Pair: ${tokenA}/${tokenB}`,
//     `\n  Start: ${inputFormatted} ${tokenB} (${optimalInput} wei)`,
//     `\n  Step 1: Buy ${tokenA} on ${buyPriceObj.dex} at ${buyPriceAinB} ${tokenB}/${tokenA}`,
//     `\n    Platform Fee: ${platformFee1.mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%`,
//     `\n    Output: ${amountAFormatted} ${tokenA}`,
//     `\n  Step 2: Sell ${tokenA} on ${sellPriceObj.dex} at ${sellPriceAinB} ${tokenB}/${tokenA}`,
//     `\n    Platform Fee: ${platformFee2.mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%`,
//     `\n    Output: ${outputFormatted} ${tokenB}`,
//     `\n  Gross Profit: ${grossProfitFormatted} ${tokenB}`,
//     `\n  Gas Cost: ${gasCostFormatted} ${tokenB}`,
//     `\n  Net Profit: ${netProfitFormatted} ${tokenB}`,
//     `\n  Profitable: ${netProfit.gt(0) ? '✅ YES' : '❌ NO'}`
//   );

//   // logCrossArbitrageOpportunity(opportunity);

//   const dbId = await storeOpportunityInDB(opportunity);
//   opportunity.dbId = dbId;
//   opportunities.push(opportunity);

//   return opportunities;
// }
// OPTIMIZED TRIANGULAR ARBITRAGE - Using efficient graph algorithms
async function triangularArbitrageOptimized(allPrices) {
  const timer = new PerformanceTimer();
  logToMain('🔍 Starting optimized triangular arbitrage analysis');

  console.log(`Starting with ${allPrices.length} price data points`);

  const { graph, edgeDetails } = buildOptimizedGraph(allPrices);
  timer.checkpoint('Graph built');

  const topTokens = identifyTopTokens(allPrices);
  console.log(`Top tokens: ${topTokens.slice(0, 10).join(', ')}`);
  timer.checkpoint('Top tokens identified');

  const maxCycles = 100;
  const cycles = [];

  for (const token of topTokens.slice(0, 10)) { // Limit starting tokens for debugging
    if (!graph.has(token)) {
      console.log(`Token ${token} not found in graph`);
      continue;
    }

    console.log(`Searching cycles starting from ${token}`);
    const visited = new Set();
    visited.add(token);

    findCyclesDFS(
      token,
      graph,
      0,
      [token],
      new Decimal(1),
      visited,
      cycles,
      maxCycles,
      edgeDetails,
      []
    );

    console.log(`Found ${cycles.length} cycles so far`);
    if (cycles.length >= maxCycles) break;
  }

  timer.checkpoint('Cycles found');
  console.log(`Total cycles found: ${cycles.length}`);

  const opportunities = [];
  for (const cycle of cycles) {
    const opportunity = await processCycle(cycle, allPrices);
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }

  timer.checkpoint('Cycles processed');
  logToMain(`✅ Found ${opportunities.length} triangular arbitrage opportunities`);

  return opportunities;
}
// Build optimized graph with pre-filtering
function buildOptimizedGraph(allPrices) {
  const graph = new Map();
  const tokenLiquidity = new Map();
  const edgeDetails = new Map(); // Store complete edge information

  // Pre-calculate token liquidity
  for (const price of allPrices) {
    const liquidity = new Decimal(price.liquidity || 0);

    tokenLiquidity.set(price.tokenA.symbol,
      (tokenLiquidity.get(price.tokenA.symbol) || new Decimal(0)).add(liquidity));
    tokenLiquidity.set(price.tokenB.symbol,
      (tokenLiquidity.get(price.tokenB.symbol) || new Decimal(0)).add(liquidity));
  }

  // Filter tokens by liquidity
  const liquidTokens = new Set();
  for (const [token, liquidity] of tokenLiquidity) {
    if (liquidity.gte(MIN_LIQUIDITY)) {
      liquidTokens.add(token);
    }
  }

  console.log(`Building graph with ${liquidTokens.size} liquid tokens`);

  // Build bidirectional graph with proper exchange rates
  for (const price of allPrices) {
    if (!liquidTokens.has(price.tokenA.symbol) || !liquidTokens.has(price.tokenB.symbol)) {
      continue;
    }

    // Initialize graph nodes
    if (!graph.has(price.tokenA.symbol)) {
      graph.set(price.tokenA.symbol, []);
    }
    if (!graph.has(price.tokenB.symbol)) {
      graph.set(price.tokenB.symbol, []);
    }

    const priceOfAinB = new Decimal(price.priceOfAinB);
    const priceOfBinA = new Decimal(price.priceOfBinA);

    if (!priceOfAinB.isFinite() || !priceOfBinA.isFinite() ||
      priceOfAinB.lte(0) || priceOfBinA.lte(0)) {
      continue;
    }

    // Calculate exchange rates (how much you get for 1 unit)
    // If priceOfAinB = 2000 (1 ETH = 2000 USDC), then exchangeRate = 2000 USDC per ETH
    const exchangeRateAtoB = priceOfAinB; // A -> B: how much B you get for 1 A
    const exchangeRateBtoA = priceOfBinA; // B -> A: how much A you get for 1 B

    // A -> B edge
    const edgeKeyAB = `${price.tokenA.symbol}->${price.tokenB.symbol}-${price.dex}`;
    const edgeAB = {
      token: price.tokenB.symbol,
      dex: price.dex,
      rate: exchangeRateAtoB.toNumber(),
      poolAddress: price.poolAddress,
      fee: new Decimal(price.fee).toNumber(),
      liquidity: new Decimal(price.liquidity || 0).toNumber(),
      fromToken: price.tokenA.symbol,
      toToken: price.tokenB.symbol
    };

    graph.get(price.tokenA.symbol).push(edgeAB);
    edgeDetails.set(edgeKeyAB, {
      ...price,
      exchangeRate: exchangeRateAtoB,
      direction: 'AtoB'
    });

    // B -> A edge
    const edgeKeyBA = `${price.tokenB.symbol}->${price.tokenA.symbol}-${price.dex}`;
    const edgeBA = {
      token: price.tokenA.symbol,
      dex: price.dex,
      rate: exchangeRateBtoA.toNumber(),
      poolAddress: price.poolAddress,
      fee: new Decimal(price.fee).toNumber(),
      liquidity: new Decimal(price.liquidity || 0).toNumber(),
      fromToken: price.tokenB.symbol,
      toToken: price.tokenA.symbol
    };

    graph.get(price.tokenB.symbol).push(edgeBA);
    edgeDetails.set(edgeKeyBA, {
      ...price,
      exchangeRate: exchangeRateBtoA,
      direction: 'BtoA'
    });
  }

  // Sort edges by liquidity and limit branching
  for (const [token, edges] of graph) {
    edges.sort((a, b) => b.liquidity - a.liquidity);
    if (edges.length > MAX_BRANCHING) {
      graph.set(token, edges.slice(0, MAX_BRANCHING));
    }
  }

  console.log(`Graph built with ${graph.size} nodes`);
  for (const [token, edges] of graph) {
    console.log(`${token}: ${edges.length} edges`);
  }

  return { graph, edgeDetails };
}

// Get top liquid tokens efficiently
function getTopLiquidTokens(allPrices) {
  const tokenLiquidity = new Map();

  for (const price of allPrices) {
    const liquidity = new Decimal(price.liquidity || 0);

    tokenLiquidity.set(price.tokenA.symbol,
      (tokenLiquidity.get(price.tokenA.symbol) || new Decimal(0)).add(liquidity));
    tokenLiquidity.set(price.tokenB.symbol,
      (tokenLiquidity.get(price.tokenB.symbol) || new Decimal(0)).add(liquidity));
  }

  return Array.from(tokenLiquidity.entries())
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .map(([token]) => token);
}

// Optimized cycle detection using DFS with pruning
async function findCyclesOptimized(graph, tokens) {
  const cycles = [];
  const maxCyclesPerToken = 5; // Limit cycles per token

  for (const startToken of tokens) {
    if (!graph.has(startToken)) continue;

    const tokenCycles = [];
    findCyclesDFS(startToken, graph, 0, [startToken], new Decimal(1),
      new Set([startToken]), tokenCycles, maxCyclesPerToken);

    cycles.push(...tokenCycles);

    if (cycles.length > MAX_TRIANGULAR_COMBINATIONS) break;
  }

  return cycles.slice(0, MAX_TRIANGULAR_COMBINATIONS);
}

// Optimized DFS with aggressive pruning
function findCyclesDFS(currentToken, graph, depth, path, currentRate, visited, cycles, maxCycles, edgeDetails, edges = []) {
  if (depth >= MAX_DEPTH || cycles.length >= maxCycles) return;

  // More reasonable threshold for finding cycles - look for any positive return
  if (currentRate.lte(0.9)) return; // Only eliminate clearly unprofitable paths

  const nodeEdges = graph.get(currentToken) || [];

  for (const edge of nodeEdges) {
    const nextToken = edge.token;
    const rate = new Decimal(edge.rate);

    if (!rate.isFinite() || rate.lte(0)) {
      continue;
    }

    // Account for fees in rate calculation
    const feeMultiplier = new Decimal(1).minus(edge.fee).minus(PRIORITY_FEE);
    const effectiveRate = rate.mul(feeMultiplier);
    const newRate = currentRate.mul(effectiveRate);

    // Check if we've completed a cycle
    if (nextToken === path[0] && depth >= 2 && newRate.gt(1.001)) { // 0.1% minimum profit
      const cycle = {
        path: [...path, nextToken],
        rate: newRate.toNumber(),
        dexes: [...edges.map(e => e.dex), edge.dex],
        poolAddresses: [...edges.map(e => e.poolAddress), edge.poolAddress],
        fees: [...edges.map(e => new Decimal(e.fee)), new Decimal(edge.fee)],
        edges: [...edges, edge]
      };

      cycles.push(cycle);
      console.log(`Found cycle: ${cycle.path.join(' -> ')} with effective rate ${newRate.toFixed(6)}`);

      if (cycles.length >= maxCycles) return;
    }
    // Continue building path if not visited and within depth limit
    else if (depth < MAX_DEPTH - 1 && !visited.has(nextToken)) {
      visited.add(nextToken);
      findCyclesDFS(
        nextToken,
        graph,
        depth + 1,
        [...path, nextToken],
        newRate,
        visited,
        cycles,
        maxCycles,
        edgeDetails,
        [...edges, edge]
      );
      visited.delete(nextToken);
    }
  }
}

// Process individual cycle
// async function processCycle(cycle, allPrices) {
//   try {
//     const startToken = cycle.path[0];
//     const startDecimals = getTokenDecimals(startToken);

//     const inputAmountHuman = '5';
//     const inputAmount = new Decimal(ethers.parseUnits(inputAmountHuman, startDecimals).toString());
//     let amount = inputAmount;
//     const amounts = [amount];
//     const amountsFormatted = [ethers.formatUnits(amount.toFixed(0), startDecimals)];
//     const stepFees = [];
//     const stepFeesFormatted = [];
//     const direction = [];
//     let totalFee = new Decimal(0);

//     for (let i = 0; i < cycle.path.length - 1; i++) {
//       const fromToken = cycle.path[i];
//       const toToken = cycle.path[i + 1];
//       const dex = cycle.dexes[i];
//       const poolAddress = cycle.poolAddresses[i];
//       const platformFee = new Decimal(cycle.fees[i]);
//       const toDecimals = getTokenDecimals(toToken);

//       const priceData = allPrices.find(p =>
//         p.poolAddress.toLowerCase() === poolAddress.toLowerCase() &&
//         p.tokenA.symbol === fromToken && p.tokenB.symbol === toToken
//       );

//       if (!priceData) {
//         logToMain(`Skipping cycle step ${fromToken} -> ${toToken} on ${dex}: No price data`, 'warn');
//         return null;
//       }

//       const rate = new Decimal(priceData.priceOfAinB);
//       if (!rate.isFinite() || rate.lte(0)) {
//         logToMain(`Skipping cycle step ${fromToken} -> ${toToken} on ${dex}: Invalid rate (${rate})`, 'warn');
//         return null;
//       }

//       const amountBeforeFee = amount.mul(rate);
//       const stepPlatformFee = amountBeforeFee.mul(platformFee);
//       const stepPriorityFee = amountBeforeFee.mul(PRIORITY_FEE);
//       const stepTotalFee = stepPlatformFee.add(stepPriorityFee);
//       amount = amountBeforeFee.minus(stepTotalFee);
//       amounts.push(amount);
//       amountsFormatted.push(ethers.formatUnits(amount.toFixed(0), toDecimals));
//       stepFees.push(stepTotalFee);
//       stepFeesFormatted.push(ethers.formatUnits(stepTotalFee.toFixed(0), toDecimals));
//       totalFee = totalFee.add(stepTotalFee);
//       direction.push(`Step ${i + 1}: ${fromToken} -> ${toToken} on ${dex}`);
//     }

//     // Calculate costs
//     const gasCostETH = await calculateGasCost(wsProvider, 350000);
//     const gasCostWei = ethers.parseEther(gasCostETH.toString());

//     // Flash loan fee on the initial borrowed amount
//     const flashLoanFee = inputAmount.mul(MAX_FLASH_LOAN_FEE);

//     // Convert gas cost to start token terms
//     let gasCost;
//     if (startToken === 'ETH' || startToken === 'WETH') {
//       gasCost = new Decimal(gasCostWei.toString());
//     } else {
//       const ethPriceInUSD = new Decimal('2600');
//       const tokenPriceInUSD = deriveTokenPriceInUSD(startToken, allPrices);
//       gasCost = new Decimal(gasCostWei.toString())
//         .mul(ethPriceInUSD)
//         .div(tokenPriceInUSD)
//         .div(new Decimal(10).pow(18 - startDecimals));
//     }

//     const grossProfit = amounts[amounts.length - 1].minus(inputAmount);
//     const totalCosts = gasCost.add(flashLoanFee);
//     const netProfit = grossProfit.minus(totalCosts);

//     const totalFeeFormatted = ethers.formatUnits(totalFee.toFixed(0), startDecimals);
//     const gasCostFormatted = ethers.formatUnits(gasCost.toFixed(0), startDecimals);
//     const flashLoanFeeFormatted = ethers.formatUnits(flashLoanFee.toFixed(0), startDecimals);
//     const grossProfitFormatted = ethers.formatUnits(grossProfit.toFixed(0), startDecimals);
//     const netProfitFormatted = ethers.formatUnits(netProfit.toFixed(0), startDecimals);

//     const opportunity = {
//       type: 'v3_triangular',
//       cycle: cycle.path.join(' -> '),
//       pair: cycle.path.join('/'),
//       direction,
//       path: cycle.path,
//       dexes: cycle.dexes,
//       fees: stepFees.map(f => f),
//       feesFormatted: stepFeesFormatted,
//       totalFees: totalFee,
//       totalFeesFormatted: totalFeeFormatted,
//       gasEstimation: gasCost,
//       gasEstimationFormatted: gasCostFormatted,
//       flashLoanFee: flashLoanFee, // Add flash loan fee
//       flashLoanFeeFormatted: flashLoanFeeFormatted,
//       profit: netProfit,
//       grossProfit,
//       grossProfitFormatted,
//       netProfitFormatted,
//       isProfitable: netProfit.gt(0),
//       amounts: amounts.map(a => a),
//       amountsFormatted,
//       estimatedRate: amounts[amounts.length - 1].div(inputAmount),
//       amount_in: inputAmount.toString(),
//       amount_out: amounts[amounts.length - 1].toFixed(0),
//       buyDex: cycle.dexes[0],
//       sellDex: cycle.dexes[cycle.dexes.length - 1],
//       buyPrice: amounts[1].div(inputAmount),
//       sellPrice: amounts[amounts.length - 1].div(amounts[amounts.length - 2]),
//       inputFormatted: amountsFormatted[0],
//       outputFormatted: amountsFormatted[amountsFormatted.length - 1],
//       amountAFormatted: amountsFormatted[1] || amountsFormatted[0]
//     };

//     console.log(
//       `\n🔺 Triangular Arbitrage Opportunity`,
//       `\n  Cycle: ${cycle.path.join(' -> ')}`,
//       `\n  Start: ${amountsFormatted[0]} ${startToken} (${inputAmount} wei)`,
//       ...direction.map((dir, i) =>
//         `\n  ${dir}` +
//         `\n    Amount In: ${amountsFormatted[i]} ${cycle.path[i]}` +
//         `\n    Platform Fee: ${cycle.fees[i].mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%` +
//         `\n    Fees: ${stepFeesFormatted[i]} ${cycle.path[i + 1]}` +
//         `\n    Amount Out: ${amountsFormatted[i + 1]} ${cycle.path[i + 1]}`
//       ),
//       `\n  Final Output: ${amountsFormatted[amounts.length - 1]} ${startToken}`,
//       `\n  Gross Profit: ${grossProfitFormatted} ${startToken}`,
//       `\n  Total DEX Fees: ${totalFeeFormatted} ${startToken}`,
//       `\n  Gas Cost: ${gasCostFormatted} ${startToken}`,
//       `\n  Flash Loan Fee: ${flashLoanFeeFormatted} ${startToken} (${MAX_FLASH_LOAN_FEE.mul(100)}%)`,
//       `\n  Net Profit: ${netProfitFormatted} ${startToken}`,
//       `\n  Profitable: ${netProfit.gt(0) ? '✅ YES' : '❌ NO'}`
//     );

//     const dbId = await storeOpportunityInDB(opportunity);
//     opportunity.dbId = dbId;

//     return opportunity;
//   } catch (error) {
//     logToMain(`Error processing cycle ${cycle.path.join(' -> ')}: ${error.message}`, 'warn');
//     return null;
//   }
// }


async function processCycle(cycle, allPrices) {
  try {
    const startToken = cycle.path[0];
    const startDecimals = getTokenDecimals(startToken);

    // Dynamic input based on USD equivalent
    const ethPriceUSD = new Decimal('4146.96');
    const startTokenPriceUSD = deriveTokenPriceInUSD(startToken, allPrices);
    const inputAmountHuman = INPUT_AMOUNT_USD.div(startTokenPriceUSD);
    const inputAmount = new Decimal(ethers.parseUnits(inputAmountHuman.toFixed(startDecimals), startDecimals).toString());
    let amount = inputAmount;
    const amounts = [amount];
    const amountsFormatted = [inputAmountHuman.toFixed(startDecimals > 6 ? 6 : startDecimals)];
    const stepFees = [];
    const stepFeesFormatted = [];
    const direction = [];
    let totalFee = new Decimal(0);

    for (let i = 0; i < cycle.path.length - 1; i++) {
      const fromToken = cycle.path[i];
      const toToken = cycle.path[i + 1];
      const dex = cycle.dexes[i];
      const poolAddress = cycle.poolAddresses[i];
      const platformFee = new Decimal(cycle.fees[i]);
      const toDecimals = getTokenDecimals(toToken);

      const priceData = allPrices.find(p =>
        p.poolAddress.toLowerCase() === poolAddress.toLowerCase() &&
        p.tokenA.symbol === fromToken && p.tokenB.symbol === toToken
      );

      if (!priceData) {
        logToMain(`Skipping cycle step ${fromToken} -> ${toToken} on ${dex}: No price data`, 'warn');
        return null;
      }

      const rate = new Decimal(priceData.priceOfAinB);
      if (!rate.isFinite() || rate.lte(0)) {
        logToMain(`Skipping cycle step ${fromToken} -> ${toToken} on ${dex}: Invalid rate (${rate})`, 'warn');
        return null;
      }

      const amountBeforeFee = amount.mul(rate);
      const stepPlatformFee = amountBeforeFee.mul(platformFee);
      const stepPriorityFee = amountBeforeFee.mul(PRIORITY_FEE);
      const stepTotalFee = stepPlatformFee.add(stepPriorityFee);
      amount = amountBeforeFee.minus(stepTotalFee);
      amounts.push(amount);
      amountsFormatted.push(ethers.formatUnits(amount.toFixed(0), toDecimals));
      stepFees.push(stepTotalFee);
      stepFeesFormatted.push(ethers.formatUnits(stepTotalFee.toFixed(0), toDecimals));
      totalFee = totalFee.add(stepTotalFee);
      direction.push(`Step ${i + 1}: ${fromToken} -> ${toToken} on ${dex}`);
    }

    // Calculate costs
    const gasCostETH = await calculateGasCost(wsProvider, 350000);
    const gasCostWei = ethers.parseEther(gasCostETH.toString());

    // Flash loan fee on the initial borrowed amount
    const flashLoanFee = inputAmount.mul(MAX_FLASH_LOAN_FEE);

    // Convert gas cost to start token terms
    let gasCost;
    if (startToken === 'ETH' || startToken === 'WETH') {
      gasCost = new Decimal(gasCostWei.toString());
    } else {
      const ethPriceInUSD = ethPriceUSD;
      const tokenPriceInUSD = startTokenPriceUSD;
      gasCost = new Decimal(gasCostWei.toString())
        .mul(ethPriceInUSD)
        .div(tokenPriceInUSD)
        .div(new Decimal(10).pow(18 - startDecimals));
    }

    const grossProfit = amounts[amounts.length - 1].minus(inputAmount);
    const totalCosts = gasCost.add(flashLoanFee);
    const netProfit = grossProfit.minus(totalCosts);

    const totalFeeFormatted = ethers.formatUnits(totalFee.toFixed(0), startDecimals);
    const gasCostFormatted = ethers.formatUnits(gasCost.toFixed(0), startDecimals);
    const flashLoanFeeFormatted = ethers.formatUnits(flashLoanFee.toFixed(0), startDecimals);
    const grossProfitFormatted = ethers.formatUnits(grossProfit.toFixed(0), startDecimals);
    const netProfitFormatted = ethers.formatUnits(netProfit.toFixed(0), startDecimals);

    const opportunity = {
      type: 'v3_triangular',
      cycle: cycle.path.join(' -> '),
      pair: cycle.path.join('/'),
      direction,
      path: cycle.path,
      dexes: cycle.dexes,
      fees: stepFees.map(f => f),
      feesFormatted: stepFeesFormatted,
      totalFees: totalFee,
      totalFeesFormatted: totalFeeFormatted,
      gasEstimation: gasCost,
      gasEstimationFormatted: gasCostFormatted,
      flashLoanFee: flashLoanFee, // Add flash loan fee
      flashLoanFeeFormatted: flashLoanFeeFormatted,
      profit: netProfit,
      grossProfit,
      grossProfitFormatted,
      netProfitFormatted,
      isProfitable: netProfit.gt(0),
      amounts: amounts.map(a => a),
      amountsFormatted,
      estimatedRate: amounts[amounts.length - 1].div(inputAmount),
      amount_in: inputAmount.toString(),
      amount_out: amounts[amounts.length - 1].toFixed(0),
      buyDex: cycle.dexes[0],
      sellDex: cycle.dexes[cycle.dexes.length - 1],
      buyPrice: amounts[1].div(inputAmount),
      sellPrice: amounts[amounts.length - 1].div(amounts[amounts.length - 2]),
      inputFormatted: amountsFormatted[0],
      outputFormatted: amountsFormatted[amountsFormatted.length - 1],
      amountAFormatted: amountsFormatted[1] || amountsFormatted[0]
    };

    // ✅ VALIDATION: Validate triangular path
    const isValidPath = validateTriangularPath(
      amounts[1], // step1Output (first intermediate amount)
      amounts[amounts.length - 1], // final output
      inputAmount,
      cycle.path
    );

    if (!isValidPath) {
      logger.warn('❌ Rejected invalid triangular path calculation', {
        path: cycle.path.join(' -> '),
        input: inputAmountHuman.toString(),
        amounts: amounts.map(a => a.toString())
      });
      return null; // Don't save this opportunity
    }

    // ✅ VALIDATION: Use validator to validate opportunity
    if (!validator.validateTriangularArbitrage(opportunity)) {
      logger.warn('❌ Rejected invalid triangular arbitrage', {
        path: cycle.path.join(' -> '),
        netProfit: netProfit.toString()
      });
      return null;
    }

    console.log(
      `\n🔺 Triangular Arbitrage Opportunity`,
      `\n  Cycle: ${cycle.path.join(' -> ')}`,
      `\n  Start: ${amountsFormatted[0]} ${startToken} (${inputAmount} wei)`,
      ...direction.map((dir, i) =>
        `\n  ${dir}` +
        `\n    Amount In: ${amountsFormatted[i]} ${cycle.path[i]}` +
        `\n    Platform Fee: ${cycle.fees[i].mul(100)}% | Priority Fee: ${PRIORITY_FEE.mul(100)}%` +
        `\n    Fees: ${stepFeesFormatted[i]} ${cycle.path[i + 1]}` +
        `\n    Amount Out: ${amountsFormatted[i + 1]} ${cycle.path[i + 1]}`
      ),
      `\n  Final Output: ${amountsFormatted[amounts.length - 1]} ${startToken}`,
      `\n  Gross Profit: ${grossProfitFormatted} ${startToken}`,
      `\n  Total DEX Fees: ${totalFeeFormatted} ${startToken}`,
      `\n  Gas Cost: ${gasCostFormatted} ${startToken}`,
      `\n  Flash Loan Fee: ${flashLoanFeeFormatted} ${startToken} (${MAX_FLASH_LOAN_FEE.mul(100)}%)`,
      `\n  Net Profit: ${netProfitFormatted} ${startToken}`,
      `\n  Profitable: ${netProfit.gt(0) ? '✅ YES' : '❌ NO'}`
    );

    const dbId = await storeOpportunityInDB(opportunity);
    opportunity.dbId = dbId;

    return opportunity;
  } catch (error) {
    logToMain(`Error processing cycle ${cycle.path.join(' -> ')}: ${error.message}`, 'warn');
    return null;
  }
}

// Helper functions
async function convertToTokenAmount(amountInDAI, tokenSymbol, priceData) {
  if (tokenSymbol === 'DAI') return new Decimal(amountInDAI);

  try {
    const priceOfTokenInDAI = tokenSymbol === priceData.tokenA.symbol
      ? new Decimal(priceData.priceOfBinA)
      : new Decimal(priceData.priceOfAinB);

    if (!priceOfTokenInDAI.isFinite() || priceOfTokenInDAI.lte(0)) {
      return INPUT_AMOUNT;
    }

    const tokenAmount = new Decimal(amountInDAI).div(priceOfTokenInDAI);
    return tokenAmount.isFinite() ? tokenAmount : INPUT_AMOUNT;
  } catch (error) {
    return INPUT_AMOUNT;
  }
}

// Helper function to derive token price in USD
// function deriveTokenPriceInUSD(tokenSymbol, allPrices) {
//   // Try to find a price against a stable coin
//   const stableCoins = ['USDC', 'USDT', 'DAI'];

//   for (const stable of stableCoins) {
//     const priceData = allPrices.find(p => 
//       (p.tokenA.symbol === tokenSymbol && p.tokenB.symbol === stable) ||
//       (p.tokenB.symbol === tokenSymbol && p.tokenA.symbol === stable)
//     );

//     if (priceData) {
//       if (priceData.tokenA.symbol === tokenSymbol) {
//         return new Decimal(priceData.priceOfAinB);
//       } else {
//         return new Decimal(priceData.priceOfBinA);
//       }
//     }
//   }

//   // If no direct stable pair found, try through ETH
//   const ethPrice = allPrices.find(p => 
//     (p.tokenA.symbol === tokenSymbol && p.tokenB.symbol === 'WETH') ||
//     (p.tokenB.symbol === tokenSymbol && p.tokenA.symbol === 'WETH')
//   );

//   if (ethPrice) {
//     const ethPriceInUSD = new Decimal('4100'); // You should get this from a price feed
//     if (ethPrice.tokenA.symbol === tokenSymbol) {
//       return new Decimal(ethPrice.priceOfAinB).mul(ethPriceInUSD);
//     } else {
//       return new Decimal(ethPrice.priceOfBinA).mul(ethPriceInUSD);
//     }
//   }

//   // Default fallback
//   return new Decimal('1');
// }

// async function calculateGasCost(provider, totalGasUsed) {
//   const feeData = await provider.getFeeData();
//   const gasPriceWei = feeData.gasPrice; // Keep in wei
//   const gasCostWei = BigInt(totalGasUsed) * gasPriceWei;

//   let gasCostEther = ethers.formatEther(gasCostWei);

//   return gasCostEther.toString(); // Return as string to work with Decimal
// }

async function getV2Rate(poolAddress) {
  // Simplified rate calculation - implement actual V2 rate fetching
  return new Decimal(1.001); // Mock rate
}

async function getV3Rate(poolAddress) {
  // Simplified rate calculation - implement actual V3 rate fetching
  return new Decimal(1.001); // Mock rate
}

function identifyTopTokens(allPrices) {
  const tokenLiquidity = new Map();

  for (const price of allPrices) {
    const liquidity = new Decimal(price.liquidity || 0);

    tokenLiquidity.set(price.tokenA.symbol,
      (tokenLiquidity.get(price.tokenA.symbol) || new Decimal(0)).add(liquidity));
    tokenLiquidity.set(price.tokenB.symbol,
      (tokenLiquidity.get(price.tokenB.symbol) || new Decimal(0)).add(liquidity));
  }

  return Array.from(tokenLiquidity.entries())
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .map(([token]) => token)
    .slice(0, TOP_TOKENS_LIMIT);
}

// MAIN OPTIMIZED ARBITRAGE ENGINE
async function runArbitrageEngine(pairs, blockNumber = 0, provider = null) {
  // Initialize provider if not already done
  if (provider && !wsProvider) {
    initializeProvider(provider);
  } else if (!wsProvider) {
    throw new Error('Provider not initialized. Pass provider to runArbitrageEngine()');
  }

  if (isProcessing) {
    logToMain(`⏭️ Skipping block ${blockNumber} - analysis in progress`, 'warn');
    return [];
  }

  isProcessing = true;
  const timer = new PerformanceTimer();

  try {
    logToMain(`🚀 Starting optimized arbitrage analysis for block ${blockNumber}`);
    const allPrices = await fetchAllPricesOptimized1(pairs);

    if (allPrices.length === 0) {
      logToMain('⚠️ No prices fetched, skipping analysis');
      return [];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DEBUG INFO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const v2Pools = allPrices.filter(p => !p.dex.includes('V3'));
    const v3Pools = allPrices.filter(p => p.dex.includes('V3'));

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEBUG INFO:
Total Pools: ${allPrices.length}
V2 Pools: ${v2Pools.length}
V3 Pools: ${v3Pools.length}
Min Profit Threshold: ${MIN_PROFIT_THRESHOLD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    // Pair groups ko count karo
    let pair = {};
    allPrices.forEach(p => {
      const key = p.poolName || `${p.tokenA.symbol}/${p.tokenB.symbol}`;
      if (!pair[key]) pair[key] = [];
      pair[key].push(p);
    });

    const pairsWithMultiplePools = Object.values(pair).filter(p => p.length >= 2).length;
    console.log(`Pairs with 2+ pools: ${pairsWithMultiplePools}`);

    // console.log("----------------allPrices", allPrices)

    const [directOpps, triangularOpps] = await Promise.all([

      directArbitrageOptimized(allPrices),
      // crossArbitrageOptimized(allPrices),
      // triangularArbitrageOptimized(allPrices),
    ]);

    const allOpportunities = [...directOpps];

    timer.checkpoint('All analyses completed');

    const profitable = allOpportunities.filter(o => o.isProfitable).length;
    const unprofitable = allOpportunities.length - profitable;
    const totalProfit = allOpportunities.reduce((sum, o) => sum.add(o.profit), new Decimal(0));
    const totalGrossProfit = allOpportunities.reduce((sum, o) => sum.add(o.grossProfit), new Decimal(0));

    console.log('\n🎯🎯🎯 FINAL ARBITRAGE ANALYSIS SUMMARY 🎯🎯🎯');
    console.log('═'.repeat(80));
    console.log(`📊 TOTAL OPPORTUNITIES FOUND: ${allOpportunities.length}`);
    console.log(`   📈 Direct Arbitrage: ${directOpps.length}`);
    // console.log(`   🔄 Cross Arbitrage: ${crossOpps.length}`);
    // console.log(`   🔺 Triangular Arbitrage: ${triangularOpps.length}`);
    console.log(`💰 FINANCIAL OVERVIEW:`);
    console.log(`   💎 Total Net Profit: ${totalProfit}`);
    console.log(`   📊 Total Gross Profit: ${totalGrossProfit}`);
    console.log(`   ✅ Profitable Opportunities: ${profitable}`);
    console.log(`   ❌ Unprofitable Opportunities: ${unprofitable}`);
    console.log(`⏱️ PERFORMANCE:`);
    console.log(`   🚀 Total Analysis Time: ${timer.getTotalTime()}ms`);
    console.log(`   📈 Average Time per Opportunity: ${allOpportunities.length ? timer.getTotalTime() / allOpportunities.length : 0}ms`);
    console.log('═'.repeat(80));

    if (allOpportunities.length > 0) {
      const bestOpportunity = allOpportunities.reduce((best, current) =>
        current.profit.gt(best.profit) ? current : best
      );
      console.log(`🏆 BEST OPPORTUNITY:`);
      console.log(`   Type: ${bestOpportunity.type}`);
      console.log(`   Profit: ${bestOpportunity.profit}`);
      console.log(`   Pair/Cycle: ${bestOpportunity.pair || bestOpportunity.cycle}`);
      console.log('═'.repeat(80));
    }

    return allOpportunities;

  } catch (error) {
    logToMain(`❌ Error in arbitrage engine: ${error.message}`, 'error');
    return [];
  } finally {
    isProcessing = false;
  }
}

// runArbitrageEngine(DIRECT_SWAP_PAIRS)

export {
  // fetchAllPricesOptimized as fetchAllPrices,
  directArbitrageOptimized as directArbitrage,
  // crossArbitrageOptimized as crossArbitrage,
  triangularArbitrageOptimized as triangularArbitrage,
  runArbitrageEngine,
  initializeProvider,
  transformOpportunityForDB,
};