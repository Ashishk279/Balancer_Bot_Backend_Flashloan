import logger from '../utils/logger.js';
import db from '../db.js';

/**
 * MonitoringService - Production monitoring and health checks
 * Tracks system health, performance metrics, and alerts
 */
class MonitoringService {
    constructor(config = {}) {
        this.config = {
            healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
            metricsInterval: config.metricsInterval || 60000, // 1 minute
            alertThresholds: config.alertThresholds || {
                errorRate: 0.1,
                responseTime: 5000,
                profitDrop: 0.5,
            },
            ...config
        };
        
        this.isRunning = false;
        this.healthInterval = null;
        this.metricsInterval = null;
        
        // Health tracking
        this.healthStatus = {
            database: 'unknown',
            rpc: 'unknown',
            executionManager: 'unknown',
            flashbotService: 'unknown',
            lastCheck: null,
        };
        
        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalProfit: 0,
            totalGasSpent: 0,
            lastUpdate: null,
        };
        
        // Alert tracking
        this.alerts = [];
        this.alertHistory = [];
    }

    /**
     * Start monitoring service
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Monitoring service already running', { service: 'monitoring' });
            return;
        }

        try {
            logger.info('Starting monitoring service...', { service: 'monitoring' });
            
            // Start health checks
            this.startHealthChecks();
            
            // Start metrics collection
            this.startMetricsCollection();
            
            this.isRunning = true;
            logger.info('✅ Monitoring service started successfully', { service: 'monitoring' });
            
        } catch (error) {
            logger.error('❌ Failed to start monitoring service', {
                error: error.message,
                service: 'monitoring'
            });
            throw error;
        }
    }

    /**
     * Stop monitoring service
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            logger.info('Stopping monitoring service...', { service: 'monitoring' });
            
            // Clear intervals
            if (this.healthInterval) {
                clearInterval(this.healthInterval);
                this.healthInterval = null;
            }
            
            if (this.metricsInterval) {
                clearInterval(this.metricsInterval);
                this.metricsInterval = null;
            }
            
            this.isRunning = false;
            logger.info('✅ Monitoring service stopped successfully', { service: 'monitoring' });
            
        } catch (error) {
            logger.error('Error stopping monitoring service', {
                error: error.message,
                service: 'monitoring'
            });
        }
    }

    /**
     * Start health checks
     */
    startHealthChecks() {
        this.healthInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(async () => {
            await this.collectMetrics();
        }, this.config.metricsInterval);
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = Date.now();
        
        try {
            logger.debug('Performing health check...', { service: 'monitoring' });
            
            // Check database health
            await this.checkDatabaseHealth();
            
            // Check RPC health
            await this.checkRPCHealth();
            
            // Check execution manager health
            await this.checkExecutionManagerHealth();
            
            // Check flashbot service health
            await this.checkFlashbotServiceHealth();
            
            // Record health check
            this.healthStatus.lastCheck = Date.now();
            
            const responseTime = Date.now() - startTime;
            await this.recordSystemHealth('monitoring', 'healthy', responseTime);
            
            logger.debug('Health check completed', {
                responseTime,
                service: 'monitoring'
            });
            
        } catch (error) {
            logger.error('Health check failed', {
                error: error.message,
                service: 'monitoring'
            });
            
            const responseTime = Date.now() - startTime;
            await this.recordSystemHealth('monitoring', 'unhealthy', responseTime, 1);
            
            // Trigger alert
            await this.triggerAlert('health_check_failed', {
                error: error.message,
                responseTime
            });
        }
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            const startTime = Date.now();
            
            // Simple query to check database connectivity
            await db.query('SELECT 1');
            
            const responseTime = Date.now() - startTime;
            this.healthStatus.database = 'healthy';
            
            await this.recordSystemHealth('database', 'healthy', responseTime);
            
        } catch (error) {
            this.healthStatus.database = 'unhealthy';
            await this.recordSystemHealth('database', 'unhealthy', 0, 1);
            
            throw new Error(`Database health check failed: ${error.message}`);
        }
    }

    /**
     * Check RPC health
     */
    async checkRPCHealth() {
        try {
            // This would check RPC endpoint health
            // For now, we'll mark as healthy
            this.healthStatus.rpc = 'healthy';
            
        } catch (error) {
            this.healthStatus.rpc = 'unhealthy';
            throw new Error(`RPC health check failed: ${error.message}`);
        }
    }

    /**
     * Check execution manager health
     */
    async checkExecutionManagerHealth() {
        try {
            // This would check execution manager status
            // For now, we'll mark as healthy
            this.healthStatus.executionManager = 'healthy';
            
        } catch (error) {
            this.healthStatus.executionManager = 'unhealthy';
            throw new Error(`Execution manager health check failed: ${error.message}`);
        }
    }

    /**
     * Check flashbot service health
     */
    async checkFlashbotServiceHealth() {
        try {
            // This would check flashbot service status
            // For now, we'll mark as healthy
            this.healthStatus.flashbotService = 'healthy';
            
        } catch (error) {
            this.healthStatus.flashbotService = 'unhealthy';
            throw new Error(`Flashbot service health check failed: ${error.message}`);
        }
    }

    /**
     * Collect performance metrics
     */
    async collectMetrics() {
        try {
            logger.debug('Collecting performance metrics...', { service: 'monitoring' });
            
            // Get execution summary
            const executionSummary = await db.getExecutionSummary();
            
            // Update metrics
            this.metrics.totalRequests = executionSummary.total_executions || 0;
            this.metrics.successfulRequests = executionSummary.successful_executions || 0;
            this.metrics.failedRequests = executionSummary.failed_executions || 0;
            this.metrics.totalProfit = parseFloat(executionSummary.total_profit || 0);
            this.metrics.totalGasSpent = parseFloat(executionSummary.total_gas_used || 0);
            this.metrics.lastUpdate = Date.now();
            
            // Calculate average response time (simplified)
            this.metrics.averageResponseTime = parseFloat(executionSummary.avg_execution_time || 0);
            
            // Check for anomalies
            await this.checkForAnomalies();
            
            logger.debug('Metrics collection completed', { service: 'monitoring' });
            
        } catch (error) {
            logger.error('Metrics collection failed', {
                error: error.message,
                service: 'monitoring'
            });
        }
    }

    /**
     * Check for performance anomalies
     */
    async checkForAnomalies() {
        try {
            // Check error rate
            const errorRate = this.metrics.totalRequests > 0 ? 
                this.metrics.failedRequests / this.metrics.totalRequests : 0;
            
            if (errorRate > this.config.alertThresholds.errorRate) {
                await this.triggerAlert('high_error_rate', {
                    errorRate: errorRate.toFixed(4),
                    threshold: this.config.alertThresholds.errorRate
                });
            }
            
            // Check response time
            if (this.metrics.averageResponseTime > this.config.alertThresholds.responseTime) {
                await this.triggerAlert('high_response_time', {
                    responseTime: this.metrics.averageResponseTime,
                    threshold: this.config.alertThresholds.responseTime
                });
            }
            
            // Check profit drop (would need historical data for comparison)
            // This is a simplified check
            
        } catch (error) {
            logger.error('Anomaly check failed', {
                error: error.message,
                service: 'monitoring'
            });
        }
    }

    /**
     * Record system health status
     */
    async recordSystemHealth(service, status, responseTime, errorCount = 0) {
        try {
            await db.insertSystemHealth({
                timestamp: Date.now(),
                service,
                status,
                response_time: responseTime,
                error_count: errorCount
            });
        } catch (error) {
            logger.error('Failed to record system health', {
                error: error.message,
                service: 'monitoring'
            });
        }
    }

    /**
     * Trigger alert
     */
    async triggerAlert(type, data) {
        try {
            const alert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type,
                data,
                timestamp: Date.now(),
                acknowledged: false
            };
            
            this.alerts.push(alert);
            this.alertHistory.push(alert);
            
            // Keep only recent alerts
            if (this.alerts.length > 100) {
                this.alerts = this.alerts.slice(-100);
            }
            
            if (this.alertHistory.length > 1000) {
                this.alertHistory = this.alertHistory.slice(-1000);
            }
            
            logger.warn(`Alert triggered: ${type}`, {
                alertId: alert.id,
                data,
                service: 'monitoring'
            });
            
            // In production, you might want to send notifications here
            // await this.sendNotification(alert);
            
        } catch (error) {
            logger.error('Failed to trigger alert', {
                error: error.message,
                service: 'monitoring'
            });
        }
    }

    /**
     * Get current health status
     */
    getHealthStatus() {
        return {
            ...this.healthStatus,
            overall: this.getOverallHealthStatus(),
            lastCheck: this.healthStatus.lastCheck
        };
    }

    /**
     * Get overall health status
     */
    getOverallHealthStatus() {
        const statuses = Object.values(this.healthStatus).filter(status => status !== 'unknown');
        
        if (statuses.length === 0) return 'unknown';
        if (statuses.every(status => status === 'healthy')) return 'healthy';
        if (statuses.some(status => status === 'unhealthy')) return 'unhealthy';
        
        return 'degraded';
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Get current alerts
     */
    getAlerts() {
        return [...this.alerts];
    }

    /**
     * Get alert history
     */
    getAlertHistory() {
        return [...this.alertHistory];
    }

    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            this.alerts = this.alerts.filter(a => a.id !== alertId);
        }
    }

    /**
     * Clear old alerts
     */
    clearOldAlerts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = Date.now() - maxAge;
        this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
        this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff);
    }
}

export default MonitoringService;
