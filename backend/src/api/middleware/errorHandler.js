const ApiResponse = require('../../utils/apiResponse');
const logger = require('../../utils/logger');

/**
 * Custom Application Error Class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, errors = null) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Async error handler wrapper
 * Catches errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log error details
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
    });

    // Handle known operational errors
    if (err.isOperational) {
        return ApiResponse.error(res, err.message, err.statusCode, err.errors);
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        return ApiResponse.validationError(res, errors);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return ApiResponse.unauthorized(res, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return ApiResponse.unauthorized(res, 'Token expired');
    }

    // Handle database errors
    if (err.code === 'ER_DUP_ENTRY') {
        return ApiResponse.error(res, 'Duplicate entry found', 409);
    }

    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return ApiResponse.error(res, 'Referenced resource not found', 400);
    }

    // Handle Oracle database errors
    if (err.errorNum) {
        switch (err.errorNum) {
            case 1:  // Unique constraint violation
                return ApiResponse.error(res, 'Duplicate entry found', 409);
            case 2291:  // Foreign key constraint violation
                return ApiResponse.error(res, 'Referenced resource not found', 400);
            case 1400:  // Cannot insert NULL
                return ApiResponse.error(res, 'Required field missing', 400);
            default:
                return ApiResponse.error(res, 'Database operation failed', 500);
        }
    }

    // Default error response
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? err.message : 'Internal server error';
    const statusCode = err.statusCode || 500;
    
    return ApiResponse.error(
        res, 
        message, 
        statusCode,
        isDevelopment ? { stack: err.stack } : null
    );
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res) => {
    return ApiResponse.notFound(res, `Route ${req.originalUrl} not found`);
};

// Legacy compatibility wrapper
class ErrorHandler {
    static handle() {
        return errorHandler;
    }

    static notFound() {
        return notFoundHandler;
    }

    static asyncWrapper(fn) {
        return asyncHandler(fn);
    }
}

module.exports = ErrorHandler;
module.exports.AppError = AppError;
module.exports.asyncHandler = asyncHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;