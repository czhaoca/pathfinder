/**
 * Request Context Middleware
 * 
 * Captures and enriches request context for security analysis
 */

const logger = require('../../utils/logger');

/**
 * Capture request context for DDoS protection
 */
const captureRequestContext = (req, res, next) => {
  try {
    // Get real IP address (considering proxies)
    req.ipAddress = getClientIP(req);
    
    // Capture timing information
    req.requestTime = Date.now();
    
    // Capture additional context
    req.context = {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'] || 'Unknown',
      referer: req.headers['referer'],
      origin: req.headers['origin'],
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding'],
      dnt: req.headers['dnt'],
      contentType: req.headers['content-type'],
      timestamp: req.requestTime
    };

    // Log request for analysis
    logger.debug('Request context captured', {
      ip: req.ipAddress,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Failed to capture request context', { error: error.message });
    next(); // Continue even if context capture fails
  }
};

/**
 * Get client IP address considering various proxy headers
 */
const getClientIP = (req) => {
  // Check various headers in order of preference
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of headers) {
    const value = req.headers[header];
    if (value) {
      // Handle comma-separated list (X-Forwarded-For can have multiple IPs)
      const ips = value.split(',').map(ip => ip.trim());
      const clientIP = ips[0];
      
      // Validate IP format
      if (isValidIP(clientIP)) {
        return clientIP;
      }
    }
  }

  // Fall back to req.ip
  return req.ip || req.connection.remoteAddress || '0.0.0.0';
};

/**
 * Validate IP address format
 */
const isValidIP = (ip) => {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  if (ipv4Pattern.test(ip)) {
    // Check IPv4 octets are valid
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet);
      return num >= 0 && num <= 255;
    });
  }
  
  return ipv6Pattern.test(ip);
};

/**
 * Track request timing for behavioral analysis
 */
const trackTiming = (req, res, next) => {
  const startTime = Date.now();
  
  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Store timing data for pattern analysis
    if (req.ipAddress) {
      // This would be stored in Redis or similar for analysis
      logger.debug('Request timing', {
        ip: req.ipAddress,
        path: req.path,
        duration,
        status: res.statusCode
      });
    }
  });
  
  next();
};

/**
 * Detect automation tools and bots
 */
const detectAutomation = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const suspiciousPatterns = [
    /bot/i,
    /spider/i,
    /crawl/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
    /phantomjs/i,
    /headless/i,
    /automated/i,
    /scraper/i,
    /wget/i,
    /curl/i,
    /python-requests/i,
    /java/i,
    /ruby/i,
    /perl/i,
    /go-http-client/i
  ];

  req.isAutomated = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  // Check for missing standard headers that browsers typically send
  const missingHeaders = !req.headers['accept'] || 
                        !req.headers['accept-language'] ||
                        !req.headers['accept-encoding'];
  
  if (missingHeaders && req.method !== 'OPTIONS') {
    req.isAutomated = true;
  }

  // Check for headless browser indicators
  if (userAgent.toLowerCase().includes('headless')) {
    req.isHeadless = true;
    req.isAutomated = true;
  }

  if (req.isAutomated) {
    logger.warn('Automated request detected', {
      ip: req.ipAddress,
      userAgent,
      path: req.path
    });
  }

  next();
};

/**
 * Geo-location middleware (requires external service in production)
 */
const geoLocation = async (req, res, next) => {
  try {
    // In production, would use MaxMind GeoIP2 or similar
    // For now, set default values
    req.geoLocation = {
      country: 'US',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC'
    };
    
    // This would be an actual geo-location lookup
    // const geo = await geoIPService.lookup(req.ipAddress);
    // req.geoLocation = geo;
    
    next();
  } catch (error) {
    logger.error('Geo-location lookup failed', { error: error.message });
    next(); // Continue without geo data
  }
};

/**
 * Device fingerprinting helper
 */
const deviceFingerprint = (req, res, next) => {
  // Client should send fingerprint data
  const fingerprint = req.body?.fingerprint || req.headers['x-device-fingerprint'];
  
  if (fingerprint) {
    req.deviceFingerprint = fingerprint;
    
    // Validate fingerprint format
    if (!isValidFingerprint(fingerprint)) {
      req.deviceFingerprint = null;
      logger.warn('Invalid device fingerprint', {
        ip: req.ipAddress,
        fingerprint
      });
    }
  }
  
  next();
};

/**
 * Validate fingerprint format
 */
const isValidFingerprint = (fingerprint) => {
  // Should be a hash-like string
  return typeof fingerprint === 'string' && 
         fingerprint.length >= 10 && 
         fingerprint.length <= 255 &&
         /^[a-zA-Z0-9_-]+$/.test(fingerprint);
};

/**
 * Combined middleware for full context capture
 */
const fullContextCapture = [
  captureRequestContext,
  trackTiming,
  detectAutomation,
  geoLocation,
  deviceFingerprint
];

module.exports = {
  captureRequestContext,
  trackTiming,
  detectAutomation,
  geoLocation,
  deviceFingerprint,
  fullContextCapture,
  getClientIP
};