# Issue #27: User Analytics System with OCI Object Storage

## Title
Implement Comprehensive User Analytics with Hot/Cold Data Tiering Using OCI Object Storage

## User Story
As a platform administrator, I want to track and analyze user behavior with efficient data storage so that I can understand user engagement patterns while optimizing storage costs through intelligent data tiering.

## Description
Build a comprehensive analytics system that tracks user activities, aggregates metrics, and implements a tiered storage strategy using OCI Object Storage. The system will maintain 90 days of hot data in the database for quick access, move data to cold storage in OCI for 1 year, then archive for long-term retention. This enables detailed analytics while optimizing storage costs.

## Acceptance Criteria

### Data Collection
- [ ] Event tracking for all user actions
- [ ] Session tracking and analysis
- [ ] Page view and interaction metrics
- [ ] Feature usage tracking
- [ ] Error and performance monitoring
- [ ] Custom event support

### Data Pipeline
- [ ] Real-time event ingestion
- [ ] Batch aggregation jobs (hourly, daily, weekly)
- [ ] Data validation and cleaning
- [ ] Duplicate event detection
- [ ] Failed event retry mechanism
- [ ] Event schema versioning

### Storage Tiering
- [ ] 90-day hot storage in database
- [ ] Automatic migration to OCI cold storage
- [ ] 1-year cold storage retention
- [ ] Archive tier for long-term storage
- [ ] Seamless query across storage tiers
- [ ] Data retrieval from cold storage on demand

### Analytics Processing
- [ ] Real-time metrics calculation
- [ ] Cohort analysis support
- [ ] Funnel analysis capabilities
- [ ] User journey mapping
- [ ] Retention metrics calculation
- [ ] Custom metric definitions

## Technical Implementation

### Database Schema for Hot Storage

```sql
-- Event tracking table (partitioned by day)
CREATE TABLE pf_user_events (
  event_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(26) NOT NULL,
  session_id VARCHAR2(26) NOT NULL,
  event_type VARCHAR2(100) NOT NULL,
  event_category VARCHAR2(50),
  event_action VARCHAR2(100),
  event_label VARCHAR2(200),
  event_value NUMBER(10,2),
  
  -- Context data
  page_url VARCHAR2(500),
  referrer_url VARCHAR2(500),
  user_agent VARCHAR2(500),
  ip_address VARCHAR2(45),
  device_type VARCHAR2(50),
  browser VARCHAR2(50),
  os VARCHAR2(50),
  
  -- Custom properties
  properties CLOB CHECK (properties IS JSON),
  
  -- Timing
  event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_timestamp TIMESTAMP,
  
  INDEX idx_events_user_time (user_id, event_timestamp),
  INDEX idx_events_session (session_id),
  INDEX idx_events_type_time (event_type, event_timestamp)
) PARTITION BY RANGE (event_timestamp) 
  INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
  (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'));

-- Aggregated metrics (hot storage)
CREATE TABLE pf_user_metrics_daily (
  metric_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(26) NOT NULL,
  metric_date DATE NOT NULL,
  
  -- Activity metrics
  total_events NUMBER(10) DEFAULT 0,
  total_sessions NUMBER(10) DEFAULT 0,
  total_duration_seconds NUMBER(10) DEFAULT 0,
  page_views NUMBER(10) DEFAULT 0,
  unique_pages NUMBER(10) DEFAULT 0,
  
  -- Engagement metrics
  actions_performed CLOB CHECK (actions_performed IS JSON),
  features_used CLOB CHECK (features_used IS JSON),
  
  -- Performance metrics
  avg_page_load_time NUMBER(10,2),
  error_count NUMBER(10) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, metric_date),
  INDEX idx_metrics_date (metric_date),
  INDEX idx_metrics_user_date (user_id, metric_date)
) PARTITION BY RANGE (metric_date) 
  INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
  (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'));

-- Session tracking
CREATE TABLE pf_user_sessions_analytics (
  session_id VARCHAR2(26) PRIMARY KEY,
  user_id VARCHAR2(26) NOT NULL,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  duration_seconds NUMBER(10),
  page_count NUMBER(10) DEFAULT 0,
  event_count NUMBER(10) DEFAULT 0,
  
  -- Entry/Exit
  entry_page VARCHAR2(500),
  exit_page VARCHAR2(500),
  
  -- Device/Location
  device_info CLOB CHECK (device_info IS JSON),
  geo_location CLOB CHECK (geo_location IS JSON),
  
  -- Outcome
  conversion_events CLOB CHECK (conversion_events IS JSON),
  session_value NUMBER(10,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_start (session_start)
);

-- Storage tier metadata
CREATE TABLE pf_analytics_storage_tiers (
  tier_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  tier_name VARCHAR2(50) NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  storage_location VARCHAR2(500) NOT NULL,
  oci_bucket VARCHAR2(100),
  oci_namespace VARCHAR2(100),
  file_prefix VARCHAR2(200),
  compression_type VARCHAR2(20),
  encryption_enabled CHAR(1) DEFAULT 'Y',
  records_count NUMBER(15),
  size_bytes NUMBER(15),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP,
  INDEX idx_tier_dates (date_range_start, date_range_end)
);
```

### Analytics Service Implementation

```javascript
// backend/src/services/analyticsService.js
const ociObjectStorage = require('oci-objectstorage');

class AnalyticsService {
  constructor(analyticsRepository, ociConfig, cacheService) {
    this.analyticsRepository = analyticsRepository;
    this.cacheService = cacheService;
    this.eventQueue = [];
    this.flushInterval = 5000; // 5 seconds
    
    // OCI Object Storage client
    this.objectStorageClient = new ociObjectStorage.ObjectStorageClient({
      authenticationDetailsProvider: ociConfig.provider
    });
    
    this.namespace = ociConfig.namespace;
    this.buckets = {
      hot: ociConfig.hotBucket,     // Recent data (optional)
      cold: ociConfig.coldBucket,   // 90 days to 1 year
      archive: ociConfig.archiveBucket // > 1 year
    };
    
    this.startEventProcessor();
    this.scheduleAggregationJobs();
    this.scheduleTieringJobs();
  }

  // Event tracking
  async trackEvent(eventData) {
    const event = {
      eventId: ulid(),
      ...eventData,
      eventTimestamp: new Date(),
      properties: JSON.stringify(eventData.properties || {})
    };

    // Add to queue for batch processing
    this.eventQueue.push(event);

    // Real-time processing for critical events
    if (this.isCriticalEvent(event.eventType)) {
      await this.processEventRealtime(event);
    }

    return { eventId: event.eventId };
  }

  async processEventBatch() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Batch insert to database
      await this.analyticsRepository.insertEvents(events);

      // Update real-time metrics
      await this.updateRealtimeMetrics(events);

      // Update session data
      await this.updateSessions(events);

      // Cache invalidation
      const userIds = [...new Set(events.map(e => e.userId))];
      for (const userId of userIds) {
        await this.cacheService.invalidate(`analytics:${userId}:*`);
      }
    } catch (error) {
      logger.error('Failed to process event batch', { error, count: events.length });
      // Re-queue failed events
      this.eventQueue.unshift(...events);
    }
  }

  // Data aggregation
  async aggregateDailyMetrics(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all events for the day
    const events = await this.analyticsRepository.getEventsByDateRange(
      startOfDay,
      endOfDay
    );

    // Group by user
    const userMetrics = new Map();

    for (const event of events) {
      if (!userMetrics.has(event.userId)) {
        userMetrics.set(event.userId, {
          userId: event.userId,
          metricDate: startOfDay,
          totalEvents: 0,
          totalSessions: new Set(),
          pageViews: 0,
          uniquePages: new Set(),
          actionsPerformed: {},
          featuresUsed: new Set(),
          errorCount: 0
        });
      }

      const metrics = userMetrics.get(event.userId);
      metrics.totalEvents++;
      metrics.totalSessions.add(event.sessionId);

      if (event.eventType === 'page_view') {
        metrics.pageViews++;
        metrics.uniquePages.add(event.pageUrl);
      }

      if (event.eventType === 'error') {
        metrics.errorCount++;
      }

      // Track actions
      if (event.eventAction) {
        metrics.actionsPerformed[event.eventAction] = 
          (metrics.actionsPerformed[event.eventAction] || 0) + 1;
      }

      // Track features
      if (event.eventCategory === 'feature_usage') {
        metrics.featuresUsed.add(event.eventLabel);
      }
    }

    // Save aggregated metrics
    for (const [userId, metrics] of userMetrics) {
      await this.analyticsRepository.saveUserMetrics({
        userId,
        metricDate: metrics.metricDate,
        totalEvents: metrics.totalEvents,
        totalSessions: metrics.totalSessions.size,
        pageViews: metrics.pageViews,
        uniquePages: metrics.uniquePages.size,
        actionsPerformed: JSON.stringify(metrics.actionsPerformed),
        featuresUsed: JSON.stringify(Array.from(metrics.featuresUsed)),
        errorCount: metrics.errorCount
      });
    }

    logger.info('Daily metrics aggregated', { 
      date: startOfDay, 
      users: userMetrics.size 
    });
  }

  // Storage tiering
  async migrateToOCIColdStorage() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

    try {
      // Get data to migrate
      const events = await this.analyticsRepository.getEventsOlderThan(cutoffDate);
      
      if (events.length === 0) {
        logger.info('No events to migrate to cold storage');
        return;
      }

      // Group by date for organized storage
      const eventsByDate = this.groupEventsByDate(events);

      for (const [date, dateEvents] of Object.entries(eventsByDate)) {
        // Compress data
        const compressedData = await this.compressData(dateEvents);

        // Upload to OCI Object Storage
        const objectName = `analytics/daily/${date}/events.json.gz`;
        await this.uploadToOCI(this.buckets.cold, objectName, compressedData);

        // Create metadata entry
        await this.analyticsRepository.createStorageTier({
          tierName: 'cold',
          dateRangeStart: new Date(date),
          dateRangeEnd: new Date(date),
          storageLocation: `oci://${this.buckets.cold}/${objectName}`,
          ociBucket: this.buckets.cold,
          ociNamespace: this.namespace,
          filePrefix: objectName,
          compressionType: 'gzip',
          recordsCount: dateEvents.length,
          sizeBytes: compressedData.length
        });

        // Delete from hot storage
        await this.analyticsRepository.deleteEventsByDate(new Date(date));

        logger.info('Migrated events to cold storage', {
          date,
          count: dateEvents.length,
          size: compressedData.length
        });
      }
    } catch (error) {
      logger.error('Failed to migrate to cold storage', { error });
      throw error;
    }
  }

  async migrateToOCIArchive() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 1 year ago

    try {
      // Get cold storage items to archive
      const coldItems = await this.analyticsRepository.getColdStorageOlderThan(cutoffDate);

      for (const item of coldItems) {
        // Move object from cold to archive bucket
        const sourceObjectName = item.filePrefix;
        const targetObjectName = sourceObjectName.replace('analytics/', 'archive/');

        // Copy to archive bucket
        await this.copyOCIObject(
          this.buckets.cold,
          sourceObjectName,
          this.buckets.archive,
          targetObjectName
        );

        // Update metadata
        await this.analyticsRepository.updateStorageTier(item.tierId, {
          tierName: 'archive',
          storageLocation: `oci://${this.buckets.archive}/${targetObjectName}`,
          ociBucket: this.buckets.archive,
          filePrefix: targetObjectName
        });

        // Delete from cold bucket
        await this.deleteOCIObject(this.buckets.cold, sourceObjectName);

        logger.info('Archived cold storage data', {
          date: item.dateRangeStart,
          size: item.sizeBytes
        });
      }
    } catch (error) {
      logger.error('Failed to migrate to archive', { error });
      throw error;
    }
  }

  // Query across tiers
  async queryAnalytics(userId, startDate, endDate) {
    const results = {
      hot: [],
      cold: [],
      archive: []
    };

    // Check hot storage (< 90 days)
    const hotCutoff = new Date();
    hotCutoff.setDate(hotCutoff.getDate() - 90);

    if (endDate > hotCutoff) {
      results.hot = await this.analyticsRepository.getUserEvents(
        userId,
        Math.max(startDate, hotCutoff),
        endDate
      );
    }

    // Check if we need cold storage (90 days - 1 year)
    const coldCutoff = new Date();
    coldCutoff.setFullYear(coldCutoff.getFullYear() - 1);

    if (startDate < hotCutoff && endDate > coldCutoff) {
      results.cold = await this.queryOCIColdStorage(
        userId,
        Math.max(startDate, coldCutoff),
        Math.min(endDate, hotCutoff)
      );
    }

    // Check if we need archive (> 1 year)
    if (startDate < coldCutoff) {
      results.archive = await this.queryOCIArchive(
        userId,
        startDate,
        Math.min(endDate, coldCutoff)
      );
    }

    // Combine and sort results
    const allEvents = [
      ...results.hot,
      ...results.cold,
      ...results.archive
    ].sort((a, b) => a.eventTimestamp - b.eventTimestamp);

    return allEvents;
  }

  async queryOCIColdStorage(userId, startDate, endDate) {
    const events = [];
    
    // Get storage tier metadata
    const tiers = await this.analyticsRepository.getStorageTiers(
      'cold',
      startDate,
      endDate
    );

    for (const tier of tiers) {
      try {
        // Download from OCI
        const data = await this.downloadFromOCI(
          tier.ociBucket,
          tier.filePrefix
        );

        // Decompress
        const decompressed = await this.decompressData(data);
        const tierEvents = JSON.parse(decompressed);

        // Filter by user
        const userEvents = tierEvents.filter(e => e.userId === userId);
        events.push(...userEvents);

        // Update last accessed
        await this.analyticsRepository.updateTierLastAccessed(tier.tierId);
      } catch (error) {
        logger.error('Failed to query cold storage', { error, tier: tier.tierId });
      }
    }

    return events;
  }

  // OCI Object Storage operations
  async uploadToOCI(bucket, objectName, data) {
    const putObjectRequest = {
      namespaceName: this.namespace,
      bucketName: bucket,
      objectName: objectName,
      putObjectBody: data,
      contentType: 'application/gzip'
    };

    const response = await this.objectStorageClient.putObject(putObjectRequest);
    return response.eTag;
  }

  async downloadFromOCI(bucket, objectName) {
    const getObjectRequest = {
      namespaceName: this.namespace,
      bucketName: bucket,
      objectName: objectName
    };

    const response = await this.objectStorageClient.getObject(getObjectRequest);
    return response.value;
  }

  async copyOCIObject(sourceBucket, sourceObject, targetBucket, targetObject) {
    const copyObjectRequest = {
      namespaceName: this.namespace,
      bucketName: targetBucket,
      copyObjectDetails: {
        sourceObjectName: sourceObject,
        destinationRegion: this.region,
        destinationNamespace: this.namespace,
        destinationBucket: sourceBucket,
        destinationObjectName: targetObject
      }
    };

    await this.objectStorageClient.copyObject(copyObjectRequest);
  }

  async deleteOCIObject(bucket, objectName) {
    const deleteObjectRequest = {
      namespaceName: this.namespace,
      bucketName: bucket,
      objectName: objectName
    };

    await this.objectStorageClient.deleteObject(deleteObjectRequest);
  }

  // Utility methods
  async compressData(data) {
    const jsonString = JSON.stringify(data);
    return await gzip(jsonString);
  }

  async decompressData(data) {
    return await gunzip(data);
  }

  groupEventsByDate(events) {
    const grouped = {};
    
    for (const event of events) {
      const date = event.eventTimestamp.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    }

    return grouped;
  }

  // Scheduled jobs
  scheduleAggregationJobs() {
    // Hourly aggregation
    setInterval(() => this.aggregateHourlyMetrics(), 60 * 60 * 1000);

    // Daily aggregation (at 2 AM)
    const dailyJob = schedule.scheduleJob('0 2 * * *', () => {
      this.aggregateDailyMetrics(new Date(Date.now() - 24 * 60 * 60 * 1000));
    });

    // Weekly aggregation (Sundays at 3 AM)
    const weeklyJob = schedule.scheduleJob('0 3 * * 0', () => {
      this.aggregateWeeklyMetrics();
    });
  }

  scheduleTieringJobs() {
    // Daily migration to cold storage (at 4 AM)
    const coldMigrationJob = schedule.scheduleJob('0 4 * * *', () => {
      this.migrateToOCIColdStorage();
    });

    // Monthly migration to archive (1st of month at 5 AM)
    const archiveJob = schedule.scheduleJob('0 5 1 * *', () => {
      this.migrateToOCIArchive();
    });
  }

  startEventProcessor() {
    setInterval(() => this.processEventBatch(), this.flushInterval);
  }
}
```

### Frontend Analytics Integration

```typescript
// frontend/src/services/analytics.ts
class AnalyticsTracker {
  private queue: AnalyticsEvent[] = [];
  private sessionId: string;
  private flushInterval = 5000;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startSession();
    this.setupEventListeners();
    this.startFlushTimer();
  }

  track(eventType: string, properties?: any) {
    const event: AnalyticsEvent = {
      eventType,
      properties,
      sessionId: this.sessionId,
      timestamp: new Date(),
      pageUrl: window.location.href,
      referrer: document.referrer
    };

    this.queue.push(event);

    // Immediate send for critical events
    if (this.isCriticalEvent(eventType)) {
      this.flush();
    }
  }

  trackPageView() {
    this.track('page_view', {
      title: document.title,
      path: window.location.pathname,
      queryParams: window.location.search
    });
  }

  trackFeatureUsage(feature: string, action?: string) {
    this.track('feature_usage', {
      feature,
      action,
      category: 'feature'
    });
  }

  trackError(error: Error, context?: any) {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      context,
      severity: 'error'
    });
  }

  trackTiming(category: string, variable: string, time: number) {
    this.track('timing', {
      category,
      variable,
      time,
      label: `${category}_${variable}`
    });
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      await api.post('/analytics/events', { events });
    } catch (error) {
      console.error('Failed to send analytics', error);
      // Re-queue events
      this.queue.unshift(...events);
    }
  }

  private setupEventListeners() {
    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flush();
    });

    // Clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.analytics) {
        this.track('click', {
          element: target.dataset.analytics,
          text: target.textContent
        });
      }
    });

    // Forms
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form.dataset.analytics) {
        this.track('form_submit', {
          formId: form.dataset.analytics,
          formName: form.name
        });
      }
    });
  }

  private startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startSession() {
    this.track('session_start', {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }

  private endSession() {
    this.track('session_end', {
      duration: this.getSessionDuration()
    });
  }

  private getSessionDuration(): number {
    // Calculate from session start
    return Date.now() - parseInt(this.sessionId.split('-')[0]);
  }

  private isCriticalEvent(eventType: string): boolean {
    return ['error', 'conversion', 'purchase', 'signup'].includes(eventType);
  }
}

// Initialize analytics
export const analytics = new AnalyticsTracker();

// React hook for analytics
export const useAnalytics = () => {
  const trackEvent = useCallback((eventType: string, properties?: any) => {
    analytics.track(eventType, properties);
  }, []);

  const trackFeature = useCallback((feature: string, action?: string) => {
    analytics.trackFeatureUsage(feature, action);
  }, []);

  useEffect(() => {
    analytics.trackPageView();
  }, []);

  return { trackEvent, trackFeature };
};
```

## Security Considerations

1. **Data Privacy**
   - PII anonymization options
   - User consent tracking
   - Data retention compliance
   - Right to deletion support

2. **Storage Security**
   - Encryption at rest in OCI
   - Encrypted data transfer
   - Access control for OCI buckets
   - Audit logging for data access

3. **Performance Security**
   - Rate limiting for event ingestion
   - Query throttling
   - Resource consumption limits
   - DDoS protection

## Testing Requirements

1. **Unit Tests**
   - Event tracking logic
   - Aggregation calculations
   - Storage tier decisions
   - OCI operations

2. **Integration Tests**
   - End-to-end event flow
   - Data migration pipelines
   - Cross-tier queries
   - Batch processing

3. **Performance Tests**
   - High-volume event ingestion
   - Query performance across tiers
   - Storage migration performance
   - Concurrent user tracking

## Documentation Updates

- Analytics implementation guide
- OCI Object Storage setup
- Data retention policies
- Query API documentation

## Dependencies

- Issue #21: Database Schema Optimization
- OCI Object Storage account and buckets
- Redis for event queuing
- Background job processor

## Estimated Effort

**Extra Large (XL)** - 10-12 days

### Justification:
- Complex data pipeline implementation
- OCI integration and testing
- Multiple storage tiers
- Aggregation logic
- Query optimization across tiers

## Priority

**Medium** - Important for platform insights but not blocking

## Labels

- `feature`
- `analytics`
- `storage`
- `oci`
- `data-pipeline`