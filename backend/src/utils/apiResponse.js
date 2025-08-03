/**
 * Standardized API response utility
 */

class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }
  
  static updated(res, data = null, message = 'Resource updated successfully') {
    return this.success(res, data, message, 200);
  }
  
  static deleted(res, message = 'Resource deleted successfully') {
    return this.success(res, null, message, 200);
  }
  
  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      },
      timestamp: new Date().toISOString()
    });
  }
  
  static error(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    const response = {
      success: false,
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString()
    };
    
    if (details) {
      response.error.details = details;
    }
    
    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse;