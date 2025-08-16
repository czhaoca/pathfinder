const express = require('express');
const router = express.Router();
const { requireRoles, hasPermission } = require('../middleware/rbac');
const { rateLimiter, strictRateLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');
const { AuditService } = require('../services/auditService');
const AuditDashboard = require('../monitoring/auditDashboard');

// Initialize services
const db = require('../config/database');
const auditService = new AuditService(db);
const auditDashboard = new AuditDashboard(db, auditService);

/**
 * GET /api/v2/admin/dashboard
 * Get admin dashboard metrics
 */
router.get('/dashboard',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('View Admin Dashboard'),
  async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const metrics = await auditDashboard.getMetrics(timeRange);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'DASHBOARD_ERROR',
        message: 'Failed to retrieve dashboard metrics'
      });
    }
  }
);

/**
 * GET /api/v2/admin/audit-logs
 * Query audit logs
 */
router.get('/audit-logs',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('audit_query'),
  auditLog('Query Audit Logs'),
  async (req, res) => {
    const {
      startDate,
      endDate,
      eventType,
      eventCategory,
      actorId,
      targetId,
      minRiskScore,
      actionResult,
      limit = 100,
      page = 1,
      verifyIntegrity = false
    } = req.query;
    
    try {
      const filters = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        eventType,
        eventCategory,
        actorId,
        targetId,
        minRiskScore: minRiskScore ? parseInt(minRiskScore) : undefined,
        actionResult,
        limit: Math.min(parseInt(limit), 1000),
        offset: (parseInt(page) - 1) * parseInt(limit),
        verifyIntegrity: verifyIntegrity === 'true'
      };
      
      const logs = await auditService.query(filters);
      
      // Log audit log access
      await auditService.log({
        event_type: 'compliance',
        event_category: 'audit_access',
        event_severity: 'info',
        event_name: 'Audit Logs Accessed',
        action: 'query',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        custom_data: JSON.stringify({
          filters,
          results_count: logs.length
        }),
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Audit query error:', error);
      res.status(500).json({
        success: false,
        error: 'QUERY_FAILED',
        message: 'Failed to query audit logs'
      });
    }
  }
);

/**
 * GET /api/v2/admin/audit-logs/export
 * Export audit logs
 */
router.get('/audit-logs/export',
  requireRoles(['admin', 'site_admin']),
  strictRateLimiter,
  auditLog('Export Audit Logs'),
  async (req, res) => {
    const {
      format = 'json',
      startDate,
      endDate,
      eventType
    } = req.query;
    
    try {
      const filters = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        eventType,
        limit: 10000 // Max export size
      };
      
      const exported = await auditDashboard.exportAuditLog(filters, format);
      
      // Set appropriate headers based on format
      const contentTypes = {
        json: 'application/json',
        csv: 'text/csv',
        xml: 'application/xml'
      };
      
      const filename = `audit-logs-${Date.now()}.${format}`;
      
      res.set({
        'Content-Type': contentTypes[format] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      
      // Log export
      await auditService.log({
        event_type: 'compliance',
        event_category: 'data_export',
        event_severity: 'warning',
        event_name: 'Audit Logs Exported',
        action: 'export',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        custom_data: JSON.stringify({
          format,
          filters,
          filename
        }),
        ip_address: req.ip,
        risk_score: 50
      });
      
      res.send(exported);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'EXPORT_FAILED',
        message: 'Failed to export audit logs'
      });
    }
  }
);

/**
 * GET /api/v2/admin/critical-events
 * Get critical security events
 */
router.get('/critical-events',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('View Critical Events'),
  async (req, res) => {
    const { startDate, endDate } = req.query;
    
    try {
      const events = await auditDashboard.getCriticalEvents(
        startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate ? new Date(endDate) : new Date()
      );
      
      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      console.error('Critical events error:', error);
      res.status(500).json({
        success: false,
        error: 'QUERY_FAILED',
        message: 'Failed to retrieve critical events'
      });
    }
  }
);

/**
 * POST /api/v2/admin/critical-events/:id/acknowledge
 * Acknowledge critical event
 */
router.post('/critical-events/:id/acknowledge',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('Acknowledge Critical Event'),
  async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    try {
      await db.execute(`
        UPDATE pf_audit_critical_events
        SET acknowledged = 1,
            acknowledged_by = :userId,
            acknowledged_at = SYSTIMESTAMP,
            investigation_notes = :notes
        WHERE id = :id
      `, {
        id,
        userId: req.user.id,
        notes
      });
      
      await auditService.log({
        event_type: 'security',
        event_category: 'incident_response',
        event_severity: 'warning',
        event_name: 'Critical Event Acknowledged',
        action: 'acknowledge',
        action_result: 'success',
        actor_id: req.user.id,
        target_id: id,
        custom_data: JSON.stringify({ notes }),
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        message: 'Critical event acknowledged'
      });
    } catch (error) {
      console.error('Acknowledge error:', error);
      res.status(500).json({
        success: false,
        error: 'ACKNOWLEDGE_FAILED',
        message: 'Failed to acknowledge critical event'
      });
    }
  }
);

/**
 * GET /api/v2/admin/threat-report
 * Generate threat analysis report
 */
router.get('/threat-report',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('Generate Threat Report'),
  async (req, res) => {
    try {
      const report = await auditDashboard.generateThreatReport();
      
      await auditService.log({
        event_type: 'compliance',
        event_category: 'reporting',
        event_severity: 'info',
        event_name: 'Threat Report Generated',
        action: 'generate_report',
        action_result: 'success',
        actor_id: req.user.id,
        custom_data: JSON.stringify({
          total_threats: report.threat_summary.total_threats
        }),
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Threat report error:', error);
      res.status(500).json({
        success: false,
        error: 'REPORT_FAILED',
        message: 'Failed to generate threat report'
      });
    }
  }
);

/**
 * GET /api/v2/admin/compliance-report
 * Generate compliance report
 */
router.get('/compliance-report',
  requireRoles(['site_admin']),
  strictRateLimiter,
  auditLog('Generate Compliance Report'),
  async (req, res) => {
    const {
      framework = 'HIPAA',
      startDate,
      endDate
    } = req.query;
    
    try {
      const report = await auditService.generateComplianceReport(
        framework,
        startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate ? new Date(endDate) : new Date()
      );
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Compliance report error:', error);
      res.status(500).json({
        success: false,
        error: 'REPORT_FAILED',
        message: 'Failed to generate compliance report'
      });
    }
  }
);

/**
 * GET /api/v2/admin/system-health
 * Get system health metrics
 */
router.get('/system-health',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('View System Health'),
  async (req, res) => {
    try {
      const health = await auditDashboard.getSystemHealth();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('System health error:', error);
      res.status(500).json({
        success: false,
        error: 'HEALTH_CHECK_FAILED',
        message: 'Failed to retrieve system health'
      });
    }
  }
);

/**
 * GET /api/v2/admin/anomalies
 * Detect security anomalies
 */
router.get('/anomalies',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('Detect Anomalies'),
  async (req, res) => {
    const { timeWindow = '1h' } = req.query;
    
    try {
      const anomalies = await auditDashboard.detectAnomalies(timeWindow);
      
      if (anomalies.length > 0) {
        await auditService.log({
          event_type: 'security',
          event_category: 'threat_detection',
          event_severity: 'warning',
          event_name: 'Anomalies Detected',
          action: 'detect',
          action_result: 'success',
          actor_id: req.user.id,
          custom_data: JSON.stringify({
            anomaly_count: anomalies.length,
            types: anomalies.map(a => a.type)
          }),
          ip_address: req.ip,
          risk_score: 70
        });
      }
      
      res.json({
        success: true,
        data: {
          anomalies,
          total: anomalies.length,
          time_window: timeWindow
        }
      });
    } catch (error) {
      console.error('Anomaly detection error:', error);
      res.status(500).json({
        success: false,
        error: 'DETECTION_FAILED',
        message: 'Failed to detect anomalies'
      });
    }
  }
);

/**
 * POST /api/v2/admin/retention-policy
 * Create or update retention policy
 */
router.post('/retention-policy',
  requireRoles(['site_admin']),
  strictRateLimiter,
  auditLog('Manage Retention Policy'),
  async (req, res) => {
    const {
      policy_name,
      event_type,
      event_category,
      retention_days,
      archive_after_days,
      delete_after_days,
      compliance_requirement
    } = req.body;
    
    if (!policy_name || !retention_days) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Policy name and retention days are required'
      });
    }
    
    try {
      await db.execute(`
        MERGE INTO pf_audit_retention_policies p
        USING (SELECT :policy_name AS policy_name FROM dual) s
        ON (p.policy_name = s.policy_name)
        WHEN MATCHED THEN
          UPDATE SET
            event_type = :event_type,
            event_category = :event_category,
            retention_days = :retention_days,
            archive_after_days = :archive_after_days,
            delete_after_days = :delete_after_days,
            compliance_requirement = :compliance_requirement,
            updated_at = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (id, policy_name, event_type, event_category, retention_days,
                  archive_after_days, delete_after_days, compliance_requirement)
          VALUES (SYS_GUID(), :policy_name, :event_type, :event_category,
                  :retention_days, :archive_after_days, :delete_after_days,
                  :compliance_requirement)
      `, {
        policy_name,
        event_type,
        event_category,
        retention_days,
        archive_after_days,
        delete_after_days,
        compliance_requirement
      });
      
      await auditService.log({
        event_type: 'configuration',
        event_category: 'policy',
        event_severity: 'warning',
        event_name: 'Retention Policy Updated',
        action: 'update_policy',
        action_result: 'success',
        actor_id: req.user.id,
        target_name: policy_name,
        new_values: JSON.stringify(req.body),
        ip_address: req.ip,
        risk_score: 40
      });
      
      res.json({
        success: true,
        message: 'Retention policy updated successfully'
      });
    } catch (error) {
      console.error('Retention policy error:', error);
      res.status(500).json({
        success: false,
        error: 'POLICY_UPDATE_FAILED',
        message: 'Failed to update retention policy'
      });
    }
  }
);

/**
 * POST /api/v2/admin/run-archival
 * Manually trigger audit log archival
 */
router.post('/run-archival',
  requireRoles(['site_admin']),
  strictRateLimiter,
  auditLog('Manual Archival'),
  async (req, res) => {
    try {
      await auditService.applyRetentionPolicies();
      
      await auditService.log({
        event_type: 'system',
        event_category: 'maintenance',
        event_severity: 'info',
        event_name: 'Manual Archival Triggered',
        action: 'archive',
        action_result: 'success',
        actor_id: req.user.id,
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        message: 'Archival process completed successfully'
      });
    } catch (error) {
      console.error('Archival error:', error);
      res.status(500).json({
        success: false,
        error: 'ARCHIVAL_FAILED',
        message: 'Failed to run archival process'
      });
    }
  }
);

/**
 * GET /api/v2/admin/rate-limits
 * View rate limit status
 */
router.get('/rate-limits',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  async (req, res) => {
    const { user_id, endpoint } = req.query;
    
    try {
      const { getRateLimitStatus } = require('../middleware/rateLimit');
      
      const key = user_id || req.ip;
      const status = await getRateLimitStatus(endpoint || 'default', key);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Rate limit status error:', error);
      res.status(500).json({
        success: false,
        error: 'STATUS_FAILED',
        message: 'Failed to retrieve rate limit status'
      });
    }
  }
);

/**
 * POST /api/v2/admin/rate-limits/reset
 * Reset rate limit for user/IP
 */
router.post('/rate-limits/reset',
  requireRoles(['site_admin']),
  strictRateLimiter,
  auditLog('Reset Rate Limit'),
  async (req, res) => {
    const { user_id, ip_address, endpoint } = req.body;
    
    if (!user_id && !ip_address) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IDENTIFIER',
        message: 'User ID or IP address required'
      });
    }
    
    try {
      const { resetRateLimit } = require('../middleware/rateLimit');
      
      const key = user_id || ip_address;
      await resetRateLimit(endpoint || 'default', key);
      
      await auditService.log({
        event_type: 'configuration',
        event_category: 'rate_limit',
        event_severity: 'warning',
        event_name: 'Rate Limit Reset',
        action: 'reset',
        action_result: 'success',
        actor_id: req.user.id,
        target_id: key,
        custom_data: JSON.stringify({ endpoint }),
        ip_address: req.ip,
        risk_score: 30
      });
      
      res.json({
        success: true,
        message: 'Rate limit reset successfully'
      });
    } catch (error) {
      console.error('Rate limit reset error:', error);
      res.status(500).json({
        success: false,
        error: 'RESET_FAILED',
        message: 'Failed to reset rate limit'
      });
    }
  }
);

module.exports = router;