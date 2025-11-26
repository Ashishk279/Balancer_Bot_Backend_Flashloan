#!/usr/bin/env node

import { ethers } from 'ethers';
import ArbitrageDetector from '../src/services/arbitrageAnalyzer.js';
import PriceFetcher from '../src/services/priceFetcher.js';
import { Decimal } from 'decimal.js';

/**
 * Test script for opportunity detection optimization
 * This script helps debug why opportunities aren't being detected
 */
async function testOpportunityDetection() {
    console.log('🔍 Testing Opportunity Detection...\n');

    try {
        // Create provider
        const provider = new ethers.WebSocketProvider('wss://ethereum-rpc.publicnode.com');
        
        // Create services
        const priceFetcher = new PriceFetcher(provider);
        const arbitrageDetector = new ArbitrageDetector(provider);

        console.log('📡 Fetching prices from all DEXs...');
        const allPrices = await priceFetcher.fetchAllPrices();
        
        if (!allPrices || allPrices.length === 0) {
            console.log('❌ No prices fetched. Check RPC connection.');
            return;
        }

        console.log(`✅ Fetched ${allPrices.length} price points\n`);

        // Group prices by pair
        const pricesByPair = new Map();
        allPrices.forEach(price => {
            const key = `${price.tokenA.symbol}/${price.tokenB.symbol}`;
            if (!pricesByPair.has(key)) {
                pricesByPair.set(key, []);
            }
            pricesByPair.get(key).push(price);
        });

        console.log('📊 Price Analysis:');
        console.log('==================');

        let totalOpportunities = 0;
        let profitablePairs = 0;

        // Analyze each pair
        for (const [pair, prices] of pricesByPair) {
            if (prices.length < 2) {
                console.log(`⚠️  ${pair}: Only ${prices.length} price(s) - need at least 2 DEXs`);
                continue;
            }

            console.log(`\n🔍 Analyzing ${pair}:`);
            
            // Find min and max prices
            let minPrice = prices[0];
            let maxPrice = prices[0];
            
            prices.forEach(price => {
                if (price.priceOfAinB.lt(minPrice.priceOfAinB)) {
                    minPrice = price;
                }
                if (price.priceOfAinB.gt(maxPrice.priceOfAinB)) {
                    maxPrice = price;
                }
            });

            const spread = maxPrice.priceOfAinB.sub(minPrice.priceOfAinB).div(minPrice.priceOfAinB).mul(100);
            
            console.log(`   Min price: ${minPrice.priceOfAinB.toFixed(8)} on ${minPrice.dex}`);
            console.log(`   Max price: ${maxPrice.priceOfAinB.toFixed(8)} on ${maxPrice.dex}`);
            console.log(`   Spread: ${spread.toFixed(4)}%`);

            if (spread.gt(0.1)) { // 0.1% threshold for testing
                console.log(`   ✅ SPREAD DETECTED: ${spread.toFixed(4)}%`);
                profitablePairs++;
                
                // Test direct arbitrage calculation
                try {
                    await arbitrageDetector.calculateProfitForDirectSwap(minPrice, maxPrice, pair, spread);
                    totalOpportunities++;
                } catch (error) {
                    console.log(`   ❌ Calculation error: ${error.message}`);
                }
            } else {
                console.log(`   ❌ Spread too small: ${spread.toFixed(4)}%`);
            }
        }

        console.log('\n📈 Summary:');
        console.log('============');
        console.log(`Total pairs analyzed: ${pricesByPair.size}`);
        console.log(`Pairs with spreads: ${profitablePairs}`);
        console.log(`Total opportunities: ${totalOpportunities}`);

        if (totalOpportunities === 0) {
            console.log('\n🔧 Optimization Suggestions:');
            console.log('1. Lower profit thresholds in .env');
            console.log('2. Check RPC connection stability');
            console.log('3. Monitor gas prices');
            console.log('4. Consider different token pairs');
            console.log('5. Check for network congestion');
        }

        // Test triangular arbitrage
        console.log('\n🔄 Testing Triangular Arbitrage...');
        const triangularOpportunities = await arbitrageDetector.findTriangularArbitrage(allPrices);
        console.log(`Triangular opportunities found: ${triangularOpportunities || 0}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testOpportunityDetection();
