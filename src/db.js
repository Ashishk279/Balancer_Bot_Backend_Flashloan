


import pkg from "pg";
import "dotenv/config";

const { Pool } = pkg;

const DEX_ADDRESSES = {
  UniswapV2: {
    router_address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    factory_address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  },
  SushiswapV2: {
    router_address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    factory_address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
  },
  UniswapV3: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  },
  UniswapV3_3000: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  },
  UniswapV3_500: {
    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  },
  PancakeSwap: {
    router_address: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory_address: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  },
};

class Database {
  constructor() {
    const isRDS = process.env.DATABASE_URL?.includes('rds.amazonaws.com');
    const isProduction = process.env.NODE_ENV === 'production';

    let sslConfig = false;
    if (isRDS || isProduction) {
      sslConfig = {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      };
    }

    console.log(`🔗 Database connection mode: ${isRDS ? 'AWS RDS' : 'Local'} (SSL: ${sslConfig ? 'enabled' : 'disabled'})`);

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.PG_MAX_CLIENTS, 10) || 10,
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 30000,
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database pool error:', err.message);
    });
  }

  async init() {
    try {
      // Step 1: Create tables and ensure isProfitable column
      const createTables = `
        CREATE TABLE IF NOT EXISTS arbitrage_scans (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          dex_a TEXT NOT NULL,
          dex_b TEXT NOT NULL,
          pair TEXT NOT NULL,
          amount_in NUMERIC NOT NULL,
          direction TEXT NOT NULL,
          buy_price NUMERIC NOT NULL,
          sell_price NUMERIC NOT NULL,
          price_difference NUMERIC NOT NULL,
          price_difference_pct NUMERIC NOT NULL,
          estimated_profit NUMERIC NOT NULL,
          gas_cost_estimate NUMERIC DEFAULT 0,
          execution_status TEXT DEFAULT 'detected',
          arbitrage_type TEXT DEFAULT 'simple' NOT NULL,
          priority_score NUMERIC,
          last_updated TIMESTAMPTZ,
          execution_payload JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );

        DROP TABLE IF EXISTS v3_arbitrage_scans CASCADE;

-- Create updated table with TEXT for string-formatted values
CREATE TABLE IF NOT EXISTS v3_arbitrage_scans (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  arbitrage_type TEXT NOT NULL,
  pair TEXT,
  cycle TEXT,
  direction JSONB,
  dex_a TEXT,
  dex_b TEXT,
  buy_price TEXT, -- Changed to TEXT for string-formatted price
  sell_price TEXT, -- Changed to TEXT for string-formatted price
  amount_in TEXT NOT NULL, -- Changed to TEXT for inputFormatted
  amount_out TEXT, -- Changed to TEXT for outputFormatted
  gas_cost_estimate TEXT DEFAULT '0', -- Changed to TEXT for string-formatted gas cost
  estimated_profit TEXT NOT NULL, -- Changed to TEXT for profit
  gross_profit TEXT NOT NULL, -- Changed to TEXT for grossProfitFormatted
  price_difference_pct TEXT, -- Changed to TEXT for string-formatted percentage
  isProfitable BOOLEAN NOT NULL DEFAULT FALSE,
  formatted_data JSONB,
  execution_payload JSONB,
  priority_score NUMERIC, -- Kept as NUMERIC for sorting/calculations
  execution_status TEXT DEFAULT 'detected',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migrate existing data (if backup exists)
-- COPY v3_arbitrage_scans FROM '/tmp/v3_arbitrage_scans_backup.csv' WITH CSV HEADER;

-- Ensure isProfitable consistency
UPDATE v3_arbitrage_scans
SET isProfitable = (CAST(estimated_profit AS NUMERIC) > 0)
WHERE isProfitable IS NULL OR isProfitable != (CAST(estimated_profit AS NUMERIC) > 0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_v3_arbitrage_scans_timestamp ON v3_arbitrage_scans(timestamp);
CREATE INDEX IF NOT EXISTS idx_v3_arbitrage_scans_pair ON v3_arbitrage_scans(pair);
CREATE INDEX IF NOT EXISTS idx_v3_arbitrage_scans_arbitrage_type ON v3_arbitrage_scans(arbitrage_type);
CREATE INDEX IF NOT EXISTS idx_v3_arbitrage_scans_profit ON v3_arbitrage_scans(CAST(estimated_profit AS NUMERIC));
CREATE INDEX IF NOT EXISTS idx_v3_arbitrage_scans_isProfitable ON v3_arbitrage_scans(isProfitable);

        -- Other tables (unchanged)
        CREATE TABLE IF NOT EXISTS price_feeds (
          id SERIAL PRIMARY KEY,
          exchange TEXT NOT NULL,
          pair TEXT NOT NULL,
          price NUMERIC NOT NULL,
          volume NUMERIC,
          liquidity_token0 NUMERIC,
          liquidity_token1 NUMERIC,
          timestamp BIGINT NOT NULL,
          block_number BIGINT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS executions (
          id SERIAL PRIMARY KEY,
          execution_id TEXT UNIQUE NOT NULL,
          scan_id INT REFERENCES arbitrage_scans(id),
          timestamp BIGINT NOT NULL,
          success BOOLEAN NOT NULL,
          profit NUMERIC,
          gas_used NUMERIC,
          gas_cost NUMERIC,
          error TEXT,
          execution_time NUMERIC,
          flashbot_bundle_id TEXT,
          transaction_hash TEXT,
          block_number BIGINT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS executed_trades (
          id SERIAL PRIMARY KEY,
          scan_id INT REFERENCES arbitrage_scans(id),
          transaction_hash TEXT,
          buy_exchange TEXT NOT NULL,
          sell_exchange TEXT NOT NULL,
          pair TEXT NOT NULL,
          amount_in NUMERIC NOT NULL,
          amount_out NUMERIC NOT NULL,
          actual_profit NUMERIC NOT NULL,
          gas_used NUMERIC,
          gas_cost NUMERIC,
          execution_time NUMERIC,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS bot_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          total_scans INT DEFAULT 0,
          opportunities_found INT DEFAULT 0,
          trades_executed INT DEFAULT 0,
          successful_trades INT DEFAULT 0,
          failed_trades INT DEFAULT 0,
          total_profit NUMERIC DEFAULT 0,
          total_gas_cost NUMERIC DEFAULT 0,
          net_profit NUMERIC DEFAULT 0,
          success_rate NUMERIC DEFAULT 0,
          avg_profit_per_trade NUMERIC DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS system_health (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          service TEXT NOT NULL,
          status TEXT NOT NULL,
          response_time INT,
          error_count INT,
          memory_usage FLOAT,
          cpu_usage FLOAT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS opportunity_queue (
          id SERIAL PRIMARY KEY,
          scan_id INT UNIQUE NOT NULL REFERENCES arbitrage_scans(id) ON DELETE CASCADE,
          priority_score NUMERIC NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          attempts INT NOT NULL DEFAULT 0,
          max_attempts INT NOT NULL DEFAULT 3,
          next_attempt_at BIGINT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_arbitrage_scans_timestamp ON arbitrage_scans(timestamp);
        CREATE INDEX IF NOT EXISTS idx_arbitrage_scans_pair ON arbitrage_scans(pair);
        CREATE INDEX IF NOT EXISTS idx_arbitrage_scans_profit ON arbitrage_scans(estimated_profit);
        CREATE INDEX IF NOT EXISTS idx_arbitrage_scans_type ON arbitrage_scans(arbitrage_type);
        CREATE INDEX IF NOT EXISTS idx_price_feeds_exchange_pair ON price_feeds(exchange, pair);
        CREATE INDEX IF NOT EXISTS idx_price_feeds_timestamp ON price_feeds(timestamp);
        CREATE INDEX IF NOT EXISTS idx_executed_trades_status ON executed_trades(status);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON performance_metrics(date);
      `;

      // Step 2: Execute table creation and column migration
      await this.pool.query(createTables);

      // Step 3: Drop and recreate views to avoid column renaming issues
      const createViews = `
        DROP VIEW IF EXISTS v3_profitable_opportunities;
        CREATE VIEW v3_profitable_opportunities AS
        SELECT
          id,
          timestamp,
          arbitrage_type,
          pair,
          cycle,
          direction,
          dex_a,
          dex_b,
          buy_price,
          sell_price,
          amount_in,
          amount_out,
          gas_cost_estimate,
          estimated_profit,
          gross_profit,
          price_difference_pct,
          isProfitable,
          formatted_data,
          execution_payload,
          to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD HH24:MI:SS') AS human_timestamp
        FROM v3_arbitrage_scans
        WHERE isProfitable = true
        ORDER BY estimated_profit DESC;

        DROP VIEW IF EXISTS profitable_opportunities;
        CREATE VIEW profitable_opportunities AS
        SELECT
          id,
          timestamp,
          dex_a,
          dex_b,
          pair,
          direction,
          buy_price,
          sell_price,
          gas_cost_estimate,
          estimated_profit,
          price_difference_pct,
          arbitrage_type,
          to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD HH24:MI:SS') AS human_timestamp
        FROM arbitrage_scans
        WHERE estimated_profit > 0
        ORDER BY estimated_profit DESC;

        DROP VIEW IF EXISTS daily_summary;
        CREATE VIEW daily_summary AS
        SELECT
          date,
          COUNT(*) AS total_opportunities,
          COUNT(*) FILTER (WHERE estimated_profit > 0) AS profitable_opportunities,
          AVG(estimated_profit) AS avg_profit,
          MAX(estimated_profit) AS max_profit,
          SUM(estimated_profit) AS total_potential_profit
        FROM (
          SELECT
            to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD')::date AS date,
            estimated_profit
          FROM arbitrage_scans
        ) sub
        GROUP BY date
        ORDER BY date DESC;
      `;

      await this.pool.query(createViews);

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database:', error.message);
      console.error(error.stack);
      throw error;
    }
  }

  async insertV3Scan(data) {
    try {
      const {
        timestamp,
        arbitrage_type,
        pair,
        cycle,
        direction,
        dex_a,
        dex_b,
        buy_price,
        sell_price,
        amount_in,
        amount_out,
        gas_cost_estimate,
        estimated_profit,
        gross_profit,
        formatted_data,
        execution_payload,
      } = data;

      const price_difference = buy_price && sell_price ? Math.abs(sell_price - buy_price) : null;
      const price_difference_pct = buy_price && sell_price && buy_price > 0 ? (price_difference / buy_price) * 100 : null;
      const isProfitable = estimated_profit > 0;
      const priority_score = isProfitable ? this.calculatePriorityScore(estimated_profit, gas_cost_estimate) : null;

      const normalized_dex_a = dex_a ? dex_a.replace(/uniswap|sushiswap|pancakeswap/i, (match) => {
        if (match.toLowerCase() === 'uniswap') return dex_a.includes('V3') ? 'UniswapV3' : 'UniswapV2';
        if (match.toLowerCase() === 'sushiswap') return 'SushiswapV2';
        if (match.toLowerCase() === 'pancakeswap') return 'PancakeSwap';
        return match;
      }) : null;
      const normalized_dex_b = dex_b ? dex_b.replace(/uniswap|sushiswap|pancakeswap/i, (match) => {
        if (match.toLowerCase() === 'uniswap') return dex_b.includes('V3') ? 'UniswapV3' : 'UniswapV2';
        if (match.toLowerCase() === 'sushiswap') return 'SushiswapV2';
        if (match.toLowerCase() === 'pancakeswap') return 'PancakeSwap';
        return match;
      }) : null;

      // console.log(`📝 Inserting V3 scan - execution_payload: ${JSON.stringify(execution_payload)}`);

      const enhanced_payload = {
        amounts: execution_payload?.amounts || [],
        dexes: execution_payload?.dexes || [normalized_dex_a, normalized_dex_b].filter(Boolean),
        fees: execution_payload?.fees || [],
        router_address: normalized_dex_a && DEX_ADDRESSES[normalized_dex_a]?.router_address ||
          normalized_dex_b && DEX_ADDRESSES[normalized_dex_b]?.router_address || null,
        factory_address: normalized_dex_a && DEX_ADDRESSES[normalized_dex_a]?.factory_address ||
          normalized_dex_b && DEX_ADDRESSES[normalized_dex_b]?.factory_address || null,
      };

      const sql = `
        INSERT INTO v3_arbitrage_scans (
          timestamp, arbitrage_type, pair, cycle, direction, dex_a, dex_b,
          buy_price, sell_price, amount_in, amount_out, gas_cost_estimate,
          estimated_profit, gross_profit, price_difference_pct, isProfitable,
          formatted_data, execution_payload, priority_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id
      `;

      const result = await this.query(sql, [
        timestamp || Date.now(),
        arbitrage_type,
        pair || null,
        cycle || null,
        direction ? JSON.stringify(direction) : null,
        dex_a || null,
        dex_b || null,
        buy_price || null,
        sell_price || null,
        amount_in,
        amount_out || null,
        gas_cost_estimate || 0,
        estimated_profit,
        gross_profit,
        price_difference_pct,
        isProfitable,
        formatted_data,
        enhanced_payload,
        priority_score,
      ]);

      const scanId = result.rows[0].id;

      if (isProfitable) {
        await this.addToV3OpportunityQueue(scanId, priority_score);
      }

      console.log(`✅ Inserted V3 scan with ID: ${scanId}, isProfitable: ${isProfitable}`);
      return result;
    } catch (error) {
      console.error(`❌ Error inserting V3 scan: ${error.message}`, error);
      throw error;
    }
  }

  async addToV3OpportunityQueue(scanId, priorityScore) {
    const sql = `
      INSERT INTO opportunity_queue (scan_id, priority_score, status)
      VALUES ($1, $2, 'queued')
      ON CONFLICT (scan_id) DO UPDATE SET
        priority_score = EXCLUDED.priority_score,
        status = 'queued',
        attempts = 0,
        next_attempt_at = NULL
    `;

    await this.query(sql, [scanId, priorityScore]);
  }

  async getAllV3Opportunities(limit = 50, type = null, isProfitable = null) {
    let sql = `
      SELECT 
        id,
        timestamp,
        arbitrage_type,
        pair,
        cycle,
        direction,
        dex_a,
        dex_b,
        buy_price,
        sell_price,
        amount_in,
        amount_out,
        gas_cost_estimate,
        estimated_profit,
        gross_profit,
        price_difference_pct,
        isProfitable,
        formatted_data,
        execution_payload,
        to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD HH24:MI:SS') AS human_timestamp
      FROM v3_arbitrage_scans
    `;
    const params = [Math.min(limit, 100)];
    let conditions = [];

    if (type && ['v3_direct', 'v3_cross', 'v3_triangular'].includes(type)) {
      conditions.push(`arbitrage_type = $${params.length + 1}`);
      params.push(type);
    }

    if (isProfitable !== null) {
      conditions.push(`isProfitable = $${params.length + 1}`);
      params.push(isProfitable);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += `
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const res = await this.query(sql, params);
    return res.rows;
  }

  async getV3EngineOpportunities(limit = 50, type = null) {
    return this.getAllV3Opportunities(limit, type, true);
  }

  async getTriangularOpportunities(limit = 50) {
    return this.getAllV3Opportunities(limit, 'v3_triangular', true);
  }

  async getV3EngineStats() {
    const sql = `
      SELECT 
        arbitrage_type,
        COUNT(*) as total_opportunities,
        COUNT(*) FILTER (WHERE isProfitable = true) as profitable_opportunities,
        COALESCE(SUM(estimated_profit), 0) as total_potential_profit,
        COALESCE(AVG(estimated_profit) FILTER (WHERE isProfitable = true), 0) as avg_profit,
        COALESCE(MAX(estimated_profit) FILTER (WHERE isProfitable = true), 0) as max_profit,
        COALESCE(MIN(estimated_profit) FILTER (WHERE isProfitable = true), 0) as min_profit
      FROM v3_arbitrage_scans
      GROUP BY arbitrage_type
    `;

    const res = await this.query(sql);
    return res.rows;
  }

  async query(text, params) {
    try {
      const res = await this.pool.query(text, params);
      return res;
    } catch (error) {
      console.error(`❌ Query error: ${error.message}`, { query: text, params });
      throw error;
    }
  }

  async getConfig(key) {
    const res = await this.query(
      "SELECT value FROM bot_config WHERE key = $1",
      [key]
    );
    return res.rows[0]?.value || null;
  }

  async setConfig(key, value, description = null) {
    const sql = `
      INSERT INTO bot_config(key, value, description)
      VALUES($1,$2,$3)
      ON CONFLICT(key) DO UPDATE
      SET value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = now();
    `;
    await this.query(sql, [key, value, description]);
  }

  async insertScan(data) {
    const {
      timestamp,
      dex_a,
      dex_b,
      pair,
      amount_in,
      direction,
      buy_price,
      sell_price,
      gas_cost_estimate,
      estimated_profit,
      arbitrage_type = "simple",
      execution_payload,
    } = data;
    const price_difference = Math.abs(sell_price - buy_price);
    const price_difference_pct = (price_difference / buy_price) * 100;

    const priority_score = this.calculatePriorityScore(
      estimated_profit,
      gas_cost_estimate
    );

    const sql = `
      INSERT INTO arbitrage_scans (
        timestamp, dex_a, dex_b, pair, amount_in, direction,
        buy_price, sell_price, gas_cost_estimate, price_difference, price_difference_pct,
        estimated_profit, arbitrage_type, priority_score, execution_payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
    `;

    const result = await this.query(sql, [
      timestamp,
      dex_a,
      dex_b,
      pair,
      amount_in,
      direction,
      buy_price,
      sell_price,
      gas_cost_estimate,
      price_difference,
      price_difference_pct,
      estimated_profit,
      arbitrage_type,
      priority_score,
      JSON.stringify(execution_payload),
    ]);

    const scanId = result.rows[0].id;

    if (estimated_profit > 0) {
      await this.addToOpportunityQueue(scanId, priority_score);
    }

    return result;
  }

  calculatePriorityScore(estimatedProfit, gasCostEstimate) {
    const profit = parseFloat(estimatedProfit);
    const gasCost = parseFloat(gasCostEstimate || 0);

    if (gasCost <= 0) return profit;

    const netProfit = profit - gasCost;
    const efficiencyRatio = netProfit / gasCost;
    return netProfit * (1 + Math.min(efficiencyRatio, 10));
  }

  async addToOpportunityQueue(scanId, priorityScore) {
    const sql = `
      INSERT INTO opportunity_queue (scan_id, priority_score, status)
      VALUES ($1, $2, 'queued')
      ON CONFLICT (scan_id) DO UPDATE SET
        priority_score = EXCLUDED.priority_score,
        status = 'queued',
        attempts = 0,
        next_attempt_at = NULL
    `;

    await this.query(sql, [scanId, priorityScore]);
  }

  async getNextOpportunity() {
    const sql = `
      SELECT 
        oq.id as queue_id,
        oq.priority_score,
        oq.attempts,
        oq.max_attempts,
        sc.*
      FROM opportunity_queue oq
      JOIN arbitrage_scans sc ON oq.scan_id = sc.id
      WHERE oq.status = 'queued'
        AND (oq.next_attempt_at IS NULL OR oq.next_attempt_at <= $1)
        AND oq.attempts < oq.max_attempts
      ORDER BY oq.priority_score DESC, sc.timestamp ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const result = await this.query(sql, [Date.now()]);
    return result.rows[0] || null;
  }

  async updateOpportunityQueueStatus(queueId, status, nextAttemptAt = null) {
    const sql = `
      UPDATE opportunity_queue 
      SET status = $2, 
          attempts = attempts + 1,
          next_attempt_at = $3,
          updated_at = now()
      WHERE id = $1
    `;

    await this.query(sql, [queueId, status, nextAttemptAt]);
  }

  async markOpportunityExecuting(scanId) {
    const sql = `
      UPDATE arbitrage_scans 
      SET execution_status = 'executing', 
          last_updated = now()
      WHERE id = $1
    `;

    await this.query(sql, [scanId]);
  }

  async markOpportunityCompleted(scanId, success) {
    const status = success ? "completed" : "failed";
    const sql = `
      UPDATE arbitrage_scans 
      SET execution_status = $2, 
          last_updated = now()
      WHERE id = $1
    `;

    await this.query(sql, [scanId, status]);
  }

  async insertExecution(data) {
    const sql = `
      INSERT INTO executions (
        execution_id, scan_id, timestamp, success, profit, gas_used, gas_cost, 
        error, execution_time, flashbot_bundle_id, transaction_hash, block_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await this.query(sql, [
      data.execution_id,
      data.scan_id,
      data.timestamp,
      data.success,
      data.profit,
      data.gas_used,
      data.gas_cost,
      data.error,
      data.execution_time,
      data.flashbot_bundle_id,
      data.transaction_hash,
      data.block_number,
    ]);
  }

  async insertFlashbotBundle(data) {
    const sql = `
      INSERT INTO flashbot_bundles (
        bundle_id, scan_id, timestamp, success, profit, gas_used, gas_cost,
        transaction_hash, block_number, bundle_size, target_block, relay_url, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    await this.query(sql, [
      data.bundle_id,
      data.scan_id,
      data.timestamp,
      data.success,
      data.profit,
      data.gas_used,
      data.gas_cost,
      data.transaction_hash,
      data.block_number,
      data.bundle_size,
      data.target_block,
      data.relay_url,
      data.error,
    ]);
  }

  async insertGasPriceHistory(data) {
    const sql = `
      INSERT INTO gas_price_history (
        timestamp, block_number, base_fee_per_gas, max_fee_per_gas, 
        max_priority_fee_per_gas, gas_used, gas_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (block_number, timestamp) DO NOTHING
    `;

    await this.query(sql, [
      data.timestamp,
      data.block_number,
      data.base_fee_per_gas,
      data.max_fee_per_gas,
      data.max_priority_fee_per_gas,
      data.gas_used,
      data.gas_limit,
    ]);
  }

  async insertSystemHealth(data) {
    const sql = `
      INSERT INTO system_health (
        timestamp, service, status, response_time, error_count, memory_usage, cpu_usage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.query(sql, [
      data.timestamp,
      data.service,
      data.status,
      data.response_time,
      data.error_count,
      data.memory_usage,
      data.cpu_usage,
    ]);
  }

  async recentScans(limit = 100) {
    const res = await this.query(
      "SELECT * FROM arbitrage_scans ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  async getProfitableOpportunities(limit = 50) {
    const res = await this.query(
      "SELECT * FROM profitable_opportunities LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  async insertExecutedTrade(data) {
    const sql = `
      INSERT INTO executed_trades (
        scan_id, transaction_hash, buy_exchange, sell_exchange, pair,
        amount_in, amount_out, actual_profit, gas_used, gas_cost, execution_time,
        status, error_message, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `;
    await this.query(sql, [
      data.scan_id,
      data.transaction_hash,
      data.buy_exchange,
      data.sell_exchange,
      data.pair,
      data.amount_in,
      data.amount_out,
      data.actual_profit,
      data.gas_used,
      data.gas_cost,
      data.execution_time,
      data.status,
      data.error_message,
      data.timestamp,
    ]);
  }

  async insertExecutedTradeFromExecution(executionData) {
    const sql = `
      INSERT INTO executed_trades (
        scan_id, transaction_hash, buy_exchange, sell_exchange, pair,
        amount_in, amount_out, actual_profit, gas_used, gas_cost, execution_time,
        status, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    const mappedData = [
      executionData.opportunity_id || null,
      executionData.transaction_hash || null,
      executionData.buy_exchange || "unknown",
      executionData.sell_exchange || "unknown",
      executionData.pair || "unknown",
      executionData.amount_in || "0",
      executionData.amount_out || "0",
      executionData.profit || "0",
      executionData.gas_used || "0",
      executionData.gas_cost || "0",
      executionData.execution_time || "0",
      executionData.success ? "success" : "failed",
      executionData.error || null,
      executionData.timestamp || Date.now(),
    ];

    await this.query(sql, mappedData);
  }

  async getExecutionStats(limit = 100) {
    const res = await this.query(
      "SELECT * FROM executions ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  async getBundleStats(limit = 100) {
    const res = await this.query(
      "SELECT * FROM flashbot_bundles ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  async getSystemHealth(service = null, limit = 100) {
    let sql = "SELECT * FROM system_health";
    let params = [];

    if (service) {
      sql += " WHERE service = $1";
      params.push(service);
    }

    sql += " ORDER BY timestamp DESC LIMIT $2";
    params.push(limit);

    const res = await this.query(sql, params);
    return res.rows;
  }

  async getRecentSuccessfulExecutions(limit = 50) {
    const res = await this.query(
      "SELECT * FROM executions WHERE success = true ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  async getExecutionSummary() {
    const sql = `
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE success = true) as successful_executions,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
        COALESCE(SUM(profit) FILTER (WHERE success = true), 0) as total_profit,
        COALESCE(SUM(gas_used) FILTER (WHERE success = true), 0) as total_gas_used,
        COALESCE(AVG(execution_time) FILTER (WHERE success = true), 0) as avg_execution_time
      FROM executions
      WHERE timestamp >= $1
    `;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const res = await this.query(sql, [oneDayAgo]);
    return res.rows[0];
  }

  async getDailySummary(days = 7) {
    const res = await this.query("SELECT * FROM daily_summary LIMIT $1", [
      days,
    ]);
    return res.rows;
  }

  async getPerformanceMetrics(startDate, endDate) {
    const res = await this.query(
      "SELECT * FROM performance_metrics WHERE date BETWEEN $1 AND $2 ORDER BY date DESC",
      [startDate, endDate]
    );
    return res.rows;
  }

  async updateDailyMetrics(date) {
    const sql = `
      INSERT INTO performance_metrics (
        date,
        total_scans,
        opportunities_found,
        total_profit,
        net_profit,
        avg_profit_per_trade
      )
      SELECT
        $1::date,
        COUNT(*) FILTER (WHERE to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') = $1),
        COUNT(*) FILTER (WHERE estimated_profit > 0 AND to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') = $1),
        COALESCE(SUM(estimated_profit) FILTER (WHERE to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') = $1), 0),
        COALESCE(SUM(estimated_profit) FILTER (WHERE to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') = $1), 0),
        COALESCE(AVG(estimated_profit) FILTER (WHERE to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') = $1), 0)
      FROM arbitrage_scans
      ON CONFLICT (date) DO UPDATE SET
        total_scans = EXCLUDED.total_scans,
        opportunities_found = EXCLUDED.opportunities_found,
        total_profit = EXCLUDED.total_profit,
        net_profit = EXCLUDED.net_profit,
        avg_profit_per_trade = EXCLUDED.avg_profit_per_trade,
        created_at = now();
    `;
    await this.query(sql, [date]);
  }

  async getQueueStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_queued,
        COUNT(*) FILTER (WHERE status = 'queued') as waiting,
        COUNT(*) FILTER (WHERE status = 'executing') as executing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(priority_score) as avg_priority_score
      FROM opportunity_queue
    `;

    const res = await this.query(sql);
    return res.rows[0];
  }

  async getGasPriceStats(hours = 24) {
    const sql = `
      SELECT 
        AVG(base_fee_per_gas) as avg_base_fee,
        AVG(max_fee_per_gas) as avg_max_fee,
        AVG(max_priority_fee_per_gas) as avg_priority_fee,
        MIN(base_fee_per_gas) as min_base_fee,
        MAX(base_fee_per_gas) as max_base_fee
      FROM gas_price_history
      WHERE timestamp >= $1
    `;

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const res = await this.query(sql, [cutoff]);
    return res.rows[0];
  }

  async cleanupOldData() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    await this.query("DELETE FROM arbitrage_scans WHERE timestamp < $1", [
      oneMonthAgo,
    ]);

    await this.query("DELETE FROM price_feeds WHERE timestamp < $1", [
      oneWeekAgo,
    ]);

    await this.query("DELETE FROM gas_price_history WHERE timestamp < $1", [
      oneWeekAgo,
    ]);

    await this.query("DELETE FROM system_health WHERE timestamp < $1", [
      oneWeekAgo,
    ]);
  }

  async refreshMaterializedViews() {
    await this.query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_performance"
    );
  }

  async createRefreshFunctions() {
    const sql = `
      CREATE OR REPLACE FUNCTION refresh_hourly_performance()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_performance;
      END;
      $$ LANGUAGE plpgsql;
    `;

    try {
      await this.query(sql);
    } catch (error) {
      console.log("Refresh function creation skipped:", error.message);
    }
  }

  async getDatabasePerformance() {
    const sql = `
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'
      ORDER BY n_distinct DESC
      LIMIT 20
    `;

    const res = await this.query(sql);
    return res.rows;
  }

  async close() {
    await this.pool.end();
  }
}

const database = new Database();
export default database;