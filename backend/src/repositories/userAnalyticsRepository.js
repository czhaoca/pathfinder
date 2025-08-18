const oracledb = require('oracledb');
const logger = require('../utils/logger');
const { ulid } = require('ulid');

class UserAnalyticsRepository {
  constructor(database) {
    this.database = database;
  }

  /**
   * Insert batch of events efficiently
   */
  async insertEvents(events) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Prepare batch insert
      const binds = events.map(event => ({
        eventId: event.eventId || ulid(),
        userId: event.userId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventCategory: event.eventCategory || null,
        eventAction: event.eventAction || null,
        eventLabel: event.eventLabel || null,
        eventValue: event.eventValue || null,
        pageUrl: event.pageUrl || null,
        referrerUrl: event.referrerUrl || null,
        userAgent: event.userAgent || null,
        ipAddress: event.ipAddress || null,
        deviceType: event.deviceType || null,
        browser: event.browser || null,
        os: event.os || null,
        screenResolution: event.screenResolution || null,
        viewportSize: event.viewportSize || null,
        countryCode: event.countryCode || null,
        region: event.region || null,
        city: event.city || null,
        latitude: event.latitude || null,
        longitude: event.longitude || null,
        properties: event.properties ? JSON.stringify(event.properties) : null,
        eventTimestamp: event.eventTimestamp || new Date(),
        processingTimestamp: new Date()
      }));

      // Use batch insert for better performance
      const sql = `
        INSERT INTO pf_user_events (
          event_id, user_id, session_id, event_type, event_category,
          event_action, event_label, event_value, page_url, referrer_url,
          user_agent, ip_address, device_type, browser, os,
          screen_resolution, viewport_size, country_code, region, city,
          latitude, longitude, properties, event_timestamp, processing_timestamp
        ) VALUES (
          :eventId, :userId, :sessionId, :eventType, :eventCategory,
          :eventAction, :eventLabel, :eventValue, :pageUrl, :referrerUrl,
          :userAgent, :ipAddress, :deviceType, :browser, :os,
          :screenResolution, :viewportSize, :countryCode, :region, :city,
          :latitude, :longitude, :properties, :eventTimestamp, :processingTimestamp
        )
      `;

      const options = {
        autoCommit: false,
        batchErrors: true,
        bindDefs: {
          eventId: { type: oracledb.STRING, maxSize: 26 },
          userId: { type: oracledb.STRING, maxSize: 26 },
          sessionId: { type: oracledb.STRING, maxSize: 26 },
          eventType: { type: oracledb.STRING, maxSize: 100 },
          eventCategory: { type: oracledb.STRING, maxSize: 50 },
          eventAction: { type: oracledb.STRING, maxSize: 100 },
          eventLabel: { type: oracledb.STRING, maxSize: 200 },
          eventValue: { type: oracledb.NUMBER },
          pageUrl: { type: oracledb.STRING, maxSize: 500 },
          referrerUrl: { type: oracledb.STRING, maxSize: 500 },
          userAgent: { type: oracledb.STRING, maxSize: 500 },
          ipAddress: { type: oracledb.STRING, maxSize: 45 },
          deviceType: { type: oracledb.STRING, maxSize: 50 },
          browser: { type: oracledb.STRING, maxSize: 50 },
          os: { type: oracledb.STRING, maxSize: 50 },
          screenResolution: { type: oracledb.STRING, maxSize: 20 },
          viewportSize: { type: oracledb.STRING, maxSize: 20 },
          countryCode: { type: oracledb.STRING, maxSize: 2 },
          region: { type: oracledb.STRING, maxSize: 100 },
          city: { type: oracledb.STRING, maxSize: 100 },
          latitude: { type: oracledb.NUMBER },
          longitude: { type: oracledb.NUMBER },
          properties: { type: oracledb.STRING, maxSize: 4000 },
          eventTimestamp: { type: oracledb.DATE },
          processingTimestamp: { type: oracledb.DATE }
        }
      };

      const result = await connection.executeMany(sql, binds, options);

      // Check for batch errors
      if (result.batchErrors && result.batchErrors.length > 0) {
        logger.warn('Some events failed to insert', { 
          errors: result.batchErrors,
          totalEvents: events.length 
        });
      }

      await connection.commit();
      
      logger.info('Events inserted successfully', { 
        count: events.length - (result.batchErrors?.length || 0)
      });

      return result;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to insert events', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get events by date range
   */
  async getEventsByDateRange(startDate, endDate, filters = {}) {
    const connection = await this.database.getConnection();
    
    try {
      let sql = `
        SELECT 
          event_id, user_id, session_id, event_type, event_category,
          event_action, event_label, event_value, page_url, referrer_url,
          user_agent, ip_address, device_type, browser, os,
          properties, event_timestamp, processing_timestamp
        FROM pf_user_events
        WHERE event_timestamp >= :startDate 
          AND event_timestamp <= :endDate
      `;

      const binds = { startDate, endDate };

      // Add optional filters
      if (filters.userId) {
        sql += ' AND user_id = :userId';
        binds.userId = filters.userId;
      }

      if (filters.eventType) {
        sql += ' AND event_type = :eventType';
        binds.eventType = filters.eventType;
      }

      if (filters.sessionId) {
        sql += ' AND session_id = :sessionId';
        binds.sessionId = filters.sessionId;
      }

      sql += ' ORDER BY event_timestamp';

      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          properties: { type: oracledb.STRING }
        }
      });

      return result.rows.map(row => ({
        ...row,
        properties: this.parseJson(row.properties)
      }));
    } catch (error) {
      logger.error('Failed to get events by date range', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get events older than specified date for migration
   */
  async getEventsOlderThan(cutoffDate, limit = 1000000) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT 
          event_id, user_id, session_id, event_type, event_category,
          event_action, event_label, event_value, page_url, referrer_url,
          user_agent, ip_address, device_type, browser, os,
          screen_resolution, viewport_size, country_code, region, city,
          latitude, longitude, properties, event_timestamp, processing_timestamp
        FROM pf_user_events
        WHERE event_timestamp < :cutoffDate
        AND ROWNUM <= :limit
        ORDER BY event_timestamp`,
        { cutoffDate, limit },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchInfo: {
            properties: { type: oracledb.STRING }
          }
        }
      );

      return result.rows.map(row => ({
        ...row,
        eventId: row.event_id,
        userId: row.user_id,
        sessionId: row.session_id,
        eventType: row.event_type,
        eventCategory: row.event_category,
        eventAction: row.event_action,
        eventLabel: row.event_label,
        eventValue: row.event_value,
        pageUrl: row.page_url,
        referrerUrl: row.referrer_url,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        deviceType: row.device_type,
        countryCode: row.country_code,
        eventTimestamp: row.event_timestamp,
        processingTimestamp: row.processing_timestamp,
        properties: this.parseJson(row.properties)
      }));
    } catch (error) {
      logger.error('Failed to get old events', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Delete events by date
   */
  async deleteEventsByDate(date) {
    const connection = await this.database.getConnection();
    
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await connection.execute(
        `DELETE FROM pf_user_events 
         WHERE event_timestamp >= :startOfDay 
           AND event_timestamp <= :endOfDay`,
        { startOfDay, endOfDay }
      );

      await connection.commit();
      
      logger.info('Events deleted for date', { 
        date: date.toISOString(), 
        rowsDeleted: result.rowsAffected 
      });

      return result.rowsAffected;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to delete events', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save or update user session
   */
  async saveSessions(sessionData) {
    const connection = await this.database.getConnection();
    
    try {
      const sql = `
        MERGE INTO pf_user_sessions_analytics s
        USING (SELECT :sessionId AS session_id FROM dual) d
        ON (s.session_id = d.session_id)
        WHEN MATCHED THEN
          UPDATE SET
            session_end = :sessionEnd,
            duration_seconds = :durationSeconds,
            page_count = :pageCount,
            event_count = :eventCount,
            error_count = :errorCount,
            api_call_count = :apiCallCount,
            exit_page = :exitPage,
            bounce = :bounce,
            engagement_score = :engagementScore,
            conversion_events = :conversionEvents,
            session_value = :sessionValue,
            updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            session_id, user_id, session_start, session_end, duration_seconds,
            is_active, page_count, event_count, error_count, api_call_count,
            entry_page, exit_page, entry_referrer, device_type, browser,
            browser_version, os, os_version, is_mobile, ip_address,
            country_code, region, city, timezone, bounce, engagement_score,
            conversion_events, session_value, utm_source, utm_medium,
            utm_campaign, utm_term, utm_content
          ) VALUES (
            :sessionId, :userId, :sessionStart, :sessionEnd, :durationSeconds,
            :isActive, :pageCount, :eventCount, :errorCount, :apiCallCount,
            :entryPage, :exitPage, :entryReferrer, :deviceType, :browser,
            :browserVersion, :os, :osVersion, :isMobile, :ipAddress,
            :countryCode, :region, :city, :timezone, :bounce, :engagementScore,
            :conversionEvents, :sessionValue, :utmSource, :utmMedium,
            :utmCampaign, :utmTerm, :utmContent
          )
      `;

      const binds = {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        sessionStart: sessionData.sessionStart || new Date(),
        sessionEnd: sessionData.sessionEnd || null,
        durationSeconds: sessionData.durationSeconds || null,
        isActive: sessionData.isActive || 'Y',
        pageCount: sessionData.pageCount || 0,
        eventCount: sessionData.eventCount || 0,
        errorCount: sessionData.errorCount || 0,
        apiCallCount: sessionData.apiCallCount || 0,
        entryPage: sessionData.entryPage || null,
        exitPage: sessionData.exitPage || null,
        entryReferrer: sessionData.entryReferrer || null,
        deviceType: sessionData.deviceType || null,
        browser: sessionData.browser || null,
        browserVersion: sessionData.browserVersion || null,
        os: sessionData.os || null,
        osVersion: sessionData.osVersion || null,
        isMobile: sessionData.isMobile || 'N',
        ipAddress: sessionData.ipAddress || null,
        countryCode: sessionData.countryCode || null,
        region: sessionData.region || null,
        city: sessionData.city || null,
        timezone: sessionData.timezone || null,
        bounce: sessionData.bounce || 'N',
        engagementScore: sessionData.engagementScore || null,
        conversionEvents: sessionData.conversionEvents ? 
          JSON.stringify(sessionData.conversionEvents) : null,
        sessionValue: sessionData.sessionValue || null,
        utmSource: sessionData.utmSource || null,
        utmMedium: sessionData.utmMedium || null,
        utmCampaign: sessionData.utmCampaign || null,
        utmTerm: sessionData.utmTerm || null,
        utmContent: sessionData.utmContent || null
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.info('Session saved', { sessionId: sessionData.sessionId });
      return sessionData.sessionId;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save session', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId, updates) {
    const connection = await this.database.getConnection();
    
    try {
      const setClauses = [];
      const binds = { sessionId };

      // Build dynamic update statement
      Object.keys(updates).forEach(key => {
        const dbColumn = this.camelToSnake(key);
        setClauses.push(`${dbColumn} = :${key}`);
        binds[key] = updates[key];
      });

      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      const sql = `
        UPDATE pf_user_sessions_analytics
        SET ${setClauses.join(', ')}
        WHERE session_id = :sessionId
      `;

      const result = await connection.execute(sql, binds);
      await connection.commit();

      return result.rowsAffected > 0;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to update session', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT * FROM pf_user_sessions_analytics WHERE session_id = :sessionId`,
        { sessionId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows[0];
      return {
        ...session,
        conversionEvents: this.parseJson(session.conversion_events)
      };
    } catch (error) {
      logger.error('Failed to get session', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save aggregated user metrics
   */
  async saveUserMetrics(metrics) {
    const connection = await this.database.getConnection();
    
    try {
      const sql = `
        MERGE INTO pf_user_metrics_daily m
        USING (
          SELECT :userId AS user_id, :metricDate AS metric_date FROM dual
        ) d
        ON (m.user_id = d.user_id AND m.metric_date = d.metric_date)
        WHEN MATCHED THEN
          UPDATE SET
            total_events = :totalEvents,
            total_sessions = :totalSessions,
            total_duration_seconds = :totalDurationSeconds,
            avg_session_duration = :avgSessionDuration,
            page_views = :pageViews,
            unique_pages = :uniquePages,
            engagement_score = :engagementScore,
            bounce_rate = :bounceRate,
            pages_per_session = :pagesPerSession,
            actions_performed = :actionsPerformed,
            features_used = :featuresUsed,
            avg_page_load_time = :avgPageLoadTime,
            avg_api_response_time = :avgApiResponseTime,
            error_count = :errorCount,
            error_rate = :errorRate,
            conversions = :conversions,
            conversion_value = :conversionValue,
            goals_completed = :goalsCompleted,
            updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            user_id, metric_date, total_events, total_sessions,
            total_duration_seconds, avg_session_duration, page_views,
            unique_pages, engagement_score, bounce_rate, pages_per_session,
            actions_performed, features_used, avg_page_load_time,
            avg_api_response_time, error_count, error_rate, conversions,
            conversion_value, goals_completed
          ) VALUES (
            :userId, :metricDate, :totalEvents, :totalSessions,
            :totalDurationSeconds, :avgSessionDuration, :pageViews,
            :uniquePages, :engagementScore, :bounceRate, :pagesPerSession,
            :actionsPerformed, :featuresUsed, :avgPageLoadTime,
            :avgApiResponseTime, :errorCount, :errorRate, :conversions,
            :conversionValue, :goalsCompleted
          )
      `;

      const binds = {
        userId: metrics.userId,
        metricDate: metrics.metricDate,
        totalEvents: metrics.totalEvents || 0,
        totalSessions: metrics.totalSessions || 0,
        totalDurationSeconds: metrics.totalDurationSeconds || 0,
        avgSessionDuration: metrics.avgSessionDuration || 0,
        pageViews: metrics.pageViews || 0,
        uniquePages: metrics.uniquePages || 0,
        engagementScore: metrics.engagementScore || 0,
        bounceRate: metrics.bounceRate || 0,
        pagesPerSession: metrics.pagesPerSession || 0,
        actionsPerformed: metrics.actionsPerformed || '{}',
        featuresUsed: metrics.featuresUsed || '[]',
        avgPageLoadTime: metrics.avgPageLoadTime || null,
        avgApiResponseTime: metrics.avgApiResponseTime || null,
        errorCount: metrics.errorCount || 0,
        errorRate: metrics.errorRate || 0,
        conversions: metrics.conversions || 0,
        conversionValue: metrics.conversionValue || 0,
        goalsCompleted: metrics.goalsCompleted || 0
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.info('User metrics saved', { 
        userId: metrics.userId, 
        date: metrics.metricDate 
      });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save user metrics', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get user events for a specific user
   */
  async getUserEvents(userId, startDate, endDate, options = {}) {
    const connection = await this.database.getConnection();
    
    try {
      let sql = `
        SELECT 
          event_id, user_id, session_id, event_type, event_category,
          event_action, event_label, event_value, page_url, referrer_url,
          properties, event_timestamp
        FROM pf_user_events
        WHERE user_id = :userId
          AND event_timestamp >= :startDate
          AND event_timestamp <= :endDate
      `;

      const binds = { userId, startDate, endDate };

      if (options.eventTypes && options.eventTypes.length > 0) {
        sql += ` AND event_type IN (${options.eventTypes.map((_, i) => `:type${i}`).join(',')})`;
        options.eventTypes.forEach((type, i) => {
          binds[`type${i}`] = type;
        });
      }

      sql += ' ORDER BY event_timestamp DESC';

      if (options.limit) {
        sql = `SELECT * FROM (${sql}) WHERE ROWNUM <= :limit`;
        binds.limit = options.limit;
      }

      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          properties: { type: oracledb.STRING }
        }
      });

      return result.rows.map(row => ({
        ...row,
        eventId: row.event_id,
        userId: row.user_id,
        sessionId: row.session_id,
        eventType: row.event_type,
        eventCategory: row.event_category,
        eventAction: row.event_action,
        eventLabel: row.event_label,
        eventValue: row.event_value,
        pageUrl: row.page_url,
        referrerUrl: row.referrer_url,
        eventTimestamp: row.event_timestamp,
        properties: this.parseJson(row.properties)
      }));
    } catch (error) {
      logger.error('Failed to get user events', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Create storage tier metadata
   */
  async createStorageTier(tierData) {
    const connection = await this.database.getConnection();
    
    try {
      const sql = `
        INSERT INTO pf_analytics_storage_tiers (
          tier_id, tier_name, date_range_start, date_range_end,
          storage_location, oci_bucket, oci_namespace, oci_region,
          file_prefix, compression_type, encryption_enabled,
          encryption_key_id, records_count, size_bytes, size_compressed,
          checksum, migration_status
        ) VALUES (
          :tierId, :tierName, :dateRangeStart, :dateRangeEnd,
          :storageLocation, :ociBucket, :ociNamespace, :ociRegion,
          :filePrefix, :compressionType, :encryptionEnabled,
          :encryptionKeyId, :recordsCount, :sizeBytes, :sizeCompressed,
          :checksum, :migrationStatus
        )
      `;

      const binds = {
        tierId: tierData.tierId || ulid(),
        tierName: tierData.tierName,
        dateRangeStart: tierData.dateRangeStart,
        dateRangeEnd: tierData.dateRangeEnd,
        storageLocation: tierData.storageLocation,
        ociBucket: tierData.ociBucket || null,
        ociNamespace: tierData.ociNamespace || null,
        ociRegion: tierData.ociRegion || null,
        filePrefix: tierData.filePrefix || null,
        compressionType: tierData.compressionType || 'gzip',
        encryptionEnabled: tierData.encryptionEnabled || 'Y',
        encryptionKeyId: tierData.encryptionKeyId || null,
        recordsCount: tierData.recordsCount || 0,
        sizeBytes: tierData.sizeBytes || 0,
        sizeCompressed: tierData.sizeCompressed || 0,
        checksum: tierData.checksum || null,
        migrationStatus: tierData.migrationStatus || 'completed'
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.info('Storage tier created', { 
        tierId: binds.tierId,
        tierName: tierData.tierName 
      });

      return binds.tierId;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to create storage tier', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Update storage tier metadata
   */
  async updateStorageTier(tierId, updates) {
    const connection = await this.database.getConnection();
    
    try {
      const setClauses = [];
      const binds = { tierId };

      Object.keys(updates).forEach(key => {
        const dbColumn = this.camelToSnake(key);
        setClauses.push(`${dbColumn} = :${key}`);
        binds[key] = updates[key];
      });

      const sql = `
        UPDATE pf_analytics_storage_tiers
        SET ${setClauses.join(', ')}
        WHERE tier_id = :tierId
      `;

      const result = await connection.execute(sql, binds);
      await connection.commit();

      return result.rowsAffected > 0;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to update storage tier', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get storage tiers by criteria
   */
  async getStorageTiers(tierName, startDate, endDate) {
    const connection = await this.database.getConnection();
    
    try {
      let sql = `
        SELECT 
          tier_id, tier_name, date_range_start, date_range_end,
          storage_location, oci_bucket, oci_namespace, oci_region,
          file_prefix, compression_type, encryption_enabled,
          records_count, size_bytes, size_compressed,
          last_accessed, access_count, restoration_status
        FROM pf_analytics_storage_tiers
        WHERE 1=1
      `;

      const binds = {};

      if (tierName) {
        sql += ' AND tier_name = :tierName';
        binds.tierName = tierName;
      }

      if (startDate && endDate) {
        sql += ` AND date_range_start <= :endDate 
                 AND date_range_end >= :startDate`;
        binds.startDate = startDate;
        binds.endDate = endDate;
      }

      sql += ' ORDER BY date_range_start DESC';

      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows.map(row => ({
        tierId: row.tier_id,
        tierName: row.tier_name,
        dateRangeStart: row.date_range_start,
        dateRangeEnd: row.date_range_end,
        storageLocation: row.storage_location,
        ociBucket: row.oci_bucket,
        ociNamespace: row.oci_namespace,
        ociRegion: row.oci_region,
        filePrefix: row.file_prefix,
        compressionType: row.compression_type,
        encryptionEnabled: row.encryption_enabled,
        recordsCount: row.records_count,
        sizeBytes: row.size_bytes,
        sizeCompressed: row.size_compressed,
        lastAccessed: row.last_accessed,
        accessCount: row.access_count,
        restorationStatus: row.restoration_status
      }));
    } catch (error) {
      logger.error('Failed to get storage tiers', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get cold storage items older than specified date
   */
  async getColdStorageOlderThan(cutoffDate) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT 
          tier_id, tier_name, date_range_start, date_range_end,
          storage_location, oci_bucket, oci_namespace, file_prefix,
          size_bytes, size_compressed, records_count
        FROM pf_analytics_storage_tiers
        WHERE tier_name = 'cold'
          AND date_range_end < :cutoffDate
        ORDER BY date_range_start`,
        { cutoffDate },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return result.rows.map(row => ({
        tierId: row.tier_id,
        tierName: row.tier_name,
        dateRangeStart: row.date_range_start,
        dateRangeEnd: row.date_range_end,
        storageLocation: row.storage_location,
        ociBucket: row.oci_bucket,
        ociNamespace: row.oci_namespace,
        filePrefix: row.file_prefix,
        sizeBytes: row.size_bytes,
        sizeCompressed: row.size_compressed,
        recordsCount: row.records_count
      }));
    } catch (error) {
      logger.error('Failed to get old cold storage', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Update tier last accessed timestamp
   */
  async updateTierLastAccessed(tierId) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute(
        `UPDATE pf_analytics_storage_tiers
         SET last_accessed = CURRENT_TIMESTAMP,
             access_count = access_count + 1
         WHERE tier_id = :tierId`,
        { tierId }
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to update tier access', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save funnel analysis
   */
  async saveFunnelAnalysis(funnelData) {
    const connection = await this.database.getConnection();
    
    try {
      const sql = `
        MERGE INTO pf_analytics_funnels f
        USING (SELECT :funnelName AS funnel_name FROM dual) d
        ON (f.funnel_name = d.funnel_name)
        WHEN MATCHED THEN
          UPDATE SET
            steps = :steps,
            total_steps = :totalSteps,
            analysis_start_date = :analysisStartDate,
            analysis_end_date = :analysisEndDate,
            total_users = :totalUsers,
            conversion_rate = :conversionRate,
            avg_time_to_convert = :avgTimeToConvert,
            step_conversion_rates = :stepConversionRates,
            drop_off_points = :dropOffPoints,
            updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            funnel_id, funnel_name, funnel_type, steps, total_steps,
            analysis_start_date, analysis_end_date, total_users,
            conversion_rate, avg_time_to_convert, step_conversion_rates,
            drop_off_points, created_by
          ) VALUES (
            :funnelId, :funnelName, :funnelType, :steps, :totalSteps,
            :analysisStartDate, :analysisEndDate, :totalUsers,
            :conversionRate, :avgTimeToConvert, :stepConversionRates,
            :dropOffPoints, :createdBy
          )
      `;

      const binds = {
        funnelId: funnelData.funnelId || ulid(),
        funnelName: funnelData.funnelName,
        funnelType: funnelData.funnelType || 'custom',
        steps: JSON.stringify(funnelData.steps),
        totalSteps: funnelData.totalSteps,
        analysisStartDate: funnelData.analysisStartDate,
        analysisEndDate: funnelData.analysisEndDate,
        totalUsers: funnelData.totalUsers || 0,
        conversionRate: funnelData.conversionRate || 0,
        avgTimeToConvert: funnelData.avgTimeToConvert || 0,
        stepConversionRates: JSON.stringify(funnelData.stepConversionRates || {}),
        dropOffPoints: JSON.stringify(funnelData.dropOffPoints || {}),
        createdBy: funnelData.createdBy || null
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.info('Funnel analysis saved', { funnelName: funnelData.funnelName });
      return binds.funnelId;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save funnel analysis', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save cohort analysis
   */
  async saveCohortAnalysis(cohortData) {
    const connection = await this.database.getConnection();
    
    try {
      const sql = `
        MERGE INTO pf_analytics_cohorts c
        USING (
          SELECT :cohortName AS cohort_name, :cohortDate AS cohort_date FROM dual
        ) d
        ON (c.cohort_name = d.cohort_name AND c.cohort_date = d.cohort_date)
        WHEN MATCHED THEN
          UPDATE SET
            user_count = :userCount,
            user_ids = :userIds,
            retention_data = :retentionData,
            day_1_retention = :day1Retention,
            day_7_retention = :day7Retention,
            day_30_retention = :day30Retention,
            day_90_retention = :day90Retention,
            updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            cohort_id, cohort_name, cohort_date, cohort_type,
            definition_criteria, user_count, user_ids, retention_data,
            day_1_retention, day_7_retention, day_30_retention, day_90_retention
          ) VALUES (
            :cohortId, :cohortName, :cohortDate, :cohortType,
            :definitionCriteria, :userCount, :userIds, :retentionData,
            :day1Retention, :day7Retention, :day30Retention, :day90Retention
          )
      `;

      const binds = {
        cohortId: cohortData.cohortId || ulid(),
        cohortName: cohortData.cohortName,
        cohortDate: cohortData.cohortDate,
        cohortType: cohortData.cohortType || 'acquisition',
        definitionCriteria: JSON.stringify(cohortData.definitionCriteria || {}),
        userCount: cohortData.userCount,
        userIds: JSON.stringify(cohortData.userIds || []),
        retentionData: JSON.stringify(cohortData.retentionData || {}),
        day1Retention: cohortData.day1Retention || 0,
        day7Retention: cohortData.day7Retention || 0,
        day30Retention: cohortData.day30Retention || 0,
        day90Retention: cohortData.day90Retention || 0
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.info('Cohort analysis saved', { 
        cohortName: cohortData.cohortName,
        cohortDate: cohortData.cohortDate 
      });

      return binds.cohortId;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save cohort analysis', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get real-time cache data
   */
  async getRealtimeCache(cacheKey) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT 
          cache_key, cache_type, user_id, metric_value, metric_data,
          created_at, expires_at, hit_count
        FROM pf_analytics_realtime_cache
        WHERE cache_key = :cacheKey
          AND expires_at > CURRENT_TIMESTAMP`,
        { cacheKey },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchInfo: {
            metric_data: { type: oracledb.STRING }
          }
        }
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Update hit count
      await connection.execute(
        `UPDATE pf_analytics_realtime_cache
         SET hit_count = hit_count + 1,
             last_accessed = CURRENT_TIMESTAMP
         WHERE cache_key = :cacheKey`,
        { cacheKey }
      );
      await connection.commit();

      const row = result.rows[0];
      return {
        ...row,
        metricData: this.parseJson(row.metric_data)
      };
    } catch (error) {
      logger.error('Failed to get cache', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Set real-time cache data
   */
  async setRealtimeCache(cacheKey, cacheData, ttlSeconds = 300) {
    const connection = await this.database.getConnection();
    
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const sql = `
        MERGE INTO pf_analytics_realtime_cache c
        USING (SELECT :cacheKey AS cache_key FROM dual) d
        ON (c.cache_key = d.cache_key)
        WHEN MATCHED THEN
          UPDATE SET
            cache_type = :cacheType,
            user_id = :userId,
            metric_value = :metricValue,
            metric_data = :metricData,
            expires_at = :expiresAt,
            hit_count = 0,
            last_accessed = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            cache_key, cache_type, user_id, metric_value,
            metric_data, expires_at
          ) VALUES (
            :cacheKey, :cacheType, :userId, :metricValue,
            :metricData, :expiresAt
          )
      `;

      const binds = {
        cacheKey,
        cacheType: cacheData.cacheType || 'custom',
        userId: cacheData.userId || null,
        metricValue: cacheData.metricValue || null,
        metricData: JSON.stringify(cacheData.metricData || {}),
        expiresAt
      };

      await connection.execute(sql, binds);
      await connection.commit();

      logger.debug('Cache set', { cacheKey, ttl: ttlSeconds });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to set cache', { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Helper methods
   */
  parseJson(jsonString, defaultValue = null) {
    if (!jsonString) return defaultValue;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('Failed to parse JSON', { json: jsonString });
      return defaultValue;
    }
  }

  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = UserAnalyticsRepository;