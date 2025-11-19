import { storeOpportunity } from '../services/opportunity.js';
import logger from '../utils/logger.js';

export async function detectAndStoreOpportunity(opportunity) {
  try {
    // Ensure opportunity has an ID
    if (!opportunity.id) {
      opportunity.id = `opp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    // Store in Redis using the service function
    await storeOpportunity(opportunity);
    logger.info(`Opportunity ${opportunity.id} stored in Redis`, { service: 'detectionLayer' });
    console.log(`✅ Opportunity ${opportunity.id} stored in Redis`);
  } catch (error) {
    logger.error(`Error storing opportunity ${opportunity.id}: ${error.message}`, { service: 'detectionLayer' });
    console.error(`❌ Error storing opportunity ${opportunity.id}: ${error.message}`);
  }
}