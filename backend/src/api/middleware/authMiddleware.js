const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  authenticate() {
    return async (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      try {
        const decoded = jwt.verify(token, config.security.jwtSecret);
        
        // Check if session is still valid
        const session = await this.authService.validateSession(decoded.sessionId);
        if (!session) {
          return res.status(401).json({ error: 'Session expired' });
        }

        // Attach user info to request
        req.user = {
          userId: decoded.userId,
          username: decoded.username,
          sessionId: decoded.sessionId
        };

        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
          return res.status(403).json({ error: 'Invalid token' });
        }
        logger.error('Authentication error', { error: error.message });
        return res.status(500).json({ error: 'Authentication failed' });
      }
    };
  }

  authorize(roles = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // If no specific roles required, just check authentication
      if (roles.length === 0) {
        return next();
      }

      // Check if user has required role
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  rateLimitByUser(options = {}) {
    const requests = new Map();
    const { windowMs = 60000, max = 100 } = options;

    return (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const userId = req.user.userId;
      const now = Date.now();
      const userRequests = requests.get(userId) || [];

      // Remove old requests outside the window
      const recentRequests = userRequests.filter(
        timestamp => now - timestamp < windowMs
      );

      if (recentRequests.length >= max) {
        return res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      recentRequests.push(now);
      requests.set(userId, recentRequests);

      // Cleanup old entries periodically
      if (Math.random() < 0.01) {
        for (const [key, value] of requests.entries()) {
          const filtered = value.filter(timestamp => now - timestamp < windowMs);
          if (filtered.length === 0) {
            requests.delete(key);
          } else {
            requests.set(key, filtered);
          }
        }
      }

      next();
    };
  }
}

module.exports = AuthMiddleware;