# Feature Flag Management System

## Overview

The Pathfinder platform includes a comprehensive feature flag management system that enables controlled feature rollouts, A/B testing, and instant feature toggling without code deployments. The system is designed for ultra-fast performance (<5ms evaluation) and includes special handling for critical security features like self-registration with DDoS protection.

## Key Features

### Core Capabilities
- **Real-time flag evaluation** with <5ms latency
- **Multi-level targeting** (system-wide, group, user)
- **Percentage-based rollouts** for gradual feature releases
- **Emergency kill switches** for instant feature disabling
- **Comprehensive audit logging** of all flag changes
- **Redis caching** for high-performance evaluation
- **Real-time updates** without server restart

### Self-Registration Control
- **DDoS protection** with configurable rate limiting
- **CAPTCHA integration** for suspicious activity
- **IP blocking** for repeated violations
- **Suspicion scoring** with ML-based detection
- **Emergency shutdown** capabilities
- **Real-time metrics** dashboard

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Flag Manager │  │ Self-Reg     │  │ Metrics      │      │
│  │              │  │ Control      │  │ Dashboard    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Flag CRUD    │  │ Evaluation   │  │ Emergency    │      │
│  │ Endpoints    │  │ Endpoints    │  │ Controls     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Enhanced Feature Flag Service                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ In-Memory    │  │ Redis Cache  │  │ DDoS         │      │
│  │ Cache        │  │ Layer        │  │ Protection   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Feature      │  │ History      │  │ Protection   │      │
│  │ Flags        │  │ Tracking     │  │ Events       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Performance Optimization

1. **Three-tier caching strategy**:
   - In-memory cache (< 1ms)
   - Redis cache (< 5ms)
   - Database fallback

2. **Lazy loading and preloading**:
   - Critical flags preloaded on startup
   - Non-critical flags loaded on demand

3. **Pub/Sub for real-time updates**:
   - Instant propagation across instances
   - No polling required

## Usage Guide

### Backend Usage

#### 1. Basic Flag Evaluation

```javascript
// In your service or controller
const { EnhancedFeatureFlagService } = require('./services/enhancedFeatureFlagService');

// Evaluate a single flag
const result = await flagService.evaluateFlag('new_feature', {
  userId: req.user.id,
  groupId: req.user.groupId,
  // Additional context
});

if (result.value) {
  // Feature is enabled
  return newFeatureLogic();
} else {
  // Feature is disabled
  return oldFeatureLogic();
}
```

#### 2. Using Middleware

```javascript
// In your Express app
const { featureFlagMiddleware } = require('./services/enhancedFeatureFlagService');

app.use(featureFlagMiddleware(flagService));

// In your routes
router.get('/api/endpoint', async (req, res) => {
  // Flags are automatically evaluated and attached to request
  if (req.flags.new_feature) {
    // Feature is enabled for this user
  }
  
  // Or use the helper function
  if (await req.hasFeature('experimental_feature')) {
    // Feature is enabled
  }
});
```

#### 3. Self-Registration Protection

```javascript
// In registration endpoint
router.post('/api/register', async (req, res) => {
  try {
    // Check registration protection
    const protection = await flagService.checkRegistrationProtection(
      req.ip,
      req.body.fingerprint,
      req.headers
    );
    
    if (protection.requireCaptcha) {
      // Validate CAPTCHA
      if (!validateCaptcha(req.body.captcha)) {
        return res.status(400).json({ error: 'Invalid CAPTCHA' });
      }
    }
    
    // Proceed with registration
    const user = await createUser(req.body);
    
    res.json({ 
      success: true, 
      user,
      remainingAttempts: protection.remainingAttempts 
    });
    
  } catch (error) {
    // Handle blocking or other errors
    res.status(429).json({ error: error.message });
  }
});
```

### Frontend Usage

#### 1. React Hook

```typescript
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

function MyComponent() {
  const { flags, evaluateFlags } = useFeatureFlags();
  
  // Check if a feature is enabled
  const isNewUIEnabled = flags.find(f => f.flag_key === 'new_ui')?.enabled === 'Y';
  
  // Evaluate flags for current user
  useEffect(() => {
    evaluateFlags(['feature1', 'feature2']).then(results => {
      // Handle results
    });
  }, []);
  
  return (
    <div>
      {isNewUIEnabled ? <NewUI /> : <OldUI />}
    </div>
  );
}
```

#### 2. Service Direct Usage

```typescript
import { featureFlagService } from '@/services/featureFlagService';

// Check if feature is enabled
const isEnabled = await featureFlagService.isFeatureEnabled('my_feature');

if (isEnabled) {
  // Show feature
}
```

### Admin Management

#### 1. Creating Flags

```typescript
// Via API
await featureFlagService.createFlag({
  flag_key: 'new_feature',
  flag_name: 'New Feature',
  description: 'Experimental new feature',
  flag_type: 'boolean',
  default_value: 'false',
  category: 'experimental',
  rollout_percentage: 10 // Start with 10% rollout
});
```

#### 2. Emergency Controls

```typescript
// Emergency disable
await featureFlagService.emergencyDisable(
  'problematic_feature',
  'High error rate detected'
);

// Toggle self-registration
await featureFlagService.toggleSelfRegistration(
  false,
  'DDoS attack detected'
);
```

## Critical System Flags

### Pre-configured Flags

| Flag Key | Description | Default | Category |
|----------|-------------|---------|----------|
| `self_registration_enabled` | Allow new user registration | false | security |
| `sso_google_enabled` | Enable Google SSO | false | authentication |
| `sso_microsoft_enabled` | Enable Microsoft SSO | false | authentication |
| `rate_limiting_enabled` | Global rate limiting | true | security |
| `maintenance_mode` | System maintenance mode | false | system |

### Self-Registration Protection Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Rate Limit | 5 attempts | Max attempts per window |
| Time Window | 15 minutes | Rate limit window |
| Block Duration | 60 minutes | How long to block IPs |
| CAPTCHA Threshold | 3 attempts | When to show CAPTCHA |
| Suspicion Threshold | 0.8 | Score for extra verification |

## Best Practices

### 1. Flag Naming Convention

```
feature_category_name
```

Examples:
- `auth_sso_google`
- `ui_dark_mode`
- `api_rate_limit_strict`

### 2. Rollout Strategy

1. **Start small**: Begin with 1-5% rollout
2. **Monitor metrics**: Watch error rates and performance
3. **Gradual increase**: Increase by 10-25% increments
4. **Full rollout**: Once stable, roll out to 100%

### 3. Emergency Procedures

1. **Identify issue**: Monitor alerts and metrics
2. **Emergency disable**: Use emergency kill switch
3. **Investigate**: Review logs and metrics
4. **Fix and test**: Resolve issue in dev/staging
5. **Gradual re-enable**: Start with small percentage

### 4. Performance Guidelines

- **Cache appropriately**: Set TTL based on flag volatility
- **Minimize context**: Only pass necessary evaluation context
- **Batch evaluations**: Evaluate multiple flags together
- **Use middleware**: Leverage request-level caching

## Monitoring and Metrics

### Key Metrics to Track

1. **Evaluation Performance**
   - Average evaluation time (target: <5ms)
   - Cache hit rate (target: >90%)
   - Total evaluations per second

2. **Self-Registration**
   - Registration attempts
   - Success rate
   - Block rate
   - Suspicious IP count
   - CAPTCHA solve rate

3. **System Health**
   - Flag update frequency
   - Error rates
   - Circuit breaker trips

### Dashboard Views

The admin dashboard provides:
- Real-time flag status
- Evaluation metrics
- Self-registration control panel
- Emergency controls
- Historical analytics

## Security Considerations

### Access Control

- Only admins can create/modify flags
- Audit logging for all changes
- Role-based flag visibility
- Encrypted sensitive flag values

### DDoS Protection

- Rate limiting per IP
- CAPTCHA challenges
- Browser fingerprinting
- Suspicious pattern detection
- Automatic IP blocking

### Emergency Response

- One-click emergency disable
- Automatic alerting
- Audit trail for compliance
- Rollback capabilities

## API Reference

### Endpoints

#### Flag Management
- `GET /api/feature-flags` - List all flags
- `POST /api/feature-flags` - Create flag
- `PUT /api/feature-flags/:key` - Update flag
- `DELETE /api/feature-flags/:key` - Archive flag

#### Evaluation
- `POST /api/feature-flags/evaluate` - Evaluate flags

#### Self-Registration
- `POST /api/feature-flags/self-registration/toggle` - Toggle registration
- `GET /api/feature-flags/self-registration/metrics` - Get metrics
- `POST /api/feature-flags/self-registration/protection` - Update protection

#### Emergency
- `POST /api/feature-flags/:key/emergency-disable` - Emergency disable
- `POST /api/feature-flags/:key/rollback` - Rollback changes

## Troubleshooting

### Common Issues

1. **Slow evaluation**
   - Check Redis connection
   - Verify cache configuration
   - Review flag complexity

2. **Registration blocked**
   - Check IP block list
   - Review rate limit settings
   - Verify CAPTCHA service

3. **Flags not updating**
   - Check pub/sub connection
   - Verify cache invalidation
   - Review error logs

### Debug Mode

Enable debug logging:
```javascript
process.env.FLAG_DEBUG = 'true';
```

View metrics:
```javascript
const metrics = flagService.getMetrics();
console.log(metrics);
```

## Migration Guide

### From Basic to Enhanced System

1. **Database migration**: Tables already created in issue #21
2. **Service upgrade**: Replace `FeatureFlagService` with `EnhancedFeatureFlagService`
3. **Add Redis**: Configure Redis connection
4. **Update middleware**: Use new `featureFlagMiddleware`
5. **Test thoroughly**: Verify all flags work as expected

## Support

For issues or questions:
1. Check the troubleshooting guide
2. Review system logs
3. Contact the platform team
4. Create a GitHub issue

## Changelog

### Version 1.0.0 (Issue #24)
- Initial implementation
- Self-registration with DDoS protection
- <5ms evaluation performance
- Emergency controls
- Admin dashboard
- Comprehensive testing suite