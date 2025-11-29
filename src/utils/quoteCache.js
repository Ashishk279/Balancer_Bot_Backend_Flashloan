/**
 * Smart Quote Cache with TTL
 * Caches DEX quotes to avoid redundant RPC calls
 * Optimized for high-frequency arbitrage with local node
 */

import logger from './logger.js';
import { QUOTE_CONFIG } from '../config/parallelConfig.js';

class QuoteCache {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            totalSaved: 0,
            avgLatencySaved: 0
        };
        this.enabled = QUOTE_CONFIG.CACHE.ENABLED;
        this.ttl = QUOTE_CONFIG.CACHE.TTL;
        this.maxSize = QUOTE_CONFIG.CACHE.MAX_SIZE;

        if (this.enabled && QUOTE_CONFIG.CACHE.AUTO_CLEANUP) {
            this.startAutoCleanup();
        }

        logger.info(`✅ Quote Cache initialized (TTL: ${this.ttl}ms, Max Size: ${this.maxSize})`);
    }

    /**
     * Generate unique cache key
     */
    getCacheKey(quoter, tokenIn, tokenOut, amountIn, fee = 0) {
        return `${quoter}_${tokenIn}_${tokenOut}_${amountIn}_${fee}`;
    }

    /**
     * Get quote from cache or fetch new one
     */
    async get(key, fetcher, estimatedLatency = 100) {
        if (!this.enabled) {
            return await fetcher();
        }

        // Check cache
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && now - cached.timestamp < this.ttl) {
            // Cache hit!
            this.stats.hits++;
            this.stats.totalSaved++;
            this.stats.avgLatencySaved =
                (this.stats.avgLatencySaved * (this.stats.totalSaved - 1) + estimatedLatency) /
                this.stats.totalSaved;

            logger.debug(`📦 Cache HIT: ${key.substring(0, 50)}...`);
            return cached.value;
        }

        // Cache miss - fetch new quote
        this.stats.misses++;
        logger.debug(`🔍 Cache MISS: Fetching ${key.substring(0, 50)}...`);

        const value = await fetcher();

        // Store in cache
        this.set(key, value);

        return value;
    }

    /**
     * Set value in cache
     */
    set(key, value) {
        // Enforce max size (LRU-like: remove oldest if full)
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [key, data] of this.cache.entries()) {
            if (now - data.timestamp > this.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            logger.debug(`🧹 Cleaned up ${removed} expired cache entries`);
        }
    }

    /**
     * Auto cleanup interval
     */
    startAutoCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.ttl); // Cleanup at TTL interval
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        logger.info('🧹 Quote cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0
            ? ((this.stats.hits / totalRequests) * 100).toFixed(1)
            : '0.0';

        return {
            enabled: this.enabled,
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            totalRequests,
            hitRate: hitRate + '%',
            avgLatencySaved: this.stats.avgLatencySaved.toFixed(2) + 'ms',
            estimatedTimeSaved: (this.stats.totalSaved * this.stats.avgLatencySaved / 1000).toFixed(1) + 's'
        };
    }

    /**
     * Log statistics
     */
    logStats() {
        const stats = this.getStats();
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                   QUOTE CACHE STATISTICS                   ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Status: ${stats.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`Cache Size: ${stats.size} / ${stats.maxSize}`);
        console.log(`Total Requests: ${stats.totalRequests}`);
        console.log(`Cache Hits: ${stats.hits} (${stats.hitRate})`);
        console.log(`Cache Misses: ${stats.misses}`);
        console.log(`Avg Latency Saved: ${stats.avgLatencySaved}`);
        console.log(`Total Time Saved: ${stats.estimatedTimeSaved}`);
        console.log('');
    }
}

// Singleton instance
const quoteCacheInstance = new QuoteCache();

export default quoteCacheInstance;
export { QuoteCache };
