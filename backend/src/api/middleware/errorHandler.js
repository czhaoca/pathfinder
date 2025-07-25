const logger = require('../../utils/logger');

class ErrorHandler {
  static handle() {
    return (err, req, res, next) => {
      // Log error details
      logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userId: req.user?.userId,
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';

      // Handle specific error types
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: isDevelopment ? err.details : undefined
        });
      }

      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
          error: 'Authentication failed'
        });
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large'
        });
      }

      // Database errors
      if (err.code && err.code.startsWith('ORA-')) {
        const dbError = ErrorHandler.handleDatabaseError(err);
        return res.status(dbError.status).json({
          error: dbError.message,
          code: isDevelopment ? err.code : undefined
        });
      }

      // Default error response
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        stack: isDevelopment ? err.stack : undefined
      });
    };
  }

  static notFound() {
    return (req, res) => {
      res.status(404).json({
        error: 'Resource not found',
        path: req.path
      });
    };
  }

  static handleDatabaseError(err) {
    // Handle common Oracle error codes
    switch (err.code) {
      case 'ORA-00001':
        return { status: 409, message: 'Duplicate entry' };
      case 'ORA-01400':
        return { status: 400, message: 'Required field missing' };
      case 'ORA-02291':
        return { status: 400, message: 'Invalid reference' };
      case 'ORA-12154':
      case 'ORA-12514':
        return { status: 503, message: 'Database connection error' };
      default:
        return { status: 500, message: 'Database error' };
    }
  }

  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ErrorHandler;