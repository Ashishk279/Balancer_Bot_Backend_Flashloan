#!/usr/bin/env node

import "dotenv/config";
import { ethers } from 'ethers';
import OpportunityProcessor from '../src/services/opportunityProcessor.js';
import { getRpcUrls, ETHEREUM_CHAIN_ID } from '../src/services/rpcService.js';
import logger from '../src/utils/logger.js';

/**
 * Test script for arbitrage execution
 * This script tests the execution flow without running the full bot
 */
async function testExecution() {
    try {
        console.log('🧪 Testing Arbitrage Execution Flow...\n');

        // Check if private key is set
        if (!process.env.PRIVATE_KEY) {
            console.log('❌ PRIVATE_KEY not set in .env file');
            console.log('   Please set your private key to test execution');
            console.log('   Example: PRIVATE_KEY=0x1234567890abcdef...');
            return;
        }

        // Initialize logger
        await logger.init();

        // Get RPC URL
        const rpcUrls = await getRpcUrls(ETHEREUM_CHAIN_ID);
        if (rpcUrls.length === 0) {
            throw new Error('No RPC URLs available');
        }

        // Create provider and wallet
        const provider = new ethers.WebSocketProvider(rpcUrls[0]);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log('📡 Connected to:', rpcUrls[0]);
        console.log('👛 Wallet address:', wallet.address);

        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log('💰 Wallet balance:', ethers.formatEther(balance), 'ETH');

        if (balance < ethers.parseEther("0.01")) {
            console.log('⚠️  Warning: Low balance. Consider adding more ETH for gas fees');
        }

        // Initialize opportunity processor
        console.log('\n🔧 Initializing Opportunity Processor...');
        const processor = new OpportunityProcessor(provider, wallet);
        await processor.initialize();
        await processor.start();

        console.log('✅ Opportunity Processor initialized successfully');

        // Create a test opportunity
        const testOpportunity = {
            id: 'test_opp_001',
            timestamp: Date.now(),
            dex_a: 'UniswapV2',
            dex_b: 'SushiV2',
            pair: 'WETH/USDC',
            amount_in: '1.0',
            direction: 'WETH -> USDC -> WETH',
            buy_price: '2000',
            sell_price: '2010',
            price_difference: '10',
            price_difference_pct: '0.5',
            estimated_profit: '0.005', // 0.005 ETH profit
            gas_cost_estimate: '0.001',
            execution_status: 'detected',
            arbitrage_type: 'simple',
            execution_payload: {
                path: [
                    {
                        router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                        tokenOut: '0xA0b86a33E6441b8c4C8C0C4C0C4C0C4C0C4C0C4C',
                        dexType: 0
                    }
                ],
                loanToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                loanAmount: '1000000000000000000',
                minProfit: '4000000000000000'
            }
        };

        console.log('\n🎯 Testing with sample opportunity:');
        console.log('   Pair:', testOpportunity.pair);
        console.log('   Expected Profit:', testOpportunity.estimated_profit, 'ETH');
        console.log('   Type:', testOpportunity.arbitrage_type);

        // Test execution
        console.log('\n🚀 Starting execution test...');
        const startTime = Date.now();
        
        // Simulate opportunity processing
        const result = await processor.instantExecutor.executeArbitrage(testOpportunity);
        
        const executionTime = Date.now() - startTime;
        
        console.log('\n📊 Execution Results:');
        console.log('   Success:', result.success ? '✅' : '❌');
        console.log('   Execution Time:', executionTime, 'ms');
        
        if (result.success) {
            console.log('   Profit:', result.profit, 'ETH');
            console.log('   Gas Used:', result.gasUsed);
            console.log('   Gas Cost:', result.gasCost, 'ETH');
            console.log('   Transaction Hash:', result.transactionHash);
            console.log('   Block Number:', result.blockNumber);
        } else {
            console.log('   Error:', result.error);
        }

        // Get processor stats
        const stats = processor.getStats();
        console.log('\n📈 Processor Statistics:');
        console.log('   Total Processed:', stats.totalProcessed);
        console.log('   Successful:', stats.successfulExecutions);
        console.log('   Failed:', stats.failedExecutions);
        console.log('   Total Profit:', stats.totalProfit.toString(), 'ETH');

        // Stop processor
        await processor.stop();
        console.log('\n✅ Test completed successfully');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        process.exit(0);
    }
}

// Run the test
testExecution();
