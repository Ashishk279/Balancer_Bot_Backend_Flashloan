import redis from "../config/radis.js"
import db from '../db.js';
import logger from '../utils/logger.js';
import { transformOpportunityForDB } from '../services/v3/arbitrageEngin/transform.js';
import Decimal from "decimal.js";

export async function flushToDB() {
  try {
    logger.info('Flushing Redis data to DB...', { service: 'persistenceLayer' });
    console.log('Flushing Redis data to DB...');

    // Scan for all opportunity keys
    const keys = await redis.keys('opportunity:*');
    for (const key of keys) {
      const opp = await redis.hgetall(key);
      if (opp) {
        const opportunity = {
          id: key.split(':')[1],
          type: opp.strategy,
          profit: new Decimal(opp.expectedProfit),
          poolName: opp.poolId,
          buyDex: opp.buyDex,
          sellDex: opp.sellDex,
          buyPrice: new Decimal(opp.buyPrice),
          sellPrice: new Decimal(opp.sellPrice),
          amount_in: new Decimal(opp.amountIn),
          amount_out: new Decimal(opp.amount_out || '0'),
          amountA: new Decimal(opp.amountA || '0'),
          gasEstimation: new Decimal(opp.gasEstimation),
          formatted: JSON.parse(opp.formatted || '{}'),
          execution_payload: JSON.parse(opp.executionPayload || '{}'),
          tokenSymbols: JSON.parse(opp.tokenSymbols || '[]'),
          path: opp.path,
          fees: JSON.parse(opp.fees || '[]'),
        };

        const dbData = transformOpportunityForDB(opportunity);
        await db.insertV3Scan(dbData);
        logger.info(`Persisted ${key} to DB`, { service: 'persistenceLayer' });
        console.log(`Persisted ${key} to DB.`);
      }
    }
  } catch (error) {
    logger.error(`Error flushing to DB: ${error.message}`, { service: 'persistenceLayer' });
    console.error(`Error flushing to DB:`, error);
  }
}