import { ethers } from 'ethers';
import Decimal from 'decimal.js';
import QuoterV2 from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json' with { type: 'json' };

const SLIPPAGE_TOLERANCE = 0.09; // 2% slippage tolerance
const MIN_PROFIT_BUFFER = 0.8; // Take 80% of expected profit as minimum
const DEFAULT_AMOUNT_IN = '0.01'; // Default 0.01 units of input token

const DEX_ROUTER = {
    router1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    router2: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    router3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    router4: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    router5: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",  // pancakev3
    router6: "0xEfF92A263d31888d860bD50809A8D171709b7b1c", // pancakev2
}

const dexTypes = {
    "UniswapV2": 0,
    "SushiswapV2": 0,
    "PancakeswapV2": 0,
    "UniswapV3_3000": 1,
    "UniswapV3_500": 1,
    "UniswapV3_10000": 1,
    "SushiswapV3_500": 1,
    "SushiswapV3_3000": 1,
    "SushiswapV3_10000": 1,
    "PancakeswapV3_500": 1,
    "PancakeswapV3_10000": 1,
    "PancakeswapV3_3000": 1,
}

// V2 Router ABI for getAmountsOut
const V2_ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
];

// V2 Pair ABI for getReserves
const V2_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)'
];

/**
 * Calculate price impact for V2 pools
 * @param {string} amountIn - Amount to swap (in wei)
 * @param {string} reserveIn - Reserve of input token
 * @param {string} reserveOut - Reserve of output token
 * @returns {number} Price impact percentage (e.g., 2.5 for 2.5%)
 */
function calculatePriceImpactV2(amountIn, reserveIn, reserveOut) {
    try {
        const amountInDecimal = new Decimal(amountIn);
        const reserveInDecimal = new Decimal(reserveIn);
        const reserveOutDecimal = new Decimal(reserveOut);

        // Validate inputs
        if (reserveInDecimal.isZero() || reserveOutDecimal.isZero()) {
            return 0;
        }

        // Spot price before trade = reserveOut / reserveIn
        const spotPrice = reserveOutDecimal.div(reserveInDecimal);

        // Calculate amount out using x*y=k formula with 0.3% fee
        const amountInWithFee = amountInDecimal.mul(997);
        const numerator = amountInWithFee.mul(reserveOutDecimal);
        const denominator = reserveInDecimal.mul(1000).add(amountInWithFee);
        const amountOut = numerator.div(denominator);

        // Execution price = amountOut / amountIn
        const executionPrice = amountOut.div(amountInDecimal);

        // Price impact = (spotPrice - executionPrice) / spotPrice * 100
        const priceImpact = spotPrice.minus(executionPrice).div(spotPrice).mul(100);

        return parseFloat(priceImpact.abs().toFixed(4)); // Return as number with 4 decimal precision
    } catch (error) {
        console.error('Error calculating V2 price impact:', error.message);
        return 0;
    }
}

/**
 * Calculate price impact for V3 pools
 * @param {string} currentPrice - Current spot price from slot0
 * @param {string} executionPrice - Expected execution price from quoter
 * @returns {number} Price impact percentage (e.g., 2.5 for 2.5%)
 */
function calculatePriceImpactV3(currentPrice, executionPrice) {
    try {
        const currentPriceDecimal = new Decimal(currentPrice);
        const executionPriceDecimal = new Decimal(executionPrice);

        // Validate inputs
        if (currentPriceDecimal.isZero()) {
            return 0;
        }

        // Price impact = abs((executionPrice - currentPrice) / currentPrice) * 100
        const priceImpact = executionPriceDecimal.minus(currentPriceDecimal)
            .div(currentPriceDecimal)
            .abs()
            .mul(100);

        return parseFloat(priceImpact.toFixed(4)); // Return as number with 4 decimal precision
    } catch (error) {
        console.error('Error calculating V3 price impact:', error.message);
        return 0;
    }
}

/**
 * Get dynamic slippage based on trade amount
 * Lower amounts get lower slippage, higher amounts get higher slippage
 * @param {string} amountUSD - Trade amount in USD
 * @returns {number} Slippage tolerance (e.g., 0.005 for 0.5%)
 */
function getDynamicSlippage(amountUSD) {
    try {
        const amount = new Decimal(amountUSD);

        // Define slippage tiers based on trade size
        if (amount.lte(100)) {
            return 0.005; // 0.5% for trades <= $100
        } else if (amount.lte(500)) {
            return 0.01; // 1% for trades <= $500
        } else if (amount.lte(1000)) {
            return 0.015; // 1.5% for trades <= $1000
        } else if (amount.lte(5000)) {
            return 0.02; // 2% for trades <= $5000
        } else if (amount.lte(10000)) {
            return 0.03; // 3% for trades <= $10000
        } else if (amount.lte(50000)) {
            return 0.05; // 5% for trades <= $50000
        } else {
            return 0.08; // 8% for trades > $50000
        }
    } catch (error) {
        console.error('Error calculating dynamic slippage:', error.message);
        return 0.02; // Default 2%
    }
}

/**
 * Get minAmountOut for V2 using router.getAmountsOut
 * @param {object} provider - Ethers provider
 * @param {string} routerAddress - V2 router address
 * @param {string} amountIn - Amount in (wei)
 * @param {string} tokenIn - Token in address
 * @param {string} tokenOut - Token out address
 * @param {string} pairAddress - Pair address for reserves
 * @param {number} tokenInDecimals - Token in decimals
 * @param {number} tokenOutDecimals - Token out decimals
 * @param {string} amountUSD - Trade amount in USD for dynamic slippage
 * @returns {Promise<object>} Object with expectedOut, minAmountOut, priceImpact, slippage
 */
// async function getMinAmountOutV2(provider, routerAddress, amountIn, tokenIn, tokenOut, pairAddress, tokenInDecimals, tokenOutDecimals, amountUSD) {
//     try {
//         // Create router contract instance
//         const router = new ethers.Contract(routerAddress, V2_ROUTER_ABI, provider);
//         const pair = new ethers.Contract(pairAddress, V2_PAIR_ABI, provider);

//         // Get reserves for price impact calculation
//         const [reserve0, reserve1] = await pair.getReserves();
//         const token0Address = await pair.token0();

//         // Determine which reserve is for input token
//         const isToken0 = token0Address.toLowerCase() === tokenIn.toLowerCase();
//         const reserveIn = isToken0 ? reserve0 : reserve1;
//         const reserveOut = isToken0 ? reserve1 : reserve0;

//         // Get expected amount out from router
//         const path = [tokenIn, tokenOut];
//         const amounts = await router.getAmountsOut(amountIn, path);
//         const expectedAmountOut = amounts[1]; // amounts[0] is amountIn, amounts[1] is amountOut

//         // Calculate price impact
//         const priceImpact = calculatePriceImpactV2(
//             amountIn.toString(),
//             reserveIn.toString(),
//             reserveOut.toString()
//         );

//         // Get dynamic slippage
//         const dynamicSlippage = getDynamicSlippage(amountUSD);

//         // Calculate minAmountOut with slippage
//         const expectedOut = ethers.formatUnits(expectedAmountOut, tokenOutDecimals);
//         const slippageFactor = new Decimal(1).minus(new Decimal(dynamicSlippage));
//         const minOut = new Decimal(expectedOut).mul(slippageFactor);
//         const minAmountOut = ethers.parseUnits(minOut.toFixed(tokenOutDecimals), tokenOutDecimals);

//         console.log(`V2 Quote - Expected: ${expectedOut}, Min: ${minOut.toString()}, Price Impact: ${priceImpact}%, Slippage: ${(dynamicSlippage * 100).toFixed(2)}%`);

//         return {
//             expectedAmountOut: expectedAmountOut.toString(),
//             expectedOut: expectedOut,
//             minAmountOut: minAmountOut.toString(),
//             priceImpact: priceImpact,
//             slippage: dynamicSlippage,
//             slippagePercent: (dynamicSlippage * 100).toFixed(2)
//         };
//     } catch (error) {
//         console.error('Error getting V2 minAmountOut:', error.message);
//         throw error;
//     }
// }




async function getMinAmountOutV2(provider, routerAddress, amountIn, tokenIn, tokenOut, pairAddress, tokenInDecimals, tokenOutDecimals, amountUSD) {
    try {
        const router = new ethers.Contract(routerAddress, V2_ROUTER_ABI, provider);
        const pair = new ethers.Contract(pairAddress, V2_PAIR_ABI, provider);

        // Get reserves for price impact calculation
        const [reserve0, reserve1] = await pair.getReserves();
        const token0Address = await pair.token0();

        const isToken0 = token0Address.toLowerCase() === tokenIn.toLowerCase();
        const reserveIn = isToken0 ? reserve0 : reserve1;
        const reserveOut = isToken0 ? reserve1 : reserve0;

        // Get expected amount from router (THIS IS THE KEY!)
        const path = [tokenIn, tokenOut];
        const amounts = await router.getAmountsOut(amountIn, path);
        const expectedAmountOut = amounts[1];

        // Calculate price impact
        const priceImpact = calculatePriceImpactV2(
            amountIn.toString(),
            reserveIn.toString(),
            reserveOut.toString()
        );

        // Get dynamic slippage
        const dynamicSlippage = getDynamicSlippage(amountUSD);

        // ✅ IMPROVED: Pure BigInt calculation (no precision loss)
        const slippageBPS = Math.floor(dynamicSlippage * 10000); // Convert to basis points
        const minAmountOut = (expectedAmountOut * BigInt(10000 - slippageBPS)) / 10000n;

        // For logging (convert to human readable)
        const expectedOut = ethers.formatUnits(expectedAmountOut, tokenOutDecimals);
        const minOut = ethers.formatUnits(minAmountOut, tokenOutDecimals);

        console.log(`V2 Quote:
            Expected: ${expectedOut}
            Min: ${minOut}
            Price Impact: ${priceImpact.toFixed(2)}%
            Slippage: ${(dynamicSlippage * 100).toFixed(2)}%
        `);

        return {
            expectedAmountOut: expectedAmountOut, // ✅ BigInt (wei format)
            expectedOut: expectedOut, // ✅ String (human-readable format)
            minAmountOut: minAmountOut, // ✅ BigInt (wei format)
            priceImpact: priceImpact,
            slippage: dynamicSlippage,
            slippagePercent: (dynamicSlippage * 100).toFixed(2)
        };
    } catch (error) {
        console.error('Error getting V2 minAmountOut:', error.message);
        throw error;
    }
}
/**
 * Get minAmountOut for V3 using quoter.quoteExactInputSingle
 * @param {object} provider - Ethers provider
 * @param {string} quoterAddress - V3 quoter address
 * @param {string} amountIn - Amount in (wei)
 * @param {string} tokenIn - Token in address
 * @param {string} tokenOut - Token out address
 * @param {number} fee - Pool fee (500, 3000, 10000)
 * @param {number} tokenInDecimals - Token in decimals
 * @param {number} tokenOutDecimals - Token out decimals
 * @param {string} currentPrice - Current spot price from slot0 (optional, for price impact)
 * @param {string} amountUSD - Trade amount in USD for dynamic slippage
 * @returns {Promise<object>} Object with expectedOut, minAmountOut, priceImpact, slippage
 */
async function getMinAmountOutV3(provider, quoterAddress, amountIn, tokenIn, tokenOut, fee, tokenInDecimals, tokenOutDecimals, currentPrice, amountUSD) {

    // console.log("fajfew -----", amountIn, tokenIn, tokenOut, fee, tokenInDecimals, tokenOutDecimals, currentPrice, amountUSD);
    try {
        // Create quoter contract instance
        const quoter = new ethers.Contract(quoterAddress, QuoterV2.abi, provider);

        // Prepare params for quoteExactInputSingle
        const params = {
            tokenIn: ethers.getAddress(tokenIn),
            tokenOut: ethers.getAddress(tokenOut),
            fee: fee,
            amountIn: amountIn,
            sqrtPriceLimitX96: 0
        };

        // console.log('V3 Quoter params:-----------------', params);   
        // Get quote from quoter
        const quote = await quoter.quoteExactInputSingle.staticCall(params);
        const expectedAmountOut = quote.amountOut;

        // Calculate execution price
        const amountInFormatted = ethers.formatUnits(amountIn, tokenInDecimals);
        const expectedOut = ethers.formatUnits(expectedAmountOut, tokenOutDecimals);

        // Calculate actual price impact for V3
        let priceImpact = 0;

        if (currentPrice && parseFloat(currentPrice) > 0) {
            // Calculate execution price (output per input)
            const executionPrice = new Decimal(expectedOut).div(new Decimal(amountInFormatted));

            // currentPrice might be in either direction (output/input or input/output)
            // Check which direction and normalize to output/input
            let normalizedCurrentPrice = new Decimal(currentPrice);

            // If the currentPrice is vastly different from executionPrice, it's likely inverted
            // A price impact > 100% suggests the prices are in opposite directions
            const rawImpact = executionPrice.minus(normalizedCurrentPrice)
                .div(normalizedCurrentPrice)
                .abs()
                .mul(100);

            // If impact is unrealistically high (>50%), try inverting the current price
            if (rawImpact.gt(50)) {
                normalizedCurrentPrice = new Decimal(1).div(new Decimal(currentPrice));
            }

            // Use the provided current price and calculate impact
            priceImpact = calculatePriceImpactV3(normalizedCurrentPrice.toString(), executionPrice.toString());
        } else {
            // Fallback: estimate based on trade size if no current price available
            const amountUSDDecimal = new Decimal(amountUSD);
            if (amountUSDDecimal.lte(100)) {
                priceImpact = 0.1;
            } else if (amountUSDDecimal.lte(500)) {
                priceImpact = 0.3;
            } else if (amountUSDDecimal.lte(1000)) {
                priceImpact = 0.5;
            } else if (amountUSDDecimal.lte(5000)) {
                priceImpact = 1.0;
            } else if (amountUSDDecimal.lte(10000)) {
                priceImpact = 2.0;
            } else {
                priceImpact = 3.0;
            }
        }

        // Get dynamic slippage
        const dynamicSlippage = getDynamicSlippage(amountUSD);

        // Calculate minAmountOut with slippage
        const slippageFactor = new Decimal(1).minus(new Decimal(dynamicSlippage));
        const minOut = new Decimal(expectedOut).mul(slippageFactor);
        const minAmountOut = ethers.parseUnits(minOut.toFixed(tokenOutDecimals), tokenOutDecimals);

        console.log(`V3 Quote - Expected: ${expectedOut}, Min: ${minOut.toString()}, Price Impact: ${priceImpact}%, Slippage: ${(dynamicSlippage * 100).toFixed(2)}%`);

        return {
            expectedAmountOut: expectedAmountOut, // ✅ BigInt (wei format) - from quoter
            expectedOut: expectedOut, // ✅ String (human-readable format)
            minAmountOut: minAmountOut, // ✅ BigInt (wei format) - with slippage
            priceImpact: priceImpact,
            slippage: dynamicSlippage,
            slippagePercent: (dynamicSlippage * 100).toFixed(2),
            gasEstimate: quote.gasEstimate?.toString() || '0'
        };
    } catch (error) {
        console.error('Error getting V3 minAmountOut:', error.message);
        throw error;
    }
}

/**
 * Universal function to get minAmountOut with dynamic slippage and price impact
 * @param {object} params - Parameters object
 * @param {object} params.provider - Ethers provider
 * @param {string} params.dexType - 'V2' or 'V3'
 * @param {string} params.amountIn - Amount in (wei)
 * @param {string} params.tokenIn - Token in address
 * @param {string} params.tokenOut - Token out address
 * @param {number} params.tokenInDecimals - Token in decimals
 * @param {number} params.tokenOutDecimals - Token out decimals
 * @param {string} params.amountUSD - Trade amount in USD
 * @param {string} [params.routerAddress] - V2 router address (required for V2)
 * @param {string} [params.pairAddress] - V2 pair address (required for V2)
 * @param {string} [params.quoterAddress] - V3 quoter address (required for V3)
 * @param {number} [params.fee] - V3 pool fee (required for V3)
 * @param {string} [params.currentPrice] - V3 current price from slot0 (optional)
 * @returns {Promise<object>} Object with expectedOut, minAmountOut, priceImpact, slippage
 */
async function getMinAmountOutWithSlippage(params) {
    const {
        provider,
        dexType,
        amountIn,
        tokenIn,
        tokenOut,
        tokenInDecimals,
        tokenOutDecimals,
        amountUSD,
        routerAddress,
        pairAddress,
        quoterAddress,
        fee,
        currentPrice
    } = params;

    if (dexType === 'V2' || dexType === 'v2') {
        if (!routerAddress || !pairAddress) {
            throw new Error('V2 requires routerAddress and pairAddress');
        }
        return await getMinAmountOutV2(
            provider,
            routerAddress,
            amountIn,
            tokenIn,
            tokenOut,
            pairAddress,
            tokenInDecimals,
            tokenOutDecimals,
            amountUSD
        );
    } else if (dexType === 'V3' || dexType === 'v3') {
        if (!quoterAddress || !fee) {
            throw new Error('V3 requires quoterAddress and fee');
        }
        return await getMinAmountOutV3(
            provider,
            quoterAddress,
            amountIn,
            tokenIn,
            tokenOut,
            fee,
            tokenInDecimals,
            tokenOutDecimals,
            currentPrice,
            amountUSD
        );
    } else {
        throw new Error(`Unknown dexType: ${dexType}. Must be 'V2' or 'V3'`);
    }
}

function calculateMinAmountOut(expectedAmountOut, decimals, slippageTolerance = SLIPPAGE_TOLERANCE) {
    const expected = new Decimal(expectedAmountOut);
    const slippage = new Decimal(1).minus(new Decimal(slippageTolerance));
    const minAmount = expected.mul(slippage);

    // Convert to token units and return as string
    return ethers.parseUnits(minAmount.toFixed(decimals), decimals).toString();
}

function calculateAmountIn(opportunity) {
    // Handle tokenB - might be object (from V3 engine) or string (from Redis)
    const tokenB = typeof opportunity.tokenB === 'string'
        ? JSON.parse(opportunity.tokenB)
        : opportunity.tokenB;
    const inputDecimals = parseInt(tokenB.decimals || '18');

    // If opportunity has suggested amount, use it (already in raw units)


    // For stablecoin pairs, use fixed amount in token units
    if (opportunity.poolId && (opportunity.poolId.endsWith('USDC') || opportunity.poolId.endsWith('USDT'))) {
        return ethers.parseUnits('5', inputDecimals).toString(); // 5 USDC/USDT
    }

    if (opportunity.amountIn) {
        return opportunity.amountIn.toString();
    }
    // If opportunity has liquidity info, calculate based on that
    if (opportunity.availableLiquidity) {
        const liquidity = new Decimal(opportunity.availableLiquidity);
        // Use 5% of available liquidity to avoid price impact
        const optimalAmount = liquidity.mul(0.05);
        return ethers.parseUnits(optimalAmount.toFixed(inputDecimals), inputDecimals).toString();
    }

    // Default fallback - use small amount in token units
    return opportunity.amountIn.toString();
}


function extractAmountIn(opportunity) {
    // Try execution_payload first
    if (opportunity.execution_payload?.amountIn) {
        return BigInt(opportunity.execution_payload.amountIn);
    }

    // Try direct amountIn
    if (opportunity.amountIn) {
        return BigInt(opportunity.amountIn);
    }

    // Parse from formatted string
    if (opportunity.formatted) {
        try {
            const formatted = JSON.parse(opportunity.formatted);
            if (formatted.input) {
                const amount = formatted.input.split(' ')[0];
                return ethers.parseEther(amount);
            }
        } catch (e) {
            console.error('Error parsing formatted:', e);
        }
    }

    throw new Error('Cannot extract amountIn from opportunity');
}



function calculateMinProfit(expectedProfit, estimatedGasCost = '0', decimals) {
    const profit = new Decimal(expectedProfit);
    const gasCost = new Decimal(estimatedGasCost);

    // Subtract gas costs from expected profit
    const netProfit = profit.minus(gasCost);

    // Apply safety buffer (take 80% of net profit as minimum)
    const minProfit = netProfit.mul(MIN_PROFIT_BUFFER);

    // If minimum profit is negative or too small, return 0
    if (minProfit.lessThanOrEqualTo(0)) {
        return '0';
    }

    return ethers.parseUnits(minProfit.toFixed(decimals), decimals).toString();
}

async function estimateGasCost(provider, gasEstimate) {
    try {
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei'); // Fallback to 50 gwei

        // Calculate total gas cost
        const gasCost = gasEstimate * gasPrice;
        return ethers.formatUnits(gasCost, 18); // Return as decimal string in ETH
    } catch (error) {
        console.error('Error estimating gas cost:', error.message);
        // Fallback estimation: assume 200k gas at 50 gwei
        const fallbackGas = BigInt(200000) * ethers.parseUnits('50', 'gwei');
        return ethers.formatUnits(fallbackGas, 18);
    }
}

async function createDirectExecutionPayload(opportunity, provider, amountIn) {
    console.log("Creating direct execution payload for opportunity:", opportunity);

    // Validate required fields
    if (!opportunity.buyDex || !opportunity.sellDex) {
        throw new Error(`Missing DEX information: buyDex=${opportunity.buyDex}, sellDex=${opportunity.sellDex}`);
    }

    // Check opportunity age (reject if older than 5 seconds)
    const opportunityTimestamp = opportunity.timestamp || Date.now();
    const ageSeconds = (Date.now() - opportunityTimestamp) / 1000;

    if (ageSeconds > 5) {
        console.log(`\n❌ Opportunity too old: ${ageSeconds.toFixed(2)}s (max: 5s)`);
        return { success: false, error: `Opportunity expired (${ageSeconds.toFixed(2)}s old)` };
    }

    console.log(`⏱️  Opportunity age: ${ageSeconds.toFixed(2)}s`);

    // Parse token details - handle both objects (from V3 engine) and strings (from Redis)
    const tokenA = typeof opportunity.tokenA === 'string'
        ? JSON.parse(opportunity.tokenA)
        : opportunity.tokenA;
    const tokenB = typeof opportunity.tokenB === 'string'
        ? JSON.parse(opportunity.tokenB)
        : opportunity.tokenB;
    const tokenA_dec = parseInt(tokenA.decimals || '18');
    const tokenB_dec = parseInt(tokenB.decimals || '18');

    // If amountIn is not provided, calculate it (for backwards compatibility)
    if (!amountIn) {
        amountIn = extractAmountIn(opportunity);
        console.log('⚠️ Warning: amountIn not provided, calculated from opportunity');
    }

    // Ensure amountIn is a string in Wei format
    amountIn = amountIn.toString();
    const amountInFormatted = ethers.formatUnits(amountIn, tokenB_dec);

    console.log(`Using amountIn: ${amountInFormatted} ${tokenB.symbol} (${amountIn} Wei)`);

    // Determine routers, fees, and DEX types
    let router1, router2, fee1, fee2, dexType1, dexType2;

    // Buy DEX configuration (Step 1: tokenB -> tokenA)
    if (opportunity.buyDex.startsWith("UniswapV3")) {
        router1 = DEX_ROUTER.router3;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000; // Fee in basis points (e.g., 3000 = 0.3%)
        dexType1 = 'V3';
    } else if (opportunity.buyDex.startsWith("SushiswapV3")) {
        router1 = DEX_ROUTER.router4;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000;
        dexType1 = 'V3';
    } else if (opportunity.buyDex.startsWith("PancakeswapV3")) {
        router1 = DEX_ROUTER.router5;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000;
        dexType1 = 'V3';
    } else if (opportunity.buyDex === "SushiswapV2") {
        router1 = DEX_ROUTER.router2;
        fee1 = 0;
        dexType1 = 'V2';
    } else if (opportunity.buyDex === "PancakeswapV2") {
        router1 = DEX_ROUTER.router6;
        fee1 = 0;
        dexType1 = 'V2';
    } else {
        router1 = DEX_ROUTER.router1; // UniswapV2
        fee1 = 0;
        dexType1 = 'V2';
    }

    // Sell DEX configuration (Step 2: tokenA -> tokenB)
    if (opportunity.sellDex.startsWith("UniswapV3")) {
        router2 = DEX_ROUTER.router3;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex.startsWith("SushiswapV3")) {
        router2 = DEX_ROUTER.router4;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex.startsWith("PancakeswapV3")) {
        router2 = DEX_ROUTER.router5;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex === "SushiswapV2") {
        router2 = DEX_ROUTER.router2;
        fee2 = 0;
        dexType2 = 'V2';
    } else if (opportunity.sellDex === "PancakeswapV2") {
        router2 = DEX_ROUTER.router6;
        fee2 = 0;
        dexType2 = 'V2';
    } else {
        router2 = DEX_ROUTER.router1; // UniswapV2
        fee2 = 0;
        dexType2 = 'V2';
    }

    const block = await provider.getBlock("latest");
    const timestamp = block.timestamp;

    // Calculate USD value for dynamic slippage
    // Since trades start with WETH, calculate USD from current ETH price
    let amountUSD = '5000'; // Default $100

    if (tokenB.symbol === 'WETH' || tokenB.symbol === 'WBNB' || tokenB.symbol === 'ETH') {
        // tokenB is WETH, tokenA is likely USDC/USDT
        // buyPrice is WETH per USDC (e.g., 0.00029040 means 1 USDC = 0.00029040 WETH)
        // To get USD per WETH: divide 1 by buyPrice (1 / 0.00029040 = ~3444 USDC per WETH)
        if (opportunity.buyPrice && (tokenA.symbol === 'USDC' || tokenA.symbol === 'USDT' || tokenA.symbol === 'DAI')) {
            const ethPriceUSD = new Decimal(1).div(new Decimal(opportunity.buyPrice));
            amountUSD = new Decimal(amountInFormatted).mul(ethPriceUSD).toString();
            console.log(`💰 ETH Price: $${ethPriceUSD.toFixed(2)} | Trade: ${amountInFormatted} WETH ≈ $${new Decimal(amountUSD).toFixed(2)}`);
        } else {
            // Fallback: estimate ETH at $3400
            amountUSD = new Decimal(amountInFormatted).mul(3400).toString();
            console.log(`💰 Trade: ${amountInFormatted} WETH ≈ $${new Decimal(amountUSD).toFixed(2)} (estimated at $3400/ETH)`);
        }
    } else if (tokenB.symbol === 'USDC' || tokenB.symbol === 'USDT' || tokenB.symbol === 'DAI' || tokenB.symbol === 'BUSD') {
        // If tokenB is a stablecoin, use the amount directly
        amountUSD = amountInFormatted;
        console.log(`💰 Trade: ${amountInFormatted} ${tokenB.symbol} ≈ $${amountUSD}`);
    } else if (opportunity.tokenBPriceUSD) {
        // If we have a direct USD price for tokenB
        amountUSD = new Decimal(amountInFormatted).mul(new Decimal(opportunity.tokenBPriceUSD)).toString();
        console.log(`💰 Trade: ${amountInFormatted} ${tokenB.symbol} ≈ $${new Decimal(amountUSD).toFixed(2)}`);
    }

    // STEP 1: Get minAmountOut for tokenB -> tokenA with dynamic slippage and price impact
    let step1Result;
    try {
        const step1Params = {
            provider,
            dexType: dexType1,
            amountIn: amountIn.toString(),
            tokenIn: tokenB.address,
            tokenOut: tokenA.address,
            tokenInDecimals: tokenB_dec,
            tokenOutDecimals: tokenA_dec,
            amountUSD: amountUSD
        };

        if (dexType1 === 'V2') {
            step1Params.routerAddress = router1;
            step1Params.pairAddress = opportunity.buyPoolAddress || opportunity.poolAddress1;
        } else {
            step1Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // UniswapV3 Quoter
            step1Params.fee = fee1;
            step1Params.currentPrice = opportunity.buyPrice; // Current price from slot0 if available
        }

        step1Result = await getMinAmountOutWithSlippage(step1Params);

        // console.log("setpe test", step1Result);
        // console.log(`✅ Step 1 (${opportunity.buyDex}): ${tokenB.symbol} -> ${tokenA.symbol}`);
        // console.log(`   Expected: ${step1Result.expectedOut} ${tokenA.symbol}`);
        // console.log(`   Min: ${ethers.formatUnits(step1Result.minAmountOut, tokenA_dec)} ${tokenA.symbol}`);
        // console.log(`   Price Impact: ${step1Result.priceImpact}%`);
        // console.log(`   Slippage: ${step1Result.slippagePercent}%`);
    } catch (error) {
        console.error(`Error getting Step 1 minAmountOut: ${error.message}`);
        // Fallback to old method
        const step1ExpectedOut = opportunity.buyPrice
            ? new Decimal(amountInFormatted).div(new Decimal(opportunity.buyPrice)).toString()
            : amountInFormatted;
        const dynamicSlippage = getDynamicSlippage(amountUSD);
        const step1MinOut = calculateMinAmountOut(step1ExpectedOut, tokenA_dec, dynamicSlippage);
        step1Result = {
            expectedOut: step1ExpectedOut,
            minAmountOut: step1MinOut.toString(),
            priceImpact: '0',
            slippagePercent: (dynamicSlippage * 100).toFixed(2)
        };
    }

    // STEP 2: Get minAmountOut for tokenA -> tokenB with dynamic slippage and price impact
    let step2Result;
    try {
        // ✅ FIX: Use expectedAmountOut directly (already in wei/BigInt), no double conversion
        const step2AmountIn = step1Result.expectedAmountOut; // Already in wei!

        const step2Params = {
            provider,
            dexType: dexType2,
            amountIn: step2AmountIn.toString(),
            tokenIn: tokenA.address,
            tokenOut: tokenB.address,
            tokenInDecimals: tokenA_dec,
            tokenOutDecimals: tokenB_dec,
            amountUSD: amountUSD
        };

        if (dexType2 === 'V2') {
            step2Params.routerAddress = router2;
            step2Params.pairAddress = opportunity.sellPoolAddress || opportunity.poolAddress2;
        } else {
            step2Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // UniswapV3 Quoter
            step2Params.fee = fee2;
            step2Params.currentPrice = opportunity.sellPrice; // Current price from slot0 if available
        }

        step2Result = await getMinAmountOutWithSlippage(step2Params);

        // console.log("step 2 test", step2Result);
        // console.log(`✅ Step 2 (${opportunity.sellDex}): ${tokenA.symbol} -> ${tokenB.symbol}`);
        // console.log(`   Expected: ${step2Result.expectedOut} ${tokenB.symbol}`);
        // console.log(`   Min: ${ethers.formatUnits(step2Result.minAmountOut, tokenB_dec)} ${tokenB.symbol}`);
        // console.log(`   Price Impact: ${step2Result.priceImpact}%`);
        // console.log(`   Slippage: ${step2Result.slippagePercent}%`);
    } catch (error) {
        console.error(`Error getting Step 2 minAmountOut: ${error.message}`);
        // Fallback to old method
        const step2ExpectedOut = opportunity.sellPrice
            ? new Decimal(step1Result.expectedOut).mul(new Decimal(opportunity.sellPrice)).toString()
            : step1Result.expectedOut;
        const dynamicSlippage = getDynamicSlippage(amountUSD);
        const step2MinOut = calculateMinAmountOut(step2ExpectedOut, tokenB_dec, dynamicSlippage);
        step2Result = {
            expectedOut: step2ExpectedOut,
            minAmountOut: step2MinOut.toString(),
            priceImpact: '0',
            slippagePercent: (dynamicSlippage * 100).toFixed(2)
        };
    }

    // Calculate minimum profit (in tokenB raw units)
    // const gasCost = opportunity.gasEstimation || '0';
    // const minProfit = calculateMinProfit(
    //     amountInFormatted || '0',
    //     gasCost,
    //     tokenB_dec
    // );
   
    console.log("step 2 expected out", amountIn)

    // ✅ FIX: Convert to BigInt for calculations (handle both BigInt and string returns)
    const amountInBigInt = BigInt(amountIn);
    const step1ExpectedAmountOut = typeof step1Result.expectedAmountOut === 'bigint'
        ? step1Result.expectedAmountOut
        : BigInt(step1Result.expectedAmountOut || step1Result.minAmountOut); // ✅ Use expectedAmountOut first!
    const step2ExpectedAmountOut = typeof step2Result.expectedAmountOut === 'bigint'
        ? step2Result.expectedAmountOut
        : BigInt(step2Result.expectedAmountOut || step2Result.minAmountOut); // ✅ Use expectedAmountOut first!

    const expectedProfit = step2ExpectedAmountOut > amountInBigInt
        ? step2ExpectedAmountOut - amountInBigInt
        : 0n;

    // Dynamic minimum based on trade size
    const minProfitBPS = 50; // 0.5%
    const minProfitRequired = (amountInBigInt * BigInt(minProfitBPS)) / 10000n;

    const gasCostFormatted = opportunity.gasEstimation || '0';

//     console.log(`
// 💰 Profit Analysis:
//    Amount In: ${ethers.formatUnits(amountInBigInt, tokenB_dec)} ${tokenB.symbol}
//    Step 1 Out: ${ethers.formatUnits(step1ExpectedAmountOut, tokenA_dec)} ${tokenA.symbol}
//    Step 2 Out: ${ethers.formatUnits(step2ExpectedAmountOut, tokenB_dec)} ${tokenB.symbol}
//    Expected Profit: ${ethers.formatUnits(expectedProfit, tokenB_dec)} ${tokenB.symbol}
//    Min Required: ${ethers.formatUnits(minProfitRequired, tokenB_dec)} ${tokenB.symbol}
//    Gas Cost: ${gasCostFormatted} ${tokenB.symbol}
// `);

    // if (expectedProfit < minProfitRequired) {
    //     console.log(' Profit too low after recalculation');
        
    //     return { success: false, error: 'Insufficient profit' };
    // }

    // console.log(`Expected Profit: ${opportunity.expectedProfit || 'N/A'} ${tokenB.symbol}`);
    // console.log(`Estimated Gas Cost: ${gasCost} ${tokenB.symbol}`);
    // console.log(`Minimum Profit Required: ${ethers.formatUnits(minProfit, tokenB_dec)} ${tokenB.symbol}`);

    const result = {
        path: [
            {
                router: router1,
                tokenIn: tokenB.address,
                tokenOut: tokenA.address,
                dexType: dexTypes[opportunity.buyDex].toString() || '0',
                fee: fee1.toString(),
                minAmountOut: step1Result.minAmountOut.toString() // Convert BigInt to string
            },
            {
                router: router2,
                tokenIn: tokenA.address,
                tokenOut: tokenB.address,
                dexType: dexTypes[opportunity.sellDex].toString() || '0',
                fee: fee2.toString(),
                minAmountOut: step2Result.minAmountOut.toString() // Convert BigInt to string
            }
        ],
        amountIn: amountIn.toString(), // Convert BigInt to string
        minProfit: minProfitRequired.toString(), // Convert BigInt to string
        deadline: (timestamp + 300).toString(), // 5 minutes
    };

    return result;
}


async function createFlashLoanPayload(opportunity, provider) {
    console.log("Creating flash loan execution payload for opportunity:", opportunity);

    // Validate required fields
    if (!opportunity.buyDex || !opportunity.sellDex) {
        throw new Error(`Missing DEX information: buyDex=${opportunity.buyDex}, sellDex=${opportunity.sellDex}`);
    }

    // Check opportunity age (reject if older than 5 seconds)
    const opportunityTimestamp = opportunity.timestamp || Date.now();
    const ageSeconds = (Date.now() - opportunityTimestamp) / 1000;

    if (ageSeconds > 5) {
        console.log(`\n❌ Flash loan opportunity too old: ${ageSeconds.toFixed(2)}s (max: 5s)`);
        return { success: false, error: `Opportunity expired (${ageSeconds.toFixed(2)}s old)` };
    }

    console.log(`⏱️  Opportunity age: ${ageSeconds.toFixed(2)}s`);

    // Parse token details - handle both objects (from V3 engine) and strings (from Redis)
    const tokenA = typeof opportunity.tokenA === 'string'
        ? JSON.parse(opportunity.tokenA)
        : opportunity.tokenA;
    const tokenB = typeof opportunity.tokenB === 'string'
        ? JSON.parse(opportunity.tokenB)
        : opportunity.tokenB;
    const tokenA_dec = parseInt(tokenA.decimals || '18');
    const tokenB_dec = parseInt(tokenB.decimals || '18');

    // Determine routers, fees, and DEX types
    let router1, router2, fee1, fee2, dexType1, dexType2;

    // Buy DEX configuration (Step 1: tokenB -> tokenA)
    if (opportunity.buyDex.startsWith("UniswapV3")) {
        router1 = DEX_ROUTER.router3;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000;
        dexType1 = 'V3';
    } else if (opportunity.buyDex.startsWith("SushiswapV3")) {
        router1 = DEX_ROUTER.router4;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000;
        dexType1 = 'V3';
    } else if (opportunity.buyDex.startsWith("PancakeswapV3")) {
        router1 = DEX_ROUTER.router5;
        fee1 = new Decimal(opportunity.fee1.toString()).mul(1000000).toNumber() || 3000;
        dexType1 = 'V3';
    } else if (opportunity.buyDex === "SushiswapV2") {
        router1 = DEX_ROUTER.router2;
        fee1 = 0;
        dexType1 = 'V2';
    } else if (opportunity.buyDex === "PancakeswapV2") {
        router1 = DEX_ROUTER.router6;
        fee1 = 0;
        dexType1 = 'V2';
    } else {
        router1 = DEX_ROUTER.router1; // UniswapV2
        fee1 = 0;
        dexType1 = 'V2';
    }

    // Sell DEX configuration (Step 2: tokenA -> tokenB)
    if (opportunity.sellDex.startsWith("UniswapV3")) {
        router2 = DEX_ROUTER.router3;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex.startsWith("SushiswapV3")) {
        router2 = DEX_ROUTER.router4;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex.startsWith("PancakeswapV3")) {
        router2 = DEX_ROUTER.router5;
        fee2 = new Decimal(opportunity.fee2.toString()).mul(1000000).toNumber() || 3000;
        dexType2 = 'V3';
    } else if (opportunity.sellDex === "SushiswapV2") {
        router2 = DEX_ROUTER.router2;
        fee2 = 0;
        dexType2 = 'V2';
    } else if (opportunity.sellDex === "PancakeswapV2") {
        router2 = DEX_ROUTER.router6;
        fee2 = 0;
        dexType2 = 'V2';
    } else {
        router2 = DEX_ROUTER.router1; // UniswapV2
        fee2 = 0;
        dexType2 = 'V2';
    }

    const block = await provider.getBlock("latest");
    const timestamp = block.timestamp;

    // Calculate loanAmount in raw units (loan is in tokenB/WETH)
    
    const loanAmount = extractAmountIn(opportunity)
    const loanAmountFormatted = ethers.formatUnits(loanAmount, tokenB_dec);

    console.log(`Using loan amount: ${loanAmountFormatted} ${tokenB.symbol} (${loanAmount} Wei)`);

    // Calculate USD value for dynamic slippage
    let amountUSD = '5000'; // Default $200

    if (tokenB.symbol === 'WETH' || tokenB.symbol === 'WBNB' || tokenB.symbol === 'ETH') {
        // tokenB is WETH
        if (opportunity.buyPrice && (tokenA.symbol === 'USDC' || tokenA.symbol === 'USDT' || tokenA.symbol === 'DAI')) {
            const ethPriceUSD = new Decimal(1).div(new Decimal(opportunity.buyPrice));
            amountUSD = new Decimal(loanAmountFormatted).mul(ethPriceUSD).toString();
            console.log(`💰 ETH Price: ${ethPriceUSD.toFixed(2)} | Loan: ${loanAmountFormatted} WETH ≈ $${new Decimal(amountUSD).toFixed(2)}`);
        } else {
            // Fallback: estimate ETH at $3400
            amountUSD = new Decimal(loanAmountFormatted).mul(3400).toString();
            console.log(`💰 Loan: ${loanAmountFormatted} WETH ≈ $${new Decimal(amountUSD).toFixed(2)} (estimated at $3400/ETH)`);
        }
    } else if (tokenB.symbol === 'USDC' || tokenB.symbol === 'USDT' || tokenB.symbol === 'DAI' || tokenB.symbol === 'BUSD') {
        // If tokenB is a stablecoin, use the amount directly
        amountUSD = loanAmountFormatted;
        console.log(`💰 Loan: ${loanAmountFormatted} ${tokenB.symbol} ≈ $${amountUSD}`);
    } else if (opportunity.tokenBPriceUSD) {
        // If we have a direct USD price for tokenB
        amountUSD = new Decimal(loanAmountFormatted).mul(new Decimal(opportunity.tokenBPriceUSD)).toString();
        console.log(`💰 Loan: ${loanAmountFormatted} ${tokenB.symbol} ≈ $${new Decimal(amountUSD).toFixed(2)}`);
    }

    // STEP 1: Get minAmountOut for tokenB -> tokenA with dynamic slippage and price impact
    let step1Result;
    try {
        const step1Params = {
            provider,
            dexType: dexType1,
            amountIn: loanAmount.toString(),
            tokenIn: tokenB.address,
            tokenOut: tokenA.address,
            tokenInDecimals: tokenB_dec,
            tokenOutDecimals: tokenA_dec,
            amountUSD: amountUSD
        };

        if (dexType1 === 'V2') {
            step1Params.routerAddress = router1;
            step1Params.pairAddress = opportunity.buyPoolAddress || opportunity.poolAddress1;
        } else {
            step1Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // UniswapV3 Quoter
            step1Params.fee = fee1;
            step1Params.currentPrice = opportunity.buyPrice;
        }

        step1Result = await getMinAmountOutWithSlippage(step1Params);

        console.log(`✅ Step 1 (${opportunity.buyDex}): ${tokenB.symbol} -> ${tokenA.symbol}`);
        console.log(`   Expected: ${step1Result.expectedOut} ${tokenA.symbol}`);
        console.log(`   Min: ${ethers.formatUnits(step1Result.minAmountOut, tokenA_dec)} ${tokenA.symbol}`);
        console.log(`   Price Impact: ${step1Result.priceImpact}%`);
        console.log(`   Slippage: ${step1Result.slippagePercent}%`);
    } catch (error) {
        console.error(`Error getting Step 1 minAmountOut: ${error.message}`);
        // Fallback to old method
        const step1ExpectedOut = opportunity.buyPrice
            ? new Decimal(loanAmountFormatted).div(new Decimal(opportunity.buyPrice)).toString()
            : loanAmountFormatted;
        const dynamicSlippage = getDynamicSlippage(amountUSD);
        const step1MinOut = calculateMinAmountOut(step1ExpectedOut, tokenA_dec, dynamicSlippage);
        step1Result = {
            expectedOut: step1ExpectedOut,
            minAmountOut: step1MinOut.toString(),
            priceImpact: '0',
            slippagePercent: (dynamicSlippage * 100).toFixed(2)
        };
    }

    // STEP 2: Get minAmountOut for tokenA -> tokenB with dynamic slippage and price impact
    let step2Result;
    try {
        // ✅ FIX: Use expectedAmountOut directly (already in wei/BigInt), no double conversion
        const step2AmountIn = step1Result.expectedAmountOut; // Already in wei!

        const step2Params = {
            provider,
            dexType: dexType2,
            amountIn: step2AmountIn.toString(),
            tokenIn: tokenA.address,
            tokenOut: tokenB.address,
            tokenInDecimals: tokenA_dec,
            tokenOutDecimals: tokenB_dec,
            amountUSD: amountUSD
        };

        if (dexType2 === 'V2') {
            step2Params.routerAddress = router2;
            step2Params.pairAddress = opportunity.sellPoolAddress || opportunity.poolAddress2;
        } else {
            step2Params.quoterAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // UniswapV3 Quoter
            step2Params.fee = fee2;
            step2Params.currentPrice = opportunity.sellPrice;
        }

        step2Result = await getMinAmountOutWithSlippage(step2Params);

        console.log(`✅ Step 2 (${opportunity.sellDex}): ${tokenA.symbol} -> ${tokenB.symbol}`);
        console.log(`   Expected: ${step2Result.expectedOut} ${tokenB.symbol}`);
        console.log(`   Min: ${ethers.formatUnits(step2Result.minAmountOut, tokenB_dec)} ${tokenB.symbol}`);
        console.log(`   Price Impact: ${step2Result.priceImpact}%`);
        console.log(`   Slippage: ${step2Result.slippagePercent}%`);
    } catch (error) {
        console.error(`Error getting Step 2 minAmountOut: ${error.message}`);
        // Fallback to old method
        const step2ExpectedOut = opportunity.sellPrice
            ? new Decimal(step1Result.expectedOut).mul(new Decimal(opportunity.sellPrice)).toString()
            : step1Result.expectedOut;
        const dynamicSlippage = getDynamicSlippage(amountUSD);
        const step2MinOut = calculateMinAmountOut(step2ExpectedOut, tokenB_dec, dynamicSlippage);
        step2Result = {
            expectedOut: step2ExpectedOut,
            minAmountOut: step2MinOut.toString(),
            priceImpact: '0',
            slippagePercent: (dynamicSlippage * 100).toFixed(2)
        };
    }

    console.log("Flash loan amount:", loanAmount);

    // ✅ FIX: Convert to BigInt for calculations (handle both BigInt and string returns)
    const loanAmountBigInt = BigInt(loanAmount);
    const step1ExpectedAmountOut = typeof step1Result.expectedAmountOut === 'bigint'
        ? step1Result.expectedAmountOut
        : BigInt(step1Result.expectedAmountOut || step1Result.minAmountOut); // ✅ Use expectedAmountOut first!
    const step2ExpectedAmountOut = typeof step2Result.expectedAmountOut === 'bigint'
        ? step2Result.expectedAmountOut
        : BigInt(step2Result.expectedAmountOut || step2Result.minAmountOut); // ✅ Use expectedAmountOut first!

    // Calculate expected profit (Balancer flash loans have no fees)
    const totalRepayment = loanAmountBigInt; // No flash loan fee for Balancer

    const expectedProfit = step2ExpectedAmountOut > totalRepayment
        ? step2ExpectedAmountOut - totalRepayment
        : 0n;

    // Dynamic minimum based on trade size
    const minProfitBPS = 50n; // 0.5%
    const minProfitRequired = (loanAmountBigInt * minProfitBPS) / 10000n;

    const gasCostFormatted = opportunity.gasEstimation || '0';

    console.log(`
💰 Flash Loan Profit Analysis (Balancer - No Fees):
   Loan Amount:      ${ethers.formatUnits(loanAmountBigInt, tokenB_dec)} ${tokenB.symbol}
   Total Repayment:  ${ethers.formatUnits(totalRepayment, tokenB_dec)} ${tokenB.symbol}
   Step 1 Out:       ${ethers.formatUnits(step1ExpectedAmountOut, tokenA_dec)} ${tokenA.symbol}
   Step 2 Out:       ${ethers.formatUnits(step2ExpectedAmountOut, tokenB_dec)} ${tokenB.symbol}
   Expected Profit:  ${ethers.formatUnits(expectedProfit, tokenB_dec)} ${tokenB.symbol}
   Min Required:     ${ethers.formatUnits(minProfitRequired, tokenB_dec)} ${tokenB.symbol}
   Gas Cost:         ${gasCostFormatted} ${tokenB.symbol}
`);

    // // Validate profitability
    // if (expectedProfit < minProfitRequired) {
    //     console.log('⚠️  Flash loan profit too low after recalculation');
    //     return { success: false, error: 'Insufficient profit for flash loan' };
    // }

    const result = {
        path: [
            {
                router: router1,
                tokenIn: tokenB.address,
                tokenOut: tokenA.address,
                dexType: dexTypes[opportunity.buyDex].toString() || '0',
                fee: fee1.toString(),
                minAmountOut: step1Result.minAmountOut.toString() // Convert BigInt to string
            },
            {
                router: router2,
                tokenIn: tokenA.address,
                tokenOut: tokenB.address,
                dexType: dexTypes[opportunity.sellDex].toString() || '0',
                fee: fee2.toString(),
                minAmountOut: step2Result.minAmountOut.toString() // Convert BigInt to string
            }
        ],
        loanToken: tokenB.address, // Flash loan is taken in tokenB
        loanAmount: loanAmount.toString(), // Raw units in Wei
        amountIn: loanAmount.toString(), // Same as loanAmount for flash loans - needed for validation
        minProfit: minProfitRequired.toString(), // Raw units in Wei
        deadline: (timestamp + 300).toString(), // 5 minutes (same as direct execution)
    };

    return result;
}

function createTriangularExecutionPayload(opportunity) {
    const path = [];
    const startToken = opportunity.path[0];
    const startDecimals = getTokenDecimals(startToken);

    for (let i = 0; i < opportunity.path.length - 1; i++) {
        path.push({
            router: opportunity.dexes[i],
            tokenIn: opportunity.path[i],
            tokenOut: opportunity.path[i + 1],
            dexType: dexTypes[opportunity.dexes[i]],
            fee: opportunity.fees[i],
            minAmountOut: 0,
        });
    }

    // Handle undefined values properly
    const profit = opportunity.profit ?
        new Decimal(opportunity.profit) :
        new Decimal('0');

    return {
        path,
        loanToken: startToken,
        loanAmount: opportunity.amounts[0].toString(),
        minProfit: profit.toString(),
        deadline: Math.floor(Date.now() / 1000) + 300,
    };
}

export {
    createDirectExecutionPayload,
    createTriangularExecutionPayload,
    createFlashLoanPayload,
    calculatePriceImpactV2,
    calculatePriceImpactV3,
    getDynamicSlippage,
    getMinAmountOutV2,
    getMinAmountOutV3,
    getMinAmountOutWithSlippage
};  
