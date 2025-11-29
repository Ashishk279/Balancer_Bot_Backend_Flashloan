// ═══════════════════════════════════════════════════════════════════════════════
// SWAP EVENT WORKER - Listens to swap events on all pools
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from 'ethers';
import { parentPort } from 'worker_threads';
import { POOLS_CONFIG } from '../config/pools.js';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const WS_URL = process.env.ETH_WS_URL || 'ws://127.0.0.1:8546';
const HTTP_URL = process.env.ETH_HTTP_URL || 'http://127.0.0.1:8545';
const MIN_SWAP_VALUE_USD = Number(process.env.MIN_SWAP_VALUE_USD) || 10000; // $10,000 default

// ─────────────────────────────────────────────────────────────────────────────
// ABIs
// ─────────────────────────────────────────────────────────────────────────────

const SWAP_EVENT_ABI_V2 = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
];

const SWAP_EVENT_ABI_V3 = [
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
];

const PAIR_ABI_V2 = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

const POOL_ABI_V3 = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SwapEventWorker {
  constructor() {
    this.wsProvider = null;
    this.httpProvider = null;
    this.subscribedPools = new Map();
    this.priceCache = new Map();
    this.isRunning = false;
    this.stats = {
      swapsDetected: 0,
      opportunitiesFound: 0,
      totalProfit: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async initialize() {
    console.log('🚀 Initializing Swap Event Worker...\n');

    try {
      // Create WebSocket provider
      this.wsProvider = new ethers.WebSocketProvider(WS_URL);
      this.httpProvider = new ethers.JsonRpcProvider(HTTP_URL);

      // Wait for connection
      await this.wsProvider.ready;
      console.log('✅ WebSocket connected\n');

      // Subscribe to all pools
      await this.subscribeToAllPools();

      this.isRunning = true;
      console.log('\n🎯 Swap Event Worker is now ACTIVE!\n');
      console.log('═'.repeat(60));

      // Stats logging every 30 seconds
      setInterval(() => this.logStats(), 30000);

      // Send ready signal to parent
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_READY', worker: 'swapEvent' });
      }

    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_ERROR', worker: 'swapEvent', error: error.message });
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIBE TO POOLS
  // ═══════════════════════════════════════════════════════════════════════════

  async subscribeToAllPools() {
    console.log('📡 Subscribing to swap events...\n');

    for (const [poolName, poolConfig] of Object.entries(POOLS_CONFIG)) {
      try {
        await this.subscribeToPool(poolName, poolConfig);
        console.log(`   ✅ ${poolName}`);
      } catch (error) {
        console.log(`   ❌ ${poolName}: ${error.message}`);
      }
    }
  }

  async subscribeToPool(poolName, poolConfig) {
    const { address, version } = poolConfig;
    const abi = version === 'V3' ? SWAP_EVENT_ABI_V3 : SWAP_EVENT_ABI_V2;

    const contract = new ethers.Contract(address, abi, this.wsProvider);

    // Subscribe to Swap events
    contract.on('Swap', async (...args) => {
      const event = args[args.length - 1]; // Last arg is event object
      await this.handleSwapEvent(poolName, poolConfig, args, event);
    });

    this.subscribedPools.set(poolName, { contract, config: poolConfig });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLE SWAP EVENT - MAIN LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  async handleSwapEvent(poolName, poolConfig, args, event) {
    const startTime = Date.now();
    this.stats.swapsDetected++;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Parse swap details
      // ─────────────────────────────────────────────────────────────────────
      const swapDetails = this.parseSwapEvent(poolConfig, args);

      // Filter small swaps (less than MIN_SWAP_VALUE_USD)
      if (swapDetails.valueUSD < MIN_SWAP_VALUE_USD) {
        return; // Too small, ignore
      }

      console.log(`\n⚡ SWAP DETECTED on ${poolName}`);
      console.log(`   💰 Value: $${swapDetails.valueUSD.toLocaleString()}`);
      console.log(`   📊 Direction: ${swapDetails.direction}`);

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Get prices from OTHER pools (parallel)
      // ─────────────────────────────────────────────────────────────────────
      const tokenPair = this.getTokenPairKey(poolConfig);
      const otherPools = this.getOtherPoolsForPair(tokenPair, poolName);

      if (otherPools.length === 0) {
        console.log(`   ⏭️  No other pools for this pair`);
        return;
      }

      // Fetch all prices in parallel
      const pricePromises = otherPools.map(p =>
        this.getPoolPrice(p.name, p.config)
      );

      const [sourcePrice, ...otherPrices] = await Promise.all([
        this.getPoolPrice(poolName, poolConfig),
        ...pricePromises
      ]);

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Find arbitrage opportunities
      // ─────────────────────────────────────────────────────────────────────
      for (let i = 0; i < otherPools.length; i++) {
        const otherPool = otherPools[i];
        const otherPrice = otherPrices[i];

        if (!sourcePrice || !otherPrice) continue;

        const spread = this.calculateSpread(sourcePrice, otherPrice);
        const minSpread = this.calculateMinProfitableSpread(poolConfig.fee, otherPool.config.fee);

        console.log(`   📈 ${poolName} vs ${otherPool.name}: ${spread.toFixed(4)}% (min: ${minSpread.toFixed(4)}%)`);

        if (spread > minSpread) {
          // OPPORTUNITY FOUND!
          this.stats.opportunitiesFound++;

          const opportunity = {
            type: 'SWAP_EVENT_ARB',
            timestamp: Date.now(),
            sourcePool: {
              name: poolName,
              address: poolConfig.address,
              price: sourcePrice,
              dex: poolConfig.dex
            },
            targetPool: {
              name: otherPool.name,
              address: otherPool.config.address,
              price: otherPrice,
              dex: otherPool.config.dex
            },
            spread: spread,
            minSpread: minSpread,
            netSpread: spread - minSpread,
            swapDetails: swapDetails,
            tokens: {
              token0: poolConfig.token0,
              token1: poolConfig.token1
            },
            blockNumber: event.blockNumber
          };

          console.log(`\n   🎯 ══════════════════════════════════════════`);
          console.log(`   🎯 ARBITRAGE OPPORTUNITY FOUND!`);
          console.log(`   🎯 ══════════════════════════════════════════`);
          console.log(`   🎯 Buy on:  ${opportunity.targetPool.dex} @ ${otherPrice.toFixed(6)}`);
          console.log(`   🎯 Sell on: ${opportunity.sourcePool.dex} @ ${sourcePrice.toFixed(6)}`);
          console.log(`   🎯 Spread:  ${spread.toFixed(4)}%`);
          console.log(`   🎯 Net:     ${opportunity.netSpread.toFixed(4)}%`);
          console.log(`   🎯 ══════════════════════════════════════════\n`);

          // Send to parent thread for execution
          if (parentPort) {
            parentPort.postMessage({
              type: 'OPPORTUNITY',
              data: opportunity
            });
          }
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`   ⏱️  Processed in ${processingTime}ms`);

    } catch (error) {
      console.error(`   ❌ Error processing swap: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  parseSwapEvent(poolConfig, args) {
    const { version, token0, token1 } = poolConfig;

    if (version === 'V3') {
      const [sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick] = args;

      const amt0 = Number(ethers.formatUnits(amount0 < 0 ? -amount0 : amount0, token0.decimals));
      const amt1 = Number(ethers.formatUnits(amount1 < 0 ? -amount1 : amount1, token1.decimals));

      return {
        amount0: amt0,
        amount1: amt1,
        direction: amount0 > 0 ? `SELL ${token0.symbol}` : `BUY ${token0.symbol}`,
        valueUSD: this.estimateValueUSD(token0, amt0, token1, amt1)
      };
    } else {
      const [sender, amount0In, amount1In, amount0Out, amount1Out, to] = args;

      const amt0In = Number(ethers.formatUnits(amount0In, token0.decimals));
      const amt1In = Number(ethers.formatUnits(amount1In, token1.decimals));
      const amt0Out = Number(ethers.formatUnits(amount0Out, token0.decimals));
      const amt1Out = Number(ethers.formatUnits(amount1Out, token1.decimals));

      return {
        amount0In: amt0In,
        amount1In: amt1In,
        amount0Out: amt0Out,
        amount1Out: amt1Out,
        direction: amt0In > 0 ? `SELL ${token0.symbol}` : `SELL ${token1.symbol}`,
        valueUSD: this.estimateValueUSD(token0, amt0In || amt0Out, token1, amt1In || amt1Out)
      };
    }
  }

  estimateValueUSD(token0, amt0, token1, amt1) {
    // Simple USD estimation (assumes stablecoins = $1, ETH = $3000)
    const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD'];

    if (stablecoins.includes(token0.symbol)) {
      return amt0;
    } else if (stablecoins.includes(token1.symbol)) {
      return amt1;
    } else if (token0.symbol === 'WETH' || token0.symbol === 'ETH') {
      return amt0 * 3000; // Rough estimate
    } else if (token1.symbol === 'WETH' || token1.symbol === 'ETH') {
      return amt1 * 3000;
    }
    return 0;
  }

  async getPoolPrice(poolName, poolConfig) {
    const { address, version, token0, token1 } = poolConfig;

    try {
      if (version === 'V3') {
        const pool = new ethers.Contract(address, POOL_ABI_V3, this.httpProvider);
        const slot0 = await pool.slot0();
        const sqrtPriceX96 = slot0.sqrtPriceX96;

        // Calculate price from sqrtPriceX96
        const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
        const adjustedPrice = price * (10 ** (token0.decimals - token1.decimals));

        return adjustedPrice;
      } else {
        const pair = new ethers.Contract(address, PAIR_ABI_V2, this.httpProvider);
        const reserves = await pair.getReserves();

        const reserve0 = Number(ethers.formatUnits(reserves[0], token0.decimals));
        const reserve1 = Number(ethers.formatUnits(reserves[1], token1.decimals));

        return reserve1 / reserve0; // Price of token0 in terms of token1
      }
    } catch (error) {
      console.error(`   ❌ Price fetch failed for ${poolName}: ${error.message}`);
      return null;
    }
  }

  getTokenPairKey(poolConfig) {
    const { token0, token1 } = poolConfig;
    const sorted = [token0.address, token1.address].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  getOtherPoolsForPair(tokenPairKey, excludePoolName) {
    const otherPools = [];

    for (const [poolName, { config }] of this.subscribedPools) {
      if (poolName === excludePoolName) continue;

      const pairKey = this.getTokenPairKey(config);
      if (pairKey === tokenPairKey) {
        otherPools.push({ name: poolName, config });
      }
    }

    return otherPools;
  }

  calculateSpread(price1, price2) {
    return Math.abs(price1 - price2) / Math.min(price1, price2) * 100;
  }

  calculateMinProfitableSpread(fee1, fee2) {
    // Minimum spread = both DEX fees + estimated gas cost + margin
    const totalFees = (fee1 + fee2) * 100; // Convert to percentage
    const gasEstimate = 0.15; // ~0.15% for gas
    const margin = 0.1; // 0.1% safety margin

    return totalFees + gasEstimate + margin;
  }

  logStats() {
    console.log(`\n📊 ═══════════════════════════════════════════`);
    console.log(`📊 SWAP EVENT WORKER STATS (Last 30s)`);
    console.log(`📊 ═══════════════════════════════════════════`);
    console.log(`📊 Swaps Detected:      ${this.stats.swapsDetected}`);
    console.log(`📊 Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`📊 Pools Monitored:     ${this.subscribedPools.size}`);
    console.log(`📊 ═══════════════════════════════════════════\n`);

    // Reset counters
    this.stats.swapsDetected = 0;
    this.stats.opportunitiesFound = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// START WORKER
// ─────────────────────────────────────────────────────────────────────────────

const worker = new SwapEventWorker();
worker.initialize().catch(console.error);

export default SwapEventWorker;
