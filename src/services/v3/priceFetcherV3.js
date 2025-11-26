



import { ethers, Interface } from 'ethers';
import { MULTICALL3_ADDRESS, MULTICALL3_ABI } from '../../constants/v3/multiCall.js';
import { v3_dexes } from '../../constants/v3/v3_dex_addresses.js';
import { DIRECT_SWAP_PAIRS } from '../../constants/v3/v3_token_pools.js';
import wsProvider from '../../provider/websocket.js';
import QuoterV2 from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json' with { type: 'json' };
import Decimal from 'decimal.js';

class DEXPriceFetcherV3 {
  constructor(quoterAddress, name, provider) {
    this.name = name;
    this.provider = provider;
    
    this.quoter = new ethers.Contract('0x61fFE014bA17989E743c5F6cB21bF9697530B21e', QuoterV2.abi, this.provider);
  }

 // Fixed V3 getPricesBatched function
async  getPricesBatchedV3(queries, chunkSize = 15) {
  if (queries.length === 0) return [];

  const prices = [];
  const multicallIface = new Interface(MULTICALL3_ABI);
  const quoterIface = new Interface(QuoterV2.abi);

  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    console.log(`Processing V3 chunk ${i / chunkSize + 1} with ${chunk.length} queries`);

    const calls = [];
    const queryMap = [];

    chunk.forEach((query, chunkIndex) => {
      const { tokenA, tokenB, fee, poolAddress, poolName } = query;

      // Enhanced validation
      if (!tokenA?.address || !tokenB?.address || 
          !tokenA.decimals || !tokenB.decimals || 
          !fee || !Number.isInteger(fee) ||
          !tokenA.symbol || !tokenB.symbol) {
        console.warn(`Skipping invalid V3 query ${chunkIndex} in ${poolName || 'unknown'}: Missing required fields`);
        return;
      }

      let tokenA_address, tokenB_address, poolAddressChecksum;
      try {
        tokenA_address = ethers.getAddress(tokenA.address);
        tokenB_address = ethers.getAddress(tokenB.address);
        if (poolAddress) {
          poolAddressChecksum = ethers.getAddress(poolAddress);
        }
      } catch (err) {
        console.warn(`Skipping V3 query ${chunkIndex} (${poolName || 'unknown'}): Invalid address - ${err.message}`);
        return;
      }

      // Validate quoter address exists
      // if (!this.quoter) {

      //   console.error('Quoter address not set', this.quoter.address);
      //   return;
      // }

      try {
        // A-to-B quote
        const amountInWeiAtoB = ethers.parseUnits('1', tokenA.decimals);
        const paramsAtoB = {
          tokenIn: tokenA_address,
          tokenOut: tokenB_address,
          fee: fee,
          amountIn: amountInWeiAtoB,
          sqrtPriceLimitX96: 0
        };
        const callDataAtoB = quoterIface.encodeFunctionData('quoteExactInputSingle', [paramsAtoB]);
        calls.push({ 
          target: ethers.getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'), 
          allowFailure: true, 
          callData: callDataAtoB 
        });

        // B-to-A quote
        const amountInWeiBtoA = ethers.parseUnits('1', tokenB.decimals);
        const paramsBtoA = {
          tokenIn: tokenB_address,
          tokenOut: tokenA_address,
          fee: fee,
          amountIn: amountInWeiBtoA,
          sqrtPriceLimitX96: 0
        };
        const callDataBtoA = quoterIface.encodeFunctionData('quoteExactInputSingle', [paramsBtoA]);
        calls.push({ 
          target: ethers.getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'), 
          allowFailure: true, 
          callData: callDataBtoA 
        });

        queryMap.push(chunkIndex);
      } catch (err) {
        console.warn(`Failed to create calls for V3 query ${chunkIndex}: ${err.message}`);
      }
    });

    if (calls.length === 0) {
      console.warn(`No valid calls in V3 chunk ${i / chunkSize + 1}`);
      // Add zero prices for failed queries
      chunk.forEach(query => {
        prices.push(this.createZeroPriceObject(query));
      });
      continue;
    }

    try {
      // Validate multicall address
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
          console.warn(`V3 chunk ${i / chunkSize + 1} attempt ${attempt} failed: ${error.message}`);
          if (attempt === 3) {
            throw new Error(`V3 chunk ${i / chunkSize + 1} failed after 3 attempts: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!result) {
        throw new Error('No result from multicall');
      }

      const decodedResults = multicallIface.decodeFunctionResult('aggregate3', result)[0];

      // Process results in pairs (A-to-B, B-to-A)
      for (let j = 0; j < decodedResults.length; j += 2) {
        const queryIndex = queryMap[Math.floor(j / 2)];
        if (queryIndex === undefined || queryIndex >= chunk.length) {
          console.warn(`Invalid query index ${queryIndex} for result pair ${j}`);
          continue;
        }

        const query = chunk[queryIndex];
        const { tokenA, tokenB, fee, dexName } = query;

        const priceObj = {
          dex: dexName,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: query.poolName || `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: { 
            symbol: tokenA.symbol, 
            address: tokenA.address, 
            decimals: tokenA.decimals 
          },
          tokenB: { 
            symbol: tokenB.symbol, 
            address: tokenB.address, 
            decimals: tokenB.decimals 
          },
          fee: fee,
          poolAddress: query.poolAddress
        };

        if (priceObj.priceOfAinB > 0 && priceObj.poolAddress) {
          const poolContract = new ethers.Contract(query.poolAddress, ['function liquidity() view returns (uint128)'], this.provider);
          const liquidity = await poolContract.liquidity();
          const liquidityDecimal = new Decimal(liquidity.toString());
          if (liquidityDecimal.lt(new Decimal('50000'))) {
            console.warn(`Skipping low liquidity (${liquidityDecimal}) for ${query.tokenA.symbol}/${query.tokenB.symbol} on UniswapV3_${fee}`);
            return; // Don't push
          }
          priceObj.liquidity = liquidityDecimal.toString();
        }

        // Process A-to-B result
        const resAtoB = decodedResults[j];
        if (resAtoB?.success) {
          try {
            const decodedAtoB = quoterIface.decodeFunctionResult('quoteExactInputSingle', resAtoB.returnData);
            const amountOutAtoB = ethers.formatUnits(decodedAtoB.amountOut, tokenB.decimals);
            if (parseFloat(amountOutAtoB) > 0) {
              priceObj.priceOfAinB = amountOutAtoB;
              priceObj.tokenAAmount = '1';
            }
          } catch (err) {
            console.warn(`Failed to decode A-to-B for ${tokenA.symbol}/${tokenB.symbol} (fee: ${fee}): ${err.message}`);
          }
        }

        // Process B-to-A result
        const resBtoA = decodedResults[j + 1];
        if (resBtoA?.success) {
          try {
            const decodedBtoA = quoterIface.decodeFunctionResult('quoteExactInputSingle', resBtoA.returnData);
            const amountOutBtoA = ethers.formatUnits(decodedBtoA.amountOut, tokenA.decimals);
            if (parseFloat(amountOutBtoA) > 0) {
              priceObj.priceOfBinA = amountOutBtoA;
              priceObj.tokenBAmount = '1';
            }
          } catch (err) {
            console.warn(`Failed to decode B-to-A for ${tokenB.symbol}/${tokenA.symbol} (fee: ${fee}): ${err.message}`);
          }
        }

        prices.push(priceObj);
      }
    } catch (error) {
      console.error(`V3 chunk ${i / chunkSize + 1} failed: ${error.message}. Queries: ${chunk.map(q => q.poolAddress || 'unknown').join(', ')}`);
      // Add zero prices for failed chunk
      chunk.forEach(query => {
        prices.push(this.createZeroPriceObject(query));
      });
    }
  }
  console.log(`✅ Fetched ${prices.length} V3 prices in total`);

  return prices;
}

// Helper function to create zero price objects
 createZeroPriceObject(query) {
  return {
    dex: query.dexName,
    priceOfAinB: 0,
    priceOfBinA: 0,
    tokenAAmount: '0',
    tokenBAmount: '0',
    poolName: query.poolName || `${query.tokenA?.symbol || 'unknown'}/${query.tokenB?.symbol || 'unknown'}`,
    tokenA: query.tokenA,
    tokenB: query.tokenB,
    fee: query.fee,
    poolAddress: query.poolAddress
  };
}

// New function to get prices using slot0() with multicall
async getPricesBatchedV3WithSlot0(queries, chunkSize = 15) {
  if (queries.length === 0) return [];

  const prices = [];
  const multicallIface = new Interface(MULTICALL3_ABI);
  const poolIface = new Interface([
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
  ]);

  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    console.log(`Processing V3 chunk ${i / chunkSize + 1} with ${chunk.length} queries using slot0()`);

    const calls = [];
    const queryMap = [];

    chunk.forEach((query, chunkIndex) => {
      const { tokenA, tokenB, fee, poolAddress, poolName } = query;

      // Enhanced validation
      if (!tokenA?.address || !tokenB?.address ||
          !tokenA.decimals || !tokenB.decimals ||
          !fee || !Number.isInteger(fee) ||
          !tokenA.symbol || !tokenB.symbol ||
          !poolAddress) {
        console.warn(`Skipping invalid V3 query ${chunkIndex} in ${poolName || 'unknown'}: Missing required fields`);
        return;
      }

      let tokenA_address, tokenB_address, poolAddressChecksum;
      try {
        tokenA_address = ethers.getAddress(tokenA.address);
        tokenB_address = ethers.getAddress(tokenB.address);
        poolAddressChecksum = ethers.getAddress(poolAddress);
      } catch (err) {
        console.warn(`Skipping V3 query ${chunkIndex} (${poolName || 'unknown'}): Invalid address - ${err.message}`);
        return;
      }

      try {
        // Create slot0() call for this pool
        const callData = poolIface.encodeFunctionData('slot0', []);
        calls.push({
          target: poolAddressChecksum,
          allowFailure: true,
          callData: callData
        });

        queryMap.push({ chunkIndex, query: { ...query, tokenA_address, tokenB_address, poolAddressChecksum } });
      } catch (err) {
        console.warn(`Failed to create slot0 call for V3 query ${chunkIndex}: ${err.message}`);
      }
    });

    if (calls.length === 0) {
      console.warn(`No valid calls in V3 chunk ${i / chunkSize + 1}`);
      chunk.forEach(query => {
        prices.push(this.createZeroPriceObject(query));
      });
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
          console.warn(`V3 slot0 chunk ${i / chunkSize + 1} attempt ${attempt} failed: ${error.message}`);
          if (attempt === 3) {
            throw new Error(`V3 slot0 chunk ${i / chunkSize + 1} failed after 3 attempts: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!result) {
        throw new Error('No result from multicall');
      }

      const decodedResults = multicallIface.decodeFunctionResult('aggregate3', result)[0];

      // Process slot0 results
      for (let j = 0; j < decodedResults.length; j++) {
        const { chunkIndex, query } = queryMap[j];
        if (chunkIndex === undefined || chunkIndex >= chunk.length) {
          console.warn(`Invalid query index ${chunkIndex} for result ${j}`);
          continue;
        }

        const { tokenA, tokenB, fee, dexName, poolAddressChecksum, tokenA_address, tokenB_address } = query;

        const priceObj = {
          dex: dexName,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: query.poolName || `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: {
            symbol: tokenA.symbol,
            address: tokenA.address,
            decimals: tokenA.decimals
          },
          tokenB: {
            symbol: tokenB.symbol,
            address: tokenB.address,
            decimals: tokenB.decimals
          },
          fee: fee,
          poolAddress: query.poolAddress
        };

        const res = decodedResults[j];
        if (res?.success) {
          try {
            const decoded = poolIface.decodeFunctionResult('slot0', res.returnData);
            const sqrtPriceX96 = decoded[0]; // sqrtPriceX96

            // ✅ FIXED: Calculate price from sqrtPriceX96
            // Formula: price = (sqrtPriceX96 / 2^96)^2
            // This gives us token1/token0 ratio in RAW units
            // We need to determine token0 and token1 order
            const token0IsTokenA = tokenA_address.toLowerCase() < tokenB_address.toLowerCase();

            // Convert sqrtPriceX96 to Decimal for precision
            const Q96 = new Decimal(2).pow(96);
            const sqrtPrice = new Decimal(sqrtPriceX96.toString()).div(Q96);
            const priceRaw = sqrtPrice.pow(2); // token1/token0 in RAW units

            // ✅ FIX: Adjust for decimals by DIVIDING (not multiplying!)
            // priceHuman = priceRaw / (10^(token1.decimals - token0.decimals))

            let priceOfAinB, priceOfBinA;

            if (token0IsTokenA) {
              // token0 = tokenA, token1 = tokenB
              // priceRaw = tokenB/tokenA (in raw units)
              // To get human-readable: divide by decimal adjustment
              const decimalAdjustment = new Decimal(10).pow(tokenB.decimals - tokenA.decimals);
              priceOfAinB = priceRaw.div(decimalAdjustment); // How many tokenB for 1 tokenA
              priceOfBinA = new Decimal(1).div(priceOfAinB);
            } else {
              // token0 = tokenB, token1 = tokenA
              // priceRaw = tokenA/tokenB (in raw units)
              const decimalAdjustment = new Decimal(10).pow(tokenA.decimals - tokenB.decimals);
              priceOfBinA = priceRaw.div(decimalAdjustment); // How many tokenA for 1 tokenB
              priceOfAinB = new Decimal(1).div(priceOfBinA);
            }

            // Check for valid prices
            if (priceOfAinB.gt(0) && priceOfBinA.gt(0)) {
              priceObj.priceOfAinB = priceOfAinB.toString();
              priceObj.priceOfBinA = priceOfBinA.toString();
              priceObj.tokenAAmount = '1';
              priceObj.tokenBAmount = '1';
              priceObj.sqrtPriceX96 = sqrtPriceX96.toString(); // Store for reference
            }
          } catch (err) {
            console.warn(`Failed to decode slot0 for ${tokenA.symbol}/${tokenB.symbol} (fee: ${fee}): ${err.message}`);
          }
        }

        prices.push(priceObj);
      }
    } catch (error) {
      console.error(`V3 slot0 chunk ${i / chunkSize + 1} failed: ${error.message}. Queries: ${chunk.map(q => q.poolAddress || 'unknown').join(', ')}`);
      chunk.forEach(query => {
        prices.push(this.createZeroPriceObject(query));
      });
    }
  }

  console.log(`✅ Fetched ${prices.length} V3 prices using slot0() in total`);
  return prices;
}

  async getPrice(tokenA, tokenB, fee, poolAddress = null) {
    if (!poolAddress) {
      console.log(`⚠️ No pool address provided for ${tokenA.address.slice(0, 6)}-${tokenB.address.slice(0, 6)} on ${this.name} (using QuoterV2)`);
    }

    try {
      // Validate token objects
      if (!tokenA.address || !tokenB.address || !tokenA.decimals || !tokenB.decimals) {
        console.error(`Invalid token data: tokenA=${JSON.stringify(tokenA)}, tokenB=${JSON.stringify(tokenB)}`);
        return { 
          dex: `${this.name}_${fee}`,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
          tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
          fee: fee
        };
      }

      // Find the pool in DIRECT_SWAP_PAIRS
      const pool = DIRECT_SWAP_PAIRS.find(p =>
        (p.token0.address.toLowerCase() === tokenA.address.toLowerCase() && p.token1.address.toLowerCase() === tokenB.address.toLowerCase()) ||
        (p.token1.address.toLowerCase() === tokenA.address.toLowerCase() && p.token0.address.toLowerCase() === tokenB.address.toLowerCase())
      );
      if (!pool) {
        console.error(`Pool not found for ${tokenA.address.slice(0, 6)}-${tokenB.address.slice(0, 6)} in DIRECT_SWAP_PAIRS`);
        return { 
          dex: `${this.name}_${fee}`,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
          tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
          fee: fee
        };
      }

      const tokenAObj = pool.token0.address.toLowerCase() === tokenA.address.toLowerCase() ? pool.token0 : pool.token1;
      const tokenBObj = pool.token1.address.toLowerCase() === tokenB.address.toLowerCase() ? pool.token1 : pool.token0;

      const isToken0 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase();

      // Fetch price of A in B (tokenA -> tokenB)
      const amountInWeiAtoB = ethers.parseUnits('1', tokenA.decimals);
      const tokenAAmount = ethers.formatUnits(amountInWeiAtoB, tokenA.decimals);
      const paramsAtoB = {
        tokenIn: tokenA.address,
        tokenOut: tokenB.address,
        fee,
        amountIn: amountInWeiAtoB,
        sqrtPriceLimitX96: 0
      };

      const quoteAtoB = await this.quoter.quoteExactInputSingle.staticCall(paramsAtoB);
      const amountOutWeiAtoB = ethers.formatUnits(quoteAtoB.amountOut, tokenB.decimals)

      if (!amountOutWeiAtoB || amountOutWeiAtoB === 0n) {
        console.log(`Zero amount out for ${tokenAObj.symbol}-${tokenBObj.symbol} (fee: ${fee}) on ${this.name}`);
        return { 
          dex: `${this.name}_${fee}`,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
          tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
          fee: fee
        };
      }

      

      // Fetch price of B in A (tokenB -> tokenA)
      const amountInWeiBtoA = ethers.parseUnits('1', tokenB.decimals);
      const tokenBAmount = ethers.formatUnits(amountInWeiBtoA, tokenB.decimals);
      const paramsBtoA = {
        tokenIn: tokenB.address,
        tokenOut: tokenA.address,
        fee,
        amountIn: amountInWeiBtoA,
        sqrtPriceLimitX96: 0
      };

      const quoteBtoA = await this.quoter.quoteExactInputSingle.staticCall(paramsBtoA);
      const amountOutWeiBtoA = ethers.formatUnits(quoteBtoA.amountOut, tokenA.decimals);

      if (!amountOutWeiBtoA || amountOutWeiBtoA === 0n) {
        console.log(`Zero amount out for ${tokenBObj.symbol}-${tokenAObj.symbol} (fee: ${fee}) on ${this.name}`);
        return { 
          dex: `${this.name}_${fee}`,
          priceOfAinB: 0,
          priceOfBinA: 0,
          tokenAAmount: '0',
          tokenBAmount: '0',
          poolName: `${tokenA.symbol}/${tokenB.symbol}`,
          tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
          tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
          fee: fee
        };
      }

      return {
        dex: `${this.name}_${fee}`,
        priceOfAinB: amountOutWeiAtoB,
        priceOfBinA: amountOutWeiBtoA,
        tokenAAmount: tokenAAmount,
        tokenBAmount: tokenBAmount,
        poolName: `${tokenA.symbol}/${tokenB.symbol}`,
        tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
        tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
        fee: fee
      };
    } catch (error) {
      console.error(`V3 quote error for ${tokenA.address.slice(0, 6)}-${tokenB.address.slice(0, 6)} (fee: ${fee}) on ${this.name}:`, error.message);
      if (error.code === 'CALL_EXCEPTION') {
        console.error('CALL_EXCEPTION details:', JSON.stringify(error, null, 2));
      }
      return { 
        dex: `${this.name}_${fee}`,
        priceOfAinB: 0,
        priceOfBinA: 0,
        tokenAAmount: '0',
        tokenBAmount: '0',
        poolName: `${tokenA.symbol}/${tokenB.symbol}`,
        tokenA: { symbol: tokenA.symbol, address: tokenA.address, decimals: tokenA.decimals },
        tokenB: { symbol: tokenB.symbol, address: tokenB.address, decimals: tokenB.decimals },
        fee: fee
      };
    }
  }

  async simulateMultiHop(path, fees, amountInWei, poolAddresses = []) {
    if (path.length < 2) {
      console.log(`❌ Invalid path for multi-hop on ${this.name}`);
      return { amountOutWei: ethers.toBigInt(0), amountsWei: [ethers.toBigInt(0), ethers.toBigInt(0)] };
    }

    try {
      let encodedPath = ethers.solidityPacked(['address', 'uint24', 'address'], [path[0].address, fees[0], path[1].address]);
      for (let i = 1; i < fees.length; i++) {
        encodedPath = ethers.concat([encodedPath, ethers.solidityPacked(['uint24', 'address'], [fees[i], path[i + 1].address])]);
      }

      console.log(`🔄 ${this.name} Multi-Hop Simulation:`);
      console.log(`   Path: ${path.map(t => t.symbol || t.address.slice(0, 6)).join(' -> ')}`);
      console.log(`   Fee Tiers: ${fees.join(', ')}`);
      console.log(`   Input Amount (wei): ${amountInWei.toString()}`);

      const quote = await this.quoter.quoteExactInput.staticCall(encodedPath, amountInWei.toString());
      const amountOutWei = quote.amountOut;

      console.log('Quote result:', {
        amountOut: ethers.formatUnits(amountOutWei, path[path.length - 1].decimals),
        sqrtPriceX96After: quote.sqrtPriceX96After.toString(),
        initializedTicksCrossed: quote.initializedTicksCrossed.toString(),
        gasEstimate: quote.gasEstimate.toString()
      });

      console.log(`   Pool Addresses: ${poolAddresses.join(', ') || 'N/A (QuoterV2 used)'}`);
      console.log(`   Fee Tiers: ${fees.map(f => `${f} (${(Number(f) / 10000).toFixed(4)}%)`).join(', ')}`);
      console.log(`   Output Amount (wei): ${amountOutWei.toString()}`);

      return { amountOutWei, amountsWei: [amountInWei, amountOutWei] };
    } catch (error) {
      console.error(`V3 multi-hop error for path ${path.map(t => t.symbol || t.address.slice(0, 6)).join(' -> ')} on ${this.name}:`, error.message);
      if (error.code === 'CALL_EXCEPTION') {
        console.error('CALL_EXCEPTION details:', JSON.stringify(error, null, 2));
      }
      return { amountOutWei: ethers.toBigInt(0), amountsWei: [ethers.toBigInt(0), ethers.toBigInt(0)] };
    }
  }
}

class PriceFetcherV3 {
  constructor(provider) {
    this.provider = provider;
    const uniswapDex = v3_dexes.find(dex => dex.name === 'UniswapV3');
    if (!uniswapDex) {
      throw new Error('UniswapV3 not found in v3_dexes');
    }
    this.fetchers = {
      UniswapV3: new DEXPriceFetcherV3(uniswapDex.quoter, uniswapDex.name, provider)
    };
  }

  async fetchAllPrices(batchSize = 5, amountInWei = ethers.parseEther('10')) {
    console.log(`🚀 Starting V3 price fetch for ${DIRECT_SWAP_PAIRS.length} pools with batch size ${batchSize} and input amount ${amountInWei.toString()} wei`);
    const allResults = [];
    const feeTiers = [500, 3000, 10000]; // Support multiple fee tiers

    for (let i = 0; i < DIRECT_SWAP_PAIRS.length; i += batchSize) {
      const batch = DIRECT_SWAP_PAIRS.slice(i, i + batchSize);
      const promises = batch.flatMap(pool => {
        const tokenA = pool.token0;
        const tokenB = pool.token1;
        const uniswapV3Pool = pool.pools;

        if (!tokenA || !tokenB) {
          console.error(`Invalid token data in pool ${pool.name}:`, JSON.stringify(pool, null, 2));
          return [];
        }

        const feePromises = [];
        if (uniswapV3Pool) {
          if (uniswapV3Pool.UniswapV3?.address) {
            feePromises.push(this.fetchers.UniswapV3.getPrice(
              tokenA,
              tokenB,
              uniswapV3Pool.UniswapV3.fee,
              uniswapV3Pool.UniswapV3.address
            ));
          }
          if (uniswapV3Pool.UniswapV3_500?.address) {
            feePromises.push(this.fetchers.UniswapV3.getPrice(
              tokenA,
              tokenB,
              uniswapV3Pool.UniswapV3_500.fee,
              uniswapV3Pool.UniswapV3_500.address
            ));
          }
          if (uniswapV3Pool.UniswapV3_3000?.address) {
            feePromises.push(this.fetchers.UniswapV3.getPrice(
              tokenA,
              tokenB,
              uniswapV3Pool.UniswapV3_3000.fee,
              uniswapV3Pool.UniswapV3_3000.address
            ));
          }
          if (uniswapV3Pool.UniswapV3_10000?.address) {
            feePromises.push(this.fetchers.UniswapV3.getPrice(
              tokenA,
              tokenB,
              uniswapV3Pool.UniswapV3_10000.fee,
              uniswapV3Pool.UniswapV3_10000.address
            ));
          }
        } else {
          console.warn(`No UniswapV3 pool address for ${pool.name}`);
        }
        return feePromises;
      });

      const results = await Promise.all(promises.map(p => p.catch(e => {
        console.error('Error in price fetch:', e.message);
        return null;
      })));
      results.forEach(result => {
        if (result && result.priceOfAinB !== 0 && result.priceOfBinA !== 0) {
          allResults.push(result);
        }
      });
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
    }

    const pricesByPool = allResults.reduce((acc, result) => {
      if (!result) return acc;
      const poolKey = result.poolName;
      if (!acc[poolKey]) acc[poolKey] = [];
      acc[poolKey].push(result);
      return acc;
    }, {});

    console.log(`✅ Fetched ${allResults.length} V3 prices across fee tiers`);
    return { pricesByPool, allPrices: allResults };
  }
}
export {PriceFetcherV3, DEXPriceFetcherV3}
export default PriceFetcherV3;