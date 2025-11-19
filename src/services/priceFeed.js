/**
 * Price Feed Service
 *
 * Fetches real-time cryptocurrency prices from multiple sources:
 * 1. Chainlink Price Feeds (on-chain, most reliable)
 * 2. CoinGecko API (off-chain, fallback)
 * 3. Redis cache (for performance)
 */

import { ethers } from 'ethers';
import redis from '../config/radis.js';
import logger from '../utils/logger.js';
import Decimal from 'decimal.js';

// Chainlink Price Feed ABI (only the functions we need)
const CHAINLINK_AGGREGATOR_ABI = [
  {
    "inputs": [],
    "name": "latestRoundData",
    "outputs": [
      { "internalType": "uint80", "name": "roundId", "type": "uint80" },
      { "internalType": "int256", "name": "answer", "type": "int256" },
      { "internalType": "uint256", "name": "startedAt", "type": "uint256" },
      { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
      { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Chainlink Price Feed addresses on Ethereum Mainnet
const CHAINLINK_FEEDS = {
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'WBTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
  'DAI/USD': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
  
  // ✅ ADD THESE FOR BETTER ACCURACY:
  'MATIC/USD': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',  // ← CRITICAL
  'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
  'UNI/USD': '0x553303d460EE0afB37EdFf9bE42922D8FF63220e',
  'AAVE/USD': '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9',
  'SNX/USD': '0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699',
  'CRV/USD': '0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f',
  'YFI/USD': '0xA027702dbb89fbd58938e4324ac03B58d812b0E1',   // ← FIXES YFI
  'SUSHI/USD': '0xCc70F09A6CC17553b2E31954cD36E4A2d89501f7',
};


// CoinGecko token ID mapping
const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'WETH': 'ethereum',
  'BTC': 'bitcoin',
  'WBTC': 'wrapped-bitcoin',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'UNI': 'uniswap',
  'LINK': 'chainlink',
  'AAVE': 'aave',
  'MKR': 'maker',
  'COMP': 'compound-governance-token',
  'SNX': 'synthetix-network-token',
  'YFI': 'yearn-finance',
  'SUSHI': 'sushi',
  'CRV': 'curve-dao-token',
  
  // ✅ ADD THESE CRITICAL TOKENS:
  'MATIC': 'matic-network',       // ← FIXES YOUR MAIN ISSUE
  'WMATIC': 'matic-network',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'APE': 'apecoin',
  'LDO': 'lido-dao',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
};


// Cache configuration
const CACHE_TTL = 60; // 60 seconds
const CACHE_PREFIX = 'price:';

/**
 * Price Feed Manager
 */
class PriceFeedService {
  constructor(provider) {
    this.provider = provider;
    this.chainlinkFeeds = {};
    this.lastPrices = {}; // In-memory fallback
    this.initialized = false;
  }

  /**
   * Initialize Chainlink price feed contracts
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Initializing Chainlink price feeds...', { service: 'priceFeed' });

      for (const [pair, address] of Object.entries(CHAINLINK_FEEDS)) {
        try {
          this.chainlinkFeeds[pair] = new ethers.Contract(
            address,
            CHAINLINK_AGGREGATOR_ABI,
            this.provider
          );
          logger.info(`Chainlink feed initialized: ${pair}`, { service: 'priceFeed' });
        } catch (error) {
          logger.error(`Failed to initialize Chainlink feed for ${pair}: ${error.message}`, { service: 'priceFeed' });
        }
      }

      this.initialized = true;
      logger.info('Chainlink price feeds initialized', { service: 'priceFeed' });
    } catch (error) {
      logger.error(`Error initializing price feeds: ${error.message}`, { service: 'priceFeed' });
    }
  }

  /**
   * Get ETH price in USD
   * @returns {Decimal} ETH price in USD
   */
  async getETHPrice() {
    return await this.getPrice('ETH', 'USD');
  }

  /**
   * Get token price in USD
   * @param {string} token - Token symbol (e.g., 'ETH', 'WBTC', 'USDC')
   * @param {string} currency - Currency (default: 'USD')
   * @returns {Decimal} Token price in specified currency
   */
async getPrice(token, currency = 'USD') {
  // ✅ COMPLETE NORMALIZATION
  token = token.toUpperCase();
  
  // Wrapped token normalization
  if (token === 'WETH') token = 'ETH';
  if (token === 'WMATIC') token = 'MATIC';  // ✅ ADDED
  if (token === 'WBTC') token = 'BTC';      // ✅ ADDED (for CoinGecko consistency)
  
  const cacheKey = `${CACHE_PREFIX}${token}/${currency}`;


    try {
      // 1. Check Redis cache
      const cached = await this.getCachedPrice(cacheKey);
      if (cached) {
        // logger.info(`Price cache hit: ${token}/${currency} = ${cached}`, { service: 'priceFeed' });
        return new Decimal(cached);
      }

      // 2. Try Chainlink oracle (on-chain, most reliable)
      const chainlinkPrice = await this.getChainlinkPrice(token, currency);
      if (chainlinkPrice) {
        await this.cachePrice(cacheKey, chainlinkPrice.toString());
        this.lastPrices[token] = chainlinkPrice;
        return chainlinkPrice;
      }

      // 3. Fallback to CoinGecko API
      const coingeckoPrice = await this.getCoinGeckoPrice(token, currency);
      if (coingeckoPrice) {
        await this.cachePrice(cacheKey, coingeckoPrice.toString());
        this.lastPrices[token] = coingeckoPrice;
        return coingeckoPrice;
      }

      // 4. Use last known price if available
      if (this.lastPrices[token]) {
        logger.warn(`Using last known price for ${token}: ${this.lastPrices[token]}`, { service: 'priceFeed' });
        return this.lastPrices[token];
      }

      // 5. Use default fallback prices
      const fallbackPrice = this.getFallbackPrice(token);
      logger.warn(`Using fallback price for ${token}: ${fallbackPrice}`, { service: 'priceFeed' });
      return fallbackPrice;

    } catch (error) {
      logger.error(`Error getting price for ${token}/${currency}: ${error.message}`, { service: 'priceFeed' });
      return this.getFallbackPrice(token);
    }
  }

  /**
   * Get price from Chainlink oracle
   * @param {string} token - Token symbol
   * @param {string} currency - Currency
   * @returns {Decimal|null} Price or null
   */
  async getChainlinkPrice(token, currency) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const pair = `${token}/${currency}`;
      const feed = this.chainlinkFeeds[pair];

      if (!feed) {
        return null;
      }

      const roundData = await feed.latestRoundData();
      const decimals = await feed.decimals();

      const price = new Decimal(roundData.answer.toString())
        .div(new Decimal(10).pow(decimals));

      logger.info(`Chainlink price: ${token}/${currency} = ${price}`, { service: 'priceFeed' });

      return price;
    } catch (error) {
      logger.error(`Chainlink price fetch failed for ${token}/${currency}: ${error.message}`, { service: 'priceFeed' });
      return null;
    }
  }

  /**
   * Get price from CoinGecko API
   * @param {string} token - Token symbol
   * @param {string} currency - Currency
   * @returns {Decimal|null} Price or null
   */
  async getCoinGeckoPrice(token, currency = 'USD') {
    try {
      const coinId = COINGECKO_IDS[token];
      if (!coinId) {
        logger.warn(`No CoinGecko ID mapping for ${token}`, { service: 'priceFeed' });
        return null;
      }

      const currencyLower = currency.toLowerCase();
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currencyLower}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const price = data[coinId]?.[currencyLower];

      if (!price) {
        throw new Error(`Price not found in response`);
      }

      const priceDecimal = new Decimal(price);
      logger.info(`CoinGecko price: ${token}/${currency} = ${priceDecimal}`, { service: 'priceFeed' });

      return priceDecimal;
    } catch (error) {
      logger.error(`CoinGecko price fetch failed for ${token}/${currency}: ${error.message}`, { service: 'priceFeed' });
      return null;
    }
  }

  /**
   * Get cached price from Redis
   * @param {string} key - Cache key
   * @returns {string|null} Cached price or null
   */
  async getCachedPrice(key) {
    try {
      const cached = await redis.get(key);
      return cached;
    } catch (error) {
      logger.error(`Redis cache read error: ${error.message}`, { service: 'priceFeed' });
      return null;
    }
  }

  /**
   * Cache price in Redis
   * @param {string} key - Cache key
   * @param {string} value - Price value
   */
  async cachePrice(key, value) {
    try {
      await redis.setex(key, CACHE_TTL, value);
    } catch (error) {
      logger.error(`Redis cache write error: ${error.message}`, { service: 'priceFeed' });
    }
  }

  /**
   * Get fallback price (last resort)
   * @param {string} token - Token symbol
   * @returns {Decimal} Fallback price
   */
getFallbackPrice(token) {
  const fallbackPrices = {
    // Majors
    'ETH': new Decimal('3500'),
    'WETH': new Decimal('3500'),
    'BTC': new Decimal('95000'),
    'WBTC': new Decimal('95000'),
    
    // Stablecoins
    'USDC': new Decimal('1'),
    'USDT': new Decimal('1'),
    'DAI': new Decimal('1'),
    'BUSD': new Decimal('1'),
    'USDD': new Decimal('1'),
    
    // DeFi Blue Chips
    'UNI': new Decimal('10'),
    'LINK': new Decimal('20'),
    'AAVE': new Decimal('200'),
    'MKR': new Decimal('2500'),
    'CRV': new Decimal('0.80'),
    'SUSHI': new Decimal('1.50'),
    'COMP': new Decimal('50'),
    'SNX': new Decimal('3'),
    
    // ✅ CRITICAL ADDITIONS:
    'MATIC': new Decimal('0.50'),    // ← FIXES MAIN ISSUE
    'WMATIC': new Decimal('0.50'),
    'YFI': new Decimal('8000'),      // ← FIXES YFI
    
    // Other popular tokens
    'SHIB': new Decimal('0.00001'),
    'PEPE': new Decimal('0.000001'),
    'APE': new Decimal('1.5'),
    'LDO': new Decimal('2'),
    'ARB': new Decimal('1'),
    'OP': new Decimal('2'),
    'SAND': new Decimal('0.50'),
    'MANA': new Decimal('0.60'),
  };

  // ✅ SAFER DEFAULT with WARNING
  if (!fallbackPrices[token]) {
  logger.error(
    `❌ UNKNOWN TOKEN: ${token} - Using conservative $0.01 default`,
    { 
      service: 'priceFeed',
      token: token,
      action: 'ADD_TO_FALLBACK_PRICES',
      impact: 'CALCULATIONS_MAY_BE_WRONG'
    }
  );
}

  // if (!fallbackPrices[token]) {
  //   logger.error(
  //     ⁠`❌ UNKNOWN TOKEN: ${token} - Using conservative $0.01 default`, 
  //     { 
  //     service: 'priceFeed',
  //     token: token,
  //     action: 'ADD_TO_FALLBACK_PRICES',
  //     impact: 'CALCULATIONS_MAY_BE_WRONG'
  //   }
  // );
  // }

  // Changed from $1 to $0.01 for safety
  return fallbackPrices[token] || new Decimal('0.01');
}
  /**
   * Get multiple prices at once
   * @param {Array<string>} tokens - Array of token symbols
   * @param {string} currency - Currency
   * @returns {Object} Object with token prices
   */
  async getPrices(tokens, currency = 'USD') {
    const prices = {};

    await Promise.all(
      tokens.map(async (token) => {
        prices[token] = await this.getPrice(token, currency);
      })
    );

    return prices;
  }

  /**
   * Clear price cache
   */
  async clearCache() {
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cleared ${keys.length} price cache entries`, { service: 'priceFeed' });
      }
    } catch (error) {
      logger.error(`Error clearing price cache: ${error.message}`, { service: 'priceFeed' });
    }
  }
}

// Singleton instance
let priceFeedInstance = null;

/**
 * Initialize price feed service
 * @param {Object} provider - Ethers provider
 * @returns {PriceFeedService} Price feed instance
 */
export function initializePriceFeed(provider) {
  if (!priceFeedInstance) {
    priceFeedInstance = new PriceFeedService(provider);
  }
  return priceFeedInstance;
}

/**
 * Get price feed instance
 * @returns {PriceFeedService} Price feed instance
 */
export function getPriceFeed() {
  if (!priceFeedInstance) {
    throw new Error('Price feed not initialized. Call initializePriceFeed() first.');
  }
  return priceFeedInstance;
}

export default {
  initializePriceFeed,
  getPriceFeed,
  PriceFeedService
};

//sanjay