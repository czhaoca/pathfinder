const crypto = require('crypto');
const { UnauthorizedError } = require('../../utils/errors');

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for state-changing operations
 */
class CSRFMiddleware {
  constructor() {
    this.tokenStore = new Map(); // In production, use Redis or database
    this.tokenExpiry = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Generate a new CSRF token for a session
   */
  generateToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + this.tokenExpiry;
    
    this.tokenStore.set(`${sessionId}:${token}`, expiry);
    
    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();
    
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(sessionId, token) {
    if (!token) return false;
    
    const key = `${sessionId}:${token}`;
    const expiry = this.tokenStore.get(key);
    
    if (!expiry) return false;
    
    if (Date.now() > expiry) {
      this.tokenStore.delete(key);
      return false;
    }
    
    // Token is valid, delete it (single use)
    this.tokenStore.delete(key);
    return true;
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [key, expiry] of this.tokenStore.entries()) {
      if (expiry < now) {
        this.tokenStore.delete(key);
      }
    }
  }

  /**
   * Middleware function to check CSRF token
   */
  protect() {
    return (req, res, next) => {
      // Skip CSRF check for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip for public endpoints
      if (req.path.includes('/api/invitations/validate') || 
          req.path.includes('/api/invitations/accept')) {
        return next();
      }

      // Get session ID from authenticated user
      const sessionId = req.user?.sessionId;
      if (!sessionId) {
        return next(new UnauthorizedError('No session found'));
      }

      // Get CSRF token from header or body
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      
      if (!this.validateToken(sessionId, token)) {
        return next(new UnauthorizedError('Invalid or missing CSRF token'));
      }

      next();
    };
  }

  /**
   * Endpoint to get a new CSRF token
   */
  getTokenEndpoint() {
    return (req, res) => {
      const sessionId = req.user?.sessionId;
      if (!sessionId) {
        return res.status(401).json({ error: 'No session found' });
      }

      const token = this.generateToken(sessionId);
      res.json({ csrfToken: token });
    };
  }
}

module.exports = new CSRFMiddleware();