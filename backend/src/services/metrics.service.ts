/**
 * Metrics Service
 * Prometheus metrics collection
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger.js';

export class MetricsService {
  private registry: Registry;

  // Counters
  private httpRequestsTotal: Counter;
  private cliSessionsTotal: Counter;
  private authAttemptsTotal: Counter;

  // Histograms
  private httpRequestDuration: Histogram;
  private cliSessionDuration: Histogram;

  // Gauges
  private activeConnections: Gauge;
  private activeSessions: Gauge;
  private queueSize: Gauge;

  constructor() {
    this.registry = new Registry();

    // Initialize counters
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.cliSessionsTotal = new Counter({
      name: 'cli_sessions_total',
      help: 'Total number of CLI sessions',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.authAttemptsTotal = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'success'],
      registers: [this.registry],
    });

    // Initialize histograms
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.cliSessionDuration = new Histogram({
      name: 'cli_session_duration_seconds',
      help: 'CLI session duration in seconds',
      labelNames: ['type', 'status'],
      buckets: [60, 300, 600, 1800, 3600],
      registers: [this.registry],
    });

    // Initialize gauges
    this.activeConnections = new Gauge({
      name: 'active_websocket_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.activeSessions = new Gauge({
      name: 'active_cli_sessions',
      help: 'Number of active CLI sessions',
      registers: [this.registry],
    });

    this.queueSize = new Gauge({
      name: 'queue_size',
      help: 'Number of jobs in queue',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    logger.info('Metrics service initialized');
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status: status.toString() });
    this.httpRequestDuration.observe({ method, route, status: status.toString() }, duration);
  }

  /**
   * Record CLI session
   */
  recordCLISession(type: string, status: string, duration: number): void {
    this.cliSessionsTotal.inc({ type, status });
    this.cliSessionDuration.observe({ type, status }, duration);
  }

  /**
   * Record authentication attempt
   */
  recordAuthAttempt(type: 'login' | 'register', success: boolean): void {
    this.authAttemptsTotal.inc({ type, success: success.toString() });
  }

  /**
   * Update active connections
   */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Update active sessions
   */
  setActiveSessions(count: number): void {
    this.activeSessions.set(count);
  }

  /**
   * Update queue size
   */
  setQueueSize(queue: string, status: string, size: number): void {
    this.queueSize.set({ queue, status }, size);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

// Singleton instance
export const metricsService = new MetricsService();
