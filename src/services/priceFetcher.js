import { ethers, Interface } from 'ethers';
import { TOKEN_POOLS } from "../constants/token_pools.js"
import { Decimal } from 'decimal.js';
import { MULTICALL3_ADDRESS, MULTICALL3_ABI } from '../constants/v3/multiCall.js';

class PriceFetcher {
  // Constructor now accepts a single provider
  constructor(provider) { // <-- CHANGED
    if (!provider) {
      throw new Error("PriceFetcher requires a provider instance.");
    }
    this.provider = provider; // <-- CHANGED
    this.IUniswapV2PairABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
    ];
  }


  async getPoolPricesBatchedV2(queries, chunkSize = 5) {
    if (queries.length === 0) return [];

    const prices = [];
    const multicallIface = new Interface(MULTICALL3_ABI);
    const pairIface = new Interface(this.IUniswapV2PairABI);

    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      console.log(`Processing V2 chunk ${i / chunkSize + 1} with ${chunk.length} queries`);

      const calls = [];
      const chunkIndices = [];

      chunk.forEach((query, chunkIndex) => {
        const { poolAddress, dexName, tokenA, tokenB } = query;

        // Enhanced validation
        if (!poolAddress || !tokenA?.address || !tokenB?.address ||
          !tokenA.decimals || !tokenB.decimals ||
          !tokenA.symbol || !tokenB.symbol || !dexName) {
          console.warn(`Skipping invalid V2 query ${chunkIndex}: Missing required fields`);
          return;
        }

        let poolAddressChecksum, tokenA_address, tokenB_address;
        try {
          poolAddressChecksum = ethers.getAddress(poolAddress);
          tokenA_address = ethers.getAddress(tokenA.address);
          tokenB_address = ethers.getAddress(tokenB.address);
        } catch (err) {
          console.warn(`Skipping V2 query ${chunkIndex} for ${tokenA.symbol}/${tokenB.symbol} on ${dexName}: Invalid address - ${err.message}`);
          return;
        }

        try {
          const callData = pairIface.encodeFunctionData('getReserves', []);
          calls.push({
            target: poolAddressChecksum,
            allowFailure: true,
            callData
          });
          chunkIndices.push(chunkIndex);
        } catch (err) {
          console.warn(`Failed to create call for V2 query ${chunkIndex}: ${err.message}`);
        }
      });

      if (calls.length === 0) {
        console.warn(`No valid calls in V2 chunk ${i / chunkSize + 1}`);
        continue;
      }

      try {
        const multicallAddress = ethers.getAddress(MULTICALL3_ADDRESS);
        const multicallData = multicallIface.encodeFunctionData('aggregate3', [calls]);

        let result;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            result = await this.provider.call({
              to: multicallAddress,
              data: multicallData
            });
            break;
          } catch (error) {
            console.warn(`V2 chunk ${i / chunkSize + 1} attempt ${attempt} failed: ${error.message}`);
            if (attempt === 3) {
              throw new Error(`V2 chunk ${i / chunkSize + 1} failed after 3 attempts: ${error.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }

        if (!result) {
          throw new Error('No result from V2 multicall');
        }

        const decodedResults = multicallIface.decodeFunctionResult('aggregate3', result)[0];

        decodedResults.forEach((res, resIndex) => {
          const chunkIndex = chunkIndices[resIndex];
          if (chunkIndex === undefined || chunkIndex >= chunk.length) {
            console.warn(`Invalid chunk index ${chunkIndex} for V2 result ${resIndex}`);
            return;
          }

          const query = chunk[chunkIndex];
          const { dexName, tokenA, tokenB } = query;

          if (res?.success) {
            try {
              const [reserve0, reserve1] = pairIface.decodeFunctionResult('getReserves', res.returnData);

              if (reserve0 === 0n || reserve1 === 0n) {
                console.warn(`Zero reserves for ${tokenA.symbol}/${tokenB.symbol} on ${dexName} at ${query.poolAddress}`);
                return;
              }

              // Determine token order based on address comparison
              const [rawReserveA, rawReserveB] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
                ? [reserve0, reserve1]
                : [reserve1, reserve0];

              // Convert reserves to human-readable format
              const fixedReserveA = new Decimal(ethers.formatUnits(rawReserveA, tokenA.decimals));
              const fixedReserveB = new Decimal(ethers.formatUnits(rawReserveB, tokenB.decimals));



              if (fixedReserveA.isZero() || fixedReserveB.isZero()) {
                console.warn(`Zero calculated reserves for ${tokenA.symbol}/${tokenB.symbol} on ${dexName}`);
                return;
              }

              // ============================================
              // PRICE CALCULATION (Human Units)
              // ============================================
              // priceOfAinB = How many B tokens per 1 A token
              // Example: WETH/USDC -> priceOfAinB = 4111 means "1 WETH = 4111 USDC"
              //
              // priceOfBinA = How many A tokens per 1 B token  
              // Example: WETH/USDC -> priceOfBinA = 0.000243 means "1 USDC = 0.000243 WETH"
              // ============================================

              const priceOfAinB = fixedReserveB.div(fixedReserveA); // B tokens per A token ✅
              const priceOfBinA = fixedReserveA.div(fixedReserveB);

              // Sanity check: prices should be reciprocals
              const reciprocalCheck = priceOfAinB.mul(priceOfBinA);
              if (!reciprocalCheck.minus(1).abs().lt(0.0001)) {
                console.warn(`Price reciprocal check failed for ${tokenA.symbol}/${tokenB.symbol} on ${dexName}: ${reciprocalCheck.toFixed(10)}`);
              }

              // Log for verification (especially useful for stablecoin pairs)
              const isStablePair = ['USDC', 'USDT', 'DAI'].includes(tokenA.symbol) &&
                ['USDC', 'USDT', 'DAI'].includes(tokenB.symbol);
              if (isStablePair && (priceOfAinB.lt(0.95) || priceOfAinB.gt(1.05))) {
                console.warn(`⚠️ Unusual stablecoin price for ${tokenA.symbol}/${tokenB.symbol} on ${dexName}: ${priceOfAinB.toFixed(6)}`);
              }

              prices.push({
                dex: dexName,
                // B tokens per A token (e.g., USDC per WETH)
                priceOfAinB: priceOfAinB.toNumber(),
                // A tokens per B token (e.g., WETH per USDC)
                priceOfBinA: priceOfBinA.toNumber(),
                poolName: query.poolName || `${tokenA.symbol}/${tokenB.symbol}`,
                rawReserves: [rawReserveA, rawReserveB],
                // Human-readable reserves for debugging
                reserves: {
                  [tokenA.symbol]: fixedReserveA.toFixed(6),
                  [tokenB.symbol]: fixedReserveB.toFixed(6)
                },
                tokenA,
                tokenB,
                poolAddress: query.poolAddress,
                // Add fee (default 0.3% for UniswapV2)
                fee: query.fee || 0.003
              });

              // console.log(`✓ ${tokenA.symbol}/${tokenB.symbol} on ${dexName}: 1 ${tokenA.symbol} = ${priceOfAinB.toFixed(6)} ${tokenB.symbol}`);
            } catch (err) {
              console.warn(`Failed to decode reserves for ${tokenA.symbol}/${tokenB.symbol} on ${dexName}: ${err.message}`);
            }
          } else {
            console.warn(`getReserves failed for ${tokenA.symbol}/${tokenB.symbol} on ${dexName} at ${query.poolAddress}`);
          }
        });
      } catch (error) {
        console.error(`V2 chunk ${i / chunkSize + 1} failed: ${error.message}. Addresses: ${chunk.map(q => q.poolAddress).join(', ')}`);
      }
    }
    console.log(`✅ Fetched ${prices.length} V2 prices in total`);
    return prices;
  }
  async getPoolPrice(poolAddress, dexName, tokenA, tokenB) { // <-- CHANGED: No longer accepts a provider as a parameter
    try {
      const pairContract = new ethers.Contract(poolAddress, this.IUniswapV2PairABI, this.provider); // <-- CHANGED
      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0Address = await pairContract.token0();

      if (reserve0 === 0n || reserve1 === 0n) return null;

      const [rawReserveA, rawReserveB] = token0Address.toLowerCase() === tokenA.address.toLowerCase()
        ? [reserve0, reserve1]
        : [reserve1, reserve0];

      // FIXED: Use UnitConverter for proper decimal handling
      const fixedReserveA = new Decimal(ethers.formatUnits(rawReserveA, tokenA.decimals));
      const fixedReserveB = new Decimal(ethers.formatUnits(rawReserveB, tokenB.decimals));

      if (fixedReserveA.isZero() || fixedReserveB.isZero()) return null;

      const priceOfAinB = fixedReserveB.div(fixedReserveA);
      const priceOfBinA = fixedReserveA.div(fixedReserveB);

      return {
        dex: dexName,
        priceOfAinB,
        priceOfBinA,
        poolName: `${tokenA.symbol}/${tokenB.symbol}`,
        rawReserves: [rawReserveA, rawReserveB],
        tokenA,
        tokenB,
      };
    } catch (error) {
      const tokenASymbol = tokenA?.symbol || 'UNKNOWN';
      const tokenBSymbol = tokenB?.symbol || 'UNKNOWN';
      console.log(`❌ Price fetch error for ${tokenASymbol}/${tokenBSymbol} on ${dexName}: ${error.message}`);
      return null;
    }
  }

  async fetchAllPrices(batchSize = 5) {
    const allQueries = [];
    TOKEN_POOLS.forEach(pool => {
      Object.entries(pool.pools).forEach(([dexName, poolAddress]) => {
        allQueries.push({
          poolAddress,
          dexName,
          tokenA: pool.token0,
          tokenB: pool.token1,
        });
      });
    });

    let allResults = [];
    // The batching logic remains, but it will use the single WebSocket provider for all calls
    const batchPromises = allQueries.map(query => {
      // Validate tokens before making the call
      if (!query.tokenA || !query.tokenB || !query.tokenA.symbol || !query.tokenB.symbol) {
        console.log(`⚠️  Skipping invalid token pair: ${query.tokenA?.symbol || 'undefined'}/${query.tokenB?.symbol || 'undefined'}`);
        return Promise.resolve(null);
      }
      return this.getPoolPrice(query.poolAddress, query.dexName, query.tokenA, query.tokenB);
    });
    const batchResults = await Promise.all(batchPromises);
    allResults = allResults.concat(batchResults.filter(r => r !== null));

    const pricesByPool = allResults.reduce((acc, result) => {
      const { poolName } = result;
      if (!acc[poolName]) acc[poolName] = [];
      acc[poolName].push(result);
      return acc;
    }, {});

    return { pricesByPool, allPrices: allResults };
  }
}

export default PriceFetcher;