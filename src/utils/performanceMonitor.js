/**
 * Performance Monitor
 * Tracks and logs performance metrics for the parallel processing system
 */

import logger from './logger.js';
import { MONITORING_CONFIG } from '../config/parallelConfig.js';

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            rpcCalls: { count: 0, totalLatency: 0, errors: 0 },
            quoteFetching: { count: 0, totalLatency: 0, cached: 0, errors: 0 },
            opportunityAnalysis: { count: 0, totalLatency: 0, found: 0 },
            execution: { count: 0, totalLatency: 0, successful: 0, failed: 0 },
            gasEstimation: { count: 0, totalLatency: 0, errors: 0 },
            blockProcessing: { count: 0, totalLatency: 0, missed: 0 }
        };

        this.slowOperations = [];
        this.enabled = MONITORING_CONFIG.ENABLED;
        this.slowThreshold = MONITORING_CONFIG.SLOW_THRESHOLD;

        if (this.enabled && MONITORING_CONFIG.STATS_INTERVAL) {
            this.startStatsLogger();
        }
    }

    /**
     * Track RPC call
     */
    trackRPCCall(latency, success = true) {
        if (!this.enabled) return;

        this.metrics.rpcCalls.count++;
        this.metrics.rpcCalls.totalLatency += latency;
        if (!success) this.metrics.rpcCalls.errors++;

        if (MONITORING_CONFIG.LOG_SLOW_OPERATIONS && latency > this.slowThreshold) {
            this.logSlowOperation('RPC Call', latency);
        }
    }

    /**
     * Track quote fetching
     */
    trackQuoteFetch(latency, cached = false, success = true) {
        if (!this.enabled) return;

        this.metrics.quoteFetching.count++;
        this.metrics.quoteFetching.totalLatency += latency;
        if (cached) this.metrics.quoteFetching.cached++;
        if (!success) this.metrics.quoteFetching.errors++;

        if (MONITORING_CONFIG.LOG_SLOW_OPERATIONS && latency > this.slowThreshold) {
            this.logSlowOperation('Quote Fetch', latency);
        }
    }

    /**
     * Track opportunity analysis
     */
    trackAnalysis(latency, opportunitiesFound = 0) {
        if (!this.enabled) return;

        this.metrics.opportunityAnalysis.count++;
        this.metrics.opportunityAnalysis.totalLatency += latency;
        this.metrics.opportunityAnalysis.found += opportunitiesFound;

        if (MONITORING_CONFIG.LOG_SLOW_OPERATIONS && latency > this.slowThreshold) {
            this.logSlowOperation('Opportunity Analysis', latency);
        }
    }

    /**
     * Track execution
     */
    trackExecution(latency, success = true) {
        if (!this.enabled) return;

        this.metrics.execution.count++;
        this.metrics.execution.totalLatency += latency;
        if (success) {
            this.metrics.execution.successful++;
        } else {
            this.metrics.execution.failed++;
        }

        if (MONITORING_CONFIG.LOG_SLOW_OPERATIONS && latency > this.slowThreshold) {
            this.logSlowOperation('Execution', latency);
        }
    }

    /**
     * Track gas estimation
     */
    trackGasEstimation(latency, success = true) {
        if (!this.enabled) return;

        this.metrics.gasEstimation.count++;
        this.metrics.gasEstimation.totalLatency += latency;
        if (!success) this.metrics.gasEstimation.errors++;
    }

    /**
     * Track block processing
     */
    trackBlockProcessing(latency, missed = false) {
        if (!this.enabled) return;

        this.metrics.blockProcessing.count++;
        this.metrics.blockProcessing.totalLatency += latency;
        if (missed) this.metrics.blockProcessing.missed++;

        if (MONITORING_CONFIG.LOG_SLOW_OPERATIONS && latency > this.slowThreshold) {
            this.logSlowOperation('Block Processing', latency);
        }
    }

    /**
     * Log slow operation
     */
    logSlowOperation(operation, latency) {
        const entry = {
            operation,
            latency,
            timestamp: Date.now()
        };

        this.slowOperations.push(entry);

        // Keep only last 100 slow operations
        if (this.slowOperations.length > 100) {
            this.slowOperations.shift();
        }

        logger.warn(`⚠️  SLOW: ${operation} took ${latency}ms`);
    }

    /**
     * Get statistics
     */
    getStats() {
        const calcAvg = (metric) => {
            return metric.count > 0
                ? (metric.totalLatency / metric.count).toFixed(2) + 'ms'
                : 'N/A';
        };

        const calcRate = (success, total) => {
            return total > 0 ? ((success / total) * 100).toFixed(1) + '%' : 'N/A';
        };

        return {
            rpcCalls: {
                count: this.metrics.rpcCalls.count,
                avgLatency: calcAvg(this.metrics.rpcCalls),
                errorRate: calcRate(this.metrics.rpcCalls.errors, this.metrics.rpcCalls.count)
            },
            quoteFetching: {
                count: this.metrics.quoteFetching.count,
                avgLatency: calcAvg(this.metrics.quoteFetching),
                cacheHitRate: calcRate(this.metrics.quoteFetching.cached, this.metrics.quoteFetching.count),
                errorRate: calcRate(this.metrics.quoteFetching.errors, this.metrics.quoteFetching.count)
            },
            opportunityAnalysis: {
                count: this.metrics.opportunityAnalysis.count,
                avgLatency: calcAvg(this.metrics.opportunityAnalysis),
                avgOpportunitiesFound: this.metrics.opportunityAnalysis.count > 0
                    ? (this.metrics.opportunityAnalysis.found / this.metrics.opportunityAnalysis.count).toFixed(1)
                    : '0.0'
            },
            execution: {
                count: this.metrics.execution.count,
                avgLatency: calcAvg(this.metrics.execution),
                successRate: calcRate(this.metrics.execution.successful, this.metrics.execution.count)
            },
            gasEstimation: {
                count: this.metrics.gasEstimation.count,
                avgLatency: calcAvg(this.metrics.gasEstimation),
                errorRate: calcRate(this.metrics.gasEstimation.errors, this.metrics.gasEstimation.count)
            },
            blockProcessing: {
                count: this.metrics.blockProcessing.count,
                avgLatency: calcAvg(this.metrics.blockProcessing),
                missedRate: calcRate(this.metrics.blockProcessing.missed, this.metrics.blockProcessing.count)
            },
            slowOperations: this.slowOperations.length
        };
    }

    /**
     * Log statistics
     */
    logStats() {
        const stats = this.getStats();

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              PERFORMANCE MONITOR STATISTICS                ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        console.log('\n📞 RPC Calls:');
        console.log(`   Count: ${stats.rpcCalls.count}`);
        console.log(`   Avg Latency: ${stats.rpcCalls.avgLatency}`);
        console.log(`   Error Rate: ${stats.rpcCalls.errorRate}`);

        console.log('\n💱 Quote Fetching:');
        console.log(`   Count: ${stats.quoteFetching.count}`);
        console.log(`   Avg Latency: ${stats.quoteFetching.avgLatency}`);
        console.log(`   Cache Hit Rate: ${stats.quoteFetching.cacheHitRate}`);
        console.log(`   Error Rate: ${stats.quoteFetching.errorRate}`);

        console.log('\n🔍 Opportunity Analysis:');
        console.log(`   Count: ${stats.opportunityAnalysis.count}`);
        console.log(`   Avg Latency: ${stats.opportunityAnalysis.avgLatency}`);
        console.log(`   Avg Opportunities Found: ${stats.opportunityAnalysis.avgOpportunitiesFound}`);

        console.log('\n⚡ Execution:');
        console.log(`   Count: ${stats.execution.count}`);
        console.log(`   Avg Latency: ${stats.execution.avgLatency}`);
        console.log(`   Success Rate: ${stats.execution.successRate}`);

        console.log('\n⛽ Gas Estimation:');
        console.log(`   Count: ${stats.gasEstimation.count}`);
        console.log(`   Avg Latency: ${stats.gasEstimation.avgLatency}`);
        console.log(`   Error Rate: ${stats.gasEstimation.errorRate}`);

        console.log('\n📦 Block Processing:');
        console.log(`   Count: ${stats.blockProcessing.count}`);
        console.log(`   Avg Latency: ${stats.blockProcessing.avgLatency}`);
        console.log(`   Missed Rate: ${stats.blockProcessing.missedRate}`);

        if (stats.slowOperations > 0) {
            console.log(`\n⚠️  Slow Operations Detected: ${stats.slowOperations}`);
        }

        console.log('');
    }

    /**
     * Start automatic stats logging
     */
    startStatsLogger() {
        setInterval(() => {
            if (this.enabled) {
                this.logStats();
            }
        }, MONITORING_CONFIG.STATS_INTERVAL);
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            rpcCalls: { count: 0, totalLatency: 0, errors: 0 },
            quoteFetching: { count: 0, totalLatency: 0, cached: 0, errors: 0 },
            opportunityAnalysis: { count: 0, totalLatency: 0, found: 0 },
            execution: { count: 0, totalLatency: 0, successful: 0, failed: 0 },
            gasEstimation: { count: 0, totalLatency: 0, errors: 0 },
            blockProcessing: { count: 0, totalLatency: 0, missed: 0 }
        };
        this.slowOperations = [];
        logger.info('🔄 Performance metrics reset');
    }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
