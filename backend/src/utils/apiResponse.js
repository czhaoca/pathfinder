/**
 * Standardized API Response Utility
 * Provides consistent response format across all API endpoints
 */

class ApiResponse {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {*} data - Response data
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code (default: 200)
     */
    static success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code (default: 500)
     * @param {*} errors - Additional error details
     */
    static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Array} errors - Validation errors
     */
    static validationError(res, errors) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {string} message - Unauthorized message
     */
    static unauthorized(res, message = 'Unauthorized access') {
        return res.status(401).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {string} message - Forbidden message
     */
    static forbidden(res, message = 'Access forbidden') {
        return res.status(403).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {string} message - Not found message
     */
    static notFound(res, message = 'Resource not found') {
        return res.status(404).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} items - Array of items
     * @param {Object} pagination - Pagination metadata
     * @param {string} message - Success message
     */
    static paginated(res, items, pagination, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data: {
                items,
                pagination: {
                    total: pagination.total,
                    page: pagination.page,
                    perPage: pagination.perPage,
                    totalPages: Math.ceil(pagination.total / pagination.perPage),
                    hasNext: pagination.page < Math.ceil(pagination.total / pagination.perPage),
                    hasPrev: pagination.page > 1
                }
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send created response
     * @param {Object} res - Express response object
     * @param {*} data - Created resource data
     * @param {string} message - Success message
     */
    static created(res, data, message = 'Resource created successfully') {
        return res.status(201).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send updated response
     * @param {Object} res - Express response object
     * @param {*} data - Updated resource data
     * @param {string} message - Success message
     */
    static updated(res, data, message = 'Resource updated successfully') {
        return res.status(200).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send deleted response
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     */
    static deleted(res, message = 'Resource deleted successfully') {
        return res.status(200).json({
            success: true,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send no content response
     * @param {Object} res - Express response object
     */
    static noContent(res) {
        return res.status(204).send();
    }
}

module.exports = ApiResponse;