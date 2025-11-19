import { ethers } from 'ethers';
export const AggregatorV3ABI = [
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
  }
];

const CHAINLINK_ETH_USD_ADDRESS = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'; // ETH/USD mainnet
const STALENESS_THRESHOLD = 3600; // 1 hour in seconds
const CACHE_DURATION = 300000; // 5 minutes in ms

class PriceOracle {
  constructor(provider) {
    this.provider = provider;
    this.contract = new ethers.Contract(CHAINLINK_ETH_USD_ADDRESS, AggregatorV3ABI, provider);
    this.cache = { price: 2500, timestamp: Date.now() }; // Fallback init
  }

  async getEthPriceUsd() {
    // Check cache
    if (Date.now() - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.price;
    }

    try {
      const roundData = await this.contract.latestRoundData();
      const { answer, updatedAt } = roundData;

      // Parse price (answer has 8 decimals)
      const price = Number(answer) / 1e8;

      // Check staleness
      const now = Math.floor(Date.now() / 1000);
      if (now - Number(updatedAt) > STALENESS_THRESHOLD) {
        console.warn(`Chainlink ETH/USD stale (updated ${now - Number(updatedAt)}s ago), using cache.`);
        return this.cache.price;
      }

      // Update cache
      this.cache = { price, timestamp: Date.now() };
      console.log(`🔄 Updated ETH/USD from Chainlink: $${price.toFixed(2)} (updated ${new Date(Number(updatedAt) * 1000).toLocaleString()})`);

      return price;
    } catch (error) {
      console.error('Chainlink fetch error:', error.message);
      return this.cache.price; // Fallback
    }
  }
}

export default PriceOracle;