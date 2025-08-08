/**
 * Enhanced CPA PERT Routes with EVR Support
 * Implements comprehensive PERT reporting with soft delete protection
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { rateLimiter } = require('../middleware/rateLimiter');
const Joi = require('joi');

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
};

// Initialize controller with dependencies
function initializeRoutes(container) {
    const controller = container.resolve('cpaPertControllerEnhanced');
    
    // ========================================
    // REPORT MANAGEMENT ROUTES
    // ========================================
    
    /**
     * Create new PERT report
     * POST /api/cpa-pert/enhanced/reports
     */
    router.post('/reports',
        authenticate,
        validateRequest(schemas.createReport),
        rateLimiter.aiRateLimit({ maxRequests: 10, windowMs: 3600000 }), // 10 per hour
        controller.createReport
    );

    /**
     * Get user's PERT reports
     * GET /api/cpa-pert/enhanced/reports
     */
    router.get('/reports',
        authenticate,
        controller.getReports
    );

    /**
     * Export PERT report
     * GET /api/cpa-pert/enhanced/reports/:reportId/export
     */
    router.get('/reports/:reportId/export',
        authenticate,
        rateLimiter.heavyOperationLimit(),
        controller.exportReport
    );

    // ========================================
    // EXPERIENCE MANAGEMENT ROUTES
    // ========================================
    
    /**
     * Add experience to report (Append-only)
     * POST /api/cpa-pert/enhanced/reports/:reportId/experiences
     */
    router.post('/reports/:reportId/experiences',
        authenticate,
        validateRequest(schemas.addExperience),
        rateLimiter.aiRateLimit({ maxRequests: 30, windowMs: 3600000 }), // 30 per hour
        controller.addExperience
    );

    /**
     * Get experiences for report
     * GET /api/cpa-pert/enhanced/reports/:reportId/experiences
     */
    router.get('/reports/:reportId/experiences',
        authenticate,
        controller.getExperiences
    );

    /**
     * Update experience (Creates new version)
     * PUT /api/cpa-pert/enhanced/experiences/:experienceId
     */
    router.put('/experiences/:experienceId',
        authenticate,
        validateRequest(schemas.updateExperience),
        controller.updateExperience
    );

    /**
     * Soft delete experience
     * DELETE /api/cpa-pert/enhanced/experiences/:experienceId
     */
    router.delete('/experiences/:experienceId',
        authenticate,
        validateRequest(schemas.deleteExperience),
        controller.softDeleteExperience
    );

    /**
     * Restore soft-deleted experience
     * POST /api/cpa-pert/enhanced/experiences/:experienceId/restore
     */
    router.post('/experiences/:experienceId/restore',
        authenticate,
        controller.restoreExperience
    );

    /**
     * Get experience audit trail
     * GET /api/cpa-pert/enhanced/experiences/:experienceId/audit
     */
    router.get('/experiences/:experienceId/audit',
        authenticate,
        controller.getAuditTrail
    );

    // ========================================
    // COMPETENCY & PROGRESS ROUTES
    // ========================================
    
    /**
     * Get competency progress
     * GET /api/cpa-pert/enhanced/progress
     */
    router.get('/progress',
        authenticate,
        controller.getCompetencyProgress
    );

    /**
     * Get competency framework
     * GET /api/cpa-pert/enhanced/competency-framework
     */
    router.get('/competency-framework',
        authenticate,
        controller.getCompetencyFramework
    );

    // ========================================
    // EVR ASSESSMENT ROUTES
    // ========================================
    
    /**
     * Create EVR pre-assessment
     * POST /api/cpa-pert/enhanced/evr-assessment
     */
    router.post('/evr-assessment',
        authenticate,
        validateRequest(schemas.createEvrAssessment),
        rateLimiter.aiRateLimit({ maxRequests: 5, windowMs: 3600000 }), // 5 per hour
        controller.createEvrAssessment
    );

    /**
     * Analyze job description for competency mapping
     * POST /api/cpa-pert/enhanced/analyze-job
     */
    router.post('/analyze-job',
        authenticate,
        validateRequest(schemas.analyzeJob),
        rateLimiter.aiRateLimit({ maxRequests: 10, windowMs: 3600000 }), // 10 per hour
        controller.analyzeJobDescription
    );

    // ========================================
    // TEMPLATE ROUTES
    // ========================================
    
    /**
     * Get experience templates
     * GET /api/cpa-pert/enhanced/templates
     */
    router.get('/templates',
        authenticate,
        controller.getTemplates
    );

    /**
     * Generate experience from template
     * POST /api/cpa-pert/enhanced/templates/:templateId/generate
     */
    router.post('/templates/:templateId/generate',
        authenticate,
        validateRequest(schemas.generateFromTemplate),
        controller.generateExperienceFromTemplate
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

module.exports = initializeRoutes;