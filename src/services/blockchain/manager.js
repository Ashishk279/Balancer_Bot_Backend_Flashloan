import { ethers } from 'ethers';
import logger from '../utils/logger'; // Assuming you have a logger utility

/**
 * Ethers.js Manager with Multi-Provider Failover
 * Handles multiple RPC providers with automatic failover and load balancing.
 */
class EthersManager {
    constructor(providers, options = {}) {
        this.providersConfig = providers.map(provider => ({
            url: provider.url,
            name: provider.name || 'Unknown',
            weight: provider.weight || 1,
            maxRetries: provider.maxRetries || 3,
            timeout: provider.timeout || 30000
        }));
        
        this.currentProviderIndex = 0;
        this.failoverThreshold = options.failoverThreshold || 3;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.cooldownPeriod = options.cooldownPeriod || 60000; // 1 minute
        
        // Create ethers provider instances
        this.providerInstances = this.providersConfig.map(config => 
            new ethers.JsonRpcProvider(config.url)
        );
        
        this.currentProvider = this.providerInstances[this.currentProviderIndex];
        
        logger.info('EthersManager initialized', {
            providerCount: this.providersConfig.length,
            currentProvider: this.providersConfig[this.currentProviderIndex].name
        });
    }
    
    /**
     * Executes an operation with automatic failover and timeout.
     * @param {Function} operation - An async function that takes an ethers provider instance.
     * @param {Object} options - Execution options { maxAttempts, timeout }.
     * @returns {Promise<any>} The result of the operation.
     */
    async executeWithFailover(operation, options = {}) {
        const maxAttempts = options.maxAttempts || this.providersConfig.length;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const providerConfig = this.providersConfig[this.currentProviderIndex];
            const provider = this.providerInstances[this.currentProviderIndex];
            const timeout = options.timeout || providerConfig.timeout;

            try {
                logger.debug('Executing operation with provider', {
                    provider: providerConfig.name,
                    attempt: attempt + 1,
                    maxAttempts
                });
                
                // Race the operation against a timeout
                const result = await Promise.race([
                    operation(provider),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timed out')), timeout)
                    )
                ]);
                
                // Reset failure count on success
                this.failureCount = 0;
                this.lastFailureTime = 0;
                
                logger.debug('Operation successful', { provider: providerConfig.name });
                return result;
                
            } catch (error) {
                logger.warn('Provider operation failed', {
                    provider: providerConfig.name,
                    attempt: attempt + 1,
                    error: error.message
                });
                
                this.failureCount++;
                this.lastFailureTime = Date.now();
                
                if (this.shouldRotateProvider()) {
                    this.rotateProvider();
                } else if (attempt < maxAttempts - 1) {
                    // Rotate immediately on failure if not cooling down
                    this.rotateProvider();
                }
            }
        }
        
        throw new Error(`All providers failed after ${maxAttempts} attempts.`);
    }
    
    /**
     * Determines if the provider should be rotated based on failure count and cooldown.
     * @returns {boolean}
     */
    shouldRotateProvider() {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return this.failureCount >= this.failoverThreshold && timeSinceLastFailure > this.cooldownPeriod;
    }
    
    /**
     * Rotates to the next available provider.
     */
    rotateProvider() {
        const previousProviderName = this.providersConfig[this.currentProviderIndex].name;
        
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providersConfig.length;
        this.currentProvider = this.providerInstances[this.currentProviderIndex];
        this.failureCount = 0; // Reset count after rotation
        
        logger.info('Provider rotated', {
            from: previousProviderName,
            to: this.providersConfig[this.currentProviderIndex].name
        });
    }
    
    /**
     * Gets the current ethers provider instance.
     * @returns {ethers.JsonRpcProvider}
     */
    getCurrentProviderInstance() {
        return this.currentProvider;
    }
    
    /**
     * Gets information about the current active provider.
     * @returns {Object}
     */
    getCurrentProviderInfo() {
        return this.providersConfig[this.currentProviderIndex];
    }
    
    /**
     * Gets the status of all configured providers.
     * @returns {Array<Object>}
     */
    getProviderStatus() {
        return this.providersConfig.map((config, index) => ({
            ...config,
            isActive: index === this.currentProviderIndex,
        }));
    }
    
    /**
     * Performs a health check on the current provider.
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            await this.executeWithFailover(
                async (provider) => provider.getBlockNumber(),
                { maxAttempts: 1, timeout: 5000 }
            );
            return true;
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            return false;
        }
    }
    
    /**
     * Subscribes to new blocks using the ethers event listener pattern.
     * Note: Ethers handles automatic reconnection, but we add failover for robustness.
     * @param {Function} callback - The function to call with the new block number.
     */
    subscribeToBlocks(callback) {
        const provider = this.getCurrentProviderInstance();
        const providerName = this.getCurrentProviderInfo().name;

        provider.on('block', (blockNumber) => {
            logger.debug('New block received', { blockNumber, provider: providerName });
            callback(blockNumber);
        });

        provider.provider.on('error', (error) => {
            logger.error('Block subscription error', { provider: providerName, error: error.message });
            this.failureCount++;
            if (this.shouldRotateProvider()) {
                this.rotateProvider();
                // You might need to re-initialize the subscription with the new provider
            }
        });

        logger.info('Subscribed to new blocks', { provider: providerName });
    }
    
    /**
     * Batches multiple read-only contract calls.
     * Ethers.js doesn't have a native batch request like web3.js.
     * This is implemented using Promise.all. For high-throughput needs,
     * consider using a Multicall contract.
     * @param {Array<Object>} calls - Array of { to: string, data: string }.
     * @param {string|number} blockTag - The block tag to query.
     * @returns {Promise<Array<string>>} An array of results.
     */
    async batchCall(calls, blockTag = 'latest') {
        return this.executeWithFailover(async (provider) => {
            const promises = calls.map(call => 
                provider.call({ to: call.to, data: call.data }, blockTag)
            );
            return Promise.all(promises);
        });
    }
    
    /**
     * Gets the current gas price information.
     * @returns {Promise<ethers.FeeData>}
     */
    async getFeeData() {
        return this.executeWithFailover(async (provider) => provider.getFeeData());
    }
    
    /**
     * Gets the latest block number.
     * @returns {Promise<number>}
     */
    async getBlockNumber() {
        return this.executeWithFailover(async (provider) => provider.getBlockNumber());
    }
}

export default EthersManager;