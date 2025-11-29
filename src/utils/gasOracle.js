/**
 * Gas Oracle - Predictive Gas Pricing
 * Predicts next block base fees and calculates optimal priority fees
 * Optimized for winning MEV opportunities
 */

import { ethers } from 'ethers';
import logger from './logger.js';
import { GAS_CONFIG } from '../config/parallelConfig.js';

export class GasOracle {
    constructor(provider) {
        this.provider = provider;
        this.history = [];
        this.historySize = GAS_CONFIG.HISTORY_SIZE;
        this.isInitialized = false;
        this.currentBlock = null;
        this.blockListener = null;
        this.stats = {
            predictions: 0,
            correctPredictions: 0,
            avgError: 0
        };
    }

    async initialize() {
        logger.info('🔮 Initializing Gas Oracle...');

        // Get current block
        const blockNumber = await this.provider.getBlockNumber();
        this.currentBlock = await this.provider.getBlock(blockNumber);

        // Build initial history
        logger.info(`Building gas history (last ${this.historySize} blocks)...`);
        await this.buildHistory(blockNumber);

        // Start block listener
        this.startBlockListener();

        this.isInitialized = true;
        logger.info('✅ Gas Oracle initialized and listening for blocks');
    }

    /**
     * Build initial history from past blocks
     */
    async buildHistory(currentBlockNumber) {
        const startBlock = Math.max(0, currentBlockNumber - this.historySize);
        const promises = [];

        for (let i = startBlock; i <= currentBlockNumber; i++) {
            promises.push(
                this.provider.getBlock(i).then(block => ({
                    blockNumber: block.number,
                    baseFee: block.baseFeePerGas,
                    gasUsed: block.gasUsed,
                    gasLimit: block.gasLimit,
                    timestamp: block.timestamp,
                    transactionCount: block.transactions.length
                }))
            );
        }

        const blocks = await Promise.all(promises);
        this.history = blocks.sort((a, b) => a.blockNumber - b.blockNumber);

        logger.info(`✅ Built history of ${this.history.length} blocks`);
    }

    /**
     * Start listening for new blocks
     */
    startBlockListener() {
        this.blockListener = async (blockNumber) => {
            try {
                const block = await this.provider.getBlock(blockNumber);
                this.currentBlock = block;

                // Add to history
                this.history.push({
                    blockNumber: block.number,
                    baseFee: block.baseFeePerGas,
                    gasUsed: block.gasUsed,
                    gasLimit: block.gasLimit,
                    timestamp: block.timestamp,
                    transactionCount: block.transactions.length
                });

                // Maintain history size
                if (this.history.length > this.historySize) {
                    this.history.shift();
                }

                logger.debug(
                    `📊 Block ${blockNumber}: ` +
                    `baseFee ${ethers.formatUnits(block.baseFeePerGas, 'gwei')} Gwei, ` +
                    `${block.transactions.length} txs`
                );

            } catch (error) {
                logger.error(`Error processing block ${blockNumber}:`, error.message);
            }
        };

        this.provider.on('block', this.blockListener);
    }

    /**
     * Stop block listener
     */
    stop() {
        if (this.blockListener) {
            this.provider.off('block', this.blockListener);
            logger.info('⏸️  Gas Oracle stopped');
        }
    }

    /**
     * Predict next block's base fee using EIP-1559 formula
     * EIP-1559: baseFee can change by max ±12.5% per block
     */
    predictNextBlockBaseFee() {
        if (this.history.length === 0) {
            return null;
        }

        const latestBlock = this.history[this.history.length - 1];
        const baseFee = latestBlock.baseFee;
        const gasUsed = latestBlock.gasUsed;
        const gasTarget = latestBlock.gasLimit / 2n; // Target is 50% of gas limit

        // EIP-1559 formula
        if (gasUsed > gasTarget) {
            // Block was more than 50% full - base fee increases
            const gasUsedDelta = gasUsed - gasTarget;
            const baseFeePerGasDelta = (baseFee * gasUsedDelta) / gasTarget / 8n;
            const nextBaseFee = baseFee + baseFeePerGasDelta;
            return nextBaseFee;
        } else {
            // Block was less than 50% full - base fee decreases
            const gasUsedDelta = gasTarget - gasUsed;
            const baseFeePerGasDelta = (baseFee * gasUsedDelta) / gasTarget / 8n;
            const nextBaseFee = baseFee - baseFeePerGasDelta;
            return nextBaseFee > 0n ? nextBaseFee : baseFee;
        }
    }

    /**
     * Get average base fee over recent blocks
     */
    getAverageBaseFee(blocks = 10) {
        const recentBlocks = this.history.slice(-blocks);
        if (recentBlocks.length === 0) return 0n;

        const sum = recentBlocks.reduce((acc, block) => acc + block.baseFee, 0n);
        return sum / BigInt(recentBlocks.length);
    }

    /**
     * Calculate optimal priority fee based on profit and competition
     */
    calculateOptimalPriorityFee(estimatedProfitWei) {
        const profitBigInt = BigInt(estimatedProfitWei);

        // Calculate priority fee as percentage of profit
        let priorityFee = (profitBigInt * BigInt(GAS_CONFIG.PRIORITY_FEE.PROFIT_PERCENTAGE)) / 100n;

        // Apply min/max limits
        const minPriorityFee = ethers.parseUnits(GAS_CONFIG.PRIORITY_FEE.MIN.toString(), 'gwei');
        const maxPriorityFee = ethers.parseUnits(GAS_CONFIG.PRIORITY_FEE.MAX.toString(), 'gwei');

        if (priorityFee < minPriorityFee) {
            priorityFee = minPriorityFee;
        } else if (priorityFee > maxPriorityFee) {
            priorityFee = maxPriorityFee;
        }

        // Aggressive mode: increase by 20%
        if (GAS_CONFIG.PRIORITY_FEE.AGGRESSIVE) {
            priorityFee = (priorityFee * 120n) / 100n;
        }

        return priorityFee;
    }

    /**
     * Get optimal gas prices for transaction
     */
    getOptimalGasPrices(estimatedProfitWei = 0) {
        if (!this.isInitialized || this.history.length === 0) {
            // Fallback to current block's base fee
            const currentBaseFee = this.currentBlock?.baseFeePerGas || ethers.parseUnits('30', 'gwei');
            return {
                maxFeePerGas: currentBaseFee * 2n,
                maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
                predictedBaseFee: currentBaseFee,
                confidence: 'low'
            };
        }

        // Predict next block's base fee
        const predictedBaseFee = this.predictNextBlockBaseFee();

        // Calculate priority fee based on profit
        const priorityFee = this.calculateOptimalPriorityFee(estimatedProfitWei);

        // maxFeePerGas = predictedBaseFee * 2 + priorityFee (with buffer)
        const maxFeePerGas = predictedBaseFee * 2n + priorityFee;

        this.stats.predictions++;

        return {
            maxFeePerGas,
            maxPriorityFeePerGas: priorityFee,
            predictedBaseFee,
            confidence: 'high'
        };
    }

    /**
     * Get gas prices optimized for speed (compete harder)
     */
    getAggressiveGasPrices(estimatedProfitWei = 0) {
        const standard = this.getOptimalGasPrices(estimatedProfitWei);

        // Increase priority fee by 50% for aggressive mode
        return {
            maxFeePerGas: standard.maxFeePerGas,
            maxPriorityFeePerGas: (standard.maxPriorityFeePerGas * 150n) / 100n,
            predictedBaseFee: standard.predictedBaseFee,
            confidence: standard.confidence
        };
    }

    /**
     * Estimate if transaction will be profitable after gas costs
     */
    async estimateProfitability(estimatedProfitWei, gasLimit) {
        const gasPrices = this.getOptimalGasPrices(estimatedProfitWei);
        const gasCost = gasPrices.maxFeePerGas * BigInt(gasLimit);
        const profit = BigInt(estimatedProfitWei);
        const netProfit = profit - gasCost;

        return {
            profitable: netProfit > 0n,
            netProfit,
            gasCost,
            grossProfit: profit,
            gasPrices
        };
    }

    /**
     * Get network congestion level (0-100)
     */
    getNetworkCongestion() {
        if (this.history.length < 5) return 50;

        const recentBlocks = this.history.slice(-5);
        let totalUtilization = 0;

        for (const block of recentBlocks) {
            const utilization = Number(block.gasUsed * 100n / block.gasLimit);
            totalUtilization += utilization;
        }

        return Math.round(totalUtilization / recentBlocks.length);
    }

    /**
     * Get statistics
     */
    getStats() {
        if (this.history.length === 0) {
            return {
                currentBaseFee: 'N/A',
                predictedBaseFee: 'N/A',
                avgBaseFee: 'N/A',
                networkCongestion: 'N/A',
                historySize: 0
            };
        }

        const latest = this.history[this.history.length - 1];
        const predicted = this.predictNextBlockBaseFee();
        const average = this.getAverageBaseFee(10);
        const congestion = this.getNetworkCongestion();

        return {
            currentBaseFee: ethers.formatUnits(latest.baseFee, 'gwei') + ' Gwei',
            predictedBaseFee: predicted ? ethers.formatUnits(predicted, 'gwei') + ' Gwei' : 'N/A',
            avgBaseFee: ethers.formatUnits(average, 'gwei') + ' Gwei',
            networkCongestion: congestion + '%',
            historySize: this.history.length,
            totalPredictions: this.stats.predictions
        };
    }

    /**
     * Log statistics
     */
    logStats() {
        const stats = this.getStats();
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                  GAS ORACLE STATISTICS                     ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Current Base Fee: ${stats.currentBaseFee}`);
        console.log(`Predicted Base Fee: ${stats.predictedBaseFee}`);
        console.log(`Average Base Fee (10 blocks): ${stats.avgBaseFee}`);
        console.log(`Network Congestion: ${stats.networkCongestion}`);
        console.log(`History Size: ${stats.historySize} blocks`);
        console.log(`Total Predictions: ${stats.totalPredictions}`);
        console.log('');
    }
}

// Singleton instance
let gasOracleInstance = null;

export async function initializeGasOracle(provider) {
    if (!gasOracleInstance) {
        gasOracleInstance = new GasOracle(provider);
        await gasOracleInstance.initialize();
    }
    return gasOracleInstance;
}

export function getGasOracle() {
    if (!gasOracleInstance) {
        throw new Error('Gas Oracle not initialized');
    }
    return gasOracleInstance;
}

export default GasOracle;
