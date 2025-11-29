/**
 * Parallel Execution Layer
 * Executes multiple arbitrage opportunities simultaneously
 * Optimized for high-frequency trading with local Ethereum node
 */

import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import { EXECUTION_CONFIG } from '../config/parallelConfig.js';
import { executeFlashLoanTransaction } from './executionLayer.js';
import { consumeTopOpportunity } from '../services/opportunity.js';

/**
 * Nonce Manager for parallel transactions
 * Prevents nonce conflicts when sending multiple txs simultaneously
 */
class NonceManager {
    constructor(provider, walletAddress) {
        this.provider = provider;
        this.walletAddress = walletAddress;
        this.currentNonce = null;
        this.pendingNonces = new Set();
        this.isInitialized = false;
    }

    async initialize() {
        this.currentNonce = await this.provider.getTransactionCount(this.walletAddress, 'pending');
        this.isInitialized = true;
        logger.info(`✅ Nonce Manager initialized at nonce ${this.currentNonce}`);
    }

    /**
     * Get next available nonce
     */
    async getNextNonce() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Find first available nonce
        let nonce = this.currentNonce;
        while (this.pendingNonces.has(nonce)) {
            nonce++;
        }

        this.pendingNonces.add(nonce);
        this.currentNonce = Math.max(this.currentNonce, nonce + 1);

        logger.debug(`📝 Assigned nonce ${nonce} (pending: ${this.pendingNonces.size})`);
        return nonce;
    }

    /**
     * Release nonce after transaction confirmed/failed
     */
    releaseNonce(nonce) {
        this.pendingNonces.delete(nonce);
        logger.debug(`✅ Released nonce ${nonce} (pending: ${this.pendingNonces.size})`);
    }

    /**
     * Reset nonce manager (call if transactions are stuck)
     */
    async reset() {
        this.currentNonce = await this.provider.getTransactionCount(this.walletAddress, 'pending');
        this.pendingNonces.clear();
        logger.info(`🔄 Nonce Manager reset to ${this.currentNonce}`);
    }

    getPendingCount() {
        return this.pendingNonces.size;
    }
}

/**
 * Execution Worker
 * Single worker that continuously processes opportunities from queue
 */
class ExecutionWorker {
    constructor(workerId, provider, nonceManager) {
        this.workerId = workerId;
        this.provider = provider;
        this.nonceManager = nonceManager;
        this.stats = {
            processed: 0,
            successful: 0,
            failed: 0,
            totalProfit: 0n,
            avgExecutionTime: 0
        };
        this.isRunning = false;
        this.currentTask = null;
    }

    async start() {
        this.isRunning = true;
        logger.info(`🚀 Worker ${this.workerId} started`);

        while (this.isRunning) {
            try {
                // Get next opportunity from Redis
                const opp = await consumeTopOpportunity();

                if (!opp) {
                    // No opportunities available, sleep
                    await this.sleep(EXECUTION_CONFIG.WORKER_SLEEP);
                    continue;
                }

                // Process opportunity
                await this.processOpportunity(opp);

            } catch (error) {
                logger.error(`Worker ${this.workerId} error:`, error.message);
                await this.sleep(1000); // Sleep on error
            }
        }

        logger.info(`🛑 Worker ${this.workerId} stopped`);
    }

    async processOpportunity(opp) {
        const startTime = Date.now();
        this.currentTask = opp.id;
        this.stats.processed++;

        logger.info(`👷 Worker ${this.workerId} processing opportunity ${opp.id}`);

        try {
            // Get nonce for this transaction
            let nonce = null;
            if (EXECUTION_CONFIG.FAST_NONCE_MANAGEMENT) {
                nonce = await this.nonceManager.getNextNonce();
            }

            // Execute transaction
            const result = await executeFlashLoanTransaction(
                opp,
                this.provider,
                opp,
                nonce
            );

            const executionTime = Date.now() - startTime;
            this.stats.avgExecutionTime =
                (this.stats.avgExecutionTime * (this.stats.processed - 1) + executionTime) /
                this.stats.processed;

            if (result.success) {
                this.stats.successful++;
                const profit = BigInt(opp.estimated_profit || 0);
                this.stats.totalProfit += profit;

                logger.info(
                    `✅ Worker ${this.workerId} SUCCESS: ${opp.id} | ` +
                    `Profit: ${ethers.formatEther(profit)} ETH | ` +
                    `Time: ${executionTime}ms | ` +
                    `TX: ${result.txHash}`
                );
            } else {
                this.stats.failed++;
                logger.warn(
                    `❌ Worker ${this.workerId} FAILED: ${opp.id} | ` +
                    `Error: ${result.error} | ` +
                    `Time: ${executionTime}ms`
                );
            }

            // Release nonce
            if (nonce !== null) {
                this.nonceManager.releaseNonce(nonce);
            }

        } catch (error) {
            this.stats.failed++;
            logger.error(`Worker ${this.workerId} exception:`, error.message);

            // Release nonce on error
            if (EXECUTION_CONFIG.FAST_NONCE_MANAGEMENT) {
                await this.nonceManager.reset();
            }
        } finally {
            this.currentTask = null;
        }
    }

    stop() {
        this.isRunning = false;
        logger.info(`⏸️  Worker ${this.workerId} stopping...`);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        const successRate = this.stats.processed > 0
            ? ((this.stats.successful / this.stats.processed) * 100).toFixed(1)
            : '0.0';

        return {
            workerId: this.workerId,
            processed: this.stats.processed,
            successful: this.stats.successful,
            failed: this.stats.failed,
            successRate: successRate + '%',
            totalProfit: ethers.formatEther(this.stats.totalProfit) + ' ETH',
            avgExecutionTime: this.stats.avgExecutionTime.toFixed(0) + 'ms',
            currentTask: this.currentTask || 'idle'
        };
    }
}

/**
 * Parallel Execution Manager
 * Manages multiple workers for concurrent execution
 */
export class ParallelExecutionManager {
    constructor(provider) {
        this.provider = provider;
        this.workers = [];
        this.nonceManager = null;
        this.numWorkers = EXECUTION_CONFIG.NUM_WORKERS;
        this.isRunning = false;
        this.stats = {
            startTime: null,
            totalProcessed: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            totalProfit: 0n
        };
    }

    async initialize() {
        logger.info(`🚀 Initializing Parallel Execution Manager with ${this.numWorkers} workers...`);

        // Initialize nonce manager
        if (EXECUTION_CONFIG.FAST_NONCE_MANAGEMENT) {
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('PRIVATE_KEY not found in environment');
            }

            const wallet = new ethers.Wallet(privateKey);
            this.nonceManager = new NonceManager(this.provider, wallet.address);
            await this.nonceManager.initialize();
        }

        // Create workers
        for (let i = 1; i <= this.numWorkers; i++) {
            const worker = new ExecutionWorker(i, this.provider, this.nonceManager);
            this.workers.push(worker);
        }

        logger.info(`✅ Parallel Execution Manager initialized`);
    }

    /**
     * Start all workers
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Execution Manager already running');
            return;
        }

        this.isRunning = true;
        this.stats.startTime = Date.now();

        logger.info(`🚀 Starting ${this.numWorkers} execution workers...`);

        // Start all workers in parallel (non-blocking)
        this.workers.forEach(worker => {
            worker.start().catch(error => {
                logger.error(`Worker ${worker.workerId} crashed:`, error);
            });
        });

        // Start statistics logger
        this.startStatsLogger();

        logger.info(`✅ All workers started and running`);
    }

    /**
     * Stop all workers
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('Execution Manager not running');
            return;
        }

        logger.info('🛑 Stopping all workers...');

        this.isRunning = false;
        this.workers.forEach(worker => worker.stop());

        // Wait for all workers to finish current tasks (max 10 seconds)
        await Promise.race([
            Promise.all(this.workers.map(w => new Promise(resolve => {
                const check = setInterval(() => {
                    if (!w.currentTask) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            }))),
            new Promise(resolve => setTimeout(resolve, 10000))
        ]);

        logger.info('✅ All workers stopped');
        this.logFinalStats();
    }

    /**
     * Start periodic stats logging
     */
    startStatsLogger() {
        setInterval(() => {
            if (this.isRunning) {
                this.updateGlobalStats();
                this.logStats();
            }
        }, 60000); // Log every minute
    }

    /**
     * Update global statistics from workers
     */
    updateGlobalStats() {
        this.stats.totalProcessed = 0;
        this.stats.totalSuccessful = 0;
        this.stats.totalFailed = 0;
        this.stats.totalProfit = 0n;

        for (const worker of this.workers) {
            this.stats.totalProcessed += worker.stats.processed;
            this.stats.totalSuccessful += worker.stats.successful;
            this.stats.totalFailed += worker.stats.failed;
            this.stats.totalProfit += worker.stats.totalProfit;
        }
    }

    /**
     * Log statistics
     */
    logStats() {
        this.updateGlobalStats();

        const successRate = this.stats.totalProcessed > 0
            ? ((this.stats.totalSuccessful / this.stats.totalProcessed) * 100).toFixed(1)
            : '0.0';

        const uptime = this.stats.startTime
            ? ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1)
            : '0.0';

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║          PARALLEL EXECUTION MANAGER STATISTICS             ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Active Workers: ${this.numWorkers}`);
        console.log(`Uptime: ${uptime} minutes`);
        console.log(`Total Processed: ${this.stats.totalProcessed}`);
        console.log(`Successful: ${this.stats.totalSuccessful}`);
        console.log(`Failed: ${this.stats.totalFailed}`);
        console.log(`Success Rate: ${successRate}%`);
        console.log(`Total Profit: ${ethers.formatEther(this.stats.totalProfit)} ETH`);

        if (this.nonceManager) {
            console.log(`Pending Transactions: ${this.nonceManager.getPendingCount()}`);
        }

        console.log('\n👷 Worker Details:');
        console.log('─'.repeat(60));

        for (const worker of this.workers) {
            const stats = worker.getStats();
            console.log(`Worker ${stats.workerId}:`);
            console.log(`  Processed: ${stats.processed} | Success: ${stats.successRate}`);
            console.log(`  Profit: ${stats.totalProfit} | Avg Time: ${stats.avgExecutionTime}`);
            console.log(`  Status: ${stats.currentTask}`);
            console.log('');
        }
    }

    /**
     * Log final statistics on shutdown
     */
    logFinalStats() {
        this.updateGlobalStats();
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              FINAL EXECUTION STATISTICS                    ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Total Opportunities Processed: ${this.stats.totalProcessed}`);
        console.log(`Total Successful: ${this.stats.totalSuccessful}`);
        console.log(`Total Failed: ${this.stats.totalFailed}`);
        console.log(`Final Success Rate: ${((this.stats.totalSuccessful / this.stats.totalProcessed) * 100).toFixed(1)}%`);
        console.log(`Total Profit Earned: ${ethers.formatEther(this.stats.totalProfit)} ETH`);
        console.log('');
    }
}

// Export singleton instance creator
let managerInstance = null;

export async function initializeParallelExecution(provider) {
    if (!managerInstance) {
        managerInstance = new ParallelExecutionManager(provider);
        await managerInstance.initialize();
    }
    return managerInstance;
}

export function getExecutionManager() {
    if (!managerInstance) {
        throw new Error('Parallel Execution Manager not initialized');
    }
    return managerInstance;
}

export default ParallelExecutionManager;
