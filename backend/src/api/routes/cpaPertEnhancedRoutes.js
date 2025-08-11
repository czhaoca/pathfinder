/**
 * Enhanced CPA PERT Routes with EVR Support
 * Refactored to align with repository middleware + DI patterns
 */

const express = require('express');
const Joi = require('joi');

// Local validation helper using Joi
const validateBody = (schema) => (req, res, next) => {
  if (!schema) return next();
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    });
  }
  req.body = value;
  next();
};

// Validation schemas
const schemas = {
    createReport: Joi.object({
        report_period_start: Joi.date().required(),
        report_period_end: Joi.date().greater(Joi.ref('report_period_start')).required(),
        submission_deadline: Joi.date().optional(),
        route_type: Joi.string().valid('EVR', 'PPR').required(),
        employer_name: Joi.string().max(255).optional(),
        position_title: Joi.string().max(255).optional(),
        hours_worked: Joi.number().integer().min(0).optional(),
        mentor_id: Joi.string().uuid().optional(),
        supervisor_id: Joi.string().uuid().optional()
    }),

    addExperience: Joi.object({
        sub_competency_id: Joi.string().uuid().required(),
        experience_title: Joi.string().max(500).required(),
        experience_date: Joi.date().required(),
        proficiency_level: Joi.number().integer().min(0).max(2).required(),
        challenge: Joi.string().min(50).max(2000).required(),
        actions: Joi.string().min(50).max(2500).required(),
        results: Joi.string().min(50).max(2000).required(),
        lessons_learned: Joi.string().min(50).max(1500).required(),
        time_spent_hours: Joi.number().min(0).max(999.99).optional(),
        complexity_level: Joi.string().valid('simple', 'moderate', 'complex').optional(),
        collaboration_type: Joi.string().valid('individual', 'team', 'cross-functional').optional(),
        tools_used: Joi.array().items(Joi.string()).max(10).optional(),
        evidence_documents: Joi.array().items(Joi.object({
            filename: Joi.string().required(),
            url: Joi.string().uri().required(),
            upload_date: Joi.date().optional()
        })).max(5).optional()
    }),

    updateExperience: Joi.object({
        experience_title: Joi.string().max(500).optional(),
        experience_date: Joi.date().optional(),
        proficiency_level: Joi.number().integer().min(0).max(2).optional(),
        challenge: Joi.string().min(50).max(2000).optional(),
        actions: Joi.string().min(50).max(2500).optional(),
        results: Joi.string().min(50).max(2000).optional(),
        lessons_learned: Joi.string().min(50).max(1500).optional(),
        time_spent_hours: Joi.number().min(0).max(999.99).optional(),
        complexity_level: Joi.string().valid('simple', 'moderate', 'complex').optional(),
        collaboration_type: Joi.string().valid('individual', 'team', 'cross-functional').optional(),
        tools_used: Joi.array().items(Joi.string()).max(10).optional(),
        revision_notes: Joi.string().max(1000).optional()
    }).min(1),

    deleteExperience: Joi.object({
        reason: Joi.string().min(10).max(500).required()
    }),

    createEvrAssessment: Joi.object({
        employer_name: Joi.string().max(255).required(),
        position_title: Joi.string().max(255).required(),
        job_description: Joi.string().min(200).max(5000).required(),
        start_date: Joi.date().required(),
        reporting_relationship: Joi.string().max(500).optional(),
        team_size: Joi.number().integer().min(0).optional(),
        industry: Joi.string().max(100).optional()
    }),

    analyzeJob: Joi.object({
        job_description: Joi.string().min(200).max(5000).required(),
        position_title: Joi.string().max(255).optional()
    }),

    generateFromTemplate: Joi.object({
        report_id: Joi.string().uuid().required(),
        customizations: Joi.object({
            company_name: Joi.string().optional(),
            project_name: Joi.string().optional(),
            team_size: Joi.string().optional(),
            budget: Joi.string().optional(),
            timeline: Joi.string().optional(),
            complexity_level: Joi.string().valid('simple', 'moderate', 'complex').optional(),
            collaboration_type: Joi.string().valid('individual', 'team', 'cross-functional').optional()
        }).optional()
    })
    ,
    submitReport: Joi.object({
        payload: Joi.object().required(),
        exportedFileUrl: Joi.string().uri().optional(),
        ackReference: Joi.string().max(100).optional()
    }),

    addExperienceBreakdown: Joi.object({
        activity_type: Joi.string().valid('planning', 'execution', 'review', 'documentation', 'analysis', 'presentation', 'training').required(),
        activity_description: Joi.string().min(50).max(2000).required(),
        start_date: Joi.date().required(),
        end_date: Joi.date().min(Joi.ref('start_date')).required(),
        hours_spent: Joi.number().min(0.25).max(999.99).required(),
        competencies_demonstrated: Joi.array().items(Joi.string()).optional(),
        deliverables: Joi.array().items(Joi.string()).optional(),
        stakeholders_involved: Joi.array().items(Joi.string()).optional(),
        business_impact: Joi.string().max(1000).optional(),
        skills_applied: Joi.array().items(Joi.string()).optional()
    }),

    recordProgressMilestone: Joi.object({
        sub_competency_id: Joi.string().uuid().required(),
        milestone_date: Joi.date().optional(),
        previous_level: Joi.number().integer().min(0).max(2).optional(),
        achieved_level: Joi.number().integer().min(0).max(2).required(),
        evidence_count: Joi.number().integer().min(0).optional(),
        hours_accumulated: Joi.number().min(0).optional(),
        key_experiences: Joi.array().items(Joi.string()).optional(),
        mentor_feedback: Joi.string().max(2000).optional(),
        self_assessment: Joi.string().max(2000).optional(),
        next_steps: Joi.string().max(2000).optional()
    }),

    trackExperienceTime: Joi.object({
        activity_date: Joi.date().required(),
        hours_logged: Joi.number().min(0.25).max(24).required(),
        activity_category: Joi.string().valid('direct_work', 'supervision', 'training', 'research', 'documentation').optional(),
        description: Joi.string().max(1000).optional(),
        is_billable: Joi.string().valid('Y', 'N').optional(),
        is_cpa_eligible: Joi.string().valid('Y', 'N').optional()
    }),

    submitReportToCPA: Joi.object({
        submission_type: Joi.string().valid('draft', 'final', 'revision').optional(),
        submission_deadline: Joi.date().optional(),
        cpa_reference_number: Joi.string().max(100).optional(),
        exported_file_url: Joi.string().uri().optional(),
        exported_file_format: Joi.string().valid('pdf', 'docx', 'xml', 'json').optional()
    })
};

// Initialize controller with dependencies
function createCPAPertEnhancedRoutes(container) {
    const controller = container.get('cpaPertControllerEnhanced');
    const authMiddleware = container.get('authMiddleware');
    
    // ========================================
    // REPORT MANAGEMENT ROUTES
    // ========================================
    
    /**
     * Create new PERT report
     * POST /api/cpa-pert/enhanced/reports
     */
    const router = express.Router();

    // All routes require authentication
    router.use(authMiddleware.authenticate());

    router.post(
        '/reports',
        validateBody(schemas.createReport),
        authMiddleware.rateLimitByUser({ windowMs: 3600000, max: 60 }),
        controller.createReport
    );

    /**
     * Get user's PERT reports
     * GET /api/cpa-pert/enhanced/reports
     */
    router.get('/reports', controller.getReports);

    /**
     * Export PERT report
     * GET /api/cpa-pert/enhanced/reports/:reportId/export
     */
    router.get(
        '/reports/:reportId/export',
        authMiddleware.rateLimitByUser({ windowMs: 300000, max: 5 }),
        controller.exportReport
    );

    /**
     * Submit PERT report snapshot
     * POST /api/cpa-pert/enhanced/reports/:reportId/submit
     */
    router.post(
        '/reports/:reportId/submit',
        validateBody(schemas.submitReport),
        authMiddleware.rateLimitByUser({ windowMs: 300000, max: 10 }),
        controller.submitReport
    );

    // ========================================
    // EXPERIENCE MANAGEMENT ROUTES
    // ========================================
    
    /**
     * Add experience to report (Append-only)
     * POST /api/cpa-pert/enhanced/reports/:reportId/experiences
     */
    router.post(
        '/reports/:reportId/experiences',
        validateBody(schemas.addExperience),
        authMiddleware.rateLimitByUser({ windowMs: 3600000, max: 120 }),
        controller.addExperience
    );

    /**
     * Get experiences for report
     * GET /api/cpa-pert/enhanced/reports/:reportId/experiences
     */
    router.get('/reports/:reportId/experiences', controller.getExperiences);

    /**
     * Update experience (Creates new version)
     * PUT /api/cpa-pert/enhanced/experiences/:experienceId
     */
    router.put(
        '/experiences/:experienceId',
        validateBody(schemas.updateExperience),
        controller.updateExperience
    );

    /**
     * Soft delete experience
     * DELETE /api/cpa-pert/enhanced/experiences/:experienceId
     */
    router.delete(
        '/experiences/:experienceId',
        validateBody(schemas.deleteExperience),
        controller.softDeleteExperience
    );

    /**
     * Restore soft-deleted experience
     * POST /api/cpa-pert/enhanced/experiences/:experienceId/restore
     */
    router.post('/experiences/:experienceId/restore', controller.restoreExperience);

    /**
     * Get experience audit trail
     * GET /api/cpa-pert/enhanced/experiences/:experienceId/audit
     */
    router.get('/experiences/:experienceId/audit', controller.getAuditTrail);

    // ========================================
    // COMPETENCY & PROGRESS ROUTES
    // ========================================
    
    /**
     * Get competency progress
     * GET /api/cpa-pert/enhanced/progress
     */
    router.get('/progress', controller.getCompetencyProgress);

    /**
     * Get competency framework
     * GET /api/cpa-pert/enhanced/competency-framework
     */
    router.get('/competency-framework', controller.getCompetencyFramework);

    // ========================================
    // EVR ASSESSMENT ROUTES
    // ========================================
    
    /**
     * Create EVR pre-assessment
     * POST /api/cpa-pert/enhanced/evr-assessment
     */
    router.post(
        '/evr-assessment',
        validateBody(schemas.createEvrAssessment),
        authMiddleware.rateLimitByUser({ windowMs: 3600000, max: 20 }),
        controller.createEvrAssessment
    );

    /**
     * Analyze job description for competency mapping
     * POST /api/cpa-pert/enhanced/analyze-job
     */
    router.post(
        '/analyze-job',
        validateBody(schemas.analyzeJob),
        authMiddleware.rateLimitByUser({ windowMs: 3600000, max: 40 }),
        controller.analyzeJobDescription
    );

    // ========================================
    // TEMPLATE ROUTES
    // ========================================
    
    /**
     * Get experience templates
     * GET /api/cpa-pert/enhanced/templates
     */
    router.get('/templates', controller.getTemplates);

    /**
     * Generate experience from template
     * POST /api/cpa-pert/enhanced/templates/:templateId/generate
     */
    router.post(
        '/templates/:templateId/generate',
        validateBody(schemas.generateFromTemplate),
        controller.generateExperienceFromTemplate
    );

    // ========================================
    // NEW ENHANCED FEATURES ROUTES
    // ========================================

    /**
     * Add experience breakdown
     * POST /api/cpa-pert/enhanced/experiences/:experienceId/breakdown
     */
    router.post(
        '/experiences/:experienceId/breakdown',
        validateBody(schemas.addExperienceBreakdown),
        controller.addExperienceBreakdown
    );

    /**
     * Get experience breakdown
     * GET /api/cpa-pert/enhanced/experiences/:experienceId/breakdown
     */
    router.get(
        '/experiences/:experienceId/breakdown',
        controller.getExperienceBreakdown
    );

    /**
     * Track time for experience
     * POST /api/cpa-pert/enhanced/experiences/:experienceId/time-tracking
     */
    router.post(
        '/experiences/:experienceId/time-tracking',
        validateBody(schemas.trackExperienceTime),
        controller.trackExperienceTime
    );

    /**
     * Record progress milestone
     * POST /api/cpa-pert/enhanced/progress/milestones
     */
    router.post(
        '/progress/milestones',
        validateBody(schemas.recordProgressMilestone),
        controller.recordProgressMilestone
    );

    /**
     * Get user progress timeline
     * GET /api/cpa-pert/enhanced/progress/timeline
     */
    router.get(
        '/progress/timeline',
        controller.getUserProgressTimeline
    );

    /**
     * Submit report to CPA
     * POST /api/cpa-pert/enhanced/reports/:reportId/submit-to-cpa
     */
    router.post(
        '/reports/:reportId/submit-to-cpa',
        validateBody(schemas.submitReportToCPA),
        authMiddleware.rateLimitByUser({ windowMs: 3600000, max: 5 }),
        controller.submitReportToCPA
    );

    /**
     * Get submission history
     * GET /api/cpa-pert/enhanced/reports/:reportId/submission-history
     */
    router.get(
        '/reports/:reportId/submission-history',
        controller.getSubmissionHistory
    );

    // ========================================
    // HEALTH CHECK
    // ========================================
    
    /**
     * Health check for enhanced PERT module
     * GET /api/cpa-pert/enhanced/health
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            module: 'cpa-pert-enhanced',
            version: '2.0.0',
            features: {
                softDelete: true,
                appendOnly: true,
                versionControl: true,
                evrSupport: true,
                auditTrail: true,
                templates: true
            },
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

module.exports = createCPAPertEnhancedRoutes;
