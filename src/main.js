/**
 * Main Arbitrage Bot - Enhanced with V3 Engine
 * 
 * This bot integrates both legacy arbitrage analysis and the new V3 engine:
 * - V3 Engine: Advanced arbitrage detection with proper decimal handling and comprehensive logging
 * - Legacy Engine: Backup arbitrage analysis for compatibility
 * 
 * Configuration:
 * - V3_ENGINE_ENABLED: Set to 'false' to disable V3 engine (default: true)
 * - BATCH_SIZE: Number of pairs to process in each batch (default: 5)
 * 
 * The V3 engine provides:
 * - Direct arbitrage (same pair, different DEXes)
 * - Cross arbitrage (V2 vs V3 protocols)
 * - Triangular arbitrage (3-token cycles)
 * - Proper token decimal handling
 * - Detailed financial breakdowns
 * - Performance optimization
 */

import "dotenv/config";

import { executeFlashLoanTransaction, executeOpportunities } from './layers/executionLayer.js';
import { flushToDB } from './layers/persistenceLayer.js';

import db from './db.js';
import { startApi } from './api/api.js';

import logger from './utils/logger.js';
import { checkRPCHealth } from './utils/rpcHealth.js';
// Import V3 Engine
import { runArbitrageEngine } from './services/v3/arbitrageEngin/v3Engin.js';
import ws from "./provider/websocket.js"
import { DIRECT_SWAP_PAIRS } from "./constants/v3/v3_token_pools.js";
import { createFlashLoanPayload } from "./services/v3/arbitrageEngin/payload.js";

// --- CONFIGURATION ---
const BATCH_SIZE = process.env.BATCH_SIZE || 5;
const V3_ENGINE_ENABLED = process.env.V3_ENGINE_ENABLED !== 'false'; // Default to true

// --- NETWORK CONFIGURATION ---
// Ensure API server accepts all connections
process.env.API_HOST = process.env.API_HOST || '0.0.0.0';
if (!process.env.API_PORT) {
    process.env.API_PORT = '8000';
}

// --- DYNAMIC RPC INITIALIZATION ---
let priceFetcher;
let arbitrageDetector;
let opportunityProcessor;
let wsProvider; // <-- ADDED: WebSocket provider instance
let v3EngineEnabled = true; // Flag to enable/disable V3 engine

// Track cooldown period
let isCooldown = false;
let lastExecutionTime = null;

/**
 * Main monitoring loop - Execute top opportunity within 1-2s, then cooldown for 30s
 */
async function monitor() {
    // Skip if in cooldown period
    if (isCooldown) {
        const elapsed = Date.now() - lastExecutionTime;
        const remaining = Math.ceil((30000 - elapsed) / 1000);
        console.log(`⏸️  In cooldown period - ${remaining}s remaining before next analysis`);
        return;
    }

    console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  [${new Date().toLocaleTimeString()}] STARTING OPPORTUNITY ANALYSIS                ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

    try {
        const analysisStartTime = Date.now();

        // RPC HEALTH CHECK
        console.log('🏥 Checking RPC node health...');
        const health = await checkRPCHealth(wsProvider);
        if (!health.healthy) {
            console.log('⚠️  RPC not healthy - Detection may be slow or fail');
            console.log(`   Block time: ${health.blockTime || 'N/A'}ms`);
            console.log(`   Quoter time: ${health.quoterTime || 'N/A'}ms`);
            console.log(`   Error: ${health.error || 'Unknown'}`);
        }

        // V3 ENGINE ANALYSIS
        let v3Opportunities = [];
        if (v3EngineEnabled) {
            console.log('🚀 V3 ENGINE: Analyzing arbitrage opportunities...');
            try {
                if (DIRECT_SWAP_PAIRS && DIRECT_SWAP_PAIRS.length > 0) {
                    console.log(`🎯 Analyzing ${DIRECT_SWAP_PAIRS.length} pairs...`);

                    const v3StartTime = Date.now();
                    v3Opportunities = await runArbitrageEngine(DIRECT_SWAP_PAIRS);
                    const v3EndTime = Date.now();
                    const analysisTime = v3EndTime - v3StartTime;

                    console.log(`\n📊 ANALYSIS COMPLETED in ${analysisTime}ms`);
                    console.log(`   Total opportunities found: ${v3Opportunities.length}`);

                    if (v3Opportunities.length > 0) {
                        // Sort by profit (descending) to get TOP opportunity
                        v3Opportunities.sort((a, b) => {
                            const profitA = parseFloat(a.profit?.toString() || '0');
                            const profitB = parseFloat(b.profit?.toString() || '0');
                            return profitB - profitA;
                        });

                        console.log(`\n📋 ALL OPPORTUNITIES FOUND (sorted by profit):`);
                        v3Opportunities.forEach((opp, index) => {
                            console.log(`\n   [${index + 1}] ${opp.type} - ${opp.poolId || opp.poolName}`);
                            console.log(`       Profit: ${opp.profit?.toString()}`);
                            console.log(`       Buy: ${opp.buyDex} @ ${opp.buyPrice?.toString()}`);
                            console.log(`       Sell: ${opp.sellDex} @ ${opp.sellPrice?.toString()}`);
                            console.log(`       Amount In: ${opp.amount_in?.toString()}`);
                            console.log(`       Spread: ${opp.spread?.toString()}`);
                        });
                        // logger.info('V3 Engine Opportunities', {
                        //     opportunities: v3Opportunities,
                        //     service: 'v3EngineMonitor'
                        // });
                        // Execute TOP opportunity (highest profit)
                        const topOpportunity = v3Opportunities[0];
                        const timeSinceStart = Date.now() - analysisStartTime;

                        console.log(`\n🏆 TOP OPPORTUNITY IDENTIFIED (Analysis time: ${timeSinceStart}ms):`);
                        console.log(`   Rank: #1 (Highest Profit)`);
                        console.log(`   Profit: ${topOpportunity.profit?.toString()}`);
                        console.log(`   Pool: ${topOpportunity.poolId || topOpportunity.poolName}`);
                        console.log(`   Strategy: ${topOpportunity.type}`);
                        // console.log("TOggggggggggggg", topOpportunity)

                        // Execute within 1-2 second window
                        if (timeSinceStart <= 2000) {
                            console.log(`\n✅ Within execution window (${timeSinceStart}ms < 2000ms) - EXECUTING NOW!`);

                            await executeTopOpportunity(topOpportunity);

                            // Start 30-second cooldown
                            startCooldown();
                        } else {
                            console.log(`\n⚠️  Analysis took ${timeSinceStart}ms (> 2000ms) - Skipping execution`);
                        }
                    } else {
                        console.log(`\nℹ️  No opportunities found - continuing to next block`);
                    }
                } else {
                    console.log('⚠️  No pairs data available for V3 engine');
                }
            } catch (error) {
                console.error('❌ Error in V3 engine analysis:', error.message);
                console.error('V3 Engine stack trace:', error.stack);

                if (error.message.includes('critical') || error.message.includes('fatal')) {
                    console.log('⚠️  Critical V3 engine error detected. Consider disabling V3_ENGINE_ENABLED=false');
                }
            }
        }

    } catch (error) {
        console.error("An error occurred in the monitoring loop:", error.message);
        console.error("Stack trace:", error.stack);
    }
}

/**
 * Execute the top opportunity with detailed logging
 */
async function executeTopOpportunity(opp) {
    const { createDirectExecutionPayload } = await import('./services/v3/arbitrageEngin/payload.js');
    const { executeTransaction } = await import('./layers/executionLayer.js');

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║          EXECUTING TOP OPPORTUNITY (HIGHEST PROFIT)        ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    const executionStartTime = Date.now();

    try {
        // Log full opportunity details
        console.log(`\n📋 OPPORTUNITY DETAILS:`);
        console.log(`   Pool ID: ${opp.poolId || opp.poolName}`);
        console.log(`   Strategy: ${opp.type}`);
        console.log(`   Buy DEX: ${opp.buyDex}`);
        console.log(`   Sell DEX: ${opp.sellDex}`);
        console.log(`   Token A: ${JSON.stringify(opp.tokenA)}`);
        console.log(`   Token B: ${JSON.stringify(opp.tokenB)}`);
        console.log(`   Amount In: ${opp.amount_in?.toString()}`);
        console.log(`   Amount Out: ${opp.amount_out?.toString()}`);
        console.log(`   Expected Profit: ${opp.profit?.toString()}`);
        console.log(`   Buy Price: ${opp.buyPrice?.toString()}`);
        console.log(`   Sell Price: ${opp.sellPrice?.toString()}`);
        console.log(`   Spread: ${opp.spread?.toString()}`);
        console.log(`   Fee 1: ${opp.fee1}`);
        console.log(`   Fee 2: ${opp.fee2}`);
        console.log(`   Gas Estimation: ${opp.gasEstimation}`);

        // Create execution payload
        console.log(`\n🔧 CREATING EXECUTION PAYLOAD...`);
        const payloadStartTime = Date.now();
        const execution_payload = await createFlashLoanPayload(opp, wsProvider);
        const payloadTime = Date.now() - payloadStartTime;

        console.log(`   ✅ Payload created in ${payloadTime}ms`);
        console.log(`\n📦 EXECUTION PAYLOAD:`);
        console.log(JSON.stringify(execution_payload, null, 2));

        // Prepare execution object
        const execOpp = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: opp.type || 'v3_direct',
            timestamp: Date.now(),
            estimated_profit: opp.profit?.toString(),
            execution_payload: execution_payload,
            pair: opp.poolId || opp.poolName,
            buyDex: opp.buyDex,
            sellDex: opp.sellDex,
            txHash: opp.txHash
        };

        console.log(`\n💰 EXECUTION CHECK:`);
        console.log(`   Estimated Profit: ${execOpp.estimated_profit}`);
        console.log(`   Pair: ${execOpp.pair}`);
        console.log(`   Meets WETH criteria: ${execOpp.pair.endsWith('WETH') ? 'YES ✅' : 'NO ❌'}`);

        // Execute transaction if profitable and meets criteria
        if (execOpp.estimated_profit !== undefined && execOpp.pair.endsWith('WETH')) {
            console.log(`\n🎯 EXECUTING TRANSACTION...`);
            const txStartTime = Date.now();

            const result = await executeFlashLoanTransaction(execOpp, wsProvider);

            const txTime = Date.now() - txStartTime;
            const totalTime = Date.now() - executionStartTime;

            console.log(`\n📊 TRANSACTION RESULT (executed in ${txTime}ms):`);
            console.log(JSON.stringify(result, null, 2));

            if (result.success) {
                console.log(`\n✅ ✅ ✅ TRANSACTION SUCCESSFUL! ✅ ✅ ✅`);
                console.log(`   TX Hash: ${result.txHash}`);
                console.log(`   Block Number: ${result.blockNumber}`);
                console.log(`   Gas Used: ${result.gasUsed}`);
                console.log(`   Gas Price: ${result.gasPrice} Gwei`);
                console.log(`   Gas Cost: ${result.gasCost} ETH`);
                console.log(`   Priority Fee: ${result.priorityFee} Gwei`);
                console.log(`   Total Execution Time: ${totalTime}ms`);
            } else {
                console.log(`\n❌ ❌ ❌ TRANSACTION FAILED! ❌ ❌ ❌`);
                console.log(`   Error: ${result.error}`);
                console.log(`   Total Execution Time: ${totalTime}ms`);
            }
        } else {
            console.log(`\n⏭️  SKIPPING EXECUTION:`);
            if (!execOpp.estimated_profit) {
                console.log(`   Reason: No profit estimate`);
            } else if (!execOpp.pair.endsWith('WETH')) {
                console.log(`   Reason: Not a WETH pair (pair: ${execOpp.pair})`);
            }
        }

    } catch (error) {
        const totalTime = Date.now() - executionStartTime;
        console.log(`\n❌ ❌ ❌ EXECUTION ERROR! ❌ ❌ ❌`);
        console.log(`   Message: ${error.message}`);
        console.log(`   Total Execution Time: ${totalTime}ms`);
        console.log(`\n   Stack Trace:`);
        console.log(error.stack);
    }

    console.log(`\n╚════════════════════════════════════════════════════════════╝\n`);
}

/**
 * Start 30-second cooldown period
 */
function startCooldown() {
    isCooldown = true;
    lastExecutionTime = Date.now();

    console.log(`\n⏸️  ====== STARTING 30-SECOND COOLDOWN ======`);
    console.log(`   Next analysis will start at: ${new Date(lastExecutionTime + 30000).toLocaleTimeString()}`);

    // Set timeout to end cooldown
    setTimeout(() => {
        isCooldown = false;
        console.log(`\n✅ ====== COOLDOWN ENDED - Ready for next analysis ======\n`);
    }, 30000);
}

/**
 * Process arbitrage opportunities for execution
 */


// --- START THE BOT ---
async function startBot() {
    try {
        console.log('🚀 Starting Arbitrage Bot...');




        wsProvider = ws.getProvider(); // Get the initialized WebSocket provider
        console.log(`Using WebSocket Provider: ${wsProvider}`);


        await logger.init();


        // 3.5. Log V3 Engine status
        console.log(`🚀 V3 Engine Status: ${v3EngineEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
        if (v3EngineEnabled) {
            console.log('   📊 V3 Engine will provide enhanced arbitrage analysis');
            console.log('   🔧 To disable V3 Engine, set V3_ENGINE_ENABLED=false in .env');
        } else {
            console.log('   🔄 Using legacy arbitrage analysis only');
        }

        // 5. Connect to DB and start API/monitoring
        console.log('Connecting to and initializing database...');
        await db.init();
        console.log('|| Database connected and initialized successfully. ||');

        // Start API server with network configuration
        console.log('🌐 Starting API server...');
        console.log(`📡 API will be accessible on port ${process.env.API_PORT || 8000}`);
        console.log(`🔗 External access: http://172.31.18.227:${process.env.API_PORT || 8000}`);
        startApi();

        console.log('Starting execution layer...');
        executeOpportunities(); // Non-blocking

        // Start periodic DB flush
        console.log('Starting periodic DB flush...');
        setInterval(flushToDB, 30000); // Every 30 seconds

        // 6. Subscribe to new blocks and trigger the monitor function
        wsProvider.on('block', (blockNumber) => { // <-- ADDED
            console.log(`New block received: ${blockNumber}`);
            monitor();
        });

        // 7. Set up graceful shutdown
        setupGracefulShutdown();

    } catch (error) {
        console.error("Failed to start the bot:", error);
        process.exit(1);
    }
}

/**
 * Set up graceful shutdown handling
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

        try {
            // Stop opportunity processor if running
            if (opportunityProcessor) {
                console.log('Stopping opportunity processor...');
                await opportunityProcessor.emergencyStop();
            }

            // Close database connection
            console.log('Closing database connection...');
            await db.close();

            // Close WebSocket provider
            if (wsProvider) {
                console.log('Closing WebSocket provider...');
                wsProvider.destroy();
            }

            const redis = (await import('./config/radis.js')).default;
            console.log('Closing Redis connection...');
            await redis.quit();

            console.log('✅ Graceful shutdown completed');
            process.exit(0);

        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        shutdown('unhandledRejection');
    });
}

startBot();





