# Webhook Documentation

## Overview

Pathfinder's webhook system allows you to receive real-time notifications when events occur in your account. This enables you to build automated workflows and integrations with external systems.

## Webhook Events

### Available Events

| Event Type | Description | Payload |
|------------|-------------|---------|
| **User Events** |
| `user.created` | New user registered | User object |
| `user.updated` | User profile updated | User object with changes |
| `user.deleted` | User account deleted | User ID and metadata |
| `user.suspended` | User account suspended | User object with reason |
| `user.activated` | User account activated | User object |
| **Authentication Events** |
| `auth.login` | User logged in | Session details |
| `auth.logout` | User logged out | Session ID |
| `auth.password_changed` | Password changed | User ID |
| `auth.mfa_enabled` | MFA enabled | User ID |
| `auth.failed_attempts` | Multiple failed login attempts | User ID, count |
| **Experience Events** |
| `experience.created` | New experience added | Experience object |
| `experience.updated` | Experience modified | Experience object with changes |
| `experience.deleted` | Experience removed | Experience ID |
| `experience.analyzed` | CPA analysis completed | Analysis results |
| **Resume Events** |
| `resume.generated` | Resume created | Resume metadata |
| `resume.downloaded` | Resume downloaded | Resume ID, format |
| **Admin Events** |
| `admin.role_changed` | User role modified | User ID, old/new roles |
| `admin.approval_required` | Action needs approval | Approval request |
| `admin.audit_alert` | Security alert | Alert details |

## Webhook Configuration

### Creating a Webhook

```http
POST /api/webhooks
Authorization: Bearer {token}
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/pathfinder",
  "events": [
    "user.created",
    "user.updated",
    "experience.created"
  ],
  "active": true,
  "secret": "your-webhook-secret-key"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "webhook": {
      "id": "webhook_abc123",
      "url": "https://your-app.com/webhooks/pathfinder",
      "events": ["user.created", "user.updated", "experience.created"],
      "active": true,
      "created_at": "2024-03-01T10:00:00Z",
      "signing_key": "whsec_1234567890abcdef"
    }
  }
}
```

## Webhook Payload Format

### Standard Payload Structure

```json
{
  "id": "evt_1234567890",
  "type": "user.created",
  "api_version": "1.0",
  "created": 1709280000,
  "data": {
    // Event-specific data
  },
  "previous_attributes": {
    // For update events, previous values
  }
}
```

### Event Examples

#### User Created Event

```json
{
  "id": "evt_abc123",
  "type": "user.created",
  "api_version": "1.0",
  "created": 1709280000,
  "data": {
    "user": {
      "id": "user_123",
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "roles": ["user"],
      "created_at": "2024-03-01T10:00:00Z"
    }
  }
}
```

#### Experience Analyzed Event

```json
{
  "id": "evt_def456",
  "type": "experience.analyzed",
  "api_version": "1.0",
  "created": 1709280000,
  "data": {
    "experience_id": "exp_789",
    "analysis": {
      "competencies": [
        {
          "area": "Financial Reporting",
          "level": "Level 2",
          "score": 0.85
        }
      ],
      "recommendations": [
        "Add quantifiable achievements",
        "Include team size managed"
      ]
    }
  }
}
```

## Webhook Security

### Signature Verification

All webhooks include a signature header for verification:

```http
X-Pathfinder-Signature: sha256=1234567890abcdef...
```

#### Verifying Signatures (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const expectedSignature = `sha256=${computedSignature}`;
  
  // Use constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express middleware
app.post('/webhooks/pathfinder', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-pathfinder-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Process event
  switch (event.type) {
    case 'user.created':
      handleUserCreated(event.data);
      break;
    case 'experience.analyzed':
      handleExperienceAnalyzed(event.data);
      break;
    // ... handle other events
  }
  
  res.status(200).send('OK');
});
```

#### Verifying Signatures (Python)

```python
import hmac
import hashlib
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_SECRET = 'your-webhook-secret'

def verify_webhook_signature(payload, signature, secret):
    computed = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    expected = f"sha256={computed}"
    return hmac.compare_digest(signature, expected)

@app.route('/webhooks/pathfinder', methods=['POST'])
def handle_webhook():
    payload = request.get_data()
    signature = request.headers.get('X-Pathfinder-Signature')
    
    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        abort(401)
    
    event = request.json
    
    # Process event
    if event['type'] == 'user.created':
        handle_user_created(event['data'])
    elif event['type'] == 'experience.analyzed':
        handle_experience_analyzed(event['data'])
    
    return 'OK', 200
```

## Webhook Management

### List Webhooks

```http
GET /api/webhooks
Authorization: Bearer {token}
```

### Update Webhook

```http
PUT /api/webhooks/{webhook_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "events": ["user.created", "user.updated", "user.deleted"],
  "active": true
}
```

### Delete Webhook

```http
DELETE /api/webhooks/{webhook_id}
Authorization: Bearer {token}
```

### Test Webhook

```http
POST /api/webhooks/{webhook_id}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_type": "user.created"
}
```

## Webhook Implementation Examples

### Complete Webhook Handler (Node.js)

```javascript
class WebhookHandler {
  constructor(secret) {
    this.secret = secret;
    this.handlers = new Map();
  }
  
  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }
  
  async handle(payload, signature) {
    // Verify signature
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }
    
    const event = JSON.parse(payload);
    
    // Log event
    console.log(`Received webhook: ${event.type}`, event.id);
    
    // Get handlers for this event type
    const handlers = this.handlers.get(event.type) || [];
    
    // Execute handlers
    const results = await Promise.allSettled(
      handlers.map(handler => handler(event))
    );
    
    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('Some handlers failed:', failures);
    }
    
    return {
      processed: handlers.length,
      failed: failures.length
    };
  }
  
  verifySignature(payload, signature) {
    const computed = crypto
      .createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    const expected = `sha256=${computed}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}

// Usage
const webhookHandler = new WebhookHandler(process.env.WEBHOOK_SECRET);

// Register event handlers
webhookHandler.on('user.created', async (event) => {
  const user = event.data.user;
  
  // Send welcome email
  await sendWelcomeEmail(user.email, user.first_name);
  
  // Create user in CRM
  await createCRMContact({
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    source: 'pathfinder'
  });
  
  // Track in analytics
  analytics.track({
    event: 'User Signup',
    userId: user.id,
    properties: {
      username: user.username,
      roles: user.roles
    }
  });
});

webhookHandler.on('experience.analyzed', async (event) => {
  const { experience_id, analysis } = event.data;
  
  // Store analysis results
  await storeAnalysis(experience_id, analysis);
  
  // Notify user if significant findings
  if (analysis.competencies.some(c => c.score > 0.9)) {
    await notifyUserOfHighScore(experience_id);
  }
});

// Express endpoint
app.post('/webhooks/pathfinder', 
  express.raw({ type: 'application/json' }), 
  async (req, res) => {
    try {
      const result = await webhookHandler.handle(
        req.body,
        req.headers['x-pathfinder-signature']
      );
      
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  }
);
```

### Retry Logic

```javascript
class WebhookRetry {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }
  
  async process(event, handler) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await handler(event);
        return { success: true, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          console.log(`Retry ${attempt + 1} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    return { 
      success: false, 
      attempts: this.maxRetries, 
      error: lastError.message 
    };
  }
}
```

## Webhook Development & Testing

### Local Development with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start local server
node webhook-server.js

# Expose local port
ngrok http 3000

# Use ngrok URL for webhook configuration
# https://abc123.ngrok.io/webhooks/pathfinder
```

### Webhook Testing Tool

```javascript
// webhook-tester.js
const axios = require('axios');
const crypto = require('crypto');

class WebhookTester {
  constructor(webhookUrl, secret) {
    this.webhookUrl = webhookUrl;
    this.secret = secret;
  }
  
  async sendTestEvent(eventType, data = {}) {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: eventType,
      api_version: '1.0',
      created: Math.floor(Date.now() / 1000),
      data
    };
    
    const payload = JSON.stringify(event);
    const signature = this.generateSignature(payload);
    
    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Pathfinder-Signature': signature
        }
      });
      
      console.log('✅ Webhook test successful:', response.status);
      return response.data;
    } catch (error) {
      console.error('❌ Webhook test failed:', error.message);
      throw error;
    }
  }
  
  generateSignature(payload) {
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return `sha256=${signature}`;
  }
}

// Usage
const tester = new WebhookTester(
  'http://localhost:3000/webhooks/pathfinder',
  'test-secret'
);

// Send test events
tester.sendTestEvent('user.created', {
  user: {
    id: 'user_test',
    username: 'test_user',
    email: 'test@example.com'
  }
});
```

## Best Practices

### 1. Idempotency

```javascript
const processedEvents = new Set();

async function handleWebhook(event) {
  // Check if already processed
  if (processedEvents.has(event.id)) {
    console.log('Event already processed:', event.id);
    return { status: 'duplicate' };
  }
  
  // Process event
  await processEvent(event);
  
  // Mark as processed
  processedEvents.add(event.id);
  
  // Store in database for persistence
  await storeProcessedEvent(event.id);
  
  return { status: 'processed' };
}
```

### 2. Async Processing

```javascript
// Don't block webhook response
app.post('/webhooks/pathfinder', async (req, res) => {
  const event = req.body;
  
  // Acknowledge immediately
  res.status(200).send('OK');
  
  // Process asynchronously
  setImmediate(async () => {
    try {
      await processWebhookEvent(event);
    } catch (error) {
      console.error('Async webhook processing failed:', error);
      // Store for retry
      await queueForRetry(event);
    }
  });
});
```

### 3. Error Handling

```javascript
class WebhookErrorHandler {
  static async handle(event, error) {
    // Log error
    console.error('Webhook processing error:', {
      event_id: event.id,
      event_type: event.type,
      error: error.message,
      stack: error.stack
    });
    
    // Store failed event
    await this.storeFailedEvent(event, error);
    
    // Alert if critical
    if (this.isCritical(event.type)) {
      await this.sendAlert(event, error);
    }
    
    // Schedule retry
    await this.scheduleRetry(event);
  }
  
  static isCritical(eventType) {
    const criticalEvents = [
      'user.deleted',
      'auth.failed_attempts',
      'admin.audit_alert'
    ];
    return criticalEvents.includes(eventType);
  }
}
```

## Monitoring

### Webhook Metrics

```javascript
class WebhookMetrics {
  constructor() {
    this.metrics = {
      received: 0,
      processed: 0,
      failed: 0,
      byType: {},
      latency: []
    };
  }
  
  record(event, startTime, success) {
    this.metrics.received++;
    
    if (success) {
      this.metrics.processed++;
    } else {
      this.metrics.failed++;
    }
    
    // Track by type
    if (!this.metrics.byType[event.type]) {
      this.metrics.byType[event.type] = { received: 0, processed: 0 };
    }
    this.metrics.byType[event.type].received++;
    if (success) {
      this.metrics.byType[event.type].processed++;
    }
    
    // Track latency
    const latency = Date.now() - startTime;
    this.metrics.latency.push(latency);
    
    // Keep only last 100 latencies
    if (this.metrics.latency.length > 100) {
      this.metrics.latency.shift();
    }
  }
  
  getStats() {
    const avgLatency = this.metrics.latency.length > 0
      ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
      : 0;
    
    return {
      ...this.metrics,
      successRate: (this.metrics.processed / this.metrics.received * 100).toFixed(2) + '%',
      averageLatency: avgLatency.toFixed(2) + 'ms'
    };
  }
}
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhooks not received | Incorrect URL or firewall | Verify URL accessibility |
| Signature verification fails | Wrong secret or encoding | Check secret configuration |
| Duplicate events | Network retries | Implement idempotency |
| Events out of order | Async delivery | Use timestamps, not order |
| High latency | Slow processing | Use async processing |

## Related Documentation

- [API Reference](./openapi.yaml)
- [Authentication Flow](./authentication-flow.md)
- [Security Best Practices](./security-best-practices.md)
- [Client Examples](./client-examples.md)