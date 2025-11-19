// // import express from 'express';
// // import db from '../db.js';

// // const app = express();
// // const PORT = process.env.API_PORT || 3000;

// // // Middleware for parsing JSON bodies (if needed for POST requests later)
// // app.use(express.json());

// // // --- API Endpoints ---

// // // Endpoint to get recent arbitrage scans
// // app.get('/api/arbitrage-scans', async (req, res) => {
// //   try {
// //     const limit = parseInt(req.query.limit, 10) || 50; // Allow limit as query parameter
// //     const scans = await db.recentScans(limit);
// //     res.json(scans);
// //   } catch (error) {
// //     console.error('Error fetching arbitrage scans:', error);
// //     res.status(500).json({ error: 'Failed to retrieve arbitrage scans' });
// //   }
// // });

// // // Endpoint to get profitable opportunities
// // app.get('/api/profitable-opportunities', async (req, res) => {
// //   try {
// //     const limit = parseInt(req.query.limit, 10) || 50;
// //     const opportunities = await db.getProfitableOpportunities(limit);
// //     res.json(opportunities);
// //   } catch (error) {
// //     console.error('Error fetching profitable opportunities:', error);
// //     res.status(500).json({ error: 'Failed to retrieve profitable opportunities' });
// //   }
// // });

// // // Endpoint to get daily summary
// // app.get('/api/daily-summary', async (req, res) => {
// //   try {
// //     const days = parseInt(req.query.days, 10) || 7;
// //     const summary = await db.getDailySummary(days);
// //     res.json(summary);
// //   } catch (error) {
// //     console.error('Error fetching daily summary:', error);
// //     res.status(500).json({ error: 'Failed to retrieve daily summary' });
// //   }
// // });

// // // Basic health check endpoint
// // app.get('/api/health', (req, res) => {
// //   res.status(200).json({ status: 'ok', timestamp: new Date() });
// // });

// // // Start the API server
// // export function startApi() {
// //   app.listen(PORT, () => {
// //     console.log(`📡 API server listening on http://localhost:${PORT}`);
// //   });
// // }

// import express from "express";
// import cors from "cors";
// import db from "../db.js";

// const app = express();
// const PORT = process.env.API_PORT || 8000;
// const HOST = process.env.API_HOST || "0.0.0.0";

// // CORS Configuration
// const corsOptions = {
//   origin: [
//     "http://localhost:3000",
//     "http://localhost:5173", // Vite default port
//     "http://localhost:5174",
//     "http://172.31.18.227:3000",
//     "http://172.31.18.227:5173",
//     "http://172.31.18.227:5174",
//     process.env.FRONTEND_URL, // Allow custom frontend URL from env
//     process.env.CORS_ORIGIN || "*", // Fallback to wildcard if not specified
//   ].filter(Boolean), // Remove undefined values
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
// };

// // Apply CORS middleware
// app.use(cors(corsOptions));

// // Middleware for parsing JSON bodies
// app.use(express.json());

// // --- API Endpoints ---

// // Endpoint to get recent arbitrage scans
// app.get("/api/arbitrage-scans", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const scans = await db.recentScans(limit);
//     res.json(scans);
//   } catch (error) {
//     console.error("Error fetching arbitrage scans:", error);
//     res.status(500).json({ error: "Failed to retrieve arbitrage scans" });
//   }
// });

// // Endpoint to get profitable opportunities (all types)
// app.get("/api/profitable-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const opportunities = await db.getProfitableOpportunities(limit);
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching profitable opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve profitable opportunities" });
//   }
// });

// // NEW ENDPOINT: Get only profitable triangular arbitrage opportunities
// app.get("/api/triangular-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const opportunities = await db.getTriangularOpportunities(limit);
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching triangular opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve triangular opportunities" });
//   }
// });

// // NEW ENDPOINT: Get V3 Engine opportunities (direct, cross, triangular)
// app.get("/api/v3-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const type = req.query.type; // 'v3_direct', 'v3_cross', 'v3_triangular', or undefined for all
//     const opportunities = await db.getV3EngineOpportunities(limit, type);
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching V3 engine opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve V3 engine opportunities" });
//   }
// });

// // NEW ENDPOINT: Get V3 Engine direct arbitrage opportunities
// app.get("/api/v3-direct-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const opportunities = await db.getV3EngineOpportunities(limit, 'v3_direct');
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching V3 direct opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve V3 direct opportunities" });
//   }
// });

// // NEW ENDPOINT: Get V3 Engine cross arbitrage opportunities
// app.get("/api/v3-cross-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const opportunities = await db.getV3EngineOpportunities(limit, 'v3_cross');
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching V3 cross opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve V3 cross opportunities" });
//   }
// });

// // NEW ENDPOINT: Get V3 Engine triangular arbitrage opportunities
// app.get("/api/v3-triangular-opportunities", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const opportunities = await db.getV3EngineOpportunities(limit, 'v3_triangular');
//     res.json(opportunities);
//   } catch (error) {
//     console.error("Error fetching V3 triangular opportunities:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve V3 triangular opportunities" });
//   }
// });

// // NEW ENDPOINT: Get V3 Engine statistics
// app.get("/api/v3-engine-stats", async (req, res) => {
//   try {
//     const stats = await db.getV3EngineStats();
//     res.json(stats);
//   } catch (error) {
//     console.error("Error fetching V3 engine stats:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to retrieve V3 engine statistics" });
//   }
// });

// // NEW ENDPOINT: Get execution statistics
// app.get("/api/executions", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 100;
//     const executions = await db.getExecutionStats(limit);
//     res.json(executions);
//   } catch (error) {
//     console.error("Error fetching execution stats:", error);
//     res.status(500).json({ error: "Failed to retrieve execution statistics" });
//   }
// });

// // NEW ENDPOINT: Get flashbot bundle statistics
// app.get("/api/bundles", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 100;
//     const bundles = await db.getBundleStats(limit);
//     res.json(bundles);
//   } catch (error) {
//     console.error("Error fetching bundle stats:", error);
//     res.status(500).json({ error: "Failed to retrieve bundle statistics" });
//   }
// });

// // NEW ENDPOINT: Get system health status
// app.get("/api/system-health", async (req, res) => {
//   try {
//     const service = req.query.service || null;
//     const limit = parseInt(req.query.limit, 10) || 100;
//     const health = await db.getSystemHealth(service, limit);
//     res.json(health);
//   } catch (error) {
//     console.error("Error fetching system health:", error);
//     res.status(500).json({ error: "Failed to retrieve system health" });
//   }
// });

// // NEW ENDPOINT: Get execution summary for dashboard
// app.get("/api/execution-summary", async (req, res) => {
//   try {
//     const summary = await db.getExecutionSummary();
//     res.json(summary);
//   } catch (error) {
//     console.error("Error fetching execution summary:", error);
//     res.status(500).json({ error: "Failed to retrieve execution summary" });
//   }
// });

// // NEW ENDPOINT: Get recent successful executions
// app.get("/api/successful-executions", async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 50;
//     const executions = await db.getRecentSuccessfulExecutions(limit);
//     res.json(executions);
//   } catch (error) {
//     console.error("Error fetching successful executions:", error);
//     res.status(500).json({ error: "Failed to retrieve successful executions" });
//   }
// });

// // NEW ENDPOINT: Emergency stop endpoint
// app.post("/api/emergency-stop", async (req, res) => {
//   try {
//     // This would need access to the execution manager instance
//     // For now, we'll return a message indicating the endpoint exists
//     res.json({
//       message: "Emergency stop endpoint available",
//       note: "Implementation requires access to execution manager instance",
//     });
//   } catch (error) {
//     console.error("Error in emergency stop:", error);
//     res.status(500).json({ error: "Failed to execute emergency stop" });
//   }
// });

// // Endpoint to get daily summary
// app.get("/api/daily-summary", async (req, res) => {
//   try {
//     const days = parseInt(req.query.days, 10) || 7;
//     const summary = await db.getDailySummary(days);
//     res.json(summary);
//   } catch (error) {
//     console.error("Error fetching daily summary:", error);
//     res.status(500).json({ error: "Failed to retrieve daily summary" });
//   }
// });

// // Basic health check endpoint
// app.get("/api/health", (req, res) => {
//   res.status(200).json({ status: "ok", timestamp: new Date() });
// });

// // Start the API server
// export function startApi() {
//   app.listen(PORT, HOST, () => {
//     console.log(`📡 API server listening on http://${HOST}:${PORT}`);
//     console.log(`📡 Accessible externally at: http://172.31.18.227:${PORT}`);
//     console.log(`🌐 CORS enabled for multiple origins`);
//     console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
//   });
// }


import express from "express";
import cors from "cors";
import { createServer } from "http";
import db from "../db.js";
import { initWebSocket } from "../services/websocket.js";
import redis from '../config/radis.js';

import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'opportunities.log.json');
const OPPORTUNITY_TTL_SECONDS = 30; // same as Redis expire

const app = express();
const httpServer = createServer(app);
const PORT = process.env.API_PORT || 8000;
const HOST = process.env.API_HOST || "0.0.0.0";

// CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://172.31.18.227:3000",
    "http://172.31.18.227:5173",
    "http://172.31.18.227:5174",
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN || "*",
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Endpoint to get current opportunities from Redis
app.get("/api/current-opportunities", async (req, res) => {
  try {
    const keys = await redis.keys('opportunity:*');
    const opportunities = [];

    for (const key of keys) {
      const opp = await redis.hgetall(key);
      if (opp && Object.keys(opp).length > 0) {
        opportunities.push({
          ...opp,
          id: key,
          key: key
        });
      }
    }

    // Sort by profit (highest first)
    opportunities.sort((a, b) => {
      const profitA = parseFloat(a.expectedProfit || 0);
      const profitB = parseFloat(b.expectedProfit || 0);
      return profitB - profitA;
    });

    res.json({
      count: opportunities.length,
      opportunities: opportunities
    });
  } catch (error) {
    console.error("Error fetching current opportunities from Redis:", error);
    res.status(500).json({ error: "Failed to retrieve current opportunities" });
  }
});

app.get("/api/all-opportunities", async (req, res) => {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');

    let allOpportunities = [];
    if (content.trim()) {
      allOpportunities = JSON.parse(content);

      if (!Array.isArray(allOpportunities)) {
        return res.status(500).json({ error: "Log file is corrupted" });
      }
    }

    // Optional: Parse nested JSON fields for better frontend use
    const enriched = allOpportunities.map(opp => ({
      ...opp,
      id: opp.id || opp.key,
      key: opp.key || opp.id,
      tokenA: tryParseJSON(opp.tokenA),
      tokenB: tryParseJSON(opp.tokenB),
      formatted: tryParseJSON(opp.formatted),
      timestamp: opp.timestamp || new Date().toISOString()
    }));

    // Sort by profit (highest first)
    enriched.sort((a, b) => {
      const profitA = parseFloat(a.profit || a.expectedProfit || 0);
      const profitB = parseFloat(b.profit || b.expectedProfit || 0);
      return profitB - profitA;
    });

    res.json({
      count: enriched.length,
      from: "full_history",
      generatedAt: new Date().toISOString(),
      opportunities: enriched
    });

  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.json({
        count: 0,
        from: "full_history",
        message: "No opportunities logged yet",
        opportunities: []
      });
    }

    console.error("Error reading full opportunities log:", error);
    res.status(500).json({
      error: "Failed to load historical opportunities",
      details: error.message
    });
  }
});

// Helper to safely parse JSON strings
function tryParseJSON(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return str.includes('{') ? {} : str;
  }
}


// New endpoint: Get all V3 opportunities (profitable and non-profitable)
app.get("/api/v3-all-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const type = req.query.type;
    const isProfitable = req.query.isProfitable ? req.query.isProfitable === 'true' : null;
    const opportunities = await db.getAllV3Opportunities(limit, type, isProfitable);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching all V3 opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve all V3 opportunities" });
  }
});

// Endpoint to get profitable V3 opportunities
app.get("/api/v3-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const type = req.query.type;
    const opportunities = await db.getV3EngineOpportunities(limit, type);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching V3 engine opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve V3 engine opportunities" });
  }
});

// Endpoint to get V3 direct opportunities
app.get("/api/v3-direct-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const opportunities = await db.getV3EngineOpportunities(limit, 'v3_direct');
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching V3 direct opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve V3 direct opportunities" });
  }
});

// Endpoint to get V3 cross opportunities
app.get("/api/v3-cross-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const opportunities = await db.getV3EngineOpportunities(limit, 'v3_cross');
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching V3 cross opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve V3 cross opportunities" });
  }
});

// Endpoint to get V3 triangular opportunities
app.get("/api/v3-triangular-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const opportunities = await db.getTriangularOpportunities(limit);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching V3 triangular opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve V3 triangular opportunities" });
  }
});

// Endpoint to get V3 engine statistics
app.get("/api/v3-engine-stats", async (req, res) => {
  try {
    const stats = await db.getV3EngineStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching V3 engine stats:", error);
    res.status(500).json({ error: "Failed to retrieve V3 engine statistics" });
  }
});

// Endpoint to get recent arbitrage scans (legacy)
app.get("/api/arbitrage-scans", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const scans = await db.recentScans(limit);
    res.json(scans);
  } catch (error) {
    console.error("Error fetching arbitrage scans:", error);
    res.status(500).json({ error: "Failed to retrieve arbitrage scans" });
  }
});

// Endpoint to get profitable opportunities (legacy)
app.get("/api/profitable-opportunities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const opportunities = await db.getProfitableOpportunities(limit);
    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching profitable opportunities:", error);
    res.status(500).json({ error: "Failed to retrieve profitable opportunities" });
  }
});

// Endpoint to get execution statistics
app.get("/api/executions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const executions = await db.getExecutionStats(limit);
    res.json(executions);
  } catch (error) {
    console.error("Error fetching execution stats:", error);
    res.status(500).json({ error: "Failed to retrieve execution statistics" });
  }
});

// Endpoint to get flashbot bundle statistics
app.get("/api/bundles", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const bundles = await db.getBundleStats(limit);
    res.json(bundles);
  } catch (error) {
    console.error("Error fetching bundle stats:", error);
    res.status(500).json({ error: "Failed to retrieve bundle statistics" });
  }
});

// Endpoint to get system health status
app.get("/api/system-health", async (req, res) => {
  try {
    const service = req.query.service || null;
    const limit = parseInt(req.query.limit, 10) || 100;
    const health = await db.getSystemHealth(service, limit);
    res.json(health);
  } catch (error) {
    console.error("Error fetching system health:", error);
    res.status(500).json({ error: "Failed to retrieve system health" });
  }
});

// Endpoint to get execution summary
app.get("/api/execution-summary", async (req, res) => {
  try {
    const summary = await db.getExecutionSummary();
    res.json(summary);
  } catch (error) {
    console.error("Error fetching execution summary:", error);
    res.status(500).json({ error: "Failed to retrieve execution summary" });
  }
});

// Endpoint to get recent successful executions
app.get("/api/successful-executions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const executions = await db.getRecentSuccessfulExecutions(limit);
    res.json(executions);
  } catch (error) {
    console.error("Error fetching successful executions:", error);
    res.status(500).json({ error: "Failed to retrieve successful executions" });
  }
});

// Endpoint for emergency stop
app.post("/api/emergency-stop", async (req, res) => {
  try {
    res.json({
      message: "Emergency stop endpoint available",
      note: "Implementation requires access to execution manager instance",
    });
  } catch (error) {
    console.error("Error in emergency stop:", error);
    res.status(500).json({ error: "Failed to execute emergency stop" });
  }
});

// Endpoint to get daily summary
app.get("/api/daily-summary", async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const summary = await db.getDailySummary(days);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    res.status(500).json({ error: "Failed to retrieve daily summary" });
  }
});

// Basic health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Start the API server
export function startApi() {
  // Initialize WebSocket server
  initWebSocket(httpServer);

  httpServer.listen(PORT, HOST, () => {
    console.log(`📡 API server listening on http://${HOST}:${PORT}`);
    console.log(`📡 Accessible externally at: http://172.31.18.227:${PORT}`);
    console.log(`🌐 CORS enabled for multiple origins`);
    console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
    console.log(`🔌 WebSocket server ready for real-time updates`);
  });
}
