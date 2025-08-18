/**
 * Migration: Create User Analytics Tables with Tiered Storage Support
 * 
 * This migration creates the comprehensive analytics schema for:
 * - Event tracking with partitioning
 * - Session management
 * - Aggregated metrics
 * - Storage tier metadata for OCI integration
 * - Real-time analytics support
 */

const oracledb = require('oracledb');

module.exports = {
  up: async (connection) => {
    try {
      console.log('Creating user analytics tables...');

      // 1. Create user events table with daily partitioning
      await connection.execute(`
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
          screen_resolution VARCHAR2(20),
          viewport_size VARCHAR2(20),
          
          -- Geo location
          country_code VARCHAR2(2),
          region VARCHAR2(100),
          city VARCHAR2(100),
          latitude NUMBER(10,7),
          longitude NUMBER(10,7),
          
          -- Custom properties as JSON
          properties CLOB CONSTRAINT chk_events_properties_json CHECK (properties IS JSON),
          
          -- Timing and processing
          event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          processing_timestamp TIMESTAMP,
          received_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Data quality
          is_duplicate CHAR(1) DEFAULT 'N' CHECK (is_duplicate IN ('Y', 'N')),
          validation_status VARCHAR2(20) DEFAULT 'pending',
          
          CONSTRAINT chk_event_type CHECK (event_type IN (
            'page_view', 'click', 'scroll', 'form_submit', 'search',
            'feature_usage', 'api_call', 'error', 'timing', 'custom',
            'session_start', 'session_end', 'conversion', 'goal_completion'
          ))
        ) PARTITION BY RANGE (event_timestamp) 
          INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
          (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'))
      `);

      // Create indexes for user events
      await connection.execute(`
        CREATE INDEX idx_events_user_time ON pf_user_events (user_id, event_timestamp) LOCAL
      `);
      
      await connection.execute(`
        CREATE INDEX idx_events_session ON pf_user_events (session_id) LOCAL
      `);
      
      await connection.execute(`
        CREATE INDEX idx_events_type_time ON pf_user_events (event_type, event_timestamp) LOCAL
      `);

      await connection.execute(`
        CREATE INDEX idx_events_processing ON pf_user_events (processing_timestamp) 
        WHERE processing_timestamp IS NULL LOCAL
      `);

      // 2. Create session analytics table
      await connection.execute(`
        CREATE TABLE pf_user_sessions_analytics (
          session_id VARCHAR2(26) PRIMARY KEY,
          user_id VARCHAR2(26) NOT NULL,
          session_start TIMESTAMP NOT NULL,
          session_end TIMESTAMP,
          duration_seconds NUMBER(10),
          is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
          
          -- Session metrics
          page_count NUMBER(10) DEFAULT 0,
          event_count NUMBER(10) DEFAULT 0,
          error_count NUMBER(10) DEFAULT 0,
          api_call_count NUMBER(10) DEFAULT 0,
          
          -- Entry/Exit tracking
          entry_page VARCHAR2(500),
          exit_page VARCHAR2(500),
          entry_referrer VARCHAR2(500),
          
          -- Device and browser info
          device_type VARCHAR2(50),
          browser VARCHAR2(50),
          browser_version VARCHAR2(20),
          os VARCHAR2(50),
          os_version VARCHAR2(20),
          is_mobile CHAR(1) DEFAULT 'N' CHECK (is_mobile IN ('Y', 'N')),
          
          -- Location
          ip_address VARCHAR2(45),
          country_code VARCHAR2(2),
          region VARCHAR2(100),
          city VARCHAR2(100),
          timezone VARCHAR2(50),
          
          -- Session quality
          bounce CHAR(1) DEFAULT 'N' CHECK (bounce IN ('Y', 'N')),
          engagement_score NUMBER(5,2),
          
          -- Conversion tracking
          conversion_events CLOB CONSTRAINT chk_sessions_conversion_json CHECK (conversion_events IS JSON),
          session_value NUMBER(10,2),
          
          -- Additional data
          utm_source VARCHAR2(100),
          utm_medium VARCHAR2(100),
          utm_campaign VARCHAR2(100),
          utm_term VARCHAR2(100),
          utm_content VARCHAR2(100),
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      -- Create indexes for sessions
      await connection.execute(`
        CREATE INDEX idx_sessions_user ON pf_user_sessions_analytics (user_id)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_sessions_start ON pf_user_sessions_analytics (session_start)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_sessions_active ON pf_user_sessions_analytics (is_active) 
        WHERE is_active = 'Y'
      `);

      // 3. Create daily aggregated metrics table with partitioning
      await connection.execute(`
        CREATE TABLE pf_user_metrics_daily (
          metric_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
          user_id VARCHAR2(26) NOT NULL,
          metric_date DATE NOT NULL,
          
          -- Activity metrics
          total_events NUMBER(10) DEFAULT 0,
          total_sessions NUMBER(10) DEFAULT 0,
          total_duration_seconds NUMBER(10) DEFAULT 0,
          avg_session_duration NUMBER(10,2),
          page_views NUMBER(10) DEFAULT 0,
          unique_pages NUMBER(10) DEFAULT 0,
          
          -- Engagement metrics
          engagement_score NUMBER(5,2),
          bounce_rate NUMBER(5,2),
          pages_per_session NUMBER(10,2),
          
          -- Feature usage (JSON aggregation)
          actions_performed CLOB CONSTRAINT chk_metrics_actions_json CHECK (actions_performed IS JSON),
          features_used CLOB CONSTRAINT chk_metrics_features_json CHECK (features_used IS JSON),
          
          -- Performance metrics
          avg_page_load_time NUMBER(10,2),
          avg_api_response_time NUMBER(10,2),
          error_count NUMBER(10) DEFAULT 0,
          error_rate NUMBER(5,2),
          
          -- Conversion metrics
          conversions NUMBER(10) DEFAULT 0,
          conversion_value NUMBER(15,2),
          goals_completed NUMBER(10) DEFAULT 0,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT uk_user_metrics_date UNIQUE (user_id, metric_date)
        ) PARTITION BY RANGE (metric_date) 
          INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
          (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'))
      `);

      -- Create indexes for metrics
      await connection.execute(`
        CREATE INDEX idx_metrics_date ON pf_user_metrics_daily (metric_date) LOCAL
      `);
      
      await connection.execute(`
        CREATE INDEX idx_metrics_user_date ON pf_user_metrics_daily (user_id, metric_date) LOCAL
      `);

      // 4. Create storage tier metadata table for OCI integration
      await connection.execute(`
        CREATE TABLE pf_analytics_storage_tiers (
          tier_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
          tier_name VARCHAR2(50) NOT NULL CHECK (tier_name IN ('hot', 'cold', 'archive')),
          date_range_start DATE NOT NULL,
          date_range_end DATE NOT NULL,
          
          -- Storage location
          storage_location VARCHAR2(500) NOT NULL,
          oci_bucket VARCHAR2(100),
          oci_namespace VARCHAR2(100),
          oci_region VARCHAR2(50),
          file_prefix VARCHAR2(200),
          
          -- Storage properties
          compression_type VARCHAR2(20) DEFAULT 'gzip',
          encryption_enabled CHAR(1) DEFAULT 'Y' CHECK (encryption_enabled IN ('Y', 'N')),
          encryption_key_id VARCHAR2(100),
          
          -- Metadata
          records_count NUMBER(15),
          size_bytes NUMBER(15),
          size_compressed NUMBER(15),
          checksum VARCHAR2(64),
          
          -- Access tracking
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_accessed TIMESTAMP,
          access_count NUMBER(10) DEFAULT 0,
          restoration_status VARCHAR2(20),
          restoration_expiry TIMESTAMP,
          
          -- Migration status
          migration_status VARCHAR2(20) DEFAULT 'pending',
          migration_started_at TIMESTAMP,
          migration_completed_at TIMESTAMP,
          migration_error VARCHAR2(4000),
          
          CONSTRAINT chk_date_range CHECK (date_range_end >= date_range_start)
        )
      `);

      -- Create indexes for storage tiers
      await connection.execute(`
        CREATE INDEX idx_tier_dates ON pf_analytics_storage_tiers (date_range_start, date_range_end)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_tier_name_dates ON pf_analytics_storage_tiers (tier_name, date_range_start)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_tier_migration ON pf_analytics_storage_tiers (migration_status) 
        WHERE migration_status IN ('pending', 'in_progress')
      `);

      // 5. Create real-time analytics cache table
      await connection.execute(`
        CREATE TABLE pf_analytics_realtime_cache (
          cache_key VARCHAR2(200) PRIMARY KEY,
          cache_type VARCHAR2(50) NOT NULL,
          user_id VARCHAR2(26),
          
          -- Cached data
          metric_value NUMBER(15,2),
          metric_data CLOB CONSTRAINT chk_cache_data_json CHECK (metric_data IS JSON),
          
          -- Cache management
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          hit_count NUMBER(10) DEFAULT 0,
          last_accessed TIMESTAMP,
          
          CONSTRAINT chk_cache_type CHECK (cache_type IN (
            'user_activity', 'engagement_score', 'feature_usage',
            'conversion_rate', 'session_stats', 'custom'
          ))
        )
      `);

      -- Create index for cache expiry
      await connection.execute(`
        CREATE INDEX idx_cache_expiry ON pf_analytics_realtime_cache (expires_at)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_cache_user ON pf_analytics_realtime_cache (user_id) 
        WHERE user_id IS NOT NULL
      `);

      // 6. Create funnel analysis table
      await connection.execute(`
        CREATE TABLE pf_analytics_funnels (
          funnel_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
          funnel_name VARCHAR2(100) NOT NULL,
          funnel_type VARCHAR2(50) DEFAULT 'custom',
          
          -- Funnel definition
          steps CLOB NOT NULL CONSTRAINT chk_funnel_steps_json CHECK (steps IS JSON),
          total_steps NUMBER(3) NOT NULL,
          
          -- Time window
          analysis_start_date DATE,
          analysis_end_date DATE,
          
          -- Results
          total_users NUMBER(10),
          conversion_rate NUMBER(5,2),
          avg_time_to_convert NUMBER(10,2),
          step_conversion_rates CLOB CONSTRAINT chk_funnel_rates_json CHECK (step_conversion_rates IS JSON),
          drop_off_points CLOB CONSTRAINT chk_funnel_dropoff_json CHECK (drop_off_points IS JSON),
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR2(26),
          
          CONSTRAINT uk_funnel_name UNIQUE (funnel_name)
        )
      `);

      // 7. Create cohort analysis table
      await connection.execute(`
        CREATE TABLE pf_analytics_cohorts (
          cohort_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
          cohort_name VARCHAR2(100) NOT NULL,
          cohort_date DATE NOT NULL,
          cohort_type VARCHAR2(50) DEFAULT 'acquisition',
          
          -- Cohort definition
          definition_criteria CLOB CONSTRAINT chk_cohort_criteria_json CHECK (definition_criteria IS JSON),
          user_count NUMBER(10) NOT NULL,
          user_ids CLOB CONSTRAINT chk_cohort_users_json CHECK (user_ids IS JSON),
          
          -- Retention data
          retention_data CLOB CONSTRAINT chk_cohort_retention_json CHECK (retention_data IS JSON),
          
          -- Metrics
          day_1_retention NUMBER(5,2),
          day_7_retention NUMBER(5,2),
          day_30_retention NUMBER(5,2),
          day_90_retention NUMBER(5,2),
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT uk_cohort_name_date UNIQUE (cohort_name, cohort_date)
        )
      `);

      -- Create indexes for cohorts
      await connection.execute(`
        CREATE INDEX idx_cohort_date ON pf_analytics_cohorts (cohort_date)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_cohort_type ON pf_analytics_cohorts (cohort_type)
      `);

      // 8. Create custom events table for flexibility
      await connection.execute(`
        CREATE TABLE pf_custom_analytics_events (
          event_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
          user_id VARCHAR2(26),
          event_name VARCHAR2(100) NOT NULL,
          event_namespace VARCHAR2(50),
          
          -- Flexible event data
          event_data CLOB NOT NULL CONSTRAINT chk_custom_event_json CHECK (event_data IS JSON),
          
          -- Metadata
          source_system VARCHAR2(50),
          correlation_id VARCHAR2(100),
          event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed CHAR(1) DEFAULT 'N' CHECK (processed IN ('Y', 'N')),
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      -- Create indexes for custom events
      await connection.execute(`
        CREATE INDEX idx_custom_events_user ON pf_custom_analytics_events (user_id) 
        WHERE user_id IS NOT NULL
      `);
      
      await connection.execute(`
        CREATE INDEX idx_custom_events_name ON pf_custom_analytics_events (event_name)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_custom_events_timestamp ON pf_custom_analytics_events (event_timestamp)
      `);
      
      await connection.execute(`
        CREATE INDEX idx_custom_events_unprocessed ON pf_custom_analytics_events (processed) 
        WHERE processed = 'N'
      `);

      // 9. Create materialized view for performance dashboard
      await connection.execute(`
        CREATE MATERIALIZED VIEW pf_analytics_dashboard_mv
        BUILD IMMEDIATE
        REFRESH COMPLETE ON DEMAND
        AS
        SELECT 
          TRUNC(event_timestamp) as event_date,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_events,
          SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as page_views,
          SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END) as errors,
          SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversions,
          AVG(CASE WHEN event_type = 'timing' THEN event_value ELSE NULL END) as avg_load_time
        FROM pf_user_events
        WHERE event_timestamp >= TRUNC(SYSDATE) - 30
        GROUP BY TRUNC(event_timestamp)
      `);

      -- Create index on materialized view
      await connection.execute(`
        CREATE INDEX idx_dashboard_mv_date ON pf_analytics_dashboard_mv (event_date)
      `);

      // 10. Create procedure for automatic data tiering
      await connection.execute(`
        CREATE OR REPLACE PROCEDURE pf_analytics_auto_tiering AS
          v_cutoff_date DATE;
          v_record_count NUMBER;
        BEGIN
          -- Calculate cutoff date (90 days ago)
          v_cutoff_date := TRUNC(SYSDATE) - 90;
          
          -- Count records to be migrated
          SELECT COUNT(*) INTO v_record_count
          FROM pf_user_events
          WHERE event_timestamp < v_cutoff_date
            AND ROWNUM <= 1000000; -- Process in batches
          
          IF v_record_count > 0 THEN
            -- Insert migration job metadata
            INSERT INTO pf_analytics_storage_tiers (
              tier_name, date_range_start, date_range_end,
              storage_location, migration_status, records_count
            ) VALUES (
              'cold', 
              v_cutoff_date - 90,
              v_cutoff_date,
              'pending_migration',
              'pending',
              v_record_count
            );
            
            COMMIT;
          END IF;
        END pf_analytics_auto_tiering;
      `);

      // 11. Create cleanup job for expired cache
      await connection.execute(`
        CREATE OR REPLACE PROCEDURE pf_analytics_cache_cleanup AS
        BEGIN
          DELETE FROM pf_analytics_realtime_cache
          WHERE expires_at < SYSTIMESTAMP;
          
          COMMIT;
        END pf_analytics_cache_cleanup;
      `);

      // 12. Schedule jobs (if DBMS_SCHEDULER is available)
      try {
        // Schedule auto-tiering job to run daily at 2 AM
        await connection.execute(`
          BEGIN
            DBMS_SCHEDULER.create_job (
              job_name        => 'PF_ANALYTICS_TIERING_JOB',
              job_type        => 'PLSQL_BLOCK',
              job_action      => 'BEGIN pf_analytics_auto_tiering; END;',
              start_date      => SYSTIMESTAMP,
              repeat_interval => 'FREQ=DAILY; BYHOUR=2; BYMINUTE=0',
              enabled         => TRUE,
              comments        => 'Automatic data tiering for analytics'
            );
          END;
        `);

        // Schedule cache cleanup to run every hour
        await connection.execute(`
          BEGIN
            DBMS_SCHEDULER.create_job (
              job_name        => 'PF_ANALYTICS_CACHE_CLEANUP_JOB',
              job_type        => 'PLSQL_BLOCK',
              job_action      => 'BEGIN pf_analytics_cache_cleanup; END;',
              start_date      => SYSTIMESTAMP,
              repeat_interval => 'FREQ=HOURLY',
              enabled         => TRUE,
              comments        => 'Clean up expired analytics cache entries'
            );
          END;
        `);

        // Schedule materialized view refresh daily at 1 AM
        await connection.execute(`
          BEGIN
            DBMS_SCHEDULER.create_job (
              job_name        => 'PF_ANALYTICS_MV_REFRESH_JOB',
              job_type        => 'PLSQL_BLOCK',
              job_action      => 'BEGIN DBMS_MVIEW.refresh(''PF_ANALYTICS_DASHBOARD_MV''); END;',
              start_date      => SYSTIMESTAMP,
              repeat_interval => 'FREQ=DAILY; BYHOUR=1; BYMINUTE=0',
              enabled         => TRUE,
              comments        => 'Refresh analytics dashboard materialized view'
            );
          END;
        `);
      } catch (err) {
        console.log('Note: Scheduler jobs could not be created. You may need to set them up manually.');
        console.log('Error:', err.message);
      }

      console.log('User analytics tables created successfully');
      
    } catch (error) {
      console.error('Error creating user analytics tables:', error);
      throw error;
    }
  },

  down: async (connection) => {
    try {
      console.log('Dropping user analytics tables...');

      // Drop scheduled jobs
      try {
        await connection.execute(`
          BEGIN
            DBMS_SCHEDULER.drop_job('PF_ANALYTICS_TIERING_JOB', TRUE);
            DBMS_SCHEDULER.drop_job('PF_ANALYTICS_CACHE_CLEANUP_JOB', TRUE);
            DBMS_SCHEDULER.drop_job('PF_ANALYTICS_MV_REFRESH_JOB', TRUE);
          END;
        `);
      } catch (err) {
        console.log('Jobs may not exist, continuing...');
      }

      // Drop procedures
      await connection.execute(`DROP PROCEDURE pf_analytics_auto_tiering`);
      await connection.execute(`DROP PROCEDURE pf_analytics_cache_cleanup`);

      // Drop materialized view
      await connection.execute(`DROP MATERIALIZED VIEW pf_analytics_dashboard_mv`);

      // Drop tables
      await connection.execute(`DROP TABLE pf_custom_analytics_events PURGE`);
      await connection.execute(`DROP TABLE pf_analytics_cohorts PURGE`);
      await connection.execute(`DROP TABLE pf_analytics_funnels PURGE`);
      await connection.execute(`DROP TABLE pf_analytics_realtime_cache PURGE`);
      await connection.execute(`DROP TABLE pf_analytics_storage_tiers PURGE`);
      await connection.execute(`DROP TABLE pf_user_metrics_daily PURGE`);
      await connection.execute(`DROP TABLE pf_user_sessions_analytics PURGE`);
      await connection.execute(`DROP TABLE pf_user_events PURGE`);

      console.log('User analytics tables dropped successfully');
      
    } catch (error) {
      console.error('Error dropping user analytics tables:', error);
      throw error;
    }
  }
};