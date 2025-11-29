/**
 * Parallel Processing Configuration for 95% Success Rate
 * Optimized for Local Ethereum Node
 */

export const PARALLEL_CONFIG = {
    // ==================== RPC CONFIGURATION ====================
    RPC: {
        // Local Ethereum node (primary - ultra low latency)
        LOCAL_NODE: {
            HTTP_URL: process.env.LOCAL_NODE_HTTP || 'http://127.0.0.1:8545',
            WS_URL: process.env.LOCAL_NODE_WS || 'ws://127.0.0.1:8546',
            PRIORITY: 1000, // Highest priority
            TIMEOUT: 5000,  // 5 second timeout
        },

        // Backup remote nodes (fallback only)
        BACKUP_NODES: {
            ALCHEMY: {
                URL: process.env.ALCHEMY_URL || '',
                PRIORITY: 10,
                TIMEOUT: 10000,
            },
            QUICKNODE: {
                URL: process.env.QUICKNODE_URL || '',
                PRIORITY: 10,
                TIMEOUT: 10000,
            },
            INFURA: {
                URL: process.env.INFURA_URL || '',
                PRIORITY: 5,
                TIMEOUT: 10000,
            }
        },

        // RPC strategy: 'localFirst' | 'fastest' | 'parallelValidate'
        DEFAULT_STRATEGY: 'localFirst',

        // Health check interval (ms)
        HEALTH_CHECK_INTERVAL: 30000,

        // Retry failed provider after (ms)
        RETRY_FAILED_AFTER: 60000,
    },

    // ==================== QUOTE FETCHING ====================
    QUOTE_FETCHING: {
        // Enable parallel quote fetching
        ENABLE_PARALLEL: true,

        // Max concurrent quote requests
        MAX_CONCURRENT: 50,

        // Batch size for quote requests
        BATCH_SIZE: 20,

        // Delay between batches (ms) - prevent RPC overload
        BATCH_DELAY: 50,

        // Fetch buy and sell quotes in parallel (not sequential)
        PARALLEL_BUY_SELL: true,

        // Quote cache settings
        CACHE: {
            ENABLED: true,
            TTL: 2000, // 2 seconds (less than 1 block time)
            MAX_SIZE: 10000, // Max cached quotes
            AUTO_CLEANUP: true,
        },
    },

    // ==================== OPPORTUNITY ANALYSIS ====================
    ANALYSIS: {
        // Enable parallel pair combination checking
        ENABLE_PARALLEL_PAIRS: true,

        // Max concurrent pair analysis
        MAX_CONCURRENT_PAIRS: 100,

        // Delay between pair batches (ms)
        PAIR_BATCH_DELAY: 50,

        // Timeout for full analysis (ms)
        ANALYSIS_TIMEOUT: 1500, // Reduced from 2000ms

        // Enable aggressive optimization
        AGGRESSIVE_MODE: true,
    },

    // ==================== EXECUTION LAYER ====================
    EXECUTION: {
        // Number of parallel execution workers
        NUM_WORKERS: 5,

        // Worker sleep time when no opportunities (ms)
        WORKER_SLEEP: 500,

        // Max opportunities in execution queue
        MAX_QUEUE_SIZE: 20,

        // Execute multiple opportunities per block
        MULTI_EXECUTE_PER_BLOCK: true,

        // Timeout for transaction confirmation (ms)
        CONFIRMATION_TIMEOUT: 45000, // 45 seconds

        // Enable fast nonce management
        FAST_NONCE_MANAGEMENT: true,
    },

    // ==================== VALIDATION ====================
    VALIDATION: {
        // Combine validation steps in parallel
        PARALLEL_VALIDATION: true,

        // Skip redundant validations
        SKIP_REDUNDANT: true,

        // Validation timeout (ms)
        TIMEOUT: 1000,

        // Min profit threshold (ETH)
        MIN_PROFIT: 0.0001,
    },

    // ==================== GAS OPTIMIZATION ====================
    GAS: {
        // Enable gas oracle for prediction
        ENABLE_ORACLE: true,

        // Gas oracle update interval (ms)
        ORACLE_UPDATE_INTERVAL: 3000, // Every 3 seconds

        // History size for gas prediction
        HISTORY_SIZE: 50,

        // Priority fee calculation
        PRIORITY_FEE: {
            // Percentage of profit to use as priority fee
            PROFIT_PERCENTAGE: 5, // 5% of expected profit

            // Minimum priority fee (Gwei)
            MIN: 2,

            // Maximum priority fee (Gwei)
            MAX: 50,

            // Aggressive mode (compete harder)
            AGGRESSIVE: true,
        },

        // Gas limit buffer percentage
        GAS_LIMIT_BUFFER: 30, // 30% buffer
    },

    // ==================== FLASHBOTS ====================
    FLASHBOTS: {
        // Enable Flashbots for private transactions
        ENABLED: process.env.ENABLE_FLASHBOTS === 'true',

        // Flashbots relay URL
        RELAY_URL: 'https://relay.flashbots.net',

        // Target blocks ahead
        TARGET_BLOCKS_AHEAD: 2,

        // Max blocks to try
        MAX_BLOCKS: 3,

        // Min profit for Flashbots (ETH)
        MIN_PROFIT: 0.001, // Higher threshold for Flashbots

        // Fallback to public mempool if Flashbots fails
        FALLBACK_TO_PUBLIC: true,
    },

    // ==================== PERFORMANCE MONITORING ====================
    MONITORING: {
        // Enable performance logging
        ENABLED: true,

        // Log slow operations (ms threshold)
        LOG_SLOW_OPERATIONS: true,
        SLOW_THRESHOLD: 500,

        // Log statistics interval (ms)
        STATS_INTERVAL: 60000, // Every minute

        // Track latency metrics
        TRACK_LATENCY: true,

        // Track success rates
        TRACK_SUCCESS_RATE: true,
    },

    // ==================== ADVANCED FEATURES ====================
    ADVANCED: {
        // Use mempool monitoring for early detection
        MEMPOOL_MONITORING: true,

        // Monitor pending transactions
        MONITOR_PENDING_TX: true,

        // Use EIP-1559 transaction type
        USE_EIP1559: true,

        // Enable sandwich attack protection
        SANDWICH_PROTECTION: true,

        // Minimum block confirmations for finality
        MIN_CONFIRMATIONS: 1,
    },
};

// Helper function to validate configuration
export function validateConfig() {
    const errors = [];

    // Check local node URL
    if (!PARALLEL_CONFIG.RPC.LOCAL_NODE.HTTP_URL) {
        errors.push('LOCAL_NODE_HTTP URL is required');
    }

    if (!PARALLEL_CONFIG.RPC.LOCAL_NODE.WS_URL) {
        errors.push('LOCAL_NODE_WS URL is required');
    }

    // Warn if no backup nodes configured
    const hasBackup = Object.values(PARALLEL_CONFIG.RPC.BACKUP_NODES)
        .some(node => node.URL && node.URL.length > 0);

    if (!hasBackup) {
        console.warn('⚠️  No backup RPC nodes configured. System will fail if local node goes down.');
    }

    // Check Flashbots configuration
    if (PARALLEL_CONFIG.FLASHBOTS.ENABLED && !process.env.FLASHBOTS_AUTH_KEY) {
        errors.push('FLASHBOTS_AUTH_KEY is required when Flashbots is enabled');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }

    console.log('✅ Parallel processing configuration validated successfully');
    return true;
}

// Export individual sections for easy access
export const RPC_CONFIG = PARALLEL_CONFIG.RPC;
export const QUOTE_CONFIG = PARALLEL_CONFIG.QUOTE_FETCHING;
export const ANALYSIS_CONFIG = PARALLEL_CONFIG.ANALYSIS;
export const EXECUTION_CONFIG = PARALLEL_CONFIG.EXECUTION;
export const GAS_CONFIG = PARALLEL_CONFIG.GAS;
export const FLASHBOTS_CONFIG = PARALLEL_CONFIG.FLASHBOTS;
export const MONITORING_CONFIG = PARALLEL_CONFIG.MONITORING;

export default PARALLEL_CONFIG;
