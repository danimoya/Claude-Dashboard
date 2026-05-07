import 'reflect-metadata';

/**
 * Claude Dashboard Backend Server
 * Express server with TypeORM, WebSocket, and comprehensive middleware
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { AppDataSource } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { setupQueueEventHandlers, cleanupQueues } from './config/queue.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { securityHeaders, sanitizeInput } from './middleware/security.middleware.js';
import { initializeCLIGateway } from './websocket/cli.gateway.js';
import { initializeTmuxGateway } from './websocket/tmux.gateway.js';
import { registerCBStreamProxy } from './websocket/cb-stream.proxy.js';
import { ClaudeWrapperService } from './services/claude-wrapper.service.js';
import { CLIOutputParserService } from './services/cli-output-parser.service.js';
import { CLISessionService } from './services/cli-session.service.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import cliRoutes from './routes/cli.routes.js';
import userRoutes from './routes/user.routes.js';
import claudeBRoutes from './routes/claudeB.routes.js';
import tmuxRoutes from './routes/tmux.routes.js';
import twofaRoutes from './routes/twofa.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import setupRoutes from './routes/setup.routes.js';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origins,
    credentials: true,
  },
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (config.env !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}
app.use(requestLogger);

// Additional security hardening
app.use(securityHeaders);
app.use(sanitizeInput);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/2fa', twofaRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/cli', cliRoutes);
app.use('/api/v1/tmux', tmuxRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/cb', claudeBRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

/**
 * Initialize database and start server
 */
async function startServer() {
  try {
    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connection established');

    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established');

    // Run pending migrations
    await AppDataSource.runMigrations();
    logger.info('Database migrations completed');

    // Mint the installation_id on first boot (no-op afterwards). Used by
    // the telemetry/update-check service if the operator opts in.
    const { telemetryService } = await import('./services/telemetry.service.js');
    await telemetryService.getOrCreateInstall();

    // Setup queue event handlers
    setupQueueEventHandlers();
    logger.info('Queue event handlers configured');

    // Initialize CLI Gateway
    const claudeWrapper = new ClaudeWrapperService();
    const outputParser = new CLIOutputParserService();
    const sessionService = new CLISessionService();
    initializeCLIGateway(io, claudeWrapper, outputParser, sessionService);
    logger.info('CLI WebSocket gateway initialized');

    // Initialize Tmux WebSocket gateway
    initializeTmuxGateway(io);

    // Initialize CB stream WebSocket proxy
    registerCBStreamProxy(httpServer);
    logger.info('CB stream WebSocket proxy initialized');

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`Frontend URL: ${config.frontendUrl}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);

  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await cleanupQueues();
      await disconnectRedis();
      await AppDataSource.destroy();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server if not in test mode
if (config.env !== 'test') {
  startServer();
}

export { app, io, httpServer };
