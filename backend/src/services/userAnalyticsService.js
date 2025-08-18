const { ulid } = require('ulid');
const zlib = require('zlib');
const { promisify } = require('util');
const schedule = require('node-schedule');
const logger = require('../utils/logger');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * UserAnalyticsService - Comprehensive analytics with OCI Object Storage integration
 * 
 * Features:
 * - Real-time event tracking and processing
 * - Tiered storage with OCI Object Storage (hot/cold/archive)
 * - Automated data migration and lifecycle management
 * - Advanced analytics queries across storage tiers
 * - Performance optimization with caching and batching
 */
class UserAnalyticsService {
  constructor(analyticsRepository, ociConfig, cacheService) {
    this.analyticsRepository = analyticsRepository;
    this.cacheService = cacheService;
    this.eventQueue = [];
    this.processingLock = false; // Thread-safe queue operations
    this.flushInterval = 5000; // 5 seconds
    this.maxQueueSize = 10000;
    this.batchSize = 1000;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.maxEventPropertiesSize = 32768; // 32KB limit
    
    // OCI Object Storage configuration
    if (ociConfig && ociConfig.provider) {
      try {
        const ociObjectStorage = require('oci-objectstorage');
        
        this.objectStorageClient = new ociObjectStorage.ObjectStorageClient({
          authenticationDetailsProvider: ociConfig.provider
        });
        
        this.namespace = ociConfig.namespace;
        this.region = ociConfig.region || 'us-phoenix-1';
        this.buckets = {
          hot: ociConfig.hotBucket || 'analytics-hot',
          cold: ociConfig.coldBucket || 'analytics-cold',
          archive: ociConfig.archiveBucket || 'analytics-archive'
        };
        
        this.encryptionKeyId = ociConfig.kmsKeyId;
      } catch (error) {
        logger.warn('OCI Object Storage module not available or failed to load', { error: error.message });
        this.objectStorageClient = null;
      }
    }
    
    // Start background processors
    this.startEventProcessor();
    this.scheduleAggregationJobs();
    this.scheduleTieringJobs();
    
    // Session tracking with cleanup
    this.activeSessions = new Map();
    this.startSessionCleanup();
    
    // Real-time metrics
    this.realtimeMetrics = {
      activeUsers: new Set(),
      eventsPerMinute: [],
      errorRate: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Track an event
   */
  async trackEvent(eventData) {
    try {
      // Validate required fields
      if (!eventData.userId || !eventData.sessionId) {
        throw new Error('userId and sessionId are required');
      }

      // Validate and sanitize properties
      if (eventData.properties) {
        const propsString = typeof eventData.properties === 'object' ?
          JSON.stringify(eventData.properties) : eventData.properties;
        
        if (propsString.length > this.maxEventPropertiesSize) {
          throw new Error(`Event properties too large (max ${this.maxEventPropertiesSize / 1024}KB)`);
        }
        
        // Sanitize for security
        eventData.properties = this.sanitizeProperties(eventData.properties);
      }

      // Enrich event data
      const event = {
        eventId: ulid(),
        ...eventData,
        eventTimestamp: eventData.eventTimestamp || new Date(),
        receivedTimestamp: new Date(),
        properties: typeof eventData.properties === 'object' ? 
          JSON.stringify(eventData.properties) : eventData.properties
      };

      // Extract device info from user agent if provided
      if (event.userAgent) {
        const deviceInfo = this.parseUserAgent(event.userAgent);
        event.deviceType = deviceInfo.deviceType;
        event.browser = deviceInfo.browser;
        event.os = deviceInfo.os;
      }

      // Check queue capacity
      if (this.eventQueue.length >= this.maxQueueSize) {
        throw new Error('Event queue at capacity');
      }

      // Add to queue for batch processing
      this.eventQueue.push(event);

      // Update real-time metrics
      this.updateRealtimeMetrics(event);

      // Process critical events immediately
      if (this.isCriticalEvent(event.eventType)) {
        await this.processEventRealtime(event);
      }

      // Update session tracking with activity timestamp
      this.updateSessionTracking(event);
      
      // Update last activity for session cleanup
      if (this.activeSessions.has(event.sessionId)) {
        const session = this.activeSessions.get(event.sessionId);
        session.lastActivity = Date.now();
      }

      logger.debug('Event tracked', { 
        eventId: event.eventId, 
        eventType: event.eventType 
      });

      return { eventId: event.eventId };
    } catch (error) {
      logger.error('Failed to track event', { error: error.message });
      throw error;
    }
  }

  /**
   * Process event batch
   */
  async processEventBatch() {
    if (this.eventQueue.length === 0 || this.processingLock) return;

    // Thread-safe queue extraction
    this.processingLock = true;
    const events = [];
    
    try {
      const batchSize = Math.min(this.batchSize, this.eventQueue.length);
      for (let i = 0; i < batchSize; i++) {
        const event = this.eventQueue.shift();
        if (event) events.push(event);
      }
    } finally {
      this.processingLock = false;
    }
    
    if (events.length === 0) return;

    try {
      // Remove duplicates
      const uniqueEvents = this.deduplicateEvents(events);

      // Batch insert to database
      await this.analyticsRepository.insertEvents(uniqueEvents);

      // Update real-time metrics
      await this.updateRealtimeMetrics(uniqueEvents);

      // Update session data
      await this.updateSessions(uniqueEvents);

      // Invalidate cache for affected users
      const userIds = [...new Set(uniqueEvents.map(e => e.userId))];
      for (const userId of userIds) {
        await this.cacheService.invalidate(`analytics:${userId}:*`);
      }

      logger.info('Event batch processed', { 
        count: uniqueEvents.length,
        duplicates: events.length - uniqueEvents.length 
      });
    } catch (error) {
      logger.error('Failed to process event batch', { error: error.message });
      // Re-queue failed events for retry
      this.eventQueue.unshift(...events);
      throw error;
    }
  }

  /**
   * Process event batch with retry logic
   */
  async processEventBatchWithRetry(maxRetries = 3) {
    let attempts = 0;
    let delay = 1000; // Start with 1 second delay

    while (attempts < maxRetries) {
      try {
        await this.processEventBatch();
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          logger.error('Max retries reached for event batch processing');
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  /**
   * Process critical events in real-time
   */
  async processEventRealtime(event) {
    try {
      // Store in real-time cache for immediate access
      const cacheKey = `realtime:${event.userId}:${event.eventType}`;
      await this.cacheService.set(cacheKey, event, 60); // 1 minute TTL

      // Update real-time dashboard if applicable
      if (event.eventType === 'conversion' || event.eventType === 'error') {
        await this.updateRealtimeDashboard(event);
      }

      // Trigger alerts for critical errors
      if (event.eventType === 'error' && event.properties) {
        const props = typeof event.properties === 'string' ? 
          JSON.parse(event.properties) : event.properties;
        
        if (props.severity === 'critical') {
          await this.triggerAlert('critical_error', event);
        }
      }
    } catch (error) {
      logger.error('Failed to process real-time event', { error: error.message });
    }
  }

  /**
   * Session management
   */
  async startSession(sessionData) {
    try {
      const session = {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        sessionStart: new Date(),
        isActive: 'Y',
        pageCount: 0,
        eventCount: 0,
        deviceType: this.parseUserAgent(sessionData.userAgent).deviceType,
        browser: this.parseUserAgent(sessionData.userAgent).browser,
        os: this.parseUserAgent(sessionData.userAgent).os,
        ipAddress: sessionData.ipAddress,
        entryPage: sessionData.entryPage || '/',
        entryReferrer: sessionData.referrer || null
      };

      await this.analyticsRepository.saveSessions(session);
      
      // Track in memory for real-time metrics with last activity
      this.activeSessions.set(sessionData.sessionId, {
        ...session,
        lastActivity: Date.now()
      });

      logger.info('Session started', { sessionId: sessionData.sessionId });
      return session;
    } catch (error) {
      logger.error('Failed to start session', { error: error.message });
      throw error;
    }
  }

  async endSession(sessionId) {
    try {
      const session = await this.analyticsRepository.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const endTime = new Date();
      const durationSeconds = Math.floor((endTime - session.session_start) / 1000);

      await this.analyticsRepository.updateSession(sessionId, {
        sessionEnd: endTime,
        durationSeconds,
        isActive: 'N',
        bounce: session.page_count <= 1 ? 'Y' : 'N',
        engagementScore: this.calculateEngagementScore({
          duration: durationSeconds,
          pageCount: session.page_count,
          eventCount: session.event_count
        })
      });

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      logger.info('Session ended', { sessionId, duration: durationSeconds });
      return { sessionId, durationSeconds };
    } catch (error) {
      logger.error('Failed to end session', { error: error.message });
      throw error;
    }
  }

  async trackPageView(sessionId, pageUrl, pageTitle) {
    try {
      // Get current session to increment page count
      const session = await this.analyticsRepository.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      await this.analyticsRepository.updateSession(sessionId, {
        pageCount: (session.page_count || 0) + 1,
        exitPage: pageUrl
      });

      return this.trackEvent({
        sessionId,
        eventType: 'page_view',
        eventCategory: 'navigation',
        pageUrl,
        eventLabel: pageTitle
      });
    } catch (error) {
      logger.error('Failed to track page view', { error: error.message });
      throw error;
    }
  }

  /**
   * Data aggregation
   */
  async aggregateDailyMetrics(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all events for the day
      const events = await this.analyticsRepository.getEventsByDateRange(
        startOfDay,
        endOfDay
      );

      if (events.length === 0) {
        logger.info('No events to aggregate for date', { date: startOfDay });
        return;
      }

      // Group by user
      const userMetrics = new Map();

      for (const event of events) {
        if (!userMetrics.has(event.userId)) {
          userMetrics.set(event.userId, {
            userId: event.userId,
            metricDate: startOfDay,
            totalEvents: 0,
            totalSessions: new Set(),
            totalDurationSeconds: 0,
            pageViews: 0,
            uniquePages: new Set(),
            actionsPerformed: {},
            featuresUsed: new Set(),
            errorCount: 0,
            conversions: 0,
            conversionValue: 0,
            loadTimes: [],
            apiResponseTimes: []
          });
        }

        const metrics = userMetrics.get(event.userId);
        metrics.totalEvents++;
        metrics.totalSessions.add(event.sessionId);

        // Process by event type
        switch (event.eventType) {
          case 'page_view':
            metrics.pageViews++;
            metrics.uniquePages.add(event.pageUrl);
            break;
          
          case 'error':
            metrics.errorCount++;
            break;
          
          case 'conversion':
            metrics.conversions++;
            metrics.conversionValue += event.eventValue || 0;
            break;
          
          case 'timing':
            if (event.properties) {
              const props = typeof event.properties === 'string' ? 
                JSON.parse(event.properties) : event.properties;
              
              if (props.metric === 'page_load_time') {
                metrics.loadTimes.push(event.eventValue);
              } else if (props.metric === 'api_response_time') {
                metrics.apiResponseTimes.push(event.eventValue);
              }
            }
            break;
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

      // Save aggregated metrics for each user
      for (const [userId, metrics] of userMetrics) {
        // Calculate averages
        const avgPageLoadTime = metrics.loadTimes.length > 0 ?
          metrics.loadTimes.reduce((a, b) => a + b, 0) / metrics.loadTimes.length : null;
        
        const avgApiResponseTime = metrics.apiResponseTimes.length > 0 ?
          metrics.apiResponseTimes.reduce((a, b) => a + b, 0) / metrics.apiResponseTimes.length : null;

        const errorRate = metrics.totalEvents > 0 ?
          (metrics.errorCount / metrics.totalEvents) * 100 : 0;

        await this.analyticsRepository.saveUserMetrics({
          userId,
          metricDate: metrics.metricDate,
          totalEvents: metrics.totalEvents,
          totalSessions: metrics.totalSessions.size,
          pageViews: metrics.pageViews,
          uniquePages: metrics.uniquePages.size,
          actionsPerformed: JSON.stringify(metrics.actionsPerformed),
          featuresUsed: JSON.stringify(Array.from(metrics.featuresUsed)),
          errorCount: metrics.errorCount,
          errorRate,
          avgPageLoadTime,
          avgApiResponseTime,
          conversions: metrics.conversions,
          conversionValue: metrics.conversionValue
        });
      }

      logger.info('Daily metrics aggregated', { 
        date: startOfDay, 
        users: userMetrics.size,
        totalEvents: events.length
      });
    } catch (error) {
      logger.error('Failed to aggregate daily metrics', { error: error.message });
      throw error;
    }
  }

  async aggregateHourlyMetrics() {
    // Aggregate metrics for the past hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    try {
      const events = await this.analyticsRepository.getEventsByDateRange(hourAgo, now);
      
      // Calculate hourly statistics
      const stats = {
        uniqueUsers: new Set(events.map(e => e.userId)).size,
        totalEvents: events.length,
        errorRate: events.filter(e => e.eventType === 'error').length / events.length,
        avgResponseTime: this.calculateAvgResponseTime(events)
      };

      // Store in cache for quick access
      await this.cacheService.set('analytics:hourly:stats', stats, 3600);

      logger.info('Hourly metrics aggregated', stats);
    } catch (error) {
      logger.error('Failed to aggregate hourly metrics', { error: error.message });
    }
  }

  async aggregateWeeklyMetrics() {
    // Aggregate metrics for the past week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    try {
      // This would typically aggregate daily metrics into weekly summaries
      logger.info('Weekly metrics aggregation started');
      
      // Implementation would aggregate daily metrics
      // and create weekly summaries for reporting
      
    } catch (error) {
      logger.error('Failed to aggregate weekly metrics', { error: error.message });
    }
  }

  /**
   * OCI Storage Operations
   */
  async migrateToOCIColdStorage() {
    if (!this.objectStorageClient) {
      logger.warn('OCI Object Storage not configured, skipping migration');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

    try {
      // Get data to migrate
      const events = await this.analyticsRepository.getEventsOlderThan(cutoffDate);
      
      if (events.length === 0) {
        logger.info('No events to migrate to cold storage');
        return;
      }

      logger.info('Starting migration to cold storage', { 
        eventCount: events.length,
        cutoffDate 
      });

      // Group by date for organized storage
      const eventsByDate = this.groupEventsByDate(events);

      for (const [date, dateEvents] of Object.entries(eventsByDate)) {
        try {
          // Compress data
          const compressedData = await this.compressData(dateEvents);

          // Create object name with date hierarchy
          const objectName = `analytics/daily/${date}/events.json.gz`;

          // Upload to OCI Object Storage
          await this.uploadToOCI(this.buckets.cold, objectName, compressedData);

          // Create metadata entry
          await this.analyticsRepository.createStorageTier({
            tierName: 'cold',
            dateRangeStart: new Date(date),
            dateRangeEnd: new Date(date),
            storageLocation: `oci://${this.buckets.cold}/${objectName}`,
            ociBucket: this.buckets.cold,
            ociNamespace: this.namespace,
            ociRegion: this.region,
            filePrefix: objectName,
            compressionType: 'gzip',
            encryptionEnabled: 'Y',
            encryptionKeyId: this.encryptionKeyId,
            recordsCount: dateEvents.length,
            sizeBytes: JSON.stringify(dateEvents).length,
            sizeCompressed: compressedData.length,
            checksum: this.calculateChecksum(compressedData)
          });

          // Delete from hot storage
          await this.analyticsRepository.deleteEventsByDate(new Date(date));

          logger.info('Migrated events to cold storage', {
            date,
            count: dateEvents.length,
            compressedSize: compressedData.length
          });
        } catch (error) {
          logger.error('Failed to migrate date to cold storage', { 
            date,
            error: error.message 
          });
          // Continue with next date
        }
      }
    } catch (error) {
      logger.error('Failed to migrate to cold storage', { error: error.message });
      throw error;
    }
  }

  async migrateToOCIArchive() {
    if (!this.objectStorageClient) {
      logger.warn('OCI Object Storage not configured, skipping archive migration');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 1 year ago

    try {
      // Get cold storage items to archive
      const coldItems = await this.analyticsRepository.getColdStorageOlderThan(cutoffDate);

      if (coldItems.length === 0) {
        logger.info('No cold storage items to archive');
        return;
      }

      logger.info('Starting migration to archive storage', { 
        itemCount: coldItems.length 
      });

      for (const item of coldItems) {
        try {
          // Move object from cold to archive bucket
          const sourceObjectName = item.filePrefix;
          const targetObjectName = sourceObjectName.replace('analytics/', 'archive/');

          // Copy to archive bucket with Archive storage tier
          await this.copyOCIObject(
            this.buckets.cold,
            sourceObjectName,
            this.buckets.archive,
            targetObjectName,
            'Archive'
          );

          // Update metadata
          await this.analyticsRepository.updateStorageTier(item.tierId, {
            tierName: 'archive',
            storageLocation: `oci://${this.buckets.archive}/${targetObjectName}`,
            ociBucket: this.buckets.archive,
            filePrefix: targetObjectName,
            migrationCompletedAt: new Date()
          });

          // Delete from cold bucket
          await this.deleteOCIObject(this.buckets.cold, sourceObjectName);

          logger.info('Archived cold storage data', {
            date: item.dateRangeStart,
            size: item.sizeBytes
          });
        } catch (error) {
          logger.error('Failed to archive cold storage item', { 
            tierId: item.tierId,
            error: error.message 
          });
          // Continue with next item
        }
      }
    } catch (error) {
      logger.error('Failed to migrate to archive', { error: error.message });
      throw error;
    }
  }

  /**
   * Query across storage tiers
   */
  async queryAnalytics(userId, startDate, endDate) {
    const results = {
      hot: [],
      cold: [],
      archive: []
    };

    try {
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
        try {
          results.cold = await this.queryOCIColdStorage(
            userId,
            Math.max(startDate, coldCutoff),
            Math.min(endDate, hotCutoff)
          );
        } catch (error) {
          logger.error('Failed to query cold storage', { error: error.message });
          // Continue without cold storage data
        }
      }

      // Check if we need archive (> 1 year)
      if (startDate < coldCutoff) {
        try {
          results.archive = await this.queryOCIArchive(
            userId,
            startDate,
            Math.min(endDate, coldCutoff)
          );
        } catch (error) {
          logger.error('Failed to query archive storage', { error: error.message });
          // Continue without archive data
        }
      }

      // Combine and sort results
      const allEvents = [
        ...results.hot,
        ...results.cold,
        ...results.archive
      ].sort((a, b) => 
        new Date(a.eventTimestamp) - new Date(b.eventTimestamp)
      );

      logger.info('Analytics query completed', {
        userId,
        totalEvents: allEvents.length,
        hot: results.hot.length,
        cold: results.cold.length,
        archive: results.archive.length
      });

      return allEvents;
    } catch (error) {
      logger.error('Failed to query analytics', { error: error.message });
      throw error;
    }
  }

  async queryOCIColdStorage(userId, startDate, endDate) {
    if (!this.objectStorageClient) {
      return [];
    }

    const events = [];
    
    try {
      // Check cache first
      const cacheKey = `cold-storage:${userId}:${startDate.getTime()}:${endDate.getTime()}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

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
          logger.error('Failed to query cold storage tier', { 
            error: error.message, 
            tier: tier.tierId 
          });
        }
      }

      // Cache results for 1 hour
      if (events.length > 0) {
        await this.cacheService.set(cacheKey, events, 3600);
      }

      return events;
    } catch (error) {
      logger.error('Failed to query cold storage', { error: error.message });
      return [];
    }
  }

  async queryOCIArchive(userId, startDate, endDate) {
    if (!this.objectStorageClient) {
      return [];
    }

    // Archive queries are similar to cold storage but may require restoration
    // For simplicity, we'll follow the same pattern
    return this.queryOCIColdStorage(userId, startDate, endDate);
  }

  /**
   * Analytics calculations
   */
  async getUserActivitySummary(userId) {
    try {
      // Check cache first
      const cacheKey = `user-activity:${userId}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const events = await this.analyticsRepository.getUserEvents(
        userId, 
        thirtyDaysAgo, 
        now
      );

      const sessions = new Set(events.map(e => e.sessionId));
      const pageViews = events.filter(e => e.eventType === 'page_view');
      const actions = events.filter(e => e.eventAction);

      const summary = {
        totalEvents: events.length,
        totalSessions: sessions.size,
        averageSessionDuration: await this.calculateAvgSessionDuration(userId),
        mostVisitedPages: this.getMostFrequent(pageViews.map(e => e.pageUrl), 10),
        topActions: this.getMostFrequent(actions.map(e => e.eventAction), 10),
        lastActivity: events.length > 0 ? events[0].eventTimestamp : null
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, summary, 300);

      return summary;
    } catch (error) {
      logger.error('Failed to get user activity summary', { error: error.message });
      throw error;
    }
  }

  async calculateEngagementScore(data) {
    // Simple engagement score calculation
    const durationScore = Math.min(data.duration / 300, 1) * 0.4; // 5 min = max
    const pageScore = Math.min(data.pageCount / 10, 1) * 0.3; // 10 pages = max
    const eventScore = Math.min(data.eventCount / 20, 1) * 0.3; // 20 events = max
    
    return Math.round((durationScore + pageScore + eventScore) * 100);
  }

  async calculateRetentionCohorts(startDate, endDate) {
    // Cohort analysis implementation
    try {
      const cohorts = {};
      
      // Get all users who started in the date range
      const newUsers = await this.getNewUsersInRange(startDate, endDate);
      
      // For each cohort date, calculate retention
      for (const cohortDate of this.dateRange(startDate, endDate)) {
        const cohortUsers = newUsers.filter(u => 
          this.isSameDay(u.firstSeen, cohortDate)
        );
        
        if (cohortUsers.length === 0) continue;
        
        cohorts[cohortDate.toISOString()] = {
          users: cohortUsers.length,
          retention: await this.calculateRetentionRates(cohortUsers, cohortDate)
        };
      }
      
      return {
        cohorts,
        retentionRates: this.aggregateRetentionRates(cohorts)
      };
    } catch (error) {
      logger.error('Failed to calculate retention cohorts', { error: error.message });
      throw error;
    }
  }

  async identifyUserSegments() {
    // User segmentation logic
    return ['highly_engaged', 'at_risk', 'new_users', 'power_users', 'dormant'];
  }

  async calculateFunnel(funnelSteps, startDate, endDate) {
    try {
      const funnelData = {
        steps: [],
        conversionRates: {},
        dropoffRates: {}
      };

      let previousStepUsers = null;

      for (let i = 0; i < funnelSteps.length; i++) {
        const step = funnelSteps[i];
        const stepUsers = await this.getUsersForFunnelStep(step, startDate, endDate);
        
        funnelData.steps.push({
          step: step.step,
          users: stepUsers.length,
          percentage: previousStepUsers ? 
            (stepUsers.length / previousStepUsers.length) * 100 : 100
        });

        if (i > 0) {
          const conversionRate = (stepUsers.length / previousStepUsers.length) * 100;
          const dropoffRate = 100 - conversionRate;
          
          funnelData.conversionRates[`step${i-1}_to_step${i}`] = conversionRate;
          funnelData.dropoffRates[`step${i-1}_to_step${i}`] = dropoffRate;
        }

        previousStepUsers = stepUsers;
      }

      // Overall conversion rate
      if (funnelData.steps.length > 0) {
        const firstStep = funnelData.steps[0];
        const lastStep = funnelData.steps[funnelData.steps.length - 1];
        funnelData.overallConversion = (lastStep.users / firstStep.users) * 100;
      }

      return funnelData;
    } catch (error) {
      logger.error('Failed to calculate funnel', { error: error.message });
      throw error;
    }
  }

  async getFeatureAdoption() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const events = await this.analyticsRepository.getEventsByDateRange(
        thirtyDaysAgo,
        new Date(),
        { eventCategory: 'feature_usage' }
      );

      const featureUsage = {};
      const uniqueUsers = new Set();

      events.forEach(event => {
        uniqueUsers.add(event.userId);
        const feature = event.eventLabel;
        
        if (!featureUsage[feature]) {
          featureUsage[feature] = {
            name: feature,
            users: new Set(),
            events: 0
          };
        }
        
        featureUsage[feature].users.add(event.userId);
        featureUsage[feature].events++;
      });

      const totalUsers = uniqueUsers.size;

      return {
        features: Object.values(featureUsage).map(f => ({
          name: f.name,
          adoptionRate: (f.users.size / totalUsers) * 100,
          userCount: f.users.size,
          eventCount: f.events
        })).sort((a, b) => b.adoptionRate - a.adoptionRate)
      };
    } catch (error) {
      logger.error('Failed to get feature adoption', { error: error.message });
      throw error;
    }
  }

  async getUnusedFeatures(days = 30) {
    // Implementation to identify features not used in the last N days
    return [];
  }

  async getUserJourney(userId) {
    try {
      const events = await this.analyticsRepository.getUserEvents(
        userId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      const paths = this.extractUserPaths(events);
      const entryPoints = this.extractEntryPoints(events);
      const exitPoints = this.extractExitPoints(events);
      const conversionPoints = events.filter(e => e.eventType === 'conversion');

      return {
        paths,
        entryPoints,
        exitPoints,
        conversionPoints: conversionPoints.map(e => ({
          timestamp: e.eventTimestamp,
          value: e.eventValue,
          page: e.pageUrl
        }))
      };
    } catch (error) {
      logger.error('Failed to get user journey', { error: error.message });
      throw error;
    }
  }

  async getCommonUserPaths() {
    // Implementation to identify common navigation paths
    return [];
  }

  async executeCustomQuery(query) {
    try {
      // Validate query
      if (!query.metrics || query.metrics.length === 0) {
        throw new Error('At least one metric is required');
      }

      const validMetrics = ['pageViews', 'uniqueUsers', 'sessions', 'events'];
      for (const metric of query.metrics) {
        if (!validMetrics.includes(metric)) {
          throw new Error(`Invalid metric: ${metric}`);
        }
      }

      // Execute query based on parameters
      // This would be a complex implementation based on the query structure
      
      return {
        data: [],
        metadata: {
          query,
          executionTime: 0,
          rowCount: 0
        }
      };
    } catch (error) {
      logger.error('Failed to execute custom query', { error: error.message });
      throw error;
    }
  }

  async exportAnalytics(config) {
    try {
      const events = await this.analyticsRepository.getEventsByDateRange(
        config.dateRange.start,
        config.dateRange.end
      );

      if (config.format === 'csv') {
        return this.exportToCSV(events, config.metrics);
      } else if (config.format === 'json') {
        return JSON.stringify(events, null, 2);
      } else {
        throw new Error(`Unsupported export format: ${config.format}`);
      }
    } catch (error) {
      logger.error('Failed to export analytics', { error: error.message });
      throw error;
    }
  }

  async exportAnalyticsStream(config) {
    // Implementation for streaming large exports
    const { Readable } = require('stream');
    
    return new Readable({
      async read() {
        // Stream implementation
      }
    });
  }

  /**
   * OCI Object Storage operations
   */
  async uploadToOCI(bucket, objectName, data) {
    if (!this.objectStorageClient) {
      throw new Error('OCI Object Storage client not initialized');
    }

    try {
      const putObjectRequest = {
        namespaceName: this.namespace,
        bucketName: bucket,
        objectName: objectName,
        putObjectBody: data,
        contentType: 'application/gzip'
      };

      // Add encryption if configured
      if (this.encryptionKeyId) {
        putObjectRequest.opcSseKmsKeyId = this.encryptionKeyId;
        putObjectRequest.opcSseCustomerAlgorithm = 'AES256';
      }

      // Add content checksum for integrity
      putObjectRequest.contentMD5 = this.calculateChecksum(data);

      const response = await this.objectStorageClient.putObject(putObjectRequest);
      
      logger.debug('Object uploaded to OCI', { 
        bucket, 
        objectName, 
        etag: response.eTag 
      });
      
      return response.eTag;
    } catch (error) {
      logger.error('Failed to upload to OCI', { error: error.message });
      throw error;
    }
  }

  async downloadFromOCI(bucket, objectName) {
    if (!this.objectStorageClient) {
      throw new Error('OCI Object Storage client not initialized');
    }

    try {
      const getObjectRequest = {
        namespaceName: this.namespace,
        bucketName: bucket,
        objectName: objectName
      };

      const response = await this.objectStorageClient.getObject(getObjectRequest);
      
      logger.debug('Object downloaded from OCI', { bucket, objectName });
      
      return response.value;
    } catch (error) {
      logger.error('Failed to download from OCI', { error: error.message });
      throw error;
    }
  }

  async copyOCIObject(sourceBucket, sourceObject, targetBucket, targetObject, storageClass) {
    if (!this.objectStorageClient) {
      throw new Error('OCI Object Storage client not initialized');
    }

    try {
      const copyObjectRequest = {
        namespaceName: this.namespace,
        bucketName: targetBucket,
        copyObjectDetails: {
          sourceObjectName: sourceObject,
          destinationRegion: this.region,
          destinationNamespace: this.namespace,
          destinationBucket: sourceBucket,
          destinationObjectName: targetObject,
          destinationObjectStorageTier: storageClass
        }
      };

      await this.objectStorageClient.copyObject(copyObjectRequest);
      
      logger.debug('Object copied in OCI', { 
        source: `${sourceBucket}/${sourceObject}`,
        target: `${targetBucket}/${targetObject}` 
      });
    } catch (error) {
      logger.error('Failed to copy OCI object', { error: error.message });
      throw error;
    }
  }

  async deleteOCIObject(bucket, objectName) {
    if (!this.objectStorageClient) {
      throw new Error('OCI Object Storage client not initialized');
    }

    try {
      const deleteObjectRequest = {
        namespaceName: this.namespace,
        bucketName: bucket,
        objectName: objectName
      };

      await this.objectStorageClient.deleteObject(deleteObjectRequest);
      
      logger.debug('Object deleted from OCI', { bucket, objectName });
    } catch (error) {
      logger.error('Failed to delete OCI object', { error: error.message });
      throw error;
    }
  }

  /**
   * Utility methods
   */
  async compressData(data) {
    const jsonString = JSON.stringify(data);
    return await gzip(jsonString);
  }

  async decompressData(data) {
    const decompressed = await gunzip(data);
    return decompressed.toString();
  }

  groupEventsByDate(events) {
    const grouped = {};
    
    for (const event of events) {
      const date = new Date(event.eventTimestamp).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    }

    return grouped;
  }

  deduplicateEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      if (seen.has(event.eventId)) {
        return false;
      }
      seen.add(event.eventId);
      return true;
    });
  }

  parseUserAgent(userAgent) {
    if (!userAgent) {
      return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
    }

    // Simple user agent parsing
    let deviceType = 'desktop';
    let browser = 'unknown';
    let os = 'unknown';

    if (/mobile/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    if (/chrome/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/safari/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/edge/i.test(userAgent)) {
      browser = 'Edge';
    }

    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/mac/i.test(userAgent)) {
      os = 'macOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/ios|iphone|ipad/i.test(userAgent)) {
      os = 'iOS';
    }

    return { deviceType, browser, os };
  }

  calculateChecksum(data) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('base64');
  }

  isCriticalEvent(eventType) {
    return ['error', 'conversion', 'purchase', 'signup'].includes(eventType);
  }

  updateRealtimeMetrics(events) {
    const eventsArray = Array.isArray(events) ? events : [events];
    
    eventsArray.forEach(event => {
      this.realtimeMetrics.activeUsers.add(event.userId);
      this.realtimeMetrics.eventsPerMinute.push({
        timestamp: new Date(),
        eventType: event.eventType
      });
    });

    // Clean old metrics (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.realtimeMetrics.eventsPerMinute = this.realtimeMetrics.eventsPerMinute
      .filter(e => e.timestamp.getTime() > oneMinuteAgo);
  }

  async updateRealtimeDashboard(event) {
    // Update real-time dashboard metrics
    // This would typically push to a WebSocket or SSE connection
    logger.debug('Updating real-time dashboard', { eventType: event.eventType });
  }

  updateSessionTracking(event) {
    if (this.activeSessions.has(event.sessionId)) {
      const session = this.activeSessions.get(event.sessionId);
      session.eventCount++;
      session.lastActivity = new Date();
    }
  }

  async updateSessions(events) {
    const sessionUpdates = new Map();

    events.forEach(event => {
      if (!sessionUpdates.has(event.sessionId)) {
        sessionUpdates.set(event.sessionId, {
          eventCount: 0,
          pageViews: 0,
          errors: 0,
          apiCalls: 0
        });
      }

      const update = sessionUpdates.get(event.sessionId);
      update.eventCount++;

      if (event.eventType === 'page_view') update.pageViews++;
      if (event.eventType === 'error') update.errors++;
      if (event.eventType === 'api_call') update.apiCalls++;
    });

    // Batch update sessions
    for (const [sessionId, updates] of sessionUpdates) {
      await this.analyticsRepository.updateSession(sessionId, {
        eventCount: updates.eventCount,
        pageCount: updates.pageViews,
        errorCount: updates.errors,
        apiCallCount: updates.apiCalls
      });
    }
  }

  async triggerAlert(alertType, data) {
    logger.warn('Alert triggered', { alertType, data });
    // Implement alert notification logic
  }

  getMostFrequent(items, limit = 10) {
    const frequency = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item, count]) => ({ item, count }));
  }

  calculateAvgResponseTime(events) {
    const timingEvents = events.filter(e => e.eventType === 'timing');
    if (timingEvents.length === 0) return 0;

    const sum = timingEvents.reduce((acc, e) => acc + (e.eventValue || 0), 0);
    return sum / timingEvents.length;
  }

  async calculateAvgSessionDuration(userId) {
    // Implementation to calculate average session duration
    return 0;
  }

  async getNewUsersInRange(startDate, endDate) {
    // Implementation to get new users in date range
    return [];
  }

  async calculateRetentionRates(users, cohortDate) {
    // Implementation to calculate retention rates
    return {
      day1: 0,
      day7: 0,
      day30: 0,
      day90: 0
    };
  }

  aggregateRetentionRates(cohorts) {
    // Implementation to aggregate retention rates
    return {};
  }

  async getUsersForFunnelStep(step, startDate, endDate) {
    // Implementation to get users who completed a funnel step
    return [];
  }

  extractUserPaths(events) {
    // Implementation to extract user navigation paths
    return [];
  }

  extractEntryPoints(events) {
    // Implementation to extract entry points
    return [];
  }

  extractExitPoints(events) {
    // Implementation to extract exit points
    return [];
  }

  exportToCSV(events, metrics) {
    // Implementation to export to CSV format
    return 'Date,Events,Sessions,Users\n';
  }

  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  *dateRange(startDate, endDate) {
    const current = new Date(startDate);
    while (current <= endDate) {
      yield new Date(current);
      current.setDate(current.getDate() + 1);
    }
  }

  /**
   * Start session cleanup interval
   */
  startSessionCleanup() {
    setInterval(() => {
      try {
        const now = Date.now();
        const sessionsToEnd = [];
        
        for (const [sessionId, session] of this.activeSessions) {
          if (now - session.lastActivity > this.sessionTimeout) {
            sessionsToEnd.push(sessionId);
          }
        }
        
        // End timed-out sessions
        for (const sessionId of sessionsToEnd) {
          this.endSession(sessionId).catch(err => 
            logger.error('Failed to cleanup session', { sessionId, error: err.message })
          );
        }
        
        logger.debug('Session cleanup completed', { cleaned: sessionsToEnd.length });
      } catch (error) {
        logger.error('Session cleanup failed', { error: error.message });
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Sanitize properties to prevent security issues
   */
  sanitizeProperties(properties) {
    if (typeof properties !== 'object' || properties === null) {
      return properties;
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(properties)) {
      // Remove any potential SQL injection or XSS attempts
      const sanitizedKey = key.replace(/[<>'"`;]/g, '');
      
      if (typeof value === 'string') {
        // Sanitize string values
        sanitized[sanitizedKey] = value.replace(/[<>'"`;]/g, '');
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[sanitizedKey] = this.sanitizeProperties(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Scheduled jobs
   */
  scheduleAggregationJobs() {
    // Hourly aggregation with error handling
    setInterval(() => {
      this.aggregateHourlyMetrics().catch(error => {
        logger.error('Hourly aggregation failed', { error: error.message });
      });
    }, 60 * 60 * 1000);

    // Daily aggregation (at 2 AM) with error handling
    schedule.scheduleJob('0 2 * * *', () => {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.aggregateDailyMetrics(yesterday).catch(error => {
          logger.error('Daily aggregation failed', { error: error.message });
        });
      } catch (error) {
        logger.error('Daily aggregation job error', { error: error.message });
      }
    });

    // Weekly aggregation (Sundays at 3 AM) with error handling
    schedule.scheduleJob('0 3 * * 0', () => {
      try {
        this.aggregateWeeklyMetrics().catch(error => {
          logger.error('Weekly aggregation failed', { error: error.message });
        });
      } catch (error) {
        logger.error('Weekly aggregation job error', { error: error.message });
      }
    });

    logger.info('Analytics aggregation jobs scheduled');
  }

  scheduleTieringJobs() {
    // Daily migration to cold storage (at 4 AM) with error handling
    schedule.scheduleJob('0 4 * * *', () => {
      try {
        this.migrateToOCIColdStorage().catch(error => {
          logger.error('Cold storage migration failed', { error: error.message });
        });
      } catch (error) {
        logger.error('Cold storage migration job error', { error: error.message });
      }
    });

    // Monthly migration to archive (1st of month at 5 AM) with error handling
    schedule.scheduleJob('0 5 1 * *', () => {
      try {
        this.migrateToOCIArchive().catch(error => {
          logger.error('Archive migration failed', { error: error.message });
        });
      } catch (error) {
        logger.error('Archive migration job error', { error: error.message });
      }
    });

    logger.info('Storage tiering jobs scheduled');
  }

  startEventProcessor() {
    setInterval(() => {
      this.processEventBatchWithRetry().catch(error => {
        logger.error('Event processor error', { error: error.message });
      });
    }, this.flushInterval);

    logger.info('Event processor started');
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    try {
      // Process remaining events
      if (this.eventQueue.length > 0) {
        logger.info('Processing remaining events before shutdown', { 
          count: this.eventQueue.length 
        });
        await this.processEventBatch();
      }

      // Clear intervals and scheduled jobs
      clearInterval(this.eventProcessorInterval);
      schedule.gracefulShutdown();

      logger.info('Analytics service shutdown complete');
    } catch (error) {
      logger.error('Error during analytics service shutdown', { error: error.message });
    }
  }
}

module.exports = UserAnalyticsService;