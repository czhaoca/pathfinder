# Rate Limiting Documentation

## Overview

Pathfinder API implements comprehensive rate limiting to ensure fair usage, prevent abuse, and maintain system stability. This document describes rate limits, headers, and best practices for handling rate limiting.

## Rate Limit Tiers

### Endpoint-Specific Limits

| Endpoint Category | Requests | Window | Notes |
|-------------------|----------|---------|-------|
| **Authentication** |
| `/auth/login` | 5 | 15 min | Only failed attempts count |
| `/auth/register` | 5 | 15 min | Per IP address |
| `/auth/refresh` | 20 | 15 min | Per user |
| `/auth/password/*` | 3 | 15 min | Password operations |
| **General API** |
| GET endpoints | 100 | 15 min | Read operations |
| POST endpoints | 50 | 15 min | Create operations |
| PUT endpoints | 50 | 15 min | Update operations |
| DELETE endpoints | 20 | 15 min | Delete operations |
| **Heavy Operations** |
| `/resume/generate` | 5 | 60 min | Resource intensive |
| `/cpa-pert/batch/*` | 10 | 60 min | Batch processing |
| `/analytics/*` | 30 | 15 min | Data aggregation |
| **Admin Operations** |
| `/admin/*` | 200 | 15 min | Higher limits for admins |
| `/admin/audit-logs` | 50 | 15 min | Audit log queries |

### User Role Multipliers

| Role | Multiplier | Example (Base: 100) |
|------|------------|---------------------|
| user | 1.0x | 100 requests |
| admin | 2.0x | 200 requests |
| site_admin | 5.0x | 500 requests |
| api_key | 10.0x | 1000 requests |

## Rate Limit Headers

### Response Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 2024-03-01T12:30:00Z
X-RateLimit-Policy: 100;w=900
```

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed | `100` |
| `X-RateLimit-Remaining` | Requests remaining | `75` |
| `X-RateLimit-Reset` | Time when limit resets | `2024-03-01T12:30:00Z` |
| `X-RateLimit-Policy` | Policy details | `100;w=900` (100 req/15min) |

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 300
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-03-01T12:30:00Z

{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "details": {
    "retry_after": 300,
    "reset_at": "2024-03-01T12:30:00Z"
  }
}
```

## Implementation Strategies

### Client-Side Rate Limit Handling

```javascript
class RateLimitManager {
  constructor() {
    this.limits = new Map();
    this.queue = [];
    this.processing = false;
  }
  
  async request(url, options = {}) {
    // Check if rate limited
    if (this.isRateLimited(url)) {
      return this.queueRequest(url, options);
    }
    
    try {
      const response = await fetch(url, options);
      
      // Update rate limit info
      this.updateLimits(url, {
        limit: parseInt(response.headers.get('X-RateLimit-Limit')),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining')),
        reset: new Date(response.headers.get('X-RateLimit-Reset'))
      });
      
      // Handle rate limit exceeded
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After')) * 1000;
        return this.retryAfter(url, options, retryAfter);
      }
      
      return response;
      
    } catch (error) {
      throw error;
    }
  }
  
  isRateLimited(url) {
    const limit = this.limits.get(url);
    return limit && limit.remaining === 0 && limit.reset > new Date();
  }
  
  updateLimits(url, limitInfo) {
    this.limits.set(url, limitInfo);
  }
  
  async queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { url, options, resolve, reject } = this.queue[0];
      
      if (this.isRateLimited(url)) {
        // Wait until reset
        const limit = this.limits.get(url);
        const waitTime = limit.reset - new Date();
        await new Promise(r => setTimeout(r, waitTime));
      }
      
      try {
        const response = await this.request(url, options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      this.queue.shift();
      
      // Add small delay between requests
      await new Promise(r => setTimeout(r, 100));
    }
    
    this.processing = false;
  }
  
  async retryAfter(url, options, delay) {
    console.log(`Rate limited. Retrying after ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.request(url, options);
  }
}
```

### Request Throttling

```javascript
class RequestThrottler {
  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  async throttle() {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );
    
    // Check if at limit
    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.throttle(); // Recursive check
      }
    }
    
    // Add current request
    this.requests.push(now);
  }
  
  async makeRequest(fn) {
    await this.throttle();
    return fn();
  }
}

// Usage
const throttler = new RequestThrottler(10, 1000); // 10 req/sec

async function fetchData() {
  return throttler.makeRequest(async () => {
    return fetch('/api/data');
  });
}
```

### Exponential Backoff

```javascript
class ExponentialBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.factor = options.factor || 2;
    this.jitter = options.jitter || true;
  }
  
  async execute(fn) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (except 429)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          console.log(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await this.wait(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  calculateDelay(attempt) {
    let delay = Math.min(
      this.baseDelay * Math.pow(this.factor, attempt),
      this.maxDelay
    );
    
    if (this.jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.floor(delay);
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const backoff = new ExponentialBackoff({
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000
});

async function reliableRequest() {
  return backoff.execute(async () => {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw { status: response.status };
    }
    return response.json();
  });
}
```

## Best Practices

### 1. Implement Client-Side Throttling

```javascript
// Prevent overwhelming the API
const DELAY_BETWEEN_REQUESTS = 100; // ms
let lastRequestTime = 0;

async function throttledRequest(url, options) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < DELAY_BETWEEN_REQUESTS) {
    await new Promise(resolve => 
      setTimeout(resolve, DELAY_BETWEEN_REQUESTS - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
}
```

### 2. Batch Operations

```javascript
// Instead of multiple individual requests
async function inefficient(ids) {
  const results = [];
  for (const id of ids) {
    const result = await fetch(`/api/items/${id}`);
    results.push(await result.json());
  }
  return results;
}

// Use batch endpoints
async function efficient(ids) {
  const response = await fetch('/api/items/batch', {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
  return response.json();
}
```

### 3. Cache Responses

```javascript
class ResponseCache {
  constructor(ttl = 60000) { // 1 minute default
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  getCacheKey(url, options = {}) {
    return `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || {})}`;
  }
  
  async fetch(url, options = {}) {
    const key = this.getCacheKey(url, options);
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      console.log('Cache hit:', key);
      return cached.data;
    }
    
    // Fetch fresh data
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Cache successful responses
    if (response.ok) {
      this.cache.set(key, {
        data,
        expires: Date.now() + this.ttl
      });
    }
    
    return data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  invalidate(pattern) {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 4. Queue Management

```javascript
class RequestQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const { fn, resolve, reject } = this.queue.shift();
    
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process(); // Process next item
    }
  }
}

// Usage
const queue = new RequestQueue(3); // Max 3 concurrent

async function fetchAllData(urls) {
  const promises = urls.map(url => 
    queue.add(() => fetch(url).then(r => r.json()))
  );
  
  return Promise.all(promises);
}
```

## Monitoring Rate Limits

### Rate Limit Dashboard

```javascript
class RateLimitMonitor {
  constructor() {
    this.endpoints = new Map();
  }
  
  track(endpoint, headers) {
    const limit = parseInt(headers.get('X-RateLimit-Limit'));
    const remaining = parseInt(headers.get('X-RateLimit-Remaining'));
    const reset = new Date(headers.get('X-RateLimit-Reset'));
    
    this.endpoints.set(endpoint, {
      limit,
      remaining,
      reset,
      usage: ((limit - remaining) / limit * 100).toFixed(1),
      lastUpdated: new Date()
    });
  }
  
  getStatus() {
    const status = [];
    
    for (const [endpoint, info] of this.endpoints) {
      status.push({
        endpoint,
        ...info,
        critical: info.usage > 80,
        warning: info.usage > 60
      });
    }
    
    return status.sort((a, b) => b.usage - a.usage);
  }
  
  getCriticalEndpoints() {
    return this.getStatus().filter(s => s.critical);
  }
  
  displayStatus() {
    console.table(this.getStatus());
  }
}

// Usage
const monitor = new RateLimitMonitor();

// Track after each request
fetch('/api/users').then(response => {
  monitor.track('/api/users', response.headers);
  monitor.displayStatus();
});
```

## Configuration

### Server-Side Configuration

```javascript
// Rate limit configuration
const rateLimitConfig = {
  // Global limits
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  
  // Endpoint-specific limits
  endpoints: {
    '/auth/login': {
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true
    },
    '/auth/register': {
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip // Per IP
    },
    '/resume/generate': {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5
    }
  },
  
  // Role-based multipliers
  roleMultipliers: {
    user: 1.0,
    admin: 2.0,
    site_admin: 5.0
  }
};
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Constant 429 errors | Exceeding rate limits | Implement throttling and caching |
| Sporadic 429 errors | Burst traffic | Use request queuing |
| Rate limits not resetting | Clock synchronization | Check system time |
| Different limits than expected | Role not recognized | Verify authentication |

### Debug Headers

Enable debug mode to get additional information:

```http
X-RateLimit-Debug: true
X-RateLimit-User: user_123
X-RateLimit-Role: admin
X-RateLimit-Multiplier: 2.0
X-RateLimit-Window: 900000
```

## Related Documentation

- [API Reference](./openapi.yaml)
- [Error Codes](./error-codes.md)
- [Client Examples](./client-examples.md)
- [Authentication Flow](./authentication-flow.md)