import { ethers } from 'ethers';
import { Token, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core';
import { Pair, Route, Trade as TradeV2 } from '@uniswap/v2-sdk';
import Decimal from 'decimal.js';

const SLIPPAGE_TOLERANCE = new Percent(50, 10000); // 0.5% = 50/10000
const CHAIN_ID = 1; // Ethereum mainnet

const DEX_ROUTER = {
    router1: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    router2: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // Sushiswap
    router3: "0xE592427A0AEce92De3Edee1F18E0157C05861564"  // Uniswap V3
};

// Uniswap V3 Quoter V2 address
const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";

// Quoter V2 ABI (only the functions we need)
const QUOTER_V2_ABI = [
    "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

/**
 * Calculate minAmountOut for Uniswap V2 using SDK
 */
async function calculateMinAmountOutV2(
    tokenIn,
    tokenOut,
    amountIn,
    pairReserves,
    slippageTolerance = SLIPPAGE_TOLERANCE
) {
    try {

        console.log("AmountIn", amountIn)
        // Create Token instances
        const tokenInSDK = new Token(
            CHAIN_ID,
            tokenIn.address,
            parseInt(tokenIn.decimals),
            tokenIn.symbol,
            tokenIn.name || tokenIn.symbol
        );

        const tokenOutSDK = new Token(
            CHAIN_ID,
            tokenOut.address,
            parseInt(tokenOut.decimals),
            tokenOut.symbol,
            tokenOut.name || tokenOut.symbol
        );

        // Create Pair instance with reserves
        const [reserve0, reserve1] = pairReserves.token0Address.toLowerCase() === tokenIn.address.toLowerCase()
            ? [pairReserves.reserve0, pairReserves.reserve1]
            : [pairReserves.reserve1, pairReserves.reserve0];

        const pair = new Pair(
            CurrencyAmount.fromRawAmount(tokenInSDK, reserve0.toString()),
            CurrencyAmount.fromRawAmount(tokenOutSDK, reserve1.toString())
        );

        // Create Route
        const route = new Route([pair], tokenInSDK, tokenOutSDK);

        // Create Trade
        const amountInSDK = CurrencyAmount.fromRawAmount(
            tokenInSDK,
            amountIn.toString()
        );

        const trade = new TradeV2(
            route,
            amountInSDK,
            TradeType.EXACT_INPUT
        );

        // Calculate minimum amount out with slippage
        const minAmountOut = trade.minimumAmountOut(slippageTolerance);

        console.log(`[V2] Expected output: ${trade.outputAmount.toSignificant(6)} ${tokenOut.symbol}`);
        console.log(`[V2] Min output (with ${slippageTolerance.toSignificant(2)}% slippage): ${minAmountOut.toSignificant(6)} ${tokenOut.symbol}`);
        console.log(`[V2] Price impact: ${trade.priceImpact.toSignificant(2)}%`);

        return {
            minAmountOut: minAmountOut.quotient.toString(),
            expectedAmountOut: trade.outputAmount.quotient.toString(),
            priceImpact: trade.priceImpact.toSignificant(4),
            executionPrice: trade.executionPrice.toSignificant(6)
        };

    } catch (error) {
        console.error('Error calculating V2 minAmountOut:', error.message);
        throw error;
    }
}

/**
 * Calculate minAmountOut for Uniswap V3 using Quoter contract (RELIABLE METHOD)
 */
async function calculateMinAmountOutV3(
    tokenIn,
    tokenOut,
    amountIn,
    fee,
    provider,
    slippageTolerance = SLIPPAGE_TOLERANCE
) {
    try {
        // Create Quoter contract instance
        const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
       
        // Prepare quote params
        const quoteParams = {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0 // No price limit
        };

        console.log(`[V3] Querying quoter for ${ethers.formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol} -> ${tokenOut.symbol}`);

        // Call quoter (static call - doesn't send transaction)
        const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = 
            await quoter.quoteExactInputSingle.staticCall(quoteParams);

        // Calculate minimum amount out with slippage
        const expectedAmountOut = amountOut;
        const slippageMultiplier = new Decimal(1).minus(
            new Decimal(slippageTolerance.numerator.toString()).div(
                new Decimal(slippageTolerance.denominator.toString())
            )
        );
        
        const minAmountOut = new Decimal(expectedAmountOut)
            .mul(slippageMultiplier)
            .toFixed(0);

        console.log(`[V3] Expected output: ${ethers.formatUnits(expectedAmountOut, tokenOut.decimals)} ${tokenOut.symbol}`);
        console.log(`[V3] Min output (with ${slippageTolerance.toSignificant(2)}% slippage): ${ethers.formatUnits(minAmountOut, tokenOut.decimals)} ${tokenOut.symbol}`);
        console.log(`[V3] Gas estimate: ${gasEstimate.toString()}`);

        return {
            minAmountOut: minAmountOut.toString(),
            expectedAmountOut: expectedAmountOut.toString(),
            gasEstimate: gasEstimate.toString(),
            sqrtPriceX96After: sqrtPriceX96After.toString()
        };

    } catch (error) {
        console.error('Error calculating V3 minAmountOut with Quoter:', error.message);
        throw error;
    }
}

/**
 * Fetch pool data from blockchain for V2
 */
async function fetchV2PairReserves(provider, pairAddress) {
    const pairABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
    ];

    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    const [reserves, token0] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0()
    ]);

    return {
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
        token0Address: token0
    };
}

/**
 * Get fee tier from dex name
 */
function getFeeFromDexName(dexName) {
    if (dexName === 'UniswapV3_500') return 500;
    if (dexName === 'UniswapV3_3000') return 3000;
    if (dexName === 'UniswapV3_10000') return 10000;
    return 3000; // Default
}

/**
 * Updated function to integrate with your existing code
 */
async function createDirectExecutionPayloadWithSDK(opportunity, provider) {

    // console.log("\nCreating execution payload with SDK for opportunity:", opportunity);
    // console.log("opprotunity.tokenA:", opportunity.tokenA);

    // Handle tokenA/tokenB - they might be objects (from V3 engine) or strings (from Redis)
    const tokenA = typeof opportunity.tokenA === 'string'
        ? JSON.parse(opportunity.tokenA)
        : opportunity.tokenA;
    console.log("Token A:", tokenA);

    const tokenB = typeof opportunity.tokenB === 'string'
        ? JSON.parse(opportunity.tokenB)
        : opportunity.tokenB;
    console.log("Token B:", tokenB);

    // const tokenA = typeof opportunity.tokenA === 'string' ? JSON.parse(opportunity.tokenA) : opportunity.tokenA;
    // console.log("Token A:", tokenA);
    // const tokenB = typeof opportunity.tokenB === 'string' ? JSON.parse(opportunity.tokenB) : opportunity.tokenB;
    // console.log("Token B:", tokenB);
    const tokenA_dec = parseInt(tokenA.decimals || '18');
    // console.log("Token A Decimals:", tokenA_dec);
    const tokenB_dec = parseInt(tokenB.decimals || '18');
// console.log("Token B Decimals:", tokenB_dec);
    console.log("\n" + "=".repeat(80));
    console.log(`Processing opportunity: ${opportunity.poolId}`);
    console.log(`Buy on ${opportunity.buyDex}, Sell on ${opportunity.sellDex}`);
    console.log("=".repeat(80));

    // Calculate amountIn
    const amountIn = calculateAmountIn(opportunity);
    console.log(`AmountIn: ${ethers.formatUnits(amountIn, tokenB_dec)} ${tokenB.symbol} (${amountIn} raw)`);

    let step1Result, step2Result;
    const slippage1 = new Percent(50, 10000); // 1% for step 1
    const slippage2 = new Percent(50, 10000); // 5% for step 2

    try {
        // Step 1: Buy tokenA with tokenB
        console.log(`\n--- Step 1: ${tokenB.symbol} -> ${tokenA.symbol} on ${opportunity.buyDex} ---`);
        
        if (opportunity.buyDex.startsWith("UniswapV3")) {
            const fee = getFeeFromDexName(opportunity.buyDex);
            step1Result = await calculateMinAmountOutV3(
                tokenB,
                tokenA,
                amountIn,
                fee,
                provider,
                slippage1
            );
        } else {
            // V2 (Uniswap or Sushiswap)
            const pairReserves = await fetchV2PairReserves(provider, opportunity.buyPoolAddress);
            step1Result = await calculateMinAmountOutV2(
                tokenB,
                tokenA,
                amountIn,
                pairReserves,
                slippage1
            );
        }


        // Step 2: Sell tokenA for tokenB
        console.log(`\n--- Step 2: ${tokenA.symbol} -> ${tokenB.symbol} on ${opportunity.sellDex} ---`);
        
        if (opportunity.sellDex.startsWith("UniswapV3")) {
            const fee = getFeeFromDexName(opportunity.sellDex);
            step2Result = await calculateMinAmountOutV3(
                tokenA,
                tokenB,
                step1Result.expectedAmountOut, // Use expected from step 1
                fee,
                provider,
                slippage2
            );
        } else {
            const pairReserves = await fetchV2PairReserves(provider, opportunity.sellPoolAddress);
            step2Result = await calculateMinAmountOutV2(
                tokenA,
                tokenB,
                step1Result.expectedAmountOut, // Use expected from step 1
                pairReserves,
                slippage2
            );
        }


        console.log("Step1result", step1Result)
        console.log("Step2result", step2Result)

        // Calculate profit
        const amountInBN = BigInt(amountIn);
        const step2MinOutBN = BigInt(step2Result.minAmountOut);
        const step2ExpectedOutBN = BigInt(step2Result.expectedAmountOut);
        
        const minProfit = step2MinOutBN > amountInBN ? (step2MinOutBN - amountInBN).toString() : '0';
        const expectedProfit = step2ExpectedOutBN > amountInBN ? (step2ExpectedOutBN - amountInBN).toString() : '0';

        console.log("\n" + "=".repeat(80));
        console.log("PROFIT ANALYSIS:");
        console.log("=".repeat(80));
        console.log(`Amount In:        ${ethers.formatUnits(amountIn, tokenB_dec)} ${tokenB.symbol}`);
        console.log(`Expected Out:     ${ethers.formatUnits(step2Result.expectedAmountOut, tokenB_dec)} ${tokenB.symbol}`);
        console.log(`Min Out (slipped):${ethers.formatUnits(step2Result.minAmountOut, tokenB_dec)} ${tokenB.symbol}`);
        console.log(`Expected Profit:  ${ethers.formatUnits(expectedProfit, tokenB_dec)} ${tokenB.symbol}`);
        console.log(`Min Profit:       ${ethers.formatUnits(minProfit, tokenB_dec)} ${tokenB.symbol}`);
        console.log("=".repeat(80) + "\n");

        // Build execution payload
        const block = await provider.getBlock("latest");
        const timestamp = block.timestamp;

        // Determine routers and fees
        let router1, router2, fee1, fee2;
        
        if (opportunity.buyDex.startsWith("UniswapV3")) {
            router1 = DEX_ROUTER.router3;
            fee1 = getFeeFromDexName(opportunity.buyDex);
        } else if (opportunity.buyDex === "SushiswapV2") {
            router1 = DEX_ROUTER.router2;
            fee1 = 0;
        } else {
            router1 = DEX_ROUTER.router1;
            fee1 = 0;
        }

        if (opportunity.sellDex.startsWith("UniswapV3")) {
            router2 = DEX_ROUTER.router3;
            fee2 = getFeeFromDexName(opportunity.sellDex);
        } else if (opportunity.sellDex === "SushiswapV2") {
            router2 = DEX_ROUTER.router2;
            fee2 = 0;
        } else {
            router2 = DEX_ROUTER.router1;
            fee2 = 0;
        }

        const dexTypes = {
            "UniswapV2": 0,
            "SushiswapV2": 0,
            "PancakeswapV2": 0,
            "UniswapV3_3000": 1,
            "UniswapV3_500": 1,
            "UniswapV3_10000": 1
        };

        return {
            path: [
                {
                    router: router1,
                    tokenIn: tokenB.address,
                    tokenOut: tokenA.address,
                    dexType: dexTypes[opportunity.buyDex].toString() || '0',
                    fee: fee1.toString(),
                    minAmountOut: step1Result.minAmountOut
                },
                {
                    router: router2,
                    tokenIn: tokenA.address,
                    tokenOut: tokenB.address,
                    dexType: dexTypes[opportunity.sellDex].toString() || '0',
                    fee: fee2.toString(),
                    minAmountOut: step2Result.minAmountOut
                }
            ],
            amountIn: amountIn.toString(),
            minProfit: "0",
            deadline: (timestamp + 60).toString() // 60 seconds from now,
        };



    } catch (error) {
        console.error('\n❌ Error calculating with SDK:', error.message);
        throw error;
    }
}

// Helper functions
function calculateAmountIn(opportunity) {
    // const tokenB = JSON.parse(opportunity.tokenB || '{}');
    const tokenB = typeof opportunity.tokenB === 'string' ? JSON.parse(opportunity.tokenB) : opportunity.tokenB;
    const inputDecimals = parseInt(tokenB.decimals || '18');
    
    // Priority 1: Use amountIn from opportunity if available
    
    
    // Priority 2: Use fixed amounts for stablecoins
    if (opportunity.poolId && (
        opportunity.poolId.includes('USDC') || 
        opportunity.poolId.includes('USDT') 
    )) {
        return '5000000'; // 1 stablecoin
    }
    if (opportunity.poolId && opportunity.poolId.includes('DAI')) {
        return '5000000000000000000'; // 5 DAI
    }
    if (opportunity.poolId && opportunity.poolId.includes('WETH')) {
        return '10400000000000000'; // 0.01 WETH
    }
    // Priority 3: Use liquidity-based calculation
    if (opportunity.availableLiquidity) {
        const liquidity = new Decimal(opportunity.availableLiquidity);
        const optimalAmount = liquidity.mul(0.01); // Use 1% of liquidity
        return ethers.parseUnits(optimalAmount.toFixed(inputDecimals), inputDecimals).toString();
    }
    
    // Default fallback
    return ethers.parseUnits('0.01', inputDecimals).toString();
}

export {
    calculateMinAmountOutV2,
    calculateMinAmountOutV3,
    fetchV2PairReserves,
    createDirectExecutionPayloadWithSDK
};