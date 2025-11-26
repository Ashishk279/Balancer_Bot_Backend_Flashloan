import { Server } from 'socket.io';
import redis from '../config/radis.js';
import logger from '../utils/logger.js';

let io = null;

/**
 * Initialize WebSocket server with Express HTTP server
 * @param {Object} httpServer - Express HTTP server instance
 */
export function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
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
      methods: ["GET", "POST"]
    },
    // Performance optimizations
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    logger.info(`WebSocket client connected: ${socket.id}`, { service: 'websocket' });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to arbitrage bot real-time updates',
      timestamp: new Date().toISOString()
    });

    // Handle client subscription to specific channels
    socket.on('subscribe', (data) => {
      const { channel } = data;
      if (channel) {
        socket.join(channel);
        console.log(`Client ${socket.id} subscribed to ${channel}`);
        socket.emit('subscribed', { channel, timestamp: new Date().toISOString() });
      }
    });

    // Handle client unsubscription
    socket.on('unsubscribe', (data) => {
      const { channel } = data;
      if (channel) {
        socket.leave(channel);
        console.log(`Client ${socket.id} unsubscribed from ${channel}`);
        socket.emit('unsubscribed', { channel, timestamp: new Date().toISOString() });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}`);
      logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`, { service: 'websocket' });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${socket.id}:`, error);
      logger.error(`WebSocket error for client ${socket.id}: ${error.message}`, { service: 'websocket' });
    });
  });

  // Subscribe to Redis pub/sub for real-time updates
  setupRedisSubscription();

  console.log('🔌 WebSocket server initialized');
  logger.info('WebSocket server initialized', { service: 'websocket' });

  return io;
}

/**
 * Setup Redis subscription to listen for new opportunities
 */
async function setupRedisSubscription() {
  try {
    // Create a separate Redis client for pub/sub
    const subscriber = redis.duplicate();

    await subscriber.subscribe('new_opportunity', (err, count) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err);
        logger.error(`Failed to subscribe to Redis: ${err.message}`, { service: 'websocket' });
      } else {
        console.log(`📡 Subscribed to ${count} Redis channel(s) for real-time updates`);
        logger.info(`Subscribed to ${count} Redis channels`, { service: 'websocket' });
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        if (channel === 'new_opportunity') {
          const opportunity = JSON.parse(message);

          // Broadcast to all connected clients
          emitNewOpportunity(opportunity);

          console.log(`📤 Broadcasted new opportunity: ${opportunity.id || 'unknown'}`);
        }
      } catch (error) {
        console.error('Error processing Redis message:', error);
        logger.error(`Error processing Redis message: ${error.message}`, { service: 'websocket' });
      }
    });

    subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error);
      logger.error(`Redis subscriber error: ${error.message}`, { service: 'websocket' });
    });

  } catch (error) {
    console.error('Error setting up Redis subscription:', error);
    logger.error(`Error setting up Redis subscription: ${error.message}`, { service: 'websocket' });
  }
}

/**
 * Emit a new opportunity to all connected clients
 * @param {Object} opportunity - The arbitrage opportunity data
 */
export function emitNewOpportunity(opportunity) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot emit opportunity');
    return;
  }

  // Broadcast to all clients
  io.emit('new_opportunity', {
    ...opportunity,
    timestamp: new Date().toISOString()
  });

  // Also emit to specific rooms based on opportunity type
  if (opportunity.type) {
    io.to(opportunity.type).emit('opportunity_by_type', {
      ...opportunity,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Emit opportunity statistics update
 * @param {Object} stats - Statistics data
 */
export function emitStats(stats) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot emit stats');
    return;
  }

  io.emit('stats_update', {
    ...stats,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit execution update
 * @param {Object} execution - Execution data
 */
export function emitExecution(execution) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot emit execution');
    return;
  }

  io.emit('execution_update', {
    ...execution,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get the Socket.io instance
 */
export function getIO() {
  return io;
}

export default {
  initWebSocket,
  emitNewOpportunity,
  emitStats,
  emitExecution,
  getIO
};
