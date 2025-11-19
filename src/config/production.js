import { ethers } from 'ethers';

/**
 * Production Configuration
 * Comprehensive configuration for production deployment
 */

const productionConfig = {
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    maxClients: parseInt(process.env.PG_MAX_CLIENTS) || 20,
    idleTimeoutMs: parseInt(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMs: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS) || 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    }
  },

  // RPC Configuration
  rpc: {
    primary: process.env.PRIMARY_RPC_URL || process.env.RPC_URL,
    fallback: process.env.FALLBACK_RPC_URL,
    websocket: process.env.WEBSOCKET_RPC_URL,
    timeout: parseInt(process.env.RPC_TIMEOUT) || 30000,
    retries: parseInt(process.env.RPC_RETRIES) || 3,
    batchSize: parseInt(process.env.RPC_BATCH_SIZE) || 100,
    healthCheckInterval: parseInt(process.env.RPC_HEALTH_CHECK_INTERVAL) || 30000
  },

  // Arbitrage Configuration
  arbitrage: {
    minProfitThreshold: new Decimal(process.env.MIN_PROFIT_THRESHOLD || 0.01),
    maxSlippage: new Decimal(process.env.MAX_SLIPPAGE || 0.005),
    profitBuffer: new Decimal(process.env.PROFIT_BUFFER || 0.2),
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 5,
    executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT) || 30000,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 5000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    opportunityTimeout: parseInt(process.env.OPPORTUNITY_TIMEOUT) || 30000,
    queuePollInterval: parseInt(process.env.QUEUE_POLL_INTERVAL) || 1000
  },

  // Flashbot Configuration
  flashbot: {
    contractAddress: process.env.ARBITRAGE_CONTRACT_ADDRESS,
    relay: process.env.FLASHBOTS_RELAY || 'https://relay.flashbots.net',
    targetBlockOffset: parseInt(process.env.FLASHBOT_TARGET_BLOCK_OFFSET) || 1,
    maxBundleSize: parseInt(process.env.FLASHBOT_MAX_BUNDLE_SIZE) || 3,
    bundleTimeout: parseInt(process.env.FLASHBOT_BUNDLE_TIMEOUT) || 30000,
    minProfitThreshold: new Decimal(process.env.FLASHBOT_MIN_PROFIT_THRESHOLD || 0.01),
    deadlineBuffer: parseInt(process.env.FLASHBOT_DEADLINE_BUFFER) || 300
  },

  // Gas Configuration
  gas: {
    strategy: process.env.GAS_STRATEGY || 'dynamic', // 'dynamic', 'aggressive', 'conservative'
    maxFeePerGas: ethers.parseUnits(process.env.MAX_FEE_PER_GAS || "100", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits(process.env.MAX_PRIORITY_FEE_PER_GAS || "5", "gwei"),
    gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
    gasBuffer: new Decimal(process.env.GAS_BUFFER || 1.2),
    maxGasPrice: ethers.parseUnits(process.env.MAX_GAS_PRICE || "100", "gwei"),
    gasPriceMultiplier: new Decimal(process.env.GAS_PRICE_MULTIPLIER || 1.1),
    gasHistoryHours: parseInt(process.env.GAS_HISTORY_HOURS) || 24
  },

  // Monitoring Configuration
  monitoring: {
    enabled: process.env.ENABLE_MONITORING !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000,
    alertThresholds: {
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.1,
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 5000,
      profitDrop: parseFloat(process.env.ALERT_PROFIT_DROP_THRESHOLD) || 0.5
    },
    webhooks: {
      slack: process.env.SLACK_WEBHOOK_URL,
      discord: process.env.DISCORD_WEBHOOK_URL,
      email: process.env.EMAIL_WEBHOOK_URL
    }
  },

  // Security Configuration
  security: {
    privateKey: process.env.PRIVATE_KEY,
    privateKeyFile: process.env.PRIVATE_KEY_FILE,
    walletPassword: process.env.WALLET_PASSWORD,
    encryptionKey: process.env.ENCRYPTION_KEY,
    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    },
    helmet: {
      enabled: process.env.ENABLE_HELMET !== 'false',
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }
  },

  // Performance Configuration
  performance: {
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300000, // 5 minutes
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    enableGzip: process.env.ENABLE_GZIP !== 'false',
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enableResponseTime: process.env.ENABLE_RESPONSE_TIME !== 'false'
  },

  // Error Handling Configuration
  errorHandling: {
    enableGlobalErrorHandler: process.env.ENABLE_GLOBAL_ERROR_HANDLER !== 'false',
    enableUnhandledRejectionHandler: process.env.ENABLE_UNHANDLED_REJECTION_HANDLER !== 'false',
    enableGracefulShutdown: process.env.ENABLE_GRACEFUL_SHUTDOWN !== 'false',
    shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 5000,
    circuitBreaker: {
      enabled: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 5,
      recoveryTimeout: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT) || 60000
    }
  },

  // Deployment Configuration
  deployment: {
    environment: process.env.NODE_ENV || 'production',
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    cluster: {
      enabled: process.env.ENABLE_CLUSTER !== 'false',
      workers: parseInt(process.env.CLUSTER_WORKERS) || require('os').cpus().length
    },
    pm2: {
      enabled: process.env.ENABLE_PM2 !== 'false',
      instances: parseInt(process.env.PM2_INSTANCES) || 'max',
      execMode: process.env.PM2_EXEC_MODE || 'cluster'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    transports: {
      console: process.env.LOG_CONSOLE !== 'false',
      file: process.env.LOG_FILE !== 'false',
      database: process.env.LOG_DATABASE !== 'false'
    },
    file: {
      filename: process.env.LOG_FILE_PATH || 'logs/app.log',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d'
    },
    database: {
      table: process.env.LOG_DB_TABLE || 'system_logs',
      level: process.env.LOG_DB_LEVEL || 'error'
    }
  },

  // API Configuration
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api',
    documentation: {
      enabled: process.env.ENABLE_API_DOCS !== 'false',
      path: process.env.API_DOCS_PATH || '/docs'
    },
    cors: {
      enabled: process.env.ENABLE_CORS !== 'false',
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    },
    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    }
  },

  // Database Maintenance Configuration
  maintenance: {
    cleanup: {
      enabled: process.env.ENABLE_DB_CLEANUP !== 'false',
      interval: parseInt(process.env.DB_CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
      retention: {
        arbitrageScans: process.env.DB_RETENTION_ARBITRAGE_SCANS || '30d',
        priceFeeds: process.env.DB_RETENTION_PRICE_FEEDS || '7d',
        gasPriceHistory: process.env.DB_RETENTION_GAS_PRICE_HISTORY || '7d',
        systemHealth: process.env.DB_RETENTION_SYSTEM_HEALTH || '7d'
      }
    },
    vacuum: {
      enabled: process.env.ENABLE_DB_VACUUM !== 'false',
      interval: parseInt(process.env.DB_VACUUM_INTERVAL) || 7 * 24 * 60 * 60 * 1000, // 7 days
      analyze: process.env.ENABLE_DB_ANALYZE !== 'false'
    },
    materializedViews: {
      refreshInterval: parseInt(process.env.MV_REFRESH_INTERVAL) || 60 * 60 * 1000 // 1 hour
    }
  },

  // External Services Configuration
  external: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
      baseUrl: process.env.ETHERSCAN_BASE_URL || 'https://api.etherscan.io'
    },
    infura: {
      projectId: process.env.INFURA_PROJECT_ID,
      projectSecret: process.env.INFURA_PROJECT_SECRET
    },
    alchemy: {
      apiKey: process.env.ALCHEMY_API_KEY,
      baseUrl: process.env.ALCHEMY_BASE_URL
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'staging') {
  productionConfig.monitoring.logLevel = 'debug';
  productionConfig.security.helmet.enabled = false;
  productionConfig.performance.enableCaching = false;
}

if (process.env.NODE_ENV === 'development') {
  productionConfig.monitoring.logLevel = 'debug';
  productionConfig.security.helmet.enabled = false;
  productionConfig.performance.enableCaching = false;
  productionConfig.database.ssl = false;
}

// Validation
const requiredEnvVars = [
  'DATABASE_URL',
  'PRIVATE_KEY',
  'ARBITRAGE_CONTRACT_ADDRESS',
  'PRIMARY_RPC_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Missing required environment variables: ${missingVars.join(', ')}`);
  console.warn('Some features may not work correctly without these variables.');
}

export default productionConfig;
