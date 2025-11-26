import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';

// Test the arbitrage logic with simple numbers
console.log('Testing Arbitrage Logic...\n');

// Simulate two DEXes with different prices
const dex1Price = new Decimal('192.31515954'); // LINK per WETH on DEX1
const dex2Price = new Decimal('192.61518427'); // LINK per WETH on DEX2

console.log(`DEX1 Price: ${dex1Price.toString()} LINK per WETH`);
console.log(`DEX2 Price: ${dex2Price.toString()} LINK per WETH`);

// Calculate spread
const spread = dex2Price.sub(dex1Price).div(dex1Price).mul(100);
console.log(`Spread: ${spread.toString()}%`);

// UNDERSTANDING THE PRICE MEANING:
// dex1Price = 192.31515954 LINK per WETH means: 1 WETH = 192.31515954 LINK
// dex2Price = 192.61518427 LINK per WETH means: 1 WETH = 192.61518427 LINK
// 
// This means LINK is CHEAPER on DEX1 (you get more LINK per WETH)
// And LINK is MORE EXPENSIVE on DEX2 (you get less LINK per WETH)
//
// CORRECT ARBITRAGE: Buy LINK on DEX1, Sell LINK on DEX2

const tradeAmount = new Decimal('10'); // 10 WETH
console.log(`\nTrading ${tradeAmount.toString()} WETH`);

// Step 1: Buy LINK with WETH on DEX1 (cheaper - you get more LINK)
const linkReceived = tradeAmount.mul(dex1Price);
console.log(`Step 1: Buy ${linkReceived.toString()} LINK on DEX1 (cheaper - more LINK per WETH)`);

// Step 2: Sell LINK for WETH on DEX2 (more expensive - you get more WETH per LINK)
const wethReceived = linkReceived.div(dex2Price);
console.log(`Step 2: Sell LINK for ${wethReceived.toString()} WETH on DEX2 (more expensive - more WETH per LINK)`);

// Calculate profit
const profit = wethReceived.sub(tradeAmount);
console.log(`\nProfit: ${profit.toString()} WETH`);
console.log(`Profit %: ${profit.div(tradeAmount).mul(100).toString()}%`);

console.log(`\nThis should be POSITIVE because we're buying cheap and selling expensive!`);
console.log(`The issue in the code is that the calculation is wrong.`);

// Let's verify with the actual numbers from the logs:
console.log(`\n=== VERIFICATION WITH ACTUAL LOGS ===`);
console.log(`From logs: Buy price: 192.31515954 LINK/WETH`);
console.log(`From logs: Sell price: 192.61518427 LINK/WETH`);
console.log(`Spread: ${((192.61518427 - 192.31515954) / 192.31515954 * 100).toFixed(4)}%`);

// The correct calculation should be:
// 1. Buy LINK on DEX1: 10 WETH * 192.31515954 = 1923.1515954 LINK
// 2. Sell LINK on DEX2: 1923.1515954 LINK / 192.61518427 = 9.9844236 WETH
// 3. Profit: 9.9844236 - 10 = -0.0155764 WETH (LOSS!)

console.log(`\nWait, this is still showing a loss. Let me recalculate...`);

// Actually, let me think about this differently:
// If DEX2 price > DEX1 price, it means 1 WETH gets you MORE LINK on DEX1
// So we should: Buy LINK on DEX1, Sell LINK on DEX2
// But the calculation shows a loss, which means the logic is still wrong.

// Let me try the reverse:
console.log(`\n=== TRYING REVERSE LOGIC ===`);
// Step 1: Buy LINK with WETH on DEX2 (more expensive)
const linkReceivedReverse = tradeAmount.mul(dex2Price);
console.log(`Step 1: Buy ${linkReceivedReverse.toString()} LINK on DEX2 (more expensive)`);

// Step 2: Sell LINK for WETH on DEX1 (cheaper)
const wethReceivedReverse = linkReceivedReverse.div(dex1Price);
console.log(`Step 2: Sell LINK for ${wethReceivedReverse.toString()} WETH on DEX1 (cheaper)`);

// Calculate profit
const profitReverse = wethReceivedReverse.sub(tradeAmount);
console.log(`\nReverse Profit: ${profitReverse.toString()} WETH`);
console.log(`Reverse Profit %: ${profitReverse.div(tradeAmount).mul(100).toString()}%`);
