const crypto = require('crypto');

class AuditDashboard {
  constructor(db, auditService) {
    this.db = db;
    this.auditService = auditService;
  }

  async getMetrics(timeRange = '24h') {
    const endDate = new Date();
    const startDate = this.getStartDate(timeRange);
    
    const [
      totalEvents,
      eventsByType,
      eventsBySeverity,
      failureRate,
      topActors,
      criticalEvents,
      authenticationMetrics,
      dataAccessMetrics,
      systemHealth,
      complianceStatus
    ] = await Promise.all([
      this.getTotalEvents(startDate, endDate),
      this.getEventsByType(startDate, endDate),
      this.getEventsBySeverity(startDate, endDate),
      this.getFailureRate(startDate, endDate),
      this.getTopActors(startDate, endDate),
      this.getCriticalEvents(startDate, endDate),
      this.getAuthenticationMetrics(startDate, endDate),
      this.getDataAccessMetrics(startDate, endDate),
      this.getSystemHealth(),
      this.getComplianceStatus()
    ]);
    
    return {
      timeRange,
      period: { start: startDate, end: endDate },
      totalEvents,
      eventsByType,
      eventsBySeverity,
      failureRate,
      topActors,
      criticalEvents,
      authenticationMetrics,
      dataAccessMetrics,
      systemHealth,
      complianceStatus,
      generated_at: new Date()
    };
  }

  getStartDate(timeRange) {
    const now = new Date();
    const ranges = {
      '1h': () => new Date(now.getTime() - 60 * 60 * 1000),
      '6h': () => new Date(now.getTime() - 6 * 60 * 60 * 1000),
      '24h': () => new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': () => new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': () => new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    };
    
    return ranges[timeRange] ? ranges[timeRange]() : ranges['24h']();
  }

  async getTotalEvents(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT COUNT(*) as total
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
    `, { startDate, endDate });
    
    return result.rows[0]?.total || 0;
  }

  async getEventsByType(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        event_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY event_type
      ORDER BY count DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async getEventsBySeverity(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        event_severity,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY event_severity
      ORDER BY 
        CASE event_severity
          WHEN 'emergency' THEN 1
          WHEN 'critical' THEN 2
          WHEN 'error' THEN 3
          WHEN 'warning' THEN 4
          WHEN 'info' THEN 5
          WHEN 'debug' THEN 6
        END
    `, { startDate, endDate });
    
    return result.rows;
  }

  async getFailureRate(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        action_result,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY action_result
    `, { startDate, endDate });
    
    const failureRow = result.rows.find(r => r.action_result === 'failure');
    const totalCount = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    
    return {
      failure_count: failureRow?.count || 0,
      total_count: totalCount,
      failure_rate: failureRow?.percentage || 0
    };
  }

  async getTopActors(startDate, endDate, limit = 10) {
    const result = await this.db.execute(`
      SELECT 
        COALESCE(actor_username, actor_id, 'anonymous') as actor,
        COUNT(*) as action_count,
        COUNT(DISTINCT event_type) as unique_event_types,
        COUNT(CASE WHEN action_result = 'failure' THEN 1 END) as failure_count,
        MAX(event_timestamp) as last_activity
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY COALESCE(actor_username, actor_id, 'anonymous')
      ORDER BY action_count DESC
      FETCH FIRST :limit ROWS ONLY
    `, { startDate, endDate, limit });
    
    return result.rows;
  }

  async getCriticalEvents(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        ce.*,
        al.event_name,
        al.event_description,
        al.actor_username,
        al.ip_address,
        al.risk_score
      FROM pf_audit_critical_events ce
      JOIN pf_audit_log al ON ce.audit_log_id = al.id
      WHERE ce.detected_at BETWEEN :startDate AND :endDate
      ORDER BY ce.detected_at DESC
    `, { startDate, endDate });
    
    return {
      total: result.rows.length,
      unresolved: result.rows.filter(e => !e.resolved).length,
      by_threat_level: this.groupByField(result.rows, 'threat_level'),
      by_threat_type: this.groupByField(result.rows, 'threat_type'),
      events: result.rows.slice(0, 10) // Return top 10 for display
    };
  }

  async getAuthenticationMetrics(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN action_result = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN action_result = 'failure' THEN 1 END) as failed,
        COUNT(DISTINCT actor_username) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM pf_audit_log
      WHERE event_type = 'authentication'
      AND event_timestamp BETWEEN :startDate AND :endDate
    `, { startDate, endDate });
    
    const metrics = result.rows[0] || {};
    
    // Get failed login patterns
    const failedPatterns = await this.db.execute(`
      SELECT 
        actor_username,
        ip_address,
        COUNT(*) as failure_count
      FROM pf_audit_log
      WHERE event_type = 'authentication'
      AND action_result = 'failure'
      AND event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY actor_username, ip_address
      HAVING COUNT(*) > 3
      ORDER BY failure_count DESC
    `, { startDate, endDate });
    
    return {
      ...metrics,
      success_rate: metrics.total_attempts > 0 
        ? ((metrics.successful / metrics.total_attempts) * 100).toFixed(2)
        : 0,
      suspicious_patterns: failedPatterns.rows
    };
  }

  async getDataAccessMetrics(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        target_table,
        action,
        data_sensitivity,
        COUNT(*) as access_count,
        COUNT(DISTINCT actor_username) as unique_users
      FROM pf_audit_log
      WHERE event_type IN ('data_access', 'data_modification')
      AND event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY target_table, action, data_sensitivity
      ORDER BY access_count DESC
    `, { startDate, endDate });
    
    return {
      total_accesses: result.rows.reduce((sum, r) => sum + parseInt(r.access_count), 0),
      by_table: this.groupByField(result.rows, 'target_table'),
      by_action: this.groupByField(result.rows, 'action'),
      by_sensitivity: this.groupByField(result.rows, 'data_sensitivity'),
      details: result.rows.slice(0, 20)
    };
  }

  async getSystemHealth() {
    // Check audit log integrity
    const integrityCheck = await this.db.execute(`
      SELECT COUNT(*) as invalid_count
      FROM v_audit_integrity_check
      WHERE integrity_status = 'INVALID'
    `);
    
    // Check buffer status
    const bufferStatus = {
      current_size: this.auditService?.buffer?.length || 0,
      max_size: this.auditService?.config?.bufferSize || 1000,
      utilization: this.auditService?.buffer 
        ? ((this.auditService.buffer.length / this.auditService.config.bufferSize) * 100).toFixed(2)
        : 0
    };
    
    // Check retention policy status
    const retentionStatus = await this.db.execute(`
      SELECT 
        COUNT(*) as active_policies,
        MIN(retention_days) as min_retention,
        MAX(retention_days) as max_retention
      FROM pf_audit_retention_policies
      WHERE is_active = 1
    `);
    
    // Check archive status
    const archiveStatus = await this.db.execute(`
      SELECT 
        COUNT(*) as archived_events,
        MIN(event_timestamp) as oldest_event,
        MAX(event_timestamp) as newest_event
      FROM pf_audit_log_archive
    `);
    
    return {
      integrity: {
        status: integrityCheck.rows[0]?.invalid_count === 0 ? 'healthy' : 'degraded',
        invalid_events: integrityCheck.rows[0]?.invalid_count || 0
      },
      buffer: bufferStatus,
      retention: retentionStatus.rows[0],
      archive: archiveStatus.rows[0]
    };
  }

  async getComplianceStatus() {
    const frameworks = ['HIPAA', 'GDPR', 'SOC2'];
    const status = {};
    
    for (const framework of frameworks) {
      const events = await this.db.execute(`
        SELECT COUNT(*) as event_count
        FROM pf_audit_log
        WHERE compliance_frameworks LIKE :framework
        AND event_timestamp > SYSTIMESTAMP - INTERVAL '30' DAY
      `, { framework: `%${framework}%` });
      
      status[framework] = {
        events_logged: events.rows[0]?.event_count || 0,
        status: events.rows[0]?.event_count > 0 ? 'active' : 'inactive'
      };
    }
    
    return status;
  }

  async detectAnomalies(timeWindow = '1h') {
    const anomalies = [];
    const startDate = this.getStartDate(timeWindow);
    const endDate = new Date();
    
    // Detect brute force attempts
    const bruteForce = await this.detectBruteForce(startDate, endDate);
    if (bruteForce.length > 0) {
      anomalies.push({
        type: 'brute_force',
        severity: 'high',
        detected_at: new Date(),
        details: bruteForce
      });
    }
    
    // Detect privilege escalation attempts
    const privEsc = await this.detectPrivilegeEscalation(startDate, endDate);
    if (privEsc.length > 0) {
      anomalies.push({
        type: 'privilege_escalation',
        severity: 'critical',
        detected_at: new Date(),
        details: privEsc
      });
    }
    
    // Detect data exfiltration attempts
    const dataExfil = await this.detectDataExfiltration(startDate, endDate);
    if (dataExfil.length > 0) {
      anomalies.push({
        type: 'data_exfiltration',
        severity: 'critical',
        detected_at: new Date(),
        details: dataExfil
      });
    }
    
    // Detect unusual access patterns
    const unusualAccess = await this.detectUnusualAccess(startDate, endDate);
    if (unusualAccess.length > 0) {
      anomalies.push({
        type: 'unusual_access',
        severity: 'medium',
        detected_at: new Date(),
        details: unusualAccess
      });
    }
    
    // Detect configuration changes
    const configChanges = await this.detectConfigurationChanges(startDate, endDate);
    if (configChanges.length > 0) {
      anomalies.push({
        type: 'configuration_change',
        severity: 'medium',
        detected_at: new Date(),
        details: configChanges
      });
    }
    
    return anomalies;
  }

  async detectBruteForce(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        actor_username,
        ip_address,
        COUNT(*) as attempts,
        MIN(event_timestamp) as first_attempt,
        MAX(event_timestamp) as last_attempt,
        ROUND((EXTRACT(EPOCH FROM (MAX(event_timestamp) - MIN(event_timestamp))) / 60), 2) as duration_minutes
      FROM pf_audit_log
      WHERE event_type = 'authentication'
      AND action_result = 'failure'
      AND event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY actor_username, ip_address
      HAVING COUNT(*) > 5
      ORDER BY attempts DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async detectPrivilegeEscalation(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        actor_username,
        target_name,
        COUNT(*) as attempts,
        STRING_AGG(DISTINCT action, ', ') as actions_attempted
      FROM pf_audit_log
      WHERE event_type = 'authorization'
      AND action_result = 'failure'
      AND event_timestamp BETWEEN :startDate AND :endDate
      AND (target_name LIKE '%admin%' OR action LIKE '%admin%' OR action LIKE '%privilege%')
      GROUP BY actor_username, target_name
      HAVING COUNT(*) > 2
      ORDER BY attempts DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async detectDataExfiltration(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        actor_username,
        ip_address,
        SUM(CASE 
          WHEN custom_data IS NOT NULL 
          THEN JSON_VALUE(custom_data, '$.recordCount')
          ELSE 0 
        END) as total_records,
        COUNT(*) as export_count,
        STRING_AGG(DISTINCT target_table, ', ') as tables_accessed
      FROM pf_audit_log
      WHERE action = 'export'
      AND event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY actor_username, ip_address
      HAVING SUM(CASE 
        WHEN custom_data IS NOT NULL 
        THEN JSON_VALUE(custom_data, '$.recordCount')
        ELSE 0 
      END) > 10000
      OR COUNT(*) > 10
      ORDER BY total_records DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async detectUnusualAccess(startDate, endDate) {
    // Detect off-hours access
    const result = await this.db.execute(`
      SELECT 
        actor_username,
        ip_address,
        COUNT(*) as access_count,
        STRING_AGG(DISTINCT TO_CHAR(event_timestamp, 'HH24') || ':00', ', ') as hours_accessed
      FROM pf_audit_log
      WHERE event_timestamp BETWEEN :startDate AND :endDate
      AND (
        EXTRACT(HOUR FROM event_timestamp) < 6 
        OR EXTRACT(HOUR FROM event_timestamp) > 22
        OR EXTRACT(DOW FROM event_timestamp) IN (0, 6)
      )
      GROUP BY actor_username, ip_address
      HAVING COUNT(*) > 5
      ORDER BY access_count DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async detectConfigurationChanges(startDate, endDate) {
    const result = await this.db.execute(`
      SELECT 
        actor_username,
        target_name,
        action,
        COUNT(*) as change_count,
        MAX(event_timestamp) as last_change
      FROM pf_audit_log
      WHERE event_type = 'configuration'
      AND event_timestamp BETWEEN :startDate AND :endDate
      GROUP BY actor_username, target_name, action
      ORDER BY last_change DESC
    `, { startDate, endDate });
    
    return result.rows;
  }

  async generateThreatReport() {
    const [
      last1h,
      last24h,
      last7d
    ] = await Promise.all([
      this.detectAnomalies('1h'),
      this.detectAnomalies('24h'),
      this.detectAnomalies('7d')
    ]);
    
    const threatLevels = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    // Aggregate threat levels
    [...last1h, ...last24h, ...last7d].forEach(anomaly => {
      if (threatLevels[anomaly.severity] !== undefined) {
        threatLevels[anomaly.severity]++;
      }
    });
    
    return {
      generated_at: new Date(),
      threat_summary: {
        total_threats: last1h.length + last24h.length + last7d.length,
        by_severity: threatLevels,
        immediate_action_required: threatLevels.critical > 0
      },
      time_windows: {
        last_hour: {
          threats: last1h.length,
          details: last1h
        },
        last_24_hours: {
          threats: last24h.length,
          details: last24h.slice(0, 10)
        },
        last_7_days: {
          threats: last7d.length,
          details: last7d.slice(0, 10)
        }
      },
      recommendations: this.generateThreatRecommendations(threatLevels)
    };
  }

  generateThreatRecommendations(threatLevels) {
    const recommendations = [];
    
    if (threatLevels.critical > 0) {
      recommendations.push({
        priority: 'immediate',
        action: 'Investigate critical security events immediately',
        description: 'Critical threats detected requiring immediate attention'
      });
    }
    
    if (threatLevels.high > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review high-severity security events',
        description: 'High-risk activities detected that may indicate security issues'
      });
    }
    
    if (threatLevels.medium > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Monitor medium-severity events',
        description: 'Unusual patterns detected that warrant monitoring'
      });
    }
    
    // Always include general recommendations
    recommendations.push(
      {
        priority: 'ongoing',
        action: 'Enable multi-factor authentication',
        description: 'Strengthen authentication to prevent unauthorized access'
      },
      {
        priority: 'ongoing',
        action: 'Review access control policies',
        description: 'Ensure principle of least privilege is enforced'
      },
      {
        priority: 'ongoing',
        action: 'Regular security training',
        description: 'Keep users informed about security best practices'
      }
    );
    
    return recommendations;
  }

  groupByField(items, field) {
    return items.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  async exportAuditLog(filters = {}, format = 'json') {
    const events = await this.auditService.query(filters);
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
        
      case 'csv':
        return this.convertToCSV(events);
        
      case 'xml':
        return this.convertToXML(events);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  convertToCSV(events) {
    if (events.length === 0) return '';
    
    const headers = Object.keys(events[0]);
    const rows = events.map(event => 
      headers.map(header => {
        const value = event[header];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  convertToXML(events) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit_log>\n';
    
    for (const event of events) {
      xml += '  <event>\n';
      for (const [key, value] of Object.entries(event)) {
        xml += `    <${key}>${this.escapeXML(value)}</${key}>\n`;
      }
      xml += '  </event>\n';
    }
    
    xml += '</audit_log>';
    return xml;
  }

  escapeXML(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = AuditDashboard;