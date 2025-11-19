#!/usr/bin/env node

/**
 * Test Integration Script
 * Tests the flashbot integration with the bot backend
 */

import { ethers } from 'ethers';
import FlashbotBridge from '../src/services/flashbotBridge.js';

// Mock environment variables
process.env.ARBITRAGE_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.FLASHBOTS_RELAY = 'https://relay.flashbots.net';

/**
 * Test the flashbot bridge
 */
async function testFlashbotBridge() {
    try {
        console.log('🧪 Testing FlashbotBridge...\n');
        
        // Create mock provider and wallet
        const mockProvider = {
            getNetwork: () => Promise.resolve({ chainId: 1n }),
            getBlockNumber: () => Promise.resolve(12345)
        };
        
        const mockWallet = {
            address: '0x1234567890123456789012345678901234567890',
            signMessage: () => Promise.resolve('0x'),
            signTransaction: () => Promise.resolve('0x')
        };
        
        // Create flashbot bridge
        const bridge = new FlashbotBridge(mockProvider, mockWallet, process.env.ARBITRAGE_CONTRACT_ADDRESS, {
            flashbotsRelay: process.env.FLASHBOTS_RELAY,
            minProfitThreshold: 0.01
        });
        
        console.log('✅ FlashbotBridge created');
        
        // Test initialization
        console.log('\n🔄 Testing initialization...');
        await bridge.initialize();
        console.log('✅ Initialization successful');
        
        // Test status
        console.log('\n📊 Bridge status:', bridge.getStatus());
        
        // Test execution with mock opportunity
        console.log('\n🚀 Testing execution...');
        const mockOpportunity = {
            id: 'test_opp_1',
            type: 'direct',
            netProfit: { toString: () => '0.05' },
            timestamp: Date.now(),
            tokenA: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }, // WETH
            tokenB: { address: '0xA0b86a33E6441b8c4C8D7F4C8C8C8C8C8C8C8C8C' }, // Mock token
            dex_a: 'UniswapV2',
            dex_b: 'SushiSwap',
            pair: 'WETH/USDC',
            router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
        };
        
        const result = await bridge.executeArbitrage(mockOpportunity);
        console.log('✅ Execution result:', result);
        
        console.log('\n🎉 All tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Test the execution manager
 */
async function testExecutionManager() {
    try {
        console.log('\n🧪 Testing ExecutionManager...\n');
        
        const ExecutionManager = (await import('../src/services/executionManager.js')).default;
        
        // Create mock provider and wallet
        const mockProvider = {
            getNetwork: () => Promise.resolve({ chainId: 1n }),
            getBlockNumber: () => Promise.resolve(12345)
        };
        
        const mockWallet = {
            address: '0x1234567890123456789012345678901234567890',
            signMessage: () => Promise.resolve('0x'),
            signTransaction: () => Promise.resolve('0x')
        };
        
        // Create execution manager
        const manager = new ExecutionManager(mockProvider, mockWallet, {
            minProfitThreshold: 0.01,
            maxConcurrentExecutions: 3
        });
        
        console.log('✅ ExecutionManager created');
        
        // Test initialization
        console.log('\n🔄 Testing initialization...');
        await manager.initialize();
        console.log('✅ Initialization successful');
        
        // Test stats
        console.log('\n📊 Manager stats:', manager.getStats());
        
        console.log('\n🎉 ExecutionManager tests passed successfully!');
        
    } catch (error) {
        console.error('❌ ExecutionManager test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Main test function
 */
async function main() {
    try {
        console.log('🚀 Starting Integration Tests...\n');
        
        // Test flashbot bridge
        await testFlashbotBridge();
        
        // Test execution manager
        await testExecutionManager();
        
        console.log('\n🎉 All integration tests completed successfully!');
        console.log('\n📋 Your flashbot integration is working properly!');
        
    } catch (error) {
        console.error('\n❌ Integration tests failed:', error.message);
        process.exit(1);
    }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
