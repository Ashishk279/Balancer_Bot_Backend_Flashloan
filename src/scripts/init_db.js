const path = require('path');
const fs = require('fs');
require('dotenv').config();
const Database = require('../db'); 

async function initializeDatabase() {
    try {
        console.log('|| Initializing Crypto Arbitrage Bot Database...');
        
        // Validate required environment variables
        const requiredEnvVars = [
            'MIN_PROFIT_THRESHOLD',
            'POLL_INTERVAL_MS',
            'MAX_DAILY_TRADES',
            'DATABASE_URL'
        ];
        
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        // Creating directories for logging and data files
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
            console.log('✅ Created logs directory');
        }

        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ Created data directory');
        }

        // Calling the Database.init()
        // to create all tables, indexes, and views before inserting data.
        await Database.init();
        
        // Initializing configuration from environment variables
        await Database.setConfig('bot_version', process.env.BOT_VERSION || '1.0.0', 'Bot version');
        await Database.setConfig('initialized_at', new Date().toISOString(), 'Initialization timestamp');
        
        // Trading parameters from .env
        await Database.setConfig('min_profit_threshold', process.env.MIN_PROFIT_THRESHOLD, 'Minimum profit threshold in USD');
        await Database.setConfig('poll_interval_ms', process.env.POLL_INTERVAL_MS, 'Polling interval in milliseconds');
        await Database.setConfig('max_daily_trades', process.env.MAX_DAILY_TRADES, 'Maximum trades per day');
        await Database.setConfig('slippage_tolerance', process.env.SLIPPAGE_TOLERANCE || '0.05', 'Maximum allowed slippage');
        await Database.setConfig('gas_price_multiplier', process.env.GAS_PRICE_MULTIPLIER || '1.2', 'Gas price multiplier for faster execution');

        // Risk management parameters
        await Database.setConfig('max_position_size_eth', process.env.MAX_POSITION_SIZE_ETH || '0.5', 'Maximum position size in ETH');
        await Database.setConfig('stop_loss_percentage', process.env.STOP_LOSS_PERCENTAGE || '0.02', 'Stop loss percentage');

        console.log('✅ Database initialized successfully with environment configuration!');
        console.log(`📊 Min Profit Threshold: $${process.env.MIN_PROFIT_THRESHOLD}`);
        console.log(`⏱️ Poll Interval: ${process.env.POLL_INTERVAL_MS}ms`);
        console.log(`🛡️ Max Daily Trades: ${process.env.MAX_DAILY_TRADES}`);
        
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    } finally {
        // Ensure the connection is closed even if an error occurs.
        if (Database.pool) {
            await Database.close();
        }
    }
}

if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };