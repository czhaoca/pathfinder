const crypto = require('crypto');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class AuditService extends EventEmitter {
  constructor(db, config = {}) {
    super();
    this.db = db;
    this.config = {
      auditFlushInterval: 5000,
      bufferSize: 1000,
      fallbackLogPath: '/var/log/pathfinder/audit-fallback.log',
      archivalInterval: 3600000, // 1 hour in milliseconds
      archivalEnabled: true,
      ...config
    };
    
    this.buffer = [];
    this.flushInterval = null;
    this.archivalInterval = null;
    this.previousHash = null;
    this.isProcessing = false;
    
    // Start buffer flush interval
    this.startBufferFlush();
    
    // Start automatic archival if enabled
    if (this.config.archivalEnabled) {
      this.startAutomaticArchival();
    }
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async log(event) {
    try {
      // Validate required fields
      this.validateEvent(event);
      
      // Enrich event with context
      const enrichedEvent = await this.enrichEvent(event);
      
      // Calculate event hash for integrity
      enrichedEvent.event_hash = this.calculateEventHash(enrichedEvent);
      enrichedEvent.previous_hash = this.previousHash;
      
      // Update previous hash for chaining
      this.previousHash = enrichedEvent.event_hash;
      
      // Add to buffer for batch processing
      this.buffer.push(enrichedEvent);
      
      // Emit event for real-time processing (async, non-blocking)
      setImmediate(() => {
        this.emit('audit_event', enrichedEvent);
      });
      
      // Check for critical events asynchronously
      if (this.isCriticalEvent(enrichedEvent)) {
        // Handle critical event asynchronously to avoid blocking
        setImmediate(() => {
          this.handleCriticalEvent(enrichedEvent).catch(error => {
            console.error('Critical event handling failed:', error);
            this.fallbackLog({ ...enrichedEvent, critical_event_error: error.message }, error);
          });
        });
      }
      
      // Check if flush is needed (async, non-blocking)
      if (this.shouldFlushImmediately(enrichedEvent)) {
        // Immediate flush for critical events, but don't block
        setImmediate(() => {
          this.flush().catch(error => {
            console.error('Immediate flush failed:', error);
          });
        });
      } else if (this.buffer.length >= this.config.bufferSize) {
        // Regular flush when buffer is full (async)
        setImmediate(() => {
          this.flush().catch(error => {
            console.error('Buffer flush failed:', error);
          });
        });
      }
      
      return enrichedEvent.id;
      
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Fallback to file logging if database fails (async)
      setImmediate(() => {
        this.fallbackLog(event, error).catch(fallbackError => {
          console.error('Fallback logging also failed:', fallbackError);
        });
      });
      // Don't throw error to avoid breaking the application
      return null;
    }
  }

  validateEvent(event) {
    const required = ['event_type', 'event_category', 'event_severity', 'event_name', 'action', 'action_result'];
    for (const field of required) {
      if (!event[field]) {
        throw new Error(`Missing required audit field: ${field}`);
      }
    }
  }

  async enrichEvent(event) {
    const enriched = {
      id: crypto.randomUUID(),
      event_timestamp: new Date(),
      event_id: `EVT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      actor_type: event.actor_type || 'system',
      ...event
    };

    // Add request context if available
    if (global.requestContext) {
      enriched.request_id = global.requestContext.requestId;
      enriched.session_id = global.requestContext.sessionId;
      enriched.ip_address = global.requestContext.ip;
      enriched.user_agent = global.requestContext.userAgent;
    }

    // Add application context
    enriched.application_name = this.config.appName || 'pathfinder';
    enriched.application_version = this.config.appVersion || process.env.npm_package_version;
    
    // Determine data sensitivity
    enriched.data_sensitivity = this.classifyDataSensitivity(event);
    
    // Add compliance tags
    enriched.compliance_frameworks = JSON.stringify(this.getComplianceTags(event));
    
    // Calculate risk score
    enriched.risk_score = await this.calculateRiskScore(event);
    
    // Convert JSON fields to strings for Oracle (with error handling)
    try {
      if (enriched.actor_roles && typeof enriched.actor_roles === 'object') {
        enriched.actor_roles = JSON.stringify(enriched.actor_roles);
      }
      if (enriched.old_values && typeof enriched.old_values === 'object') {
        enriched.old_values = JSON.stringify(enriched.old_values);
      }
      if (enriched.new_values && typeof enriched.new_values === 'object') {
        enriched.new_values = JSON.stringify(enriched.new_values);
      }
      if (enriched.changed_fields && typeof enriched.changed_fields === 'object') {
        enriched.changed_fields = JSON.stringify(enriched.changed_fields);
      }
      if (enriched.authorization_checks && typeof enriched.authorization_checks === 'object') {
        enriched.authorization_checks = JSON.stringify(enriched.authorization_checks);
      }
      if (enriched.security_labels && typeof enriched.security_labels === 'object') {
        enriched.security_labels = JSON.stringify(enriched.security_labels);
      }
      if (enriched.threat_indicators && typeof enriched.threat_indicators === 'object') {
        enriched.threat_indicators = JSON.stringify(enriched.threat_indicators);
      }
      if (enriched.tags && typeof enriched.tags === 'object') {
        enriched.tags = JSON.stringify(enriched.tags);
      }
      if (enriched.custom_data && typeof enriched.custom_data === 'object') {
        enriched.custom_data = JSON.stringify(enriched.custom_data);
      }
    } catch (jsonError) {
      console.error('Error stringifying JSON fields:', jsonError);
      // Set problematic fields to error message
      enriched.error_message = `JSON serialization error: ${jsonError.message}`;
    }
    
    return enriched;
  }

  classifyDataSensitivity(event) {
    // Check for sensitive data patterns
    const restrictedTables = ['pf_users', 'pf_user_sessions', 'pf_encryption_keys'];
    const confidentialTables = ['experiences_detailed', 'career_progression'];
    
    if (event.target_table) {
      if (restrictedTables.some(t => event.target_table.includes(t))) {
        return 'restricted';
      }
      if (confidentialTables.some(t => event.target_table.includes(t))) {
        return 'confidential';
      }
    }
    
    if (event.event_type === 'authentication' || event.event_type === 'authorization') {
      return 'confidential';
    }
    
    return 'internal';
  }

  getComplianceTags(event) {
    const tags = [];
    
    // HIPAA relevant events
    if (event.target_table?.includes('experiences') || 
        event.target_table?.includes('career') ||
        event.event_type === 'data_access' ||
        event.event_type === 'data_modification') {
      tags.push('HIPAA');
    }
    
    // GDPR relevant events
    if (event.target_table?.includes('users') ||
        event.action === 'delete' ||
        event.action === 'export') {
      tags.push('GDPR');
    }
    
    // SOC2 relevant events
    if (event.event_type === 'authentication' ||
        event.event_type === 'authorization' ||
        event.event_type === 'system') {
      tags.push('SOC2');
    }
    
    return tags;
  }

  calculateEventHash(event) {
    // Create deterministic hash of critical event data
    const data = {
      timestamp: event.event_timestamp,
      type: event.event_type,
      actor: event.actor_id || event.actor_username,
      action: event.action,
      target: event.target_id,
      result: event.action_result,
      previous: this.previousHash
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  async calculateRiskScore(event) {
    let score = 0;
    
    // Failed authentication attempts
    if (event.event_type === 'authentication' && event.action_result === 'failure') {
      score += 20;
      
      // Only check for multiple failures if we have identifying information
      // and this is a critical event type (avoid DB calls for low-risk events)
      if ((event.actor_id || event.ip_address) && score >= 20) {
        try {
          const recentFailures = await this.getRecentFailures(
            event.actor_id, 
            event.ip_address
          );
          score += Math.min(recentFailures * 10, 50);
        } catch (error) {
          // If DB check fails, use default scoring
          console.warn('Failed to check recent failures:', error);
          score += 10; // Add moderate risk for unknown failure history
        }
      }
    }
    
    // Unauthorized access attempts
    if (event.event_type === 'authorization' && event.action_result === 'failure') {
      score += 30;
    }
    
    // Sensitive data access
    if (event.data_sensitivity === 'restricted') {
      score += 25;
    } else if (event.data_sensitivity === 'confidential') {
      score += 15;
    }
    
    // Off-hours access (assuming business hours are 6 AM to 10 PM)
    if (event.event_timestamp) {
      const hour = new Date(event.event_timestamp).getHours();
      if (hour < 6 || hour > 22) {
        score += 10;
      }
    }
    
    // Administrative actions
    if (event.actor_roles) {
      try {
        const roles = typeof event.actor_roles === 'string' 
          ? JSON.parse(event.actor_roles) 
          : event.actor_roles;
        if (Array.isArray(roles) && (roles.includes('admin') || roles.includes('site_admin'))) {
          score += 15;
        }
      } catch (parseError) {
        // If parsing fails, skip role-based scoring
        console.warn('Failed to parse actor_roles:', parseError);
      }
    }
    
    // Data deletion
    if (event.action === 'delete') {
      score += 20;
    }
    
    // Large data exports
    if (event.action === 'export' && event.custom_data?.recordCount > 1000) {
      score += 25;
    }
    
    return Math.min(score, 100);
  }

  async getRecentFailures(actorId, ipAddress) {
    try {
      const query = `
        SELECT COUNT(*) as failure_count
        FROM pf_audit_log
        WHERE event_type = 'authentication'
        AND action_result = 'failure'
        AND event_timestamp > SYSTIMESTAMP - INTERVAL '1' HOUR
        AND (actor_id = :actorId OR ip_address = :ipAddress)
      `;
      
      const result = await this.db.execute(query, { actorId, ipAddress });
      return result.rows[0]?.failure_count || 0;
    } catch (error) {
      console.error('Error checking recent failures:', error);
      return 0;
    }
  }

  shouldFlushImmediately(event) {
    return event.event_severity === 'critical' || 
           event.event_severity === 'emergency' ||
           event.event_type === 'security' ||
           event.risk_score > 70;
  }

  async flush() {
    if (this.buffer.length === 0 || this.isProcessing) return;
    
    this.isProcessing = true;
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      // Batch insert for performance
      await this.batchInsertAuditLogs(events);
      
      // Update search index
      await this.updateSearchIndex(events);
      
      // Check retention policies
      if (Math.random() < 0.01) { // Run 1% of the time to avoid overhead
        await this.applyRetentionPolicies();
      }
      
    } catch (error) {
      console.error('Failed to flush audit buffer:', error);
      // Re-add to buffer for retry
      this.buffer.unshift(...events);
      
      // Try fallback logging
      for (const event of events) {
        await this.fallbackLog(event, error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async batchInsertAuditLogs(events) {
    if (events.length === 0) return;
    
    // Limit batch size to prevent memory issues
    const maxBatchSize = 100;
    if (events.length > maxBatchSize) {
      // Process in chunks
      for (let i = 0; i < events.length; i += maxBatchSize) {
        const chunk = events.slice(i, i + maxBatchSize);
        await this.batchInsertAuditLogs(chunk);
      }
      return;
    }
    
    const columns = [
      'id', 'event_timestamp', 'event_id', 'event_type', 'event_category',
      'event_severity', 'event_name', 'event_description', 'actor_type',
      'actor_id', 'actor_username', 'actor_roles', 'target_type', 'target_id',
      'target_name', 'target_table', 'action', 'action_result', 'action_reason',
      'error_code', 'error_message', 'old_values', 'new_values', 'changed_fields',
      'data_sensitivity', 'request_id', 'session_id', 'correlation_id',
      'ip_address', 'user_agent', 'application_name', 'application_version',
      'http_method', 'http_path', 'http_status_code', 'response_time_ms',
      'risk_score', 'compliance_frameworks', 'event_hash', 'previous_hash'
    ];
    
    const values = events.map(event => columns.map(col => event[col] || null));
    
    // Build the insert query
    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `:${i}_${j}`).join(', ')})`
    ).join(', ');
    
    const query = `
      INSERT INTO pf_audit_log (${columns.join(', ')})
      VALUES ${placeholders}
    `;
    
    // Flatten the values for binding
    const bindings = {};
    values.forEach((row, i) => {
      row.forEach((val, j) => {
        bindings[`${i}_${j}`] = val;
      });
    });
    
    await this.db.execute(query, bindings);
  }

  async updateSearchIndex(events) {
    // Update search index for faster queries
    const indexEntries = events.map(event => ({
      audit_log_id: event.id,
      search_text: `${event.event_name} ${event.event_description} ${event.actor_username} ${event.target_name}`,
      event_date: new Date(event.event_timestamp).toISOString().split('T')[0],
      event_hour: new Date(event.event_timestamp).getHours(),
      actor_id_idx: event.actor_id,
      target_id_idx: event.target_id,
      ip_address_idx: event.ip_address
    }));
    
    // Batch insert search index entries
    if (indexEntries.length > 0) {
      const query = `
        INSERT INTO pf_audit_search_index 
        (audit_log_id, search_text, event_date, event_hour, actor_id_idx, target_id_idx, ip_address_idx)
        VALUES (:audit_log_id, :search_text, TO_DATE(:event_date, 'YYYY-MM-DD'), :event_hour, :actor_id_idx, :target_id_idx, :ip_address_idx)
      `;
      
      for (const entry of indexEntries) {
        await this.db.execute(query, entry);
      }
    }
  }

  isCriticalEvent(event) {
    // Multiple failed authentication attempts
    if (event.event_type === 'authentication' && 
        event.action_result === 'failure' && 
        event.risk_score > 50) {
      return true;
    }
    
    // Admin access failures
    if (event.event_type === 'authorization' && 
        event.action_result === 'failure' &&
        (event.target_name?.includes('admin') || event.action === 'admin_access')) {
      return true;
    }
    
    // User deletion
    if (event.target_table === 'pf_users' && event.action === 'delete') {
      return true;
    }
    
    // High severity security events
    if (event.event_type === 'security' && 
        (event.event_severity === 'critical' || event.event_severity === 'emergency')) {
      return true;
    }
    
    // High risk score events
    if (event.risk_score >= 80) {
      return true;
    }
    
    // Mass data export
    if (event.action === 'export' && event.custom_data?.recordCount > 10000) {
      return true;
    }
    
    return false;
  }

  async handleCriticalEvent(event) {
    try {
      // Record in critical events table
      const criticalEvent = {
        id: crypto.randomUUID(),
        audit_log_id: event.id,
        threat_type: this.identifyThreatType(event),
        threat_level: this.assessThreatLevel(event),
        detection_rule: this.getDetectionRule(event),
        detection_score: event.risk_score,
        confidence_level: this.calculateConfidence(event)
      };
      
      await this.db.execute(`
        INSERT INTO pf_audit_critical_events (
          id, audit_log_id, threat_type, threat_level,
          detection_rule, detection_score, confidence_level
        ) VALUES (:id, :audit_log_id, :threat_type, :threat_level,
                  :detection_rule, :detection_score, :confidence_level)
      `, criticalEvent);
      
      // Send immediate alerts
      await this.sendSecurityAlert(event, criticalEvent);
      
      // Emit critical event for real-time monitoring
      this.emit('critical_event', { event, criticalEvent });
      
    } catch (error) {
      console.error('Failed to handle critical event:', error);
      // Log to fallback
      await this.fallbackLog({ 
        ...event, 
        critical_event_error: error.message 
      }, error);
    }
  }

  identifyThreatType(event) {
    if (event.event_type === 'authentication' && event.action_result === 'failure') {
      return 'brute_force_attempt';
    }
    if (event.event_type === 'authorization' && event.action_result === 'failure') {
      return 'privilege_escalation_attempt';
    }
    if (event.action === 'delete' && event.target_table === 'pf_users') {
      return 'user_deletion';
    }
    if (event.action === 'export' && event.custom_data?.recordCount > 10000) {
      return 'data_exfiltration_attempt';
    }
    if (event.risk_score >= 80) {
      return 'high_risk_activity';
    }
    return 'suspicious_activity';
  }

  assessThreatLevel(event) {
    if (event.risk_score >= 90 || event.event_severity === 'emergency') {
      return 'critical';
    }
    if (event.risk_score >= 70 || event.event_severity === 'critical') {
      return 'high';
    }
    if (event.risk_score >= 50 || event.event_severity === 'error') {
      return 'medium';
    }
    return 'low';
  }

  getDetectionRule(event) {
    if (event.event_type === 'authentication' && event.action_result === 'failure') {
      return 'AUTH_FAILURE_THRESHOLD';
    }
    if (event.event_type === 'authorization' && event.action_result === 'failure') {
      return 'AUTHZ_VIOLATION';
    }
    if (event.action === 'delete') {
      return 'SENSITIVE_DATA_DELETION';
    }
    if (event.action === 'export') {
      return 'MASS_DATA_EXPORT';
    }
    return 'RISK_SCORE_THRESHOLD';
  }

  calculateConfidence(event) {
    let confidence = 50;
    
    // Higher confidence for clear patterns
    if (event.event_type === 'authentication' && event.action_result === 'failure') {
      confidence += 20;
    }
    if (event.risk_score >= 80) {
      confidence += 20;
    }
    if (event.event_severity === 'critical' || event.event_severity === 'emergency') {
      confidence += 10;
    }
    
    return Math.min(confidence, 100);
  }

  async sendSecurityAlert(event, criticalEvent) {
    const alert = {
      timestamp: new Date(),
      event_id: event.id,
      threat_type: criticalEvent.threat_type,
      threat_level: criticalEvent.threat_level,
      summary: `${criticalEvent.threat_type}: ${event.event_name}`,
      details: {
        actor: event.actor_username || event.actor_id,
        ip_address: event.ip_address,
        action: event.action,
        target: event.target_name || event.target_id,
        risk_score: event.risk_score
      }
    };
    
    // Log alert sending
    console.log('SECURITY ALERT:', alert);
    
    // Emit alert for external handlers
    this.emit('security_alert', alert);
    
    // TODO: Implement actual alert channels (email, webhook, SMS)
    // This would integrate with notification services
  }

  async applyRetentionPolicies() {
    try {
      const policies = await this.db.execute(`
        SELECT * FROM pf_audit_retention_policies 
        WHERE is_active = 1 
        ORDER BY priority
      `);
      
      for (const policy of policies.rows) {
        // Archive old logs
        if (policy.archive_after_days) {
          await this.archiveLogs(policy);
        }
        
        // Delete expired logs (unless under legal hold)
        if (policy.delete_after_days) {
          await this.deleteExpiredLogs(policy);
        }
      }
    } catch (error) {
      console.error('Failed to apply retention policies:', error);
    }
  }

  async archiveLogs(policy) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.archive_after_days);
    
    await this.db.execute(`
      INSERT INTO pf_audit_log_archive
      SELECT * FROM pf_audit_log
      WHERE event_timestamp < :cutoffDate
      AND event_type = NVL(:eventType, event_type)
      AND legal_hold = 0
    `, {
      cutoffDate,
      eventType: policy.event_type
    });
    
    await this.db.execute(`
      DELETE FROM pf_audit_log
      WHERE event_timestamp < :cutoffDate
      AND event_type = NVL(:eventType, event_type)
      AND legal_hold = 0
    `, {
      cutoffDate,
      eventType: policy.event_type
    });
  }

  async deleteExpiredLogs(policy) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.delete_after_days);
    
    await this.db.execute(`
      DELETE FROM pf_audit_log_archive
      WHERE event_timestamp < :cutoffDate
      AND event_type = NVL(:eventType, event_type)
      AND legal_hold = 0
    `, {
      cutoffDate,
      eventType: policy.event_type
    });
  }

  async fallbackLog(event, error) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        error: error?.message,
        stack: error?.stack
      };
      
      const logPath = this.config.fallbackLogPath;
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
    } catch (fallbackError) {
      console.error('Fallback logging failed:', fallbackError);
    }
  }

  startBufferFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.config.auditFlushInterval);
  }

  startAutomaticArchival() {
    // Run archival process periodically
    this.archivalInterval = setInterval(async () => {
      try {
        console.log('Running automatic audit log archival...');
        await this.applyRetentionPolicies();
        
        // Log the archival operation itself
        await this.log({
          event_type: 'system',
          event_category: 'maintenance',
          event_severity: 'info',
          event_name: 'Automatic Archival',
          event_description: 'Automated audit log archival process completed',
          action: 'archive',
          action_result: 'success',
          actor_type: 'system'
        });
      } catch (error) {
        console.error('Automatic archival failed:', error);
        await this.log({
          event_type: 'system',
          event_category: 'maintenance',
          event_severity: 'error',
          event_name: 'Archival Failed',
          event_description: `Automated archival process failed: ${error.message}`,
          action: 'archive',
          action_result: 'failure',
          actor_type: 'system',
          error_message: error.message
        });
      }
    }, this.config.archivalInterval);
    
    // Run initial archival after 1 minute
    setTimeout(() => {
      this.applyRetentionPolicies().catch(error => {
        console.error('Initial archival failed:', error);
      });
    }, 60000);
  }

  async shutdown() {
    try {
      // Clear intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }
      
      if (this.archivalInterval) {
        clearInterval(this.archivalInterval);
        this.archivalInterval = null;
      }
      
      // Flush remaining events
      if (this.buffer.length > 0) {
        await this.flush();
      }
      
      // Remove listeners to prevent memory leaks
      this.removeAllListeners();
      
      // Remove process listeners
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
    } catch (error) {
      console.error('Error during shutdown:', error);
      // Try to save buffered events to fallback log
      for (const event of this.buffer) {
        await this.fallbackLog(event, error).catch(() => {});
      }
    }
  }

  // Query methods
  async query(filters = {}) {
    const { sql, bindings } = this.buildAuditQuery(filters);
    const result = await this.db.execute(sql, bindings);
    
    // Verify integrity if requested
    if (filters.verifyIntegrity) {
      result.rows = result.rows.map(event => ({
        ...event,
        integrityValid: this.verifyEventIntegrity(event)
      }));
    }
    
    return result.rows;
  }

  buildAuditQuery(filters) {
    let sql = 'SELECT * FROM pf_audit_log WHERE 1=1';
    const bindings = {};
    let bindIndex = 0;
    
    if (filters.startDate) {
      sql += ` AND event_timestamp >= :startDate`;
      bindings.startDate = filters.startDate;
    }
    
    if (filters.endDate) {
      sql += ` AND event_timestamp <= :endDate`;
      bindings.endDate = filters.endDate;
    }
    
    if (filters.eventType) {
      sql += ` AND event_type = :eventType`;
      bindings.eventType = filters.eventType;
    }
    
    if (filters.eventCategory) {
      sql += ` AND event_category = :eventCategory`;
      bindings.eventCategory = filters.eventCategory;
    }
    
    if (filters.actorId) {
      sql += ` AND actor_id = :actorId`;
      bindings.actorId = filters.actorId;
    }
    
    if (filters.targetId) {
      sql += ` AND target_id = :targetId`;
      bindings.targetId = filters.targetId;
    }
    
    if (filters.minRiskScore) {
      sql += ` AND risk_score >= :minRiskScore`;
      bindings.minRiskScore = filters.minRiskScore;
    }
    
    if (filters.actionResult) {
      sql += ` AND action_result = :actionResult`;
      bindings.actionResult = filters.actionResult;
    }
    
    sql += ' ORDER BY event_timestamp DESC';
    
    if (filters.limit) {
      sql += ` FETCH FIRST :limit ROWS ONLY`;
      bindings.limit = filters.limit;
    }
    
    return { sql, bindings };
  }

  verifyEventIntegrity(event) {
    if (!event.previous_hash) {
      return true; // First event has no previous hash
    }
    
    // Recalculate the hash
    const expectedHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        timestamp: event.event_timestamp,
        type: event.event_type,
        actor: event.actor_id || event.actor_username,
        action: event.action,
        target: event.target_id,
        result: event.action_result,
        previous: event.previous_hash
      }))
      .digest('hex');
    
    return expectedHash === event.event_hash;
  }

  async generateComplianceReport(framework, startDate, endDate) {
    const events = await this.getComplianceEvents(framework, startDate, endDate);
    
    const report = {
      framework,
      period: { start: startDate, end: endDate },
      generated_at: new Date(),
      summary: {
        total_events: events.length,
        by_type: this.groupByField(events, 'event_type'),
        by_severity: this.groupByField(events, 'event_severity'),
        by_result: this.groupByField(events, 'action_result')
      },
      critical_events: events.filter(e => e.event_severity === 'critical' || e.event_severity === 'emergency'),
      failed_actions: events.filter(e => e.action_result === 'failure'),
      high_risk_events: events.filter(e => e.risk_score >= 70),
      compliance_status: this.assessCompliance(events, framework),
      recommendations: this.generateRecommendations(events, framework)
    };
    
    // Store report for audit trail
    await this.log({
      event_type: 'compliance',
      event_category: 'reporting',
      event_severity: 'info',
      event_name: 'Compliance Report Generated',
      event_description: `Generated ${framework} compliance report for period ${startDate} to ${endDate}`,
      action: 'generate_report',
      action_result: 'success',
      target_type: 'report',
      custom_data: JSON.stringify({
        framework,
        event_count: events.length
      })
    });
    
    return report;
  }

  async getComplianceEvents(framework, startDate, endDate) {
    const query = `
      SELECT * FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      AND compliance_frameworks LIKE :framework
      ORDER BY event_timestamp DESC
    `;
    
    const result = await this.db.execute(query, {
      startDate,
      endDate,
      framework: `%${framework}%`
    });
    
    return result.rows;
  }

  groupByField(events, field) {
    return events.reduce((acc, event) => {
      const key = event[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  assessCompliance(events, framework) {
    const requirements = this.getFrameworkRequirements(framework);
    const status = {};
    
    for (const req of requirements) {
      status[req.name] = this.checkRequirement(events, req);
    }
    
    return status;
  }

  getFrameworkRequirements(framework) {
    const requirements = {
      'HIPAA': [
        { name: 'audit_controls', check: (events) => events.length > 0 },
        { name: 'access_tracking', check: (events) => events.some(e => e.event_type === 'data_access') },
        { name: 'integrity_verification', check: (events) => events.every(e => e.event_hash) }
      ],
      'GDPR': [
        { name: 'processing_records', check: (events) => events.some(e => e.event_type === 'data_modification') },
        { name: 'deletion_capability', check: (events) => events.some(e => e.action === 'delete') },
        { name: 'access_logs', check: (events) => events.some(e => e.event_type === 'data_access') }
      ],
      'SOC2': [
        { name: 'logical_access', check: (events) => events.some(e => e.event_type === 'authentication') },
        { name: 'change_management', check: (events) => events.some(e => e.event_type === 'configuration') },
        { name: 'incident_response', check: (events) => events.some(e => e.event_severity === 'critical') }
      ]
    };
    
    return requirements[framework] || [];
  }

  checkRequirement(events, requirement) {
    return requirement.check(events) ? 'compliant' : 'non-compliant';
  }

  generateRecommendations(events, framework) {
    const recommendations = [];
    
    // Check for missing event types
    const eventTypes = new Set(events.map(e => e.event_type));
    const requiredTypes = ['authentication', 'authorization', 'data_access', 'data_modification'];
    
    for (const type of requiredTypes) {
      if (!eventTypes.has(type)) {
        recommendations.push(`Ensure ${type} events are being logged`);
      }
    }
    
    // Check for high failure rates
    const failures = events.filter(e => e.action_result === 'failure');
    if (failures.length / events.length > 0.1) {
      recommendations.push('High failure rate detected - review security controls');
    }
    
    // Check for critical events
    const criticalEvents = events.filter(e => e.event_severity === 'critical');
    if (criticalEvents.length > 0) {
      recommendations.push(`${criticalEvents.length} critical events require investigation`);
    }
    
    return recommendations;
  }
}

// Audit middleware factory
function createAuditMiddleware(auditService) {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Set request context
    global.requestContext = {
      requestId: crypto.randomUUID(),
      sessionId: req.session?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    
    // Capture original methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseData = null;
    
    // Override response methods to capture data
    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };
    
    // Log request on response finish
    res.on('finish', async () => {
      try {
        const event = {
          event_type: 'http_request',
          event_category: 'api',
          event_severity: res.statusCode >= 500 ? 'error' : 
                          res.statusCode >= 400 ? 'warning' : 'info',
          event_name: `${req.method} ${req.path}`,
          actor_type: req.user ? 'user' : 'anonymous',
          actor_id: req.user?.id,
          actor_username: req.user?.username,
          actor_roles: req.user?.roles,
          action: req.method.toLowerCase(),
          action_result: res.statusCode < 400 ? 'success' : 'failure',
          http_method: req.method,
          http_path: req.path,
          http_query: JSON.stringify(req.query),
          http_status_code: res.statusCode,
          response_time_ms: Date.now() - startTime,
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('user-agent'),
          session_id: req.session?.id
        };
        
        // Add error details if present
        if (res.statusCode >= 400 && responseData) {
          event.error_message = typeof responseData === 'string' 
            ? responseData 
            : responseData.error || responseData.message;
        }
        
        await auditService.log(event);
      } catch (error) {
        console.error('Audit middleware error:', error);
      }
    });
    
    next();
  };
}

module.exports = {
  AuditService,
  createAuditMiddleware
};