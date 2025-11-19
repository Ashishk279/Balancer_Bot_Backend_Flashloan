# 🤖 DeFi Arbitrage Trading Bot - Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen.svg)](https://github.com)
[![WebSocket](https://img.shields.io/badge/WebSocket-Enabled-blue.svg)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache-red.svg)](https://redis.io/)

A production-ready, enterprise-grade DeFi arbitrage trading bot backend that automatically detects and executes profitable arbitrage opportunities across multiple DEX platforms with MEV protection via Flashbots integration. Features real-time WebSocket updates, Redis caching, and an advanced V3 arbitrage engine with built-in dashboard.

## 🚀 Technologies Used

- **Backend**: Node.js 18+ with ES6 modules
- **Database**: PostgreSQL 13+ for persistent storage
- **Cache**: Redis 6+ for real-time opportunity caching
- **Blockchain**: Ethers.js v6 for Ethereum interaction
- **Web Framework**: Express.js 5 with CORS support
- **Real-time Communication**: Socket.io & WebSocket
- **DeFi Protocols**: Uniswap V2/V3, SushiSwap
- **MEV Protection**: Flashbots integration
- **Price Precision**: Decimal.js for accurate calculations
- **Logging**: Winston for structured logging
- **Testing**: Jest, Supertest

## 🌟 Features

### 🔍 **Advanced Opportunity Detection**

- **V3 Arbitrage Engine**: Next-generation arbitrage detection with three strategies:
  - **Direct Arbitrage**: Same token pair across different DEXs (e.g., WETH/USDC on Uniswap vs SushiSwap)
  - **Cross-Protocol Arbitrage**: V2 vs V3 protocol price differences
  - **Triangular Arbitrage**: Multi-hop token cycles (A → B → C → A)
- **Real-time Price Monitoring**: WebSocket-based block monitoring for instant price updates
- **Multi-DEX Support**: Monitors Uniswap V2/V3, SushiSwap, and other major DEXs
- **Smart Filtering**: Configurable profit thresholds with gas cost analysis
- **Precision Decimal Handling**: Accurate token decimal conversions preventing calculation errors

### ⚡ **MEV-Protected Execution**

- **Flashbots Integration**: Bundle-based execution to prevent frontrunning
- **Smart Contract Execution**: Gas-optimized arbitrage contracts
- **Flash Loan Support**: Capital-efficient trading without upfront investment
- **Emergency Stop**: Instant halt capabilities for risk management

### 🛡️ **Production Security & Reliability**

- **Comprehensive Error Handling**: Graceful degradation and recovery
- **Circuit Breaker Pattern**: Prevents cascade failures
- **Rate Limiting**: API protection and resource management
- **Secure Key Management**: Environment-based configuration
- **SSL/TLS Support**: Encrypted database connections

### 📊 **Monitoring & Analytics**

- **Built-in Web Dashboard**: Beautiful real-time dashboard at `http://localhost:8000` with:
  - Live opportunity tracking and visualization
  - Real-time profit calculations
  - System health monitoring
  - WebSocket-powered live updates
- **Redis-Powered Caching**: Ultra-fast opportunity storage and retrieval
- **WebSocket Server**: Real-time bidirectional communication for instant updates
- **Comprehensive Logging**: Structured logging with multiple levels
- **Performance Metrics**: Execution times, success rates, profit tracking
- **Health Checks**: Multiple API endpoints for system monitoring
- **Alert Integration**: Webhook support for Slack/Discord notifications

## 🏗️ Architecture Overview

```
bot_backend/
├── src/
│   ├── main.js                 # Application entry point and V3 engine orchestration
│   ├── db.js                   # Database layer with connection pooling
│   │
│   ├── api/                    # REST API & WebSocket server
│   │   └── api.js             # Express server with CORS, REST endpoints & WebSocket
│   │
│   ├── config/                 # Configuration management
│   │   ├── index.js           # Environment-based config loader
│   │   ├── production.js      # Production-specific configurations
│   │   └── radis.js           # Redis client configuration
│   │
│   ├── constants/              # Static data and addresses
│   │   ├── dex_addresses.js   # DEX router and factory addresses
│   │   ├── token_addresses.js # Token contract addresses
│   │   ├── token_pools.js     # V2 pool configurations
│   │   ├── v3/                # V3-specific configurations
│   │   │   └── v3_token_pools.js # V3 direct swap pairs
│   │   └── abis/              # Smart contract ABIs
│   │
│   ├── layers/                # Clean architecture layers
│   │   ├── detectionLayer.js  # Opportunity detection orchestration
│   │   ├── executionLayer.js  # Trade execution with Flashbots
│   │   └── persistenceLayer.js # Database persistence
│   │
│   ├── services/              # Core business logic
│   │   ├── priceFetcher.js    # Multi-DEX price aggregation
│   │   ├── priceFeed.js       # Price feed service
│   │   ├── opportunity.js     # Opportunity analysis
│   │   ├── websocket.js       # WebSocket service for real-time updates
│   │   ├── monitoringService.js # Health monitoring
│   │   ├── blockchain/        # Blockchain interaction services
│   │   └── v3/                # V3 Engine Services
│   │       ├── arbitrageEngin/
│   │       │   └── v3Engin.js # Advanced V3 arbitrage engine
│   │       ├── priceFetcherV3.js # V3-specific price fetching
│   │       ├── priceOracle.js # Price oracle integration
│   │       └── abi/           # V3 contract ABIs
│   │
│   ├── provider/              # Blockchain provider management
│   │   └── websocket.js       # WebSocket provider for blockchain events
│   │
│   ├── utils/                 # Utility functions
│   │   ├── logger.js          # Structured logging
│   │   ├── constants.js       # Application constants
│   │   ├── unitConverter.js   # Token decimal handling
│   │   └── UniswapV2Math.js   # AMM calculations
│   │
│   └── scripts/               # Database and utility scripts
│       └── init_db.js         # Database schema initialization
│
├── public/                    # Web dashboard
│   └── index.html            # Real-time arbitrage dashboard UI
│
├── scripts/                   # Deployment and testing
│   ├── deploy-production.sh   # Production deployment automation
│   ├── integrate-flashbot.js  # Flashbot integration setup
│   ├── setup-database.js      # Database setup script
│   └── test-*.js              # Comprehensive test suite
│
├── logs/                      # Application logs
│   └── arbitrage_scans_*.log  # Daily log files
│
├── .env                       # Environment configuration
├── .env.example              # Example environment variables
└── package.json              # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL 13+** database
- **Redis 6+** for caching and real-time data
- **Ethereum node access** (Infura, Alchemy, or local node)
- **Private key** for transaction signing
- **Deployed arbitrage smart contract** (from `defi-arbitrage-contract-1/`)

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd DEFI-ARBITRAGE-TRADING-BOT-15/bot_backend

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `bot_backend/` directory:

```env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL=postgresql://username:password@localhost:5432/arbitrage_bot
PG_MAX_CLIENTS=20
PG_IDLE_TIMEOUT_MS=30000
NODE_TLS_REJECT_UNAUTHORIZED=0  # For RDS SSL

# ===========================================
# REDIS CONFIGURATION
# ===========================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=                 # Optional, if Redis requires authentication

# ===========================================
# BLOCKCHAIN CONFIGURATION
# ===========================================
ETHEREUM_CHAIN_ID=1
# Primary RPC URLs (supports multiple for fallback)
ETHEREUM_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ETHEREUM_RPC_URL_2=https://mainnet.infura.io/v3/YOUR_INFURA_KEY_1
ETHEREUM_RPC_URL_3=https://mainnet.infura.io/v3/YOUR_INFURA_KEY_2
# WebSocket URL for real-time block monitoring
WS_URL=wss://eth-mainnet.ws.alchemyapi.io/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=your_private_key_here

# ===========================================
# CONTRACT ADDRESSES
# ===========================================
ARBITRAGE_CONTRACT_ADDRESS=your_deployed_contract_address

# ===========================================
# FLASHBOT CONFIGURATION
# ===========================================
FLASHBOTS_RELAY=https://relay.flashbots.net
MIN_PROFIT_THRESHOLD=0.01       # Minimum profit in ETH
MAX_SLIPPAGE=0.005              # 0.5% maximum slippage
GAS_BUFFER=1.2                  # 20% gas buffer
MAX_CONCURRENT_EXECUTIONS=3     # Parallel execution limit

# ===========================================
# API CONFIGURATION
# ===========================================
API_PORT=8000
API_HOST=0.0.0.0               # Accept external connections
CORS_ORIGIN=*                  # CORS policy
ENABLE_API_DOCS=true

# ===========================================
# V3 ENGINE CONFIGURATION
# ===========================================
V3_ENGINE_ENABLED=true         # Enable V3 arbitrage engine

# ===========================================
# PERFORMANCE TUNING
# ===========================================
BATCH_SIZE=5                   # Price fetching batch size
POLL_INTERVAL_MS=1000          # Monitoring interval
MAX_RETRIES=3                  # Execution retry limit
QUEUE_POLL_INTERVAL=1000       # Opportunity queue polling

# ===========================================
# MONITORING & LOGGING
# ===========================================
LOG_LEVEL=info
ENABLE_MONITORING=true
HEALTH_CHECK_INTERVAL=30000
METRICS_INTERVAL=60000

# ===========================================
# ALERTING (OPTIONAL)
# ===========================================
SLACK_WEBHOOK_URL=your_slack_webhook
DISCORD_WEBHOOK_URL=your_discord_webhook
ALERT_ERROR_RATE_THRESHOLD=0.1
ALERT_PROFIT_DROP_THRESHOLD=0.5
```

### 3. Database & Cache Setup

```bash
# Initialize PostgreSQL database schema
npm run init-db

# Or manually connect to PostgreSQL and create database
createdb arbitrage_bot

# Ensure Redis is running
# On Linux/Mac:
redis-server

# On Windows (if Redis is installed):
redis-server.exe

# Verify Redis connection:
redis-cli ping
# Should return: PONG
```

### 4. Start the Bot

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 5. Verify Installation

```bash
# Check health endpoint
curl http://localhost:8000/api/health

# View recent arbitrage scans
curl http://localhost:8000/api/arbitrage-scans

# Check V3 engine opportunities
curl http://localhost:8000/api/v3-opportunities

# Check current opportunities from Redis cache
curl http://localhost:8000/api/current-opportunities

# Check system health
curl http://localhost:8000/api/system-health

# Access the web dashboard
# Open in browser: http://localhost:8000
```

## 📊 API Endpoints

### Core Endpoints

| Endpoint                        | Method | Description                                   | Parameters  |
| ------------------------------- | ------ | --------------------------------------------- | ----------- |
| `/api/health`                   | GET    | Basic health check                            | -           |
| `/`                             | GET    | Web dashboard (serves index.html)             | -           |
| `/api/current-opportunities`    | GET    | **Real-time opportunities from Redis cache**  | -           |
| `/api/arbitrage-scans`          | GET    | Recent arbitrage opportunities (legacy)       | `?limit=50` |
| `/api/profitable-opportunities` | GET    | Profitable opportunities only (legacy)        | `?limit=50` |
| `/api/daily-summary`            | GET    | Daily performance summary                     | `?days=7`   |

### V3 Engine Endpoints

| Endpoint                         | Method | Description                                      | Parameters                 |
| -------------------------------- | ------ | ------------------------------------------------ | -------------------------- |
| `/api/v3-opportunities`          | GET    | All V3 profitable opportunities                  | `?limit=50&type=v3_direct` |
| `/api/v3-all-opportunities`      | GET    | All V3 opportunities (profitable & unprofitable) | `?limit=50&type=...`       |
| `/api/v3-direct-opportunities`   | GET    | V3 direct arbitrage opportunities                | `?limit=50`                |
| `/api/v3-cross-opportunities`    | GET    | V3 cross-protocol arbitrage opportunities        | `?limit=50`                |
| `/api/v3-triangular-opportunities` | GET  | V3 triangular arbitrage opportunities            | `?limit=50`                |
| `/api/v3-engine-stats`           | GET    | V3 engine performance statistics                 | -                          |

### Execution & Monitoring

| Endpoint                     | Method | Description                  | Parameters     |
| ---------------------------- | ------ | ---------------------------- | -------------- |
| `/api/executions`            | GET    | Execution statistics         | `?limit=100`   |
| `/api/successful-executions` | GET    | Recent successful executions | `?limit=50`    |
| `/api/bundles`               | GET    | Flashbot bundle statistics   | `?limit=100`   |
| `/api/execution-summary`     | GET    | Execution dashboard summary  | -              |
| `/api/system-health`         | GET    | System health status         | `?service=all` |
| `/api/emergency-stop`        | POST   | Emergency halt trading       | -              |

### Example API Response

```json
{
  "arbitrage-scans": [
    {
      "id": 12345,
      "timestamp": 1694707200000,
      "dex_a": "uniswap_v2",
      "dex_b": "sushiswap",
      "pair": "WETH/USDC",
      "amount_in": "1000000000000000000",
      "direction": "buy_a_sell_b",
      "buy_price": "1650.50",
      "sell_price": "1652.75",
      "gas_cost_estimate": "0.045",
      "estimated_profit": "0.125",
      "arbitrage_type": "direct"
    }
  ]
}
```

## 🔧 Core Services & Architecture

### Layer-Based Architecture

The bot uses a clean, layered architecture for separation of concerns:

#### Detection Layer (`src/layers/detectionLayer.js`)
- **Purpose**: Orchestrates opportunity detection across all strategies
- **Features**: Coordinates V3 engine and legacy detection methods
- **Output**: Structured opportunity objects ready for evaluation

#### Execution Layer (`src/layers/executionLayer.js`)
- **Purpose**: Handles trade execution with MEV protection
- **Features**: Flashbots integration, transaction bundling, retry logic
- **Security**: Emergency stop, circuit breaker, validation checks

#### Persistence Layer (`src/layers/persistenceLayer.js`)
- **Purpose**: Database operations and data storage
- **Features**: Batch inserts, connection pooling, error handling
- **Storage**: PostgreSQL for historical data, Redis for real-time cache

### V3 Arbitrage Engine (`src/services/v3/arbitrageEngin/v3Engin.js`)

- **Purpose**: Next-generation arbitrage detection engine
- **Strategies**:
  - **Direct Arbitrage**: Same pair across different DEXs
  - **Cross-Protocol Arbitrage**: V2 vs V3 price differences
  - **Triangular Arbitrage**: Multi-hop token cycles
- **Features**:
  - Precise decimal handling for accurate profit calculations
  - Comprehensive financial breakdowns
  - Gas cost optimization
  - Slippage protection
  - Real-time opportunity caching to Redis

### Price Fetcher Services

#### V3 Price Fetcher (`src/services/v3/priceFetcherV3.js`)
- **Purpose**: Specialized price fetching for Uniswap V3 pools
- **Features**: Tick-based pricing, liquidity depth analysis, fee tier handling

#### Legacy Price Fetcher (`src/services/priceFetcher.js`)
- **Purpose**: Price aggregation from V2-style AMMs
- **Supported DEXs**: Uniswap V2, SushiSwap, and V2-compatible DEXs

### WebSocket Service (`src/services/websocket.js`)

- **Purpose**: Real-time bidirectional communication
- **Features**:
  - Live opportunity updates
  - System status broadcasts
  - Client connection management
  - Event-driven architecture

### Monitoring Service (`src/services/monitoringService.js`)

- **Purpose**: System health monitoring and alerting
- **Features**: Resource tracking, performance metrics, health checks

## 🎨 Web Dashboard

The bot includes a beautiful, real-time web dashboard accessible at `http://localhost:8000` (or your configured API_HOST:API_PORT).

### Dashboard Features

- **Real-time Opportunity Tracking**: Live updates via WebSocket
- **Opportunity Cards**: Visual display of arbitrage opportunities with:
  - Token pair information
  - Expected profit calculations
  - DEX/protocol details
  - Arbitrage type (direct, cross, triangular)
  - Gas cost estimates
- **System Metrics**: Live system health and performance indicators
- **Auto-refresh**: WebSocket-powered automatic updates (no page refresh needed)
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Accessing the Dashboard

1. Start the bot: `npm start`
2. Open your browser to: `http://localhost:8000`
3. The dashboard will automatically connect and display live opportunities

## 🛠️ Configuration

### Environment-Specific Configs

The bot supports multiple configuration profiles:

- **Development**: `src/config/index.js` (default)
- **Production**: `src/config/production.js` (comprehensive production settings)
- **Staging**: Environment variable overrides

### Key Configuration Areas

1. **Database Settings**: Connection pooling, SSL, timeouts
2. **Redis Settings**: Cache configuration, connection options
3. **RPC Configuration**: Primary/fallback RPCs, health checking
4. **V3 Engine**: Enable/disable V3 arbitrage engine
5. **Arbitrage Parameters**: Profit thresholds, slippage limits
6. **Gas Settings**: Price limits, buffer multipliers
7. **WebSocket**: Real-time communication settings
8. **Monitoring**: Log levels, health check intervals
9. **Security**: CORS, rate limiting, encryption

## 🧪 Testing

### Test Suite

```bash
# Run all tests
npm test

# Database & Infrastructure Tests
npm run test:db              # Test PostgreSQL connectivity

# API & Integration Tests
npm run test:api             # Test all API endpoints

# Core Functionality Tests
npm run test:arbitrage       # Test arbitrage detection logic
npm run test:execution       # Test execution system
npm run test:detection       # Test opportunity detection

# Critical Security Tests
npm run test:units           # Test unit conversions (CRITICAL - prevents financial loss)

# Flashbot Integration Tests
npm run test-integration     # Test complete Flashbot integration
```

### Integration Testing

```bash
# Test flashbot integration
npm run test-integration

# Test complete arbitrage flow
node scripts/test-arbitrage-logic.js

# Additional utility scripts
node scripts/setup-database.js      # Database initialization
node scripts/integrate-flashbot.js  # Flashbot setup wizard
```

## 🚀 Production Deployment

### Automated Deployment

```bash
# Make script executable
chmod +x scripts/deploy-production.sh

# Run deployment script
./scripts/deploy-production.sh
```

### Manual Production Setup

1. **System Preparation**

   ```bash
   # Install required services
   sudo apt-get update
   sudo apt-get install -y postgresql redis-server

   # Create application user
   sudo useradd -r -s /bin/false -d /opt/arbitrage-bot arbitrage

   # Create directory structure
   sudo mkdir -p /opt/arbitrage-bot
   sudo chown arbitrage:arbitrage /opt/arbitrage-bot

   # Start Redis
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

2. **Application Setup**

   ```bash
   # Copy application files
   sudo cp -r bot_backend/* /opt/arbitrage-bot/

   # Install production dependencies
   cd /opt/arbitrage-bot
   npm ci --only=production

   # Set permissions
   sudo chown -R arbitrage:arbitrage /opt/arbitrage-bot
   ```

3. **Process Management (PM2)**

   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Create PM2 ecosystem file
   cat > ecosystem.config.js << 'EOF'
   module.exports = {
     apps: [{
       name: 'arbitrage-bot',
       script: 'src/main.js',
       instances: 1,
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production'
       },
       error_file: '/var/log/arbitrage-bot/err.log',
       out_file: '/var/log/arbitrage-bot/out.log',
       max_memory_restart: '1G'
     }]
   };
   EOF

   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **System Service**

   ```bash
   # Create systemd service
   sudo tee /etc/systemd/system/arbitrage-bot.service > /dev/null << 'EOF'
   [Unit]
   Description=Arbitrage Trading Bot
   After=network.target postgresql.service

   [Service]
   Type=forking
   User=arbitrage
   Group=arbitrage
   WorkingDirectory=/opt/arbitrage-bot
   ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   EOF

   # Enable and start service
   sudo systemctl daemon-reload
   sudo systemctl enable arbitrage-bot
   sudo systemctl start arbitrage-bot
   ```

### Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/arbitrage-bot
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Check system status
curl http://localhost:8000/api/system-health

# Check real-time opportunities from Redis
curl http://localhost:8000/api/current-opportunities

# Check V3 engine statistics
curl http://localhost:8000/api/v3-engine-stats

# Check recent performance
curl http://localhost:8000/api/execution-summary

# View application logs
tail -f logs/arbitrage_scans_$(date +%Y-%m-%d).log

# Check PM2 status
pm2 status
pm2 logs arbitrage-bot

# Monitor Redis
redis-cli INFO stats
redis-cli KEYS 'opportunity:*'

# System resource usage
htop
df -h
```

### Performance Metrics

Key metrics to monitor:

- **Opportunity Detection Rate**: Opportunities found per hour
- **V3 Engine Performance**: Direct/Cross/Triangular opportunity counts
- **Redis Cache Hit Rate**: Cache efficiency and response times
- **WebSocket Connections**: Active client connections
- **Execution Success Rate**: Percentage of successful trades
- **Average Profit per Trade**: ETH earned per successful arbitrage
- **Gas Efficiency**: Average gas used vs estimated
- **API Response Times**: Endpoint performance
- **Database Performance**: Query times and connection pool usage
- **Memory Usage**: Heap usage and potential leaks
- **RPC Health**: Provider response times and failover events

### Log Analysis

```bash
# View error logs
grep ERROR logs/*.log | tail -20

# Monitor profit opportunities
grep "PROFITABLE" logs/*.log | tail -10

# Check execution success
grep "EXECUTION_SUCCESS" logs/*.log | wc -l

# Analyze gas usage
grep "GAS_USED" logs/*.log | tail -10
```

## 🔒 Security Considerations

### Key Management

- **Environment Variables**: Store sensitive data in `.env` files
- **File Permissions**: Restrict `.env` file access (`chmod 600 .env`)
- **Key Rotation**: Regular private key rotation for production
- **Encryption**: Consider hardware security modules for large deployments

### Network Security

- **CORS Configuration**: Restrict API access origins
- **Rate Limiting**: Prevent API abuse
- **SSL/TLS**: Encrypt all network communications
- **Firewall**: Restrict unnecessary port access

### Financial Security

- **Profit Thresholds**: Set minimum profit requirements
- **Maximum Trade Size**: Limit exposure per transaction
- **Emergency Stop**: Implement immediate halt functionality
- **Slippage Protection**: Maximum acceptable price slippage

### Operational Security

- **Error Handling**: Prevent information disclosure
- **Input Validation**: Sanitize all user inputs
- **Audit Logging**: Comprehensive trade and system logs
- **Monitoring**: Real-time alerts for anomalous behavior

## ⚠️ Critical Security Notes

### Unit Conversion Fixes

The bot includes critical fixes for unit conversion issues that could lead to massive financial losses:

- **Decimal Precision Handling**: Proper token decimal conversion
- **Gas Cost Calculations**: Accurate gas cost estimations
- **Profit Calculations**: Validated profit calculation logic
- **Amount Conversions**: Safe handling of different token decimals

See `UNIT_CONVERSION_FIXES.md` for detailed security information.

### MEV Protection

- **Flashbot Integration**: Bundle-based execution prevents frontrunning
- **Private Mempool**: Transactions submitted privately
- **Priority Fees**: Competitive fee structures
- **Bundle Validation**: Comprehensive bundle verification

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Issues**

   ```bash
   # Check PostgreSQL service
   sudo systemctl status postgresql

   # Test connection
   psql $DATABASE_URL

   # Check SSL configuration for RDS
   echo "sslmode=require" >> .env
   ```

2. **RPC Provider Issues**

   ```bash
   # Test RPC connectivity
   curl -X POST $RPC_URL \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

   # Check WebSocket connection
   wscat -c $WEBSOCKET_RPC_URL
   ```

3. **Memory Issues**

   ```bash
   # Monitor memory usage
   node --max-old-space-size=4096 src/main.js

   # Check for memory leaks
   pm2 monit
   ```

4. **API Connectivity Issues**

   ```bash
   # Check if API is listening
   netstat -tlnp | grep 8000

   # Test CORS configuration
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS http://localhost:8000/api/health
   ```

### Debug Scripts

The bot includes comprehensive debugging tools:

- `scripts/debug-fetch-error.sh`: Frontend connectivity testing
- `scripts/debug-frontend-backend.sh`: End-to-end connection testing
- `frontend-debug.html`: Browser-based API testing

### Log Levels

Adjust log verbosity in `.env`:

```env
# Debug level (most verbose)
LOG_LEVEL=debug

# Info level (default)
LOG_LEVEL=info

# Error level only
LOG_LEVEL=error
```

## 🚀 V3 Arbitrage Engine

### Overview

The V3 Engine is the next-generation arbitrage detection system with enhanced precision, multiple strategies, and real-time caching.

### Enabling/Disabling V3 Engine

Control the V3 engine via environment variable:

```env
# Enable V3 Engine (default)
V3_ENGINE_ENABLED=true

# Disable V3 Engine (use legacy detection only)
V3_ENGINE_ENABLED=false
```

### V3 Engine Features

#### 1. **Direct Arbitrage Detection**
- Identifies price differences for the same token pair across different DEXs
- Example: WETH/USDC on Uniswap V2 vs SushiSwap
- Real-time price comparison with gas cost consideration

#### 2. **Cross-Protocol Arbitrage**
- Detects opportunities between V2 and V3 protocols
- Example: WETH/USDC on Uniswap V2 vs Uniswap V3
- Accounts for different pricing mechanisms (constant product vs concentrated liquidity)

#### 3. **Triangular Arbitrage**
- Multi-hop token cycles for profit extraction
- Example: WETH → USDC → DAI → WETH
- Comprehensive path analysis with minimal gas overhead

### V3 Engine Advantages

- **Precision Decimal Handling**: Uses Decimal.js to prevent rounding errors
- **Comprehensive Gas Estimation**: Accurate gas cost calculations for each strategy
- **Detailed Financial Breakdown**: Complete profit/loss analysis including:
  - Input amounts and output amounts
  - Price impact and slippage
  - Gas costs in ETH and USD
  - Net profit after all costs
- **Redis Caching**: Ultra-fast opportunity storage and retrieval
- **Real-time Updates**: WebSocket broadcasts for instant dashboard updates

### Configuring Trading Pairs

Edit `src/constants/v3/v3_token_pools.js` to configure trading pairs:

```javascript
export const DIRECT_SWAP_PAIRS = [
  {
    tokenIn: { symbol: 'WETH', address: '0x...' },
    tokenOut: { symbol: 'USDC', address: '0x...' },
    amountIn: '1000000000000000000', // 1 WETH
  },
  // Add more pairs...
];
```

## 🤝 Support & Contributing

### Getting Help

1. **Documentation**: Check all README files and guides
2. **Logs**: Review application logs for error details
3. **Health Checks**: Use API endpoints to verify system status
4. **Debug Scripts**: Run provided debugging tools
5. **Web Dashboard**: Access real-time monitoring at `http://localhost:8000`

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Reporting Issues

When reporting issues, please include:

- **Environment Details**: OS, Node.js version, database version
- **Configuration**: Relevant environment variables (sanitized)
- **Log Output**: Error messages and stack traces
- **Reproduction Steps**: How to reproduce the issue
- **Expected Behavior**: What should have happened

## 🔌 WebSocket & Real-time Features

### WebSocket Server

The bot includes a WebSocket server for real-time bidirectional communication:

- **Auto-initialized**: Starts automatically with the API server
- **Live Opportunities**: Broadcasts opportunities as they're discovered
- **System Events**: Real-time system health updates
- **Dashboard Updates**: Powers the web dashboard's live data

### WebSocket Events

Client-side connection example:

```javascript
const socket = io('http://localhost:8000');

// Listen for new opportunities
socket.on('opportunity', (data) => {
  console.log('New opportunity:', data);
});

// Listen for system events
socket.on('systemEvent', (data) => {
  console.log('System event:', data);
});
```

### Redis Cache Strategy

The bot uses Redis for ultra-fast opportunity caching:

- **Key Pattern**: `opportunity:*` - Stores active opportunities
- **TTL**: Configurable expiration for stale data cleanup
- **Hash Storage**: Efficient key-value storage for opportunity data
- **Real-time Access**: Sub-millisecond read/write operations

## 📚 Additional Resources

### Related Documentation

- **Dashboard Access**: `http://localhost:8000` - Real-time web interface
- **V3 Engine Config**: `src/constants/v3/v3_token_pools.js` - Trading pair configuration
- `../PRODUCTION_DEPLOYMENT_GUIDE.md`: Comprehensive deployment guide
- `../FLASHBOT_INTEGRATION_GUIDE.md`: Flashbot setup and configuration
- `UNIT_CONVERSION_FIXES.md`: Critical security fixes
- `INSTANT_EXECUTION_SETUP.md`: Quick execution setup

### External Resources

- [Flashbots Documentation](https://docs.flashbots.net/)
- [Uniswap V2 Documentation](https://docs.uniswap.org/protocol/V2/introduction)
- [Uniswap V3 Documentation](https://docs.uniswap.org/protocol/V3/introduction)
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [Socket.io Documentation](https://socket.io/docs/)

### Quick Links

- **Live Dashboard**: `http://localhost:8000` (when bot is running)
- **API Health**: `http://localhost:8000/api/health`
- **V3 Opportunities**: `http://localhost:8000/api/v3-opportunities`
- **Current Opportunities**: `http://localhost:8000/api/current-opportunities`

---

**⚠️ Disclaimer**: This software is for educational and research purposes. Trading cryptocurrencies involves significant financial risk. Always test thoroughly on testnets before using with real funds. The authors are not responsible for any financial losses.

**📄 License**: MIT License - see LICENSE file for details.

**🎯 Project Status**: Production-ready with active V3 engine, WebSocket support, and Redis caching.
