const { AuditService } = require('../services/auditService');
const crypto = require('crypto');

// Initialize audit service
const auditService = new AuditService(require('../config/database'));

/**
 * Audit logging middleware factory
 * @param {string} eventName - Name of the event to log
 * @param {Object} options - Additional options for audit logging
 * @returns {Function} Express middleware
 */
function auditLog(eventName, options = {}) {
  return async (req, res, next) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Store request ID for correlation
    req.auditRequestId = requestId;
    
    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    let responseData = null;
    let statusCode = 200;
    
    // Override response methods to capture data
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };
    
    // Log request on response finish
    res.on('finish', async () => {
      try {
        const responseTime = Date.now() - startTime;
        
        // Determine event details based on response
        const eventType = options.eventType || inferEventType(req.path, req.method);
        const eventCategory = options.eventCategory || inferEventCategory(req.path);
        const eventSeverity = inferEventSeverity(statusCode);
        const actionResult = statusCode < 400 ? 'success' : 'failure';
        
        // Extract sensitive data indicators
        const sensitiveFields = extractSensitiveFields(req.body);
        const hasPersonalData = detectPersonalData(req.body, responseData);
        
        // Build audit event
        const auditEvent = {
          event_type: eventType,
          event_category: eventCategory,
          event_severity: eventSeverity,
          event_name: eventName || `${req.method} ${req.path}`,
          event_description: options.description || generateEventDescription(req, statusCode),
          
          // Actor information
          actor_type: req.user ? 'user' : 'anonymous',
          actor_id: req.user?.id,
          actor_username: req.user?.username,
          actor_roles: req.user?.roles ? JSON.stringify(req.user?.roles) : null,
          
          // Target information
          target_type: options.targetType || inferTargetType(req.path),
          target_id: req.params?.id || req.params?.userId || extractTargetId(req),
          target_name: options.targetName || req.body?.username || req.body?.name,
          
          // Action details
          action: req.method.toLowerCase(),
          action_result: actionResult,
          action_reason: statusCode >= 400 ? extractErrorReason(responseData) : null,
          
          // Request context
          request_id: requestId,
          correlation_id: req.headers['x-correlation-id'] || requestId,
          session_id: req.user?.session_id || req.sessionID,
          
          // HTTP details
          http_method: req.method,
          http_path: req.path,
          http_query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : null,
          http_status_code: statusCode,
          response_time_ms: responseTime,
          
          // Client information
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('user-agent'),
          
          // Security context
          authentication_method: req.user ? 'jwt' : 'none',
          risk_score: calculateRiskScore(req, statusCode, responseTime),
          
          // Data sensitivity
          data_sensitivity: hasPersonalData ? 'confidential' : 'internal',
          
          // Custom data
          custom_data: JSON.stringify({
            request_size: req.get('content-length'),
            response_size: JSON.stringify(responseData || '').length,
            sensitive_fields: sensitiveFields,
            has_personal_data: hasPersonalData,
            ...options.customData
          })
        };
        
        // Add data modification details if applicable
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
          auditEvent.old_values = req.auditOldValues ? JSON.stringify(req.auditOldValues) : null;
          auditEvent.new_values = req.auditNewValues ? JSON.stringify(req.auditNewValues) : null;
          auditEvent.changed_fields = req.auditChangedFields ? JSON.stringify(req.auditChangedFields) : null;
        }
        
        // Add error details if failed
        if (statusCode >= 400 && responseData) {
          auditEvent.error_code = responseData.error || responseData.code;
          auditEvent.error_message = responseData.message || responseData.error_message;
        }
        
        // Log the event
        await auditService.log(auditEvent);
        
      } catch (error) {
        console.error('Audit logging error:', error);
        // Don't break the request flow due to audit logging failure
      }
    });
    
    next();
  };
}

/**
 * Infer event type from request path and method
 */
function inferEventType(path, method) {
  if (path.includes('/auth') || path.includes('/login') || path.includes('/logout')) {
    return 'authentication';
  }
  if (path.includes('/users') || path.includes('/roles')) {
    return method === 'GET' ? 'data_access' : 'data_modification';
  }
  if (path.includes('/admin')) {
    return 'configuration';
  }
  if (path.includes('/audit')) {
    return 'compliance';
  }
  return 'http_request';
}

/**
 * Infer event category from request path
 */
function inferEventCategory(path) {
  if (path.includes('/auth')) return 'authentication';
  if (path.includes('/users')) return 'user_management';
  if (path.includes('/admin')) return 'administration';
  if (path.includes('/api')) return 'api';
  return 'general';
}

/**
 * Infer event severity from status code
 */
function inferEventSeverity(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warning';
  if (statusCode >= 300) return 'info';
  return 'info';
}

/**
 * Infer target type from request path
 */
function inferTargetType(path) {
  if (path.includes('/users')) return 'user';
  if (path.includes('/roles')) return 'role';
  if (path.includes('/sessions')) return 'session';
  if (path.includes('/audit')) return 'audit_log';
  return 'resource';
}

/**
 * Extract target ID from request
 */
function extractTargetId(req) {
  return req.params?.id || 
         req.params?.userId || 
         req.params?.roleId || 
         req.body?.id || 
         req.body?.user_id || 
         null;
}

/**
 * Extract error reason from response data
 */
function extractErrorReason(responseData) {
  if (!responseData) return null;
  if (typeof responseData === 'string') return responseData;
  return responseData.message || responseData.error || responseData.reason || null;
}

/**
 * Generate event description based on request
 */
function generateEventDescription(req, statusCode) {
  const action = req.method;
  const resource = req.path.split('/').filter(p => p && !p.startsWith(':')).pop() || 'resource';
  const result = statusCode < 400 ? 'successful' : 'failed';
  return `${action} request to ${resource} ${result}`;
}

/**
 * Extract sensitive field indicators from request body
 */
function extractSensitiveFields(body) {
  if (!body || typeof body !== 'object') return [];
  
  const sensitivePatterns = [
    'password', 'secret', 'token', 'key', 'ssn', 'social_security',
    'credit_card', 'bank_account', 'pin', 'cvv', 'api_key'
  ];
  
  const fields = [];
  for (const key of Object.keys(body)) {
    const lowerKey = key.toLowerCase();
    if (sensitivePatterns.some(pattern => lowerKey.includes(pattern))) {
      fields.push(key);
    }
  }
  
  return fields;
}

/**
 * Detect if request/response contains personal data
 */
function detectPersonalData(requestBody, responseData) {
  const personalPatterns = [
    'email', 'phone', 'address', 'first_name', 'last_name',
    'date_of_birth', 'dob', 'ssn', 'social_security'
  ];
  
  const checkObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    const keys = Object.keys(obj);
    return keys.some(key => {
      const lowerKey = key.toLowerCase();
      return personalPatterns.some(pattern => lowerKey.includes(pattern));
    });
  };
  
  return checkObject(requestBody) || checkObject(responseData);
}

/**
 * Calculate risk score based on request characteristics
 */
function calculateRiskScore(req, statusCode, responseTime) {
  let score = 0;
  
  // Failed requests
  if (statusCode >= 400) score += 20;
  if (statusCode >= 500) score += 10;
  
  // Authentication-related
  if (req.path.includes('/auth') || req.path.includes('/login')) score += 10;
  if (req.path.includes('/password')) score += 15;
  
  // Admin operations
  if (req.path.includes('/admin')) score += 20;
  if (req.user?.roles?.includes('site_admin')) score += 10;
  
  // Data modification
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) score += 10;
  if (req.method === 'DELETE') score += 10;
  
  // Slow responses (potential DoS)
  if (responseTime > 5000) score += 10;
  if (responseTime > 10000) score += 10;
  
  // Anonymous access
  if (!req.user) score += 5;
  
  // Unusual patterns
  if (req.path.includes('..') || req.path.includes('//')) score += 30;
  
  return Math.min(score, 100);
}

/**
 * Middleware to track data changes for audit
 */
function trackDataChanges() {
  return (req, res, next) => {
    // Store original data retrieval functions
    req.auditSetOldValues = (values) => {
      req.auditOldValues = values;
    };
    
    req.auditSetNewValues = (values) => {
      req.auditNewValues = values;
    };
    
    req.auditSetChangedFields = (fields) => {
      req.auditChangedFields = fields;
    };
    
    next();
  };
}

/**
 * Middleware to audit specific actions
 */
const auditActions = {
  login: auditLog('User Login', { eventType: 'authentication' }),
  logout: auditLog('User Logout', { eventType: 'authentication' }),
  register: auditLog('User Registration', { eventType: 'data_modification' }),
  passwordChange: auditLog('Password Change', { eventType: 'authentication', eventCategory: 'security' }),
  roleChange: auditLog('Role Change', { eventType: 'authorization', eventCategory: 'security' }),
  userDelete: auditLog('User Deletion', { eventType: 'data_modification', eventCategory: 'user_management' }),
  adminAction: auditLog('Admin Action', { eventType: 'configuration', eventCategory: 'administration' })
};

module.exports = {
  auditLog,
  trackDataChanges,
  auditActions,
  extractSensitiveFields,
  detectPersonalData,
  calculateRiskScore
};