/**
 * Smart RPC Router - Optimized for Local Ethereum Node
 * Provides ultra-low latency RPC calls with automatic fallback
 */

import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import { RPC_CONFIG } from '../config/parallelConfig.js';

class RPCProvider {
    constructor(name, httpUrl, wsUrl, priority, isLocal = false) {
        this.name = name;
        this.httpUrl = httpUrl;
        this.wsUrl = wsUrl;
        this.priority = priority;
        this.isLocal = isLocal;
        this.httpProvider = null;
        this.wsProvider = null;
        this.latency = 0;
        this.failureCount = 0;
        this.lastFailure = null;
        this.isHealthy = true;
        this.requestCount = 0;
        this.successCount = 0;
    }

    async initialize() {
        try {
            // Use chainId 1 for mainnet (prevents auto-detection issues)
            const network = 1; // Mainnet chain ID

            // Initialize HTTP provider
            if (this.httpUrl) {
                this.httpProvider = new ethers.JsonRpcProvider(this.httpUrl, network);
                // Wait for provider to be ready
                await this.httpProvider._detectNetwork();
                await this.httpProvider.getBlockNumber(); // Test connection
                console.log(`✅ HTTP provider ${this.name} connected`);
            }

            // Initialize WebSocket provider
            if (this.wsUrl) {
                this.wsProvider = new ethers.WebSocketProvider(this.wsUrl, network);
                // Wait for provider to be ready
                await this.wsProvider._detectNetwork();
                await this.wsProvider.getBlockNumber(); // Test connection
                console.log(`✅ WebSocket provider ${this.name} connected`);
            }

            this.isHealthy = true;
            logger.info(`✅ RPC provider ${this.name} initialized (Local: ${this.isLocal})`);
        } catch (error) {
            console.error(`❌ Failed to initialize ${this.name}: ${error.message}`);
            logger.error(`❌ Failed to initialize ${this.name}: ${error.message}`);
            this.isHealthy = false;
            this.failureCount++;
        }
    }

    async call(method, params = []) {
        const start = Date.now();
        this.requestCount++;

        try {
            // Prefer HTTP for most calls (faster for single requests)
            const provider = this.httpProvider || this.wsProvider;
            if (!provider) {
                throw new Error('No provider available');
            }

            const result = await provider.send(method, params);
            this.latency = Date.now() - start;
            this.isHealthy = true;
            this.failureCount = 0;
            this.successCount++;

            return { success: true, result, latency: this.latency };
        } catch (error) {
            this.latency = Date.now() - start;
            this.isHealthy = false;
            this.failureCount++;
            this.lastFailure = Date.now();

            logger.warn(`${this.name} failed for ${method}: ${error.message}`);
            return { success: false, error: error.message, latency: this.latency };
        }
    }

    getScore() {
        if (!this.isHealthy) return 0;

        // Score calculation:
        // - Local node gets massive bonus (100x)
        // - Lower latency = higher score
        // - Success rate affects score
        const successRate = this.requestCount > 0 ? this.successCount / this.requestCount : 1;
        const effectivePriority = this.isLocal ? this.priority * 100 : this.priority;

        return (effectivePriority * successRate) / (this.latency + 1);
    }

    getProvider(preferWs = false) {
        if (preferWs && this.wsProvider) return this.wsProvider;
        return this.httpProvider || this.wsProvider;
    }
}

export class SmartRPCRouter {
    constructor() {
        this.providers = [];
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalLatency: 0,
            providerStats: {}
        };
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            logger.warn('RPC Router already initialized');
            return;
        }

        console.log('🚀 Initializing Smart RPC Router for Local Ethereum Node...');
        console.log(`   HTTP URL: ${RPC_CONFIG.LOCAL_NODE.HTTP_URL}`);
        console.log(`   WS URL: ${RPC_CONFIG.LOCAL_NODE.WS_URL}`);

        // Initialize local node (PRIMARY)
        const localNode = new RPCProvider(
            'LocalEthNode',
            RPC_CONFIG.LOCAL_NODE.HTTP_URL,
            RPC_CONFIG.LOCAL_NODE.WS_URL,
            RPC_CONFIG.LOCAL_NODE.PRIORITY,
            true // is local
        );
        console.log('🔄 Initializing local node provider...');
        await localNode.initialize();
        this.providers.push(localNode);

        // Initialize backup nodes
        for (const [name, config] of Object.entries(RPC_CONFIG.BACKUP_NODES)) {
            if (config.URL) {
                const backup = new RPCProvider(
                    name,
                    config.URL.replace('wss://', 'https://').replace('ws://', 'http://'),
                    config.URL,
                    config.PRIORITY,
                    false
                );
                await backup.initialize();
                this.providers.push(backup);
            }
        }

        const healthyProviders = this.providers.filter(p => p.isHealthy).length;
        logger.info(`✅ Initialized ${healthyProviders}/${this.providers.length} RPC providers`);

        if (healthyProviders === 0) {
            throw new Error('❌ No healthy RPC providers available!');
        }

        // Start health check
        this.startHealthCheck();

        this.isInitialized = true;
        logger.info('✅ Smart RPC Router ready');
    }

    startHealthCheck() {
        setInterval(async () => {
            for (const provider of this.providers) {
                // Retry failed providers after cooldown
                if (!provider.isHealthy && Date.now() - provider.lastFailure > RPC_CONFIG.RETRY_FAILED_AFTER) {
                    logger.info(`🔄 Retrying provider ${provider.name}...`);
                    await provider.initialize();
                }
            }
        }, RPC_CONFIG.HEALTH_CHECK_INTERVAL);
    }

    /**
     * Local First Strategy (RECOMMENDED for local node)
     * Tries local node first, falls back to remote only if needed
     */
    async localFirst(method, params = []) {
        this.stats.totalRequests++;

        // 1. Try local node first
        const localProvider = this.providers.find(p => p.isLocal && p.isHealthy);
        if (localProvider) {
            const result = await localProvider.call(method, params);
            if (result.success) {
                this.updateStats(localProvider, result.latency, true);
                return result.result;
            }
            logger.warn(`⚠️  Local node failed for ${method}, trying backup...`);
        }

        // 2. Fallback to best remote provider
        const remoteProviders = this.providers
            .filter(p => !p.isLocal && p.isHealthy)
            .sort((a, b) => b.getScore() - a.getScore());

        for (const provider of remoteProviders) {
            const result = await provider.call(method, params);
            if (result.success) {
                this.updateStats(provider, result.latency, true);
                return result.result;
            }
        }

        // All providers failed
        this.stats.failedRequests++;
        throw new Error(`❌ All RPC providers failed for ${method}`);
    }

    /**
     * Fastest Strategy (RACE - use first response)
     * Good for non-critical reads where speed matters most
     */
    async fastest(method, params = []) {
        const healthyProviders = this.providers.filter(p => p.isHealthy);

        if (healthyProviders.length === 0) {
            throw new Error('No healthy providers available');
        }

        this.stats.totalRequests++;

        // Race all providers
        const promises = healthyProviders.map(provider =>
            provider.call(method, params).then(result => ({ provider, result }))
        );

        try {
            const winner = await Promise.race(promises);

            if (winner.result.success) {
                this.updateStats(winner.provider, winner.result.latency, true);
                return winner.result.result;
            }

            throw new Error(winner.result.error);
        } catch (error) {
            this.stats.failedRequests++;
            throw error;
        }
    }

    /**
     * Batch multiple calls efficiently
     */
    async batchCall(calls, strategy = 'localFirst') {
        const callFn = strategy === 'fastest' ? this.fastest.bind(this) : this.localFirst.bind(this);

        const promises = calls.map(({ method, params }) => callFn(method, params));
        return await Promise.allSettled(promises);
    }

    /**
     * Get primary provider (local node with WebSocket)
     */
    getPrimaryProvider() {
        const local = this.providers.find(p => p.isLocal && p.isHealthy);
        if (local) {
            return local.getProvider(true); // Prefer WebSocket
        }

        // Fallback to best remote
        const best = this.providers
            .filter(p => p.isHealthy)
            .sort((a, b) => b.getScore() - a.getScore())[0];

        return best ? best.getProvider(true) : null;
    }

    /**
     * Get HTTP provider (for batch calls)
     */
    getHTTPProvider() {
        const local = this.providers.find(p => p.isLocal && p.isHealthy);
        if (local && local.httpProvider) {
            return local.httpProvider;
        }

        // Fallback to best remote HTTP
        const best = this.providers
            .filter(p => p.isHealthy && p.httpProvider)
            .sort((a, b) => b.getScore() - a.getScore())[0];

        return best?.httpProvider || null;
    }

    updateStats(provider, latency, success) {
        // Initialize provider stats if needed
        if (!this.stats.providerStats[provider.name]) {
            this.stats.providerStats[provider.name] = {
                requests: 0,
                successes: 0,
                failures: 0,
                totalLatency: 0
            };
        }

        const stats = this.stats.providerStats[provider.name];
        stats.requests++;
        this.stats.totalLatency += latency;

        if (success) {
            stats.successes++;
            stats.totalLatency += latency;
            this.stats.successfulRequests++;
        } else {
            stats.failures++;
            this.stats.failedRequests++;
        }
    }

    getStats() {
        const providerStats = Object.entries(this.stats.providerStats).map(([name, data]) => ({
            name,
            requests: data.requests,
            successes: data.successes,
            failures: data.failures,
            successRate: data.requests > 0
                ? ((data.successes / data.requests) * 100).toFixed(1) + '%'
                : 'N/A',
            avgLatency: data.successes > 0
                ? (data.totalLatency / data.successes).toFixed(2) + 'ms'
                : 'N/A',
            usage: this.stats.totalRequests > 0
                ? ((data.requests / this.stats.totalRequests) * 100).toFixed(1) + '%'
                : '0%'
        }));

        return {
            totalRequests: this.stats.totalRequests,
            successfulRequests: this.stats.successfulRequests,
            failedRequests: this.stats.failedRequests,
            overallSuccessRate: this.stats.totalRequests > 0
                ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
                : 'N/A',
            avgLatency: this.stats.successfulRequests > 0
                ? (this.stats.totalLatency / this.stats.successfulRequests).toFixed(2) + 'ms'
                : 'N/A',
            providers: providerStats
        };
    }

    logStats() {
        const stats = this.getStats();
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              SMART RPC ROUTER STATISTICS                   ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Total Requests: ${stats.totalRequests}`);
        console.log(`Overall Success Rate: ${stats.overallSuccessRate}`);
        console.log(`Average Latency: ${stats.avgLatency}`);
        console.log('\n📊 Provider Performance:');
        console.log('─'.repeat(60));

        for (const provider of stats.providers) {
            const isLocal = provider.name === 'LocalEthNode';
            const icon = isLocal ? '🖥️ ' : '☁️ ';
            console.log(`${icon}${provider.name}:`);
            console.log(`   Requests: ${provider.requests} (${provider.usage})`);
            console.log(`   Success Rate: ${provider.successRate}`);
            console.log(`   Avg Latency: ${provider.avgLatency}`);
            console.log('');
        }
    }
}

// Singleton instance
let routerInstance = null;

export async function initializeRPCRouter() {
    if (!routerInstance) {
        routerInstance = new SmartRPCRouter();
        await routerInstance.initialize();
    }
    return routerInstance;
}

export function getRPCRouter() {
    if (!routerInstance) {
        throw new Error('❌ RPC Router not initialized. Call initializeRPCRouter() first.');
    }
    return routerInstance;
}

export default SmartRPCRouter;
