import redis from "../config/radis.js";
// import Decimal from "decimal.js";

import { promises as fs } from 'fs';
import path from 'path';

import { transformOpportunityForDB } from "./v3/arbitrageEngin/transform.js";
const LOG_FILE = path.resolve(process.cwd(), 'opportunities.log.json');

export async function appendOpportunityToArrayFile(opportunityData) {
  let data = [];

  try {
    // 1. Try to read existing file
    const content = await fs.readFile(LOG_FILE, 'utf8');

    // If file is empty or malformed, start fresh
    if (content.trim()) {
      data = JSON.parse(content);
      // Safety: make sure it's an array
      if (!Array.isArray(data)) data = [];
    }
  } catch (err) {
    // File does not exist or is corrupted → start with empty array
    if (err.code !== 'ENOENT') {
      console.warn(`Could not read ${LOG_FILE}, starting fresh:`, err.message);
    }
  }

  // 2. Push the new opportunity
  data.push(opportunityData);

  // 3. Write the whole array back (pretty-printed for readability)
  try {
    await fs.writeFile(LOG_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Appended opportunity ${opportunityData.id} → ${LOG_FILE} (total: ${data.length})`);
  } catch (writeErr) {
    console.error(`Failed to write to ${LOG_FILE}:`, writeErr);
  }
}
// export async function storeOpportunity(opp) {

//   // console.log("Opp44905749", opp)
//   const oppKey = `opportunity:${opp.id}`;

//   // Store details as a hash
//   await redis.hset(oppKey, {
//     txHash: opp.txHash || '0x0', // Default if not provided
//     poolId: opp.poolId || opp.poolName || 'unknown',
//     strategy: opp.type || 'unknown',
//     amountIn: opp.amount_in?.toString() || '0',
//     amountOut: opp.amount_out?.toString() || '0',
//     expectedProfit: opp.profit?.toString() || '0',
//     buyDex: opp.buyDex || 'unknown',
//     sellDex: opp.sellDex || 'unknown',
//     tokenA: JSON.stringify(opp.tokenA || {} ),
//     tokenB: JSON.stringify(opp.tokenB || {} ),
//     tokenADecimals: opp.tokenADecimals || '0',
//     tokenBDecimals: opp.tokenBDecimals || '0',
//     fee1: opp.fee1 || '0',
//     fee2: opp.fee2 || '0',
//     priorityFee: opp.priorityFee || '0',
//     buyPrice: opp.buyPrice?.toString() || '0',
//     sellPrice: opp.sellPrice?.toString() || '0',
//     gasEstimation: opp.gasEstimation || '0',
//     formatted: JSON.stringify(opp.formatted || {}),
//     // executionPayload: JSON.stringify(opp.execution_payload || {}),
//     // tokenSymbols: JSON.stringify(opp.tokenSymbols || []),
//     path: opp.direction
//   });

//   // Expire automatically after 30s
//   await redis.expire(oppKey, 30);

//   // Add to priority queue (sorted set by profit)
//   await redis.zadd('opportunities', opp.profit?.toNumber() || 0, oppKey);
// }


// Fixed storeOpportunity function in opportunity.js
export async function storeOpportunity(opp) {
  // Ensure all values are strings or primitives for Redis
  const oppKey = `opportunity:${opp.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Convert Decimal objects to strings
  const convertDecimalToString = (value) => {
    if (!value) return '0';
    if (typeof value === 'object' && value.toString) {
      return value.toString();
    }
    return String(value);
  };

  // Store details as a hash with proper string conversion
  await redis.hset(oppKey, {
    txHash: opp.txHash || '0x0',
    poolId: opp.poolId || opp.poolName || 'unknown',
    strategy: opp.type || 'unknown',
    amountIn: convertDecimalToString(opp.amount_in),
    amountOut: convertDecimalToString(opp.amount_out),
    expectedProfit: convertDecimalToString(opp.profit) || '0',
    buyDex: opp.buyDex || 'unknown',
    sellDex: opp.sellDex || 'unknown',
    tokenA: JSON.stringify(opp.tokenA || {}),
    tokenB: JSON.stringify(opp.tokenB || {}),
    tokenADecimals: String(opp.tokenADecimals || '18'),
    tokenBDecimals: String(opp.tokenBDecimals || '18'),
    fee1: convertDecimalToString(opp.fee1),
    fee2: convertDecimalToString(opp.fee2),
    priorityFee: convertDecimalToString(opp.priorityFee),
    buyPrice: convertDecimalToString(opp.buyPrice),
    sellPrice: convertDecimalToString(opp.sellPrice),
    gasEstimation: convertDecimalToString(opp.gasEstimation) || '0',
    formatted: JSON.stringify(opp.formatted || {}),
    spread: opp.spread ? convertDecimalToString(opp.spread) : '0',
    path: opp.direction || '',
    buyPoolAddress: opp.buyPoolAddress || 'unknown',  
    sellPoolAddress: opp.sellPoolAddress || 'unknown'
  });


  // Expire automatically after 30s
  await redis.expire(oppKey, 30);

  // Add to priority queue (sorted set by profit) - ensure profit is a number
  const profitScore = opp.profit ? 
    (typeof opp.profit === 'object' ? parseFloat(opp.profit.toString()) : parseFloat(opp.profit)) 
    : 0;
    
  await redis.zadd('opportunities', profitScore, oppKey);

  console.log(`Stored opportunity ${oppKey} with profit score: ${profitScore}`);

  // Publish to Redis pub/sub for real-time WebSocket updates
  try {
    const opportunityData = {
      id: oppKey,
      key: oppKey,
      txHash: opp.txHash || '0x0',
      poolId: opp.poolId || opp.poolName || 'unknown',
      strategy: opp.type || 'unknown',
      type: opp.type || 'unknown',
      amountIn: convertDecimalToString(opp.amount_in),
      amountOut: convertDecimalToString(opp.amount_out),
      expectedProfit: convertDecimalToString(opp.profit),
      profit: convertDecimalToString(opp.profit),
      buyDex: opp.buyDex || 'unknown',
      sellDex: opp.sellDex || 'unknown',
      buyPrice: convertDecimalToString(opp.buyPrice),
      sellPrice: convertDecimalToString(opp.sellPrice),
      tokenA: JSON.stringify(opp.tokenA || {}),
      tokenB: JSON.stringify(opp.tokenB || {}),
      tokenADecimals: String(opp.tokenADecimals || '18'),
      tokenBDecimals: String(opp.tokenBDecimals || '18'),
      fee1: convertDecimalToString(opp.fee1),
      fee2: convertDecimalToString(opp.fee2),
      priorityFee: convertDecimalToString(opp.priorityFee),
      gasEstimation: convertDecimalToString(opp.gasEstimation),
      spread: opp.spread ? convertDecimalToString(opp.spread) : '0',
      path: opp.direction || '',
      formatted: JSON.stringify(opp.formatted || {}),
      timestamp: new Date().toISOString()
    };

    await redis.publish('new_opportunity', JSON.stringify(opportunityData));
    console.log(`📡 Published opportunity ${oppKey} to WebSocket subscribers`);
  } catch (publishError) {
    console.error(`Error publishing opportunity to WebSocket: ${publishError.message}`);
  }
}


export async function consumeTopOpportunity() {
  // Pop the max profit opportunity
  const result = await redis.zpopmax('opportunities');
  if (!result || result.length === 0) return null;

  const [key, score] = result;

  // Try to acquire lock
  const lockKey = `lock:${key}`;
  const gotLock = await redis.set(lockKey, '1', 'NX', 'EX', 10);
  if (!gotLock) return null; // Already taken by another worker

  // Fetch details
  const opp = await redis.hgetall(key);
  opp.key = key;

  return opp;
}

export async function completeOpportunity(oppKey, success, oppData) {
  // Release lock immediately
  await redis.del(`lock:${oppKey}`);
  await redis.del('execution_lock');

  // Save to DB for analytics/history if successful
  if (success && oppData) {
    const dbData = transformOpportunityForDB(oppData); // Use existing transform function
    try {
      const result = await db.insertV3Scan(dbData);
      console.log(`✅ Stored opportunity ${oppKey} in database with ID: ${result.rows[0].id}`);
    } catch (error) {
      console.error(`❌ Error storing opportunity ${oppKey} in database: ${error.message}`);
    }
  }
}