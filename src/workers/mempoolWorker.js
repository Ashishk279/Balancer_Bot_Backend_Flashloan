// ═══════════════════════════════════════════════════════════════════════════════
// MEMPOOL WORKER - Monitors pending transactions for large swaps
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from 'ethers';
import { parentPort } from 'worker_threads';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const WS_URL = process.env.ETH_WS_URL || 'ws://127.0.0.1:8546';
const HTTP_URL = process.env.ETH_HTTP_URL || 'http://127.0.0.1:8545';

// Minimum swap value to track (in USD)
const MIN_SWAP_VALUE_USD = Number(process.env.MIN_SWAP_VALUE_USD) || 10000; // $10,000

// DEX Router addresses
const DEX_ROUTERS = {
  'UniswapV2': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  'UniswapV3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  'UniswapV3_Router2': '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  'SushiSwap': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  'PancakeSwap': '0xEfF92A263d31888d860bD50809A8D171709b7b1c'
};

// Router method signatures for swap detection
const SWAP_SIGNATURES = {
  // UniswapV2 / SushiSwap
  'swapExactETHForTokens': '0x7ff36ab5',
  'swapETHForExactTokens': '0xfb3bdb41',
  'swapExactTokensForETH': '0x18cbafe5',
  'swapTokensForExactETH': '0x4a25d94a',
  'swapExactTokensForTokens': '0x38ed1739',
  'swapTokensForExactTokens': '0x8803dbee',

  // UniswapV3
  'exactInputSingle': '0x414bf389',
  'exactInput': '0xc04b8d59',
  'exactOutputSingle': '0xdb3e2198',
  'exactOutput': '0xf28c0498',

  // Multicall (V3 Router2)
  'multicall': '0xac9650d8',
  'multicall_deadline': '0x5ae401dc'
};

// Token addresses for price estimation
const TOKENS = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
};

// ─────────────────────────────────────────────────────────────────────────────
// ABIs for decoding
// ─────────────────────────────────────────────────────────────────────────────

const UNISWAP_V2_ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

const UNISWAP_V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)',
  'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)'
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASS
// ─────────────────────────────────────────────────────────────────────────────

class MempoolWorker {
  constructor() {
    this.wsProvider = null;
    this.httpProvider = null;
    this.isRunning = false;
    this.processedTxs = new Set(); // Avoid processing same tx twice
    this.routerInterfaces = {};
    this.ethPrice = 3000; // Default ETH price, update periodically

    this.stats = {
      totalTxsSeen: 0,
      dexTxsFound: 0,
      largeTxsFound: 0,
      opportunitiesFound: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async initialize() {
    console.log('🚀 Initializing Mempool Worker...\n');

    try {
      // Create providers
      this.wsProvider = new ethers.WebSocketProvider(WS_URL);
      this.httpProvider = new ethers.JsonRpcProvider(HTTP_URL);

      await this.wsProvider.ready;
      console.log('✅ WebSocket connected\n');

      // Initialize router interfaces for decoding
      this.initializeRouterInterfaces();

      // Update ETH price
      await this.updateEthPrice();
      setInterval(() => this.updateEthPrice(), 60000); // Update every minute

      // Start monitoring
      this.startMempoolMonitoring();

      this.isRunning = true;
      console.log('\n🎯 Mempool Worker is now ACTIVE!\n');
      console.log('═'.repeat(60));

      // Stats logging
      setInterval(() => this.logStats(), 30000);

      // Send ready signal to parent
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_READY', worker: 'mempool' });
      }

    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      if (parentPort) {
        parentPort.postMessage({ type: 'WORKER_ERROR', worker: 'mempool', error: error.message });
      }
      throw error;
    }
  }

  initializeRouterInterfaces() {
    // Create ethers interfaces for decoding
    this.routerInterfaces = {
      v2: new ethers.Interface(UNISWAP_V2_ROUTER_ABI),
      v3: new ethers.Interface(UNISWAP_V3_ROUTER_ABI)
    };
  }

  async updateEthPrice() {
    try {
      // Use Chainlink price feed
      const priceFeed = new ethers.Contract(
        '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD Chainlink
        ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'],
        this.httpProvider
      );
      const [, price] = await priceFeed.latestRoundData();
      this.ethPrice = Number(ethers.formatUnits(price, 8));
      console.log(`📊 ETH Price updated: $${this.ethPrice.toFixed(2)}`);
    } catch (error) {
      console.log('⚠️  ETH price update failed, using default');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMPOOL MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  startMempoolMonitoring() {
    console.log('📡 Starting mempool monitoring...');
    console.log('   Watching for pending transactions...\n');

    // Subscribe to pending transactions
    this.wsProvider.on('pending', async (txHash) => {
      await this.processPendingTx(txHash);
    });
  }

  async processPendingTx(txHash) {
    // Skip if already processed
    if (this.processedTxs.has(txHash)) return;
    this.processedTxs.add(txHash);

    // Cleanup old processed txs (keep last 10000)
    if (this.processedTxs.size > 10000) {
      const arr = Array.from(this.processedTxs);
      this.processedTxs = new Set(arr.slice(-5000));
    }

    this.stats.totalTxsSeen++;

    try {
      // Get transaction details
      const tx = await this.wsProvider.getTransaction(txHash);

      if (!tx || !tx.to) return;

      // Check if it's a DEX transaction
      const routerName = this.identifyRouter(tx.to);
      if (!routerName) return;

      this.stats.dexTxsFound++;

      // Decode and analyze the swap
      const swapDetails = await this.decodeSwapTransaction(tx, routerName);
      if (!swapDetails) return;

      // Check if it's a large swap
      if (swapDetails.valueUSD < MIN_SWAP_VALUE_USD) return;

      this.stats.largeTxsFound++;

      console.log(`\n⚡ ════════════════════════════════════════════════════`);
      console.log(`⚡ LARGE PENDING SWAP DETECTED!`);
      console.log(`⚡ ════════════════════════════════════════════════════`);
      console.log(`⚡ TxHash:    ${txHash.slice(0, 20)}...`);
      console.log(`⚡ Router:    ${routerName}`);
      console.log(`⚡ Type:      ${swapDetails.type}`);
      console.log(`⚡ Value:     $${swapDetails.valueUSD.toLocaleString()}`);
      console.log(`⚡ TokenIn:   ${swapDetails.tokenIn}`);
      console.log(`⚡ TokenOut:  ${swapDetails.tokenOut}`);
      console.log(`⚡ AmountIn:  ${swapDetails.amountIn}`);
      console.log(`⚡ Gas Price: ${ethers.formatUnits(tx.gasPrice || tx.maxFeePerGas || 0, 'gwei')} gwei`);

      // Calculate potential price impact
      const priceImpact = await this.estimatePriceImpact(swapDetails);
      console.log(`⚡ Est. Impact: ${priceImpact.toFixed(4)}%`);

      if (priceImpact > 0.3) { // Significant price impact
        console.log(`⚡ ════════════════════════════════════════════════════`);
        console.log(`⚡ 🎯 POTENTIAL BACKRUN OPPORTUNITY!`);
        console.log(`⚡ ════════════════════════════════════════════════════\n`);

        this.stats.opportunitiesFound++;

        // Send to parent for bundle creation
        if (parentPort) {
          // Serialize only essential tx data (avoid circular references)
          const serializedTx = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: tx.value?.toString() || '0',
            gasLimit: tx.gasLimit?.toString() || '0',
            gasPrice: tx.gasPrice?.toString() || null,
            maxFeePerGas: tx.maxFeePerGas?.toString() || null,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() || null,
            nonce: tx.nonce,
            chainId: tx.chainId
          };

          parentPort.postMessage({
            type: 'MEMPOOL_OPPORTUNITY',
            data: {
              txHash: txHash,
              rawTx: serializedTx,
              router: routerName,
              swap: swapDetails,
              priceImpact: priceImpact,
              timestamp: Date.now()
            }
          });
        }
      }

    } catch (error) {
      // Silent fail for most errors (tx might be replaced or mined)
      if (!error.message.includes('not found')) {
        // Uncomment for debugging
        // console.error(`Error processing tx: ${error.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION DECODING
  // ═══════════════════════════════════════════════════════════════════════════

  identifyRouter(toAddress) {
    const normalized = toAddress.toLowerCase();

    for (const [name, address] of Object.entries(DEX_ROUTERS)) {
      if (address.toLowerCase() === normalized) {
        return name;
      }
    }
    return null;
  }

  async decodeSwapTransaction(tx, routerName) {
    try {
      const methodId = tx.data.slice(0, 10);

      // Identify swap type
      let swapType = null;
      for (const [name, sig] of Object.entries(SWAP_SIGNATURES)) {
        if (methodId === sig) {
          swapType = name;
          break;
        }
      }

      if (!swapType) return null;

      // Decode based on router type
      let decoded;

      if (routerName.includes('V3')) {
        decoded = this.decodeV3Swap(tx.data, swapType, tx.value);
      } else {
        decoded = this.decodeV2Swap(tx.data, swapType, tx.value);
      }

      if (!decoded) return null;

      // Estimate USD value
      const valueUSD = this.estimateSwapValueUSD(decoded, tx.value);

      return {
        type: swapType,
        ...decoded,
        valueUSD: valueUSD,
        gasPrice: tx.gasPrice || tx.maxFeePerGas
      };

    } catch (error) {
      return null;
    }
  }

  decodeV2Swap(data, swapType, value) {
    try {
      const iface = this.routerInterfaces.v2;
      const decoded = iface.parseTransaction({ data, value });

      if (!decoded) return null;

      const args = decoded.args;

      switch (swapType) {
        case 'swapExactETHForTokens':
        case 'swapETHForExactTokens':
          return {
            tokenIn: 'ETH',
            tokenOut: args.path[args.path.length - 1],
            amountIn: ethers.formatEther(value),
            path: args.path
          };

        case 'swapExactTokensForETH':
        case 'swapTokensForExactETH':
          return {
            tokenIn: args.path[0],
            tokenOut: 'ETH',
            amountIn: args.amountIn ? ethers.formatUnits(args.amountIn, 18) : 'unknown',
            path: args.path
          };

        case 'swapExactTokensForTokens':
        case 'swapTokensForExactTokens':
          return {
            tokenIn: args.path[0],
            tokenOut: args.path[args.path.length - 1],
            amountIn: args.amountIn ? ethers.formatUnits(args.amountIn, 18) : 'unknown',
            path: args.path
          };

        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  decodeV3Swap(data, swapType, value) {
    try {
      const iface = this.routerInterfaces.v3;
      const decoded = iface.parseTransaction({ data, value });

      if (!decoded) return null;

      const args = decoded.args;

      switch (swapType) {
        case 'exactInputSingle':
          const params = args[0];
          return {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: ethers.formatUnits(params.amountIn, 18),
            fee: Number(params.fee)
          };

        case 'exactInput':
          // Path is encoded, simplified decoding
          return {
            tokenIn: 'encoded',
            tokenOut: 'encoded',
            amountIn: ethers.formatUnits(args[0].amountIn, 18)
          };

        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  estimateSwapValueUSD(decoded, txValue) {
    // Simple estimation
    if (decoded.tokenIn === 'ETH') {
      return Number(ethers.formatEther(txValue)) * this.ethPrice;
    }

    // Check if tokenIn is a stablecoin
    const stablecoins = [TOKENS.USDC, TOKENS.USDT, TOKENS.DAI];
    if (stablecoins.includes(decoded.tokenIn?.toLowerCase())) {
      return Number(decoded.amountIn);
    }

    // Default: use amountIn * rough estimate
    return Number(decoded.amountIn) * this.ethPrice;
  }

  async estimatePriceImpact(swapDetails) {
    // Simplified price impact estimation
    // In production, you'd simulate against actual pool reserves

    const valueUSD = swapDetails.valueUSD;

    // Rough estimation based on typical pool sizes
    // $100K in typical pool = ~0.5% impact
    // $1M = ~5% impact

    const estimatedImpact = (valueUSD / 200000) * 100; // Rough formula
    return Math.min(estimatedImpact, 50); // Cap at 50%
  }

  logStats() {
    console.log(`\n📊 ═══════════════════════════════════════════`);
    console.log(`📊 MEMPOOL WORKER STATS (Last 30s)`);
    console.log(`📊 ═══════════════════════════════════════════`);
    console.log(`📊 Total Txs Seen:       ${this.stats.totalTxsSeen}`);
    console.log(`📊 DEX Txs Found:        ${this.stats.dexTxsFound}`);
    console.log(`📊 Large Txs (>$${MIN_SWAP_VALUE_USD.toLocaleString()}):    ${this.stats.largeTxsFound}`);
    console.log(`📊 Opportunities:        ${this.stats.opportunitiesFound}`);
    console.log(`📊 ETH Price:            $${this.ethPrice.toFixed(2)}`);
    console.log(`📊 ═══════════════════════════════════════════\n`);

    // Reset counters
    this.stats.totalTxsSeen = 0;
    this.stats.dexTxsFound = 0;
    this.stats.largeTxsFound = 0;
    this.stats.opportunitiesFound = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// START WORKER
// ─────────────────────────────────────────────────────────────────────────────

const worker = new MempoolWorker();
worker.initialize().catch(console.error);

export default MempoolWorker;
