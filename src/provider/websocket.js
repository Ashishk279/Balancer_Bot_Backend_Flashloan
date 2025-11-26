import { ethers } from 'ethers';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

class WebSocketProvider {
  constructor() {
    this.provider = null;
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
    this.isConnecting = false;
    this.subscriptions = new Map();
    
    this.initialize();
  }

  async initialize() {
    try {
      // Primary WebSocket provider (Alchemy recommended)
      const wsUrl = process.env.WS_URL;
      
      console.log('Initializing WebSocket connection...');
      this.provider = new ethers.WebSocketProvider(wsUrl);
      
      
      // Set up connection event handlers
      this.setupEventHandlers();
      
      // Test connection
      await this.testConnection();
      
      console.log('✅ WebSocket provider initialized successfully');
      return this.provider;
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket provider:', error.message);
      await this.fallbackToHttpProvider();
    }
  }

  setupEventHandlers() {
    if (!this.provider || !this.provider._websocket) return;

    const ws = this.provider._websocket;
    
    ws.on('open', () => {
      console.log('🔗 WebSocket connection opened');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    });

    ws.on('close', (code, reason) => {
      console.log(`🔴 WebSocket connection closed: ${code} - ${reason}`);
      this.handleDisconnection();
    });

    ws.on('error', (error) => {
      console.error('🚨 WebSocket error:', error.message);
      this.handleDisconnection();
    });

    // Monitor connection health
    this.startHealthCheck();
  }

  async testConnection() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`📊 Current block number: ${blockNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      throw error;
    }
  }

  async handleDisconnection() {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          await this.initialize();
          // Restore subscriptions
          await this.restoreSubscriptions();
        } catch (error) {
          console.error('❌ Reconnection failed:', error.message);
          this.handleDisconnection();
        }
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached. Falling back to HTTP provider.');
      await this.fallbackToHttpProvider();
    }
  }

  async fallbackToHttpProvider() {
    try {
      console.log('🔄 Switching to HTTP provider...');
      const httpUrl = process.env.RPC_URL;
      this.provider = new ethers.JsonRpcProvider(httpUrl);
      
      await this.testConnection();
      console.log('✅ HTTP provider initialized as fallback');
    } catch (error) {
      console.error('❌ Fallback provider failed:', error.message);
      throw new Error('All provider connections failed');
    }
  }

  startHealthCheck() {
    // Ping every 30 seconds to maintain connection
    setInterval(async () => {
      if (this.provider && this.provider._websocket) {
        try {
          await this.provider.getBlockNumber();
        } catch (error) {
          console.error('❤️‍🩹 Health check failed:', error.message);
          this.handleDisconnection();
        }
      }
    }, 30000);
  }

  async restoreSubscriptions() {
    // Restore any active subscriptions after reconnection
    for (const [key, subscription] of this.subscriptions) {
      try {
        await subscription.restore();
        console.log(`✅ Restored subscription: ${key}`);
      } catch (error) {
        console.error(`❌ Failed to restore subscription ${key}:`, error.message);
      }
    }
  }

  // Subscribe to new blocks
  subscribeToBlocks(callback) {
    if (!this.provider) {
      console.error('❌ Provider not initialized');
      return null;
    }

    const subscription = this.provider.on('block', callback);
    this.subscriptions.set('blocks', {
      subscription,
      restore: () => this.provider.on('block', callback)
    });
    
    console.log('📦 Subscribed to new blocks');
    return subscription;
  }

  // Subscribe to pending transactions
  subscribeToPendingTxs(callback) {
    if (!this.provider) {
      console.error('❌ Provider not initialized');
      return null;
    }

    const subscription = this.provider.on('pending', callback);
    this.subscriptions.set('pending', {
      subscription,
      restore: () => this.provider.on('pending', callback)
    });
    
    console.log('⏳ Subscribed to pending transactions');
    return subscription;
  }

  // Get provider instance
  getProvider() {
    if (!this.provider) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }
    return this.provider;
  }

  // Clean shutdown
  async disconnect() {
    if (this.provider && this.provider._websocket) {
      this.provider._websocket.close();
    }
    this.subscriptions.clear();
    console.log('🔌 WebSocket provider disconnected');
  }
}

// Singleton instance
const ws = new WebSocketProvider();

export default ws;
export { WebSocketProvider };