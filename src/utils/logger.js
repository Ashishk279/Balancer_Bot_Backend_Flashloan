

import fs from 'fs/promises';
import path from 'path';

const logDir = 'logs';
let logFile;

async function init() {
    try {
        await fs.mkdir(logDir, { recursive: true });
        const date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        logFile = path.join(logDir, `arbitrage_scans_${date}.log`);
        console.log(`📝 Logging arbitrage opportunities to: ${logFile}`);
    } catch (error) {
        console.error('Failed to initialize logger:', error);
    }
}

async function log(level, message, data = {}) {
    if (!logFile) {
        console.error('Logger not initialized. Cannot write to log file.');
        return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    const logData = data ? `${JSON.stringify(data, null, 2)}\n\n` : '';


    try {
        await fs.appendFile(logFile, logMessage + logData);
        // Also log to console
        if (level === 'error') {
            console.error(logMessage, data);
        } else if (level === 'warn') {
            console.warn(logMessage, data);
        } else {
            console.log(logMessage, data);
        }
    } catch (error) {
        console.error(`Failed to write to log file ${logFile}:`, error);
    }
}


function info(message, data) {
    log('info', message, data);
}

function warn(message, data) {
    log('warn', message, data);
}

function error(message, data) {
    log('error', message, data);
}

function debug(message, data) {
    log('debug', message, data);
}

async function logArbitrage(opportunity) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ARBITRAGE OPPORTUNITY
----------------------------------------------------
   Pair: ${opportunity.poolName}
   Spread: ${opportunity.spread.toFixed(4)}%
   Direction: Buy on ${opportunity.minPrice.dex} -> Sell on ${opportunity.maxPrice.dex}
   Buy Price: ${opportunity.minPrice.priceOfAinB.toPrecision(8)}
   Sell Price: ${opportunity.maxPrice.priceOfAinB.toPrecision(8)}
   Est. Net Profit: ${opportunity.netProfit.toFixed(6)} ${opportunity.maxPrice.tokenA.symbol}
----------------------------------------------------\n\n`;

    try {
        await fs.appendFile(logFile, logMessage);
    } catch (error) {
        console.error(`Failed to write to log file ${logFile}:`, error);
    }
}

export default {
    init,
    logArbitrage,
    info,
    warn,
    error,
    debug,
};