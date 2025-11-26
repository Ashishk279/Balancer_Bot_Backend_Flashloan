import Decimal from "decimal.js";

function transformOpportunityForDB(opportunity) {
    // console.log("---opp", opportunity);
  
    // Calculate price difference percentage
    const buyPrice = new Decimal(opportunity.buyPrice || 0);
    const sellPrice = new Decimal(opportunity.sellPrice || 0);
    const price_difference_pct = buyPrice.gt(0)
      ? sellPrice.minus(buyPrice).div(buyPrice).times(100).toFixed(2)
      : "0";
  
    const formatted_data = opportunity.formatted;
  
    // Build execution_payload with proper null checks
    const execution_payload = {
      buyDex: opportunity.buyDex,
      sellDex: opportunity.sellDex,
      amounts: [
        opportunity.inputFormatted || opportunity.amount_in || "0",
        opportunity.amountAFormatted || opportunity.amountA || "0",
        opportunity.outputFormatted || opportunity.amount_out || "0"
      ],
      tokens: opportunity.pair ? [opportunity.pair] : [],
      tokenSymbols: opportunity.tokenSymbols || [],
      path: opportunity.path || [],
      fees: opportunity.fees || [],
      buyDexAddress: opportunity.buyDex,
      sellDexAddress: opportunity.sellDex
    };
  
    return {
      timestamp: Date.now(),
      arbitrage_type: opportunity.type,
      pair: opportunity.pair,
      cycle: opportunity.cycle || null,
      direction: opportunity.direction || null,
      dex_a: opportunity.buyDex,
      dex_b: opportunity.sellDex,
      buy_price: opportunity.buyPrice ? opportunity.buyPrice.toString() : "0",
      sell_price: opportunity.sellPrice ? opportunity.sellPrice.toString() : "0",
      amount_in: opportunity.inputFormatted || opportunity.amount_in || "0",
      amount_out: opportunity.outputFormatted || opportunity.amount_out || "0",
      gas_cost_estimate: opportunity.gasEstimation ? opportunity.gasEstimation.toString() : "0",
      estimated_profit: opportunity.profit ? opportunity.profit.toString() : "0",
      gross_profit: opportunity.grossProfit || "0",
      price_difference_pct,
      isProfitable: opportunity.isProfitable || false,
      formatted_data,
      execution_payload: execution_payload,
      priority_score: 0,
      execution_status: "detected",
    };
  }

  
export {transformOpportunityForDB}