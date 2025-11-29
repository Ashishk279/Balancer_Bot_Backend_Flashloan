/**
 * Parallel Quote Fetcher
 * Fetches DEX quotes in parallel with intelligent batching and caching
 * Optimized for local Ethereum node
 */

import logger from './logger.js';
import quoteCache from './quoteCache.js';
import { QUOTE_CONFIG } from '../config/parallelConfig.js';

/**
 * Delay helper
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parallel Quote Fetcher Class
 */
export class ParallelQuoteFetcher {
    constructor() {
        this.maxConcurrent = QUOTE_CONFIG.MAX_CONCURRENT;
        this.batchSize = QUOTE_CONFIG.BATCH_SIZE;
        this.batchDelay = QUOTE_CONFIG.BATCH_DELAY;
        this.parallelBuySell = QUOTE_CONFIG.PARALLEL_BUY_SELL;
        this.stats = {
            totalQuotes: 0,
            cachedQuotes: 0,
            fetchedQuotes: 0,
            failedQuotes: 0,
            totalLatency: 0
        };
    }

    /**
     * Fetch single quote with caching
     */
    async fetchQuote(quoter, tokenIn, tokenOut, amountIn, fee, quoteFetcher) {
        const cacheKey = quoteCache.getCacheKey(quoter, tokenIn, tokenOut, amountIn, fee);

        try {
            this.stats.totalQuotes++;

            const result = await quoteCache.get(
                cacheKey,
                () => quoteFetcher(quoter, tokenIn, tokenOut, amountIn, fee),
                100 // Estimated latency saved
            );

            if (quoteCache.cache.has(cacheKey)) {
                this.stats.cachedQuotes++;
            } else {
                this.stats.fetchedQuotes++;
            }

            return result;
        } catch (error) {
            this.stats.failedQuotes++;
            logger.error(`Quote fetch failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch quotes in parallel batches
     */
    async fetchQuotesBatch(quoteRequests, quoteFetcher) {
        const results = [];
        const batches = [];

        // Split into batches
        for (let i = 0; i < quoteRequests.length; i += this.batchSize) {
            batches.push(quoteRequests.slice(i, i + this.batchSize));
        }

        logger.info(`🚀 Fetching ${quoteRequests.length} quotes in ${batches.length} parallel batches`);

        // Process batches with delay between them
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchStart = Date.now();

            // Process all requests in batch in parallel
            const batchPromises = batch.map(request =>
                this.fetchQuote(
                    request.quoter,
                    request.tokenIn,
                    request.tokenOut,
                    request.amountIn,
                    request.fee,
                    quoteFetcher
                ).then(result => ({
                    success: true,
                    result,
                    request
                })).catch(error => ({
                    success: false,
                    error: error.message,
                    request
                }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            const batchLatency = Date.now() - batchStart;
            this.stats.totalLatency += batchLatency;

            logger.debug(`✅ Batch ${i + 1}/${batches.length} completed in ${batchLatency}ms`);

            // Delay between batches (except for last batch)
            if (i < batches.length - 1 && this.batchDelay > 0) {
                await delay(this.batchDelay);
            }
        }

        return results;
    }

    /**
     * Fetch buy and sell quotes in parallel (not sequential)
     * This is a KEY optimization - instead of buy THEN sell, do BOTH simultaneously
     */
    async fetchBuySellPair(buyRequest, sellRequest, quoteFetcher) {
        if (!this.parallelBuySell) {
            // Sequential (old way)
            const buyQuote = await this.fetchQuote(
                buyRequest.quoter,
                buyRequest.tokenIn,
                buyRequest.tokenOut,
                buyRequest.amountIn,
                buyRequest.fee,
                quoteFetcher
            );

            const sellQuote = await this.fetchQuote(
                sellRequest.quoter,
                sellRequest.tokenIn,
                sellRequest.tokenOut,
                sellRequest.amountIn || buyQuote, // Use buy output
                sellRequest.fee,
                quoteFetcher
            );

            return { buyQuote, sellQuote };
        }

        // Parallel (NEW way - MUCH faster!)
        const [buyResult, sellResult] = await Promise.allSettled([
            this.fetchQuote(
                buyRequest.quoter,
                buyRequest.tokenIn,
                buyRequest.tokenOut,
                buyRequest.amountIn,
                buyRequest.fee,
                quoteFetcher
            ),
            this.fetchQuote(
                sellRequest.quoter,
                sellRequest.tokenIn,
                sellRequest.tokenOut,
                sellRequest.amountIn, // Use estimated amount
                sellRequest.fee,
                quoteFetcher
            )
        ]);

        const buyQuote = buyResult.status === 'fulfilled' ? buyResult.value : null;
        const sellQuote = sellResult.status === 'fulfilled' ? sellResult.value : null;

        if (!buyQuote || !sellQuote) {
            throw new Error('One or both quotes failed');
        }

        return { buyQuote, sellQuote };
    }

    /**
     * Fetch multiple buy/sell pairs in parallel
     */
    async fetchMultiplePairs(pairs, quoteFetcher) {
        const results = [];
        const batches = [];

        // Split into batches
        for (let i = 0; i < pairs.length; i += this.batchSize) {
            batches.push(pairs.slice(i, i + this.batchSize));
        }

        logger.info(`🔄 Fetching ${pairs.length} buy/sell pairs in ${batches.length} batches`);

        // Process batches
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchStart = Date.now();

            // Process all pairs in batch in parallel
            const batchPromises = batch.map(pair =>
                this.fetchBuySellPair(pair.buy, pair.sell, quoteFetcher)
                    .then(result => ({
                        success: true,
                        buyQuote: result.buyQuote,
                        sellQuote: result.sellQuote,
                        pair
                    }))
                    .catch(error => ({
                        success: false,
                        error: error.message,
                        pair
                    }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            const batchLatency = Date.now() - batchStart;
            this.stats.totalLatency += batchLatency;

            logger.debug(`✅ Pair batch ${i + 1}/${batches.length} completed in ${batchLatency}ms`);

            // Delay between batches
            if (i < batches.length - 1 && this.batchDelay > 0) {
                await delay(this.batchDelay);
            }
        }

        return results;
    }

    /**
     * Process with concurrency limit using Promise pool pattern
     */
    async fetchWithConcurrencyLimit(requests, quoteFetcher, limit = this.maxConcurrent) {
        const results = [];
        const executing = [];

        for (const request of requests) {
            const promise = this.fetchQuote(
                request.quoter,
                request.tokenIn,
                request.tokenOut,
                request.amountIn,
                request.fee,
                quoteFetcher
            ).then(result => ({
                success: true,
                result,
                request
            })).catch(error => ({
                success: false,
                error: error.message,
                request
            }));

            results.push(promise);

            if (limit <= requests.length) {
                const execute = promise.then(() => executing.splice(executing.indexOf(execute), 1));
                executing.push(execute);

                if (executing.length >= limit) {
                    await Promise.race(executing);
                }
            }
        }

        return await Promise.all(results);
    }

    /**
     * Get statistics
     */
    getStats() {
        const cacheHitRate = this.stats.totalQuotes > 0
            ? ((this.stats.cachedQuotes / this.stats.totalQuotes) * 100).toFixed(1)
            : '0.0';

        const avgLatency = this.stats.fetchedQuotes > 0
            ? (this.stats.totalLatency / this.stats.fetchedQuotes).toFixed(2)
            : '0.00';

        return {
            totalQuotes: this.stats.totalQuotes,
            cachedQuotes: this.stats.cachedQuotes,
            fetchedQuotes: this.stats.fetchedQuotes,
            failedQuotes: this.stats.failedQuotes,
            cacheHitRate: cacheHitRate + '%',
            avgLatency: avgLatency + 'ms',
            totalLatency: this.stats.totalLatency + 'ms'
        };
    }

    /**
     * Log statistics
     */
    logStats() {
        const stats = this.getStats();
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║            PARALLEL QUOTE FETCHER STATISTICS               ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`Total Quotes Requested: ${stats.totalQuotes}`);
        console.log(`Cached Quotes: ${stats.cachedQuotes} (${stats.cacheHitRate})`);
        console.log(`Fetched Quotes: ${stats.fetchedQuotes}`);
        console.log(`Failed Quotes: ${stats.failedQuotes}`);
        console.log(`Avg Fetch Latency: ${stats.avgLatency}`);
        console.log(`Total Processing Time: ${stats.totalLatency}`);
        console.log('');
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalQuotes: 0,
            cachedQuotes: 0,
            fetchedQuotes: 0,
            failedQuotes: 0,
            totalLatency: 0
        };
    }
}

// Singleton instance
const parallelQuoteFetcherInstance = new ParallelQuoteFetcher();

export default parallelQuoteFetcherInstance;
