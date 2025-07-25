#!/usr/bin/env node

/**
 * Career Navigator API Server
 * Entry point for the refactored application
 */

const http = require('http');
const App = require('./app');
const logger = require('../utils/logger');
const config = require('../config');

const PORT = process.env.API_PORT || 3000;
const app = new App();
let server;

async function startServer() {
  try {
    // Initialize application
    await app.initialize();
    
    // Create HTTP server
    server = http.createServer(app.getExpressApp());
    
    // Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 API server running on port ${PORT} in ${config.environment} mode`);
      logger.info(`📡 Health check available at http://localhost:${PORT}/api/health`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');
      
      // Shutdown application
      await app.shutdown();
      
      // Exit process
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();