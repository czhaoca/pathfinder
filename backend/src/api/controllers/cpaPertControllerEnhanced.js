/**
 * Enhanced CPA PERT Controller with EVR Support
 * Implements append-only operations with soft delete protection
 * Supports separate task/story tracking and progression
 */

const { AppError } = require('../middleware/errorHandler');
const ApiResponse = require('../../utils/apiResponse');
const logger = require('../../utils/logger');

class EnhancedCpaPertController {
    constructor(cpaPertService, auditService) {
        this.cpaPertService = cpaPertService;
        this.auditService = auditService;
        
        // Bind methods
        this.createReport = this.createReport.bind(this);
        this.addExperience = this.addExperience.bind(this);
        this.updateExperience = this.updateExperience.bind(this);
        this.getReports = this.getReports.bind(this);
        this.getExperiences = this.getExperiences.bind(this);
        this.getCompetencyProgress = this.getCompetencyProgress.bind(this);
        this.createEvrAssessment = this.createEvrAssessment.bind(this);
        this.getTemplates = this.getTemplates.bind(this);
        this.generateExperienceFromTemplate = this.generateExperienceFromTemplate.bind(this);
        this.softDeleteExperience = this.softDeleteExperience.bind(this);
        this.restoreExperience = this.restoreExperience.bind(this);
        this.getAuditTrail = this.getAuditTrail.bind(this);
        this.getCompetencyFramework = this.getCompetencyFramework.bind(this);
        this.analyzeJobDescription = this.analyzeJobDescription.bind(this);
        this.exportReport = this.exportReport.bind(this);
        this.submitReport = this.submitReport.bind(this);
        this.addExperienceBreakdown = this.addExperienceBreakdown.bind(this);
        this.recordProgressMilestone = this.recordProgressMilestone.bind(this);
        this.trackExperienceTime = this.trackExperienceTime.bind(this);
        this.getExperienceBreakdown = this.getExperienceBreakdown.bind(this);
        this.getUserProgressTimeline = this.getUserProgressTimeline.bind(this);
        this.submitReportToCPA = this.submitReportToCPA.bind(this);
        this.getSubmissionHistory = this.getSubmissionHistory.bind(this);
    }

    /**
     * Create a new PERT report for EVR or PPR route
     * @route POST /api/cpa-pert/reports
     */
    async createReport(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const reportData = {
                ...req.body,
                user_id: userId,
                status: 'draft',
                version: 1
            };

            // Validate required fields
            this.validateReportData(reportData);

            // Create report with audit logging
            const report = await this.cpaPertService.createReport(reportData);

            // Log action
            await this.auditService.logAction({
                userId,
                action: 'CREATE_PERT_REPORT',
                resourceType: 'pert_report',
                resourceId: report.id,
                details: { 
                    route_type: reportData.route_type,
                    period: `${reportData.report_period_start} to ${reportData.report_period_end}`
                }
            });

            return ApiResponse.created(res, report, 'PERT report created successfully');
        } catch (error) {
            logger.error('Error creating PERT report:', error);
            next(error);
        }
    }

    /**
     * Add experience entry to report (Append-only with CARL method)
     * @route POST /api/cpa-pert/reports/:reportId/experiences
     */
    async addExperience(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            const experienceData = {
                ...req.body,
                report_id: reportId,
                version: 1,
                approval_status: 'pending'
            };

            // Verify report ownership
            await this.verifyReportOwnership(reportId, userId);

            // Validate CARL method fields
            this.validateExperienceData(experienceData);

            // Calculate word and character counts
            experienceData.word_count = this.calculateWordCount(experienceData);
            experienceData.character_count = this.calculateCharacterCount(experienceData);

            // Validate character limits based on proficiency level
            this.validateCharacterLimits(experienceData);

            // Extract and validate CPA values
            experienceData.cpa_values = this.extractCpaValues(experienceData);

            // Create experience entry (append-only)
            const experience = await this.cpaPertService.addExperience(experienceData);

            // Update competency progress
            await this.cpaPertService.updateCompetencyProgress(
                userId,
                experience.sub_competency_id,
                experience.proficiency_level
            );

            // Create review history entry
            await this.cpaPertService.createReviewHistory({
                experience_id: experience.id,
                report_id: reportId,
                action: 'submitted',
                new_status: 'pending',
                created_at: new Date()
            });

            // Log action
            await this.auditService.logAction({
                userId,
                action: 'ADD_PERT_EXPERIENCE',
                resourceType: 'pert_experience',
                resourceId: experience.id,
                details: { 
                    competency: experience.sub_competency_id,
                    level: experience.proficiency_level,
                    word_count: experience.word_count
                }
            });

            return ApiResponse.created(res, experience, 'Experience added successfully');
        } catch (error) {
            logger.error('Error adding experience:', error);
            next(error);
        }
    }

    /**
     * Update experience (Creates new version, preserves original)
     * @route PUT /api/cpa-pert/experiences/:experienceId
     */
    async updateExperience(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;
            const updates = req.body;

            // Verify ownership through report
            const experience = await this.cpaPertService.getExperienceById(experienceId);
            if (!experience) {
                throw new AppError('Experience not found', 404);
            }
            
            await this.verifyReportOwnership(experience.report_id, userId);

            // Validate updates
            if (updates.challenge || updates.actions || updates.results || updates.lessons_learned) {
                this.validateExperienceData(updates);
                updates.word_count = this.calculateWordCount(updates);
                updates.character_count = this.calculateCharacterCount(updates);
                this.validateCharacterLimits(updates);
            }

            // Create new version instead of updating (append-only)
            const newVersion = await this.cpaPertService.createExperienceVersion(
                experienceId,
                {
                    ...experience,
                    ...updates,
                    last_edited_by: userId,
                    version: experience.version + 1,
                    previous_version_id: experienceId,
                    updated_at: new Date()
                }
            );

            // Create review history entry
            await this.cpaPertService.createReviewHistory({
                experience_id: newVersion.id,
                report_id: experience.report_id,
                action: 'revised',
                previous_status: experience.approval_status,
                new_status: 'pending',
                comments: updates.revision_notes,
                changes_made: JSON.stringify(Object.keys(updates))
            });

            // Log version creation
            await this.auditService.logAction({
                userId,
                action: 'UPDATE_PERT_EXPERIENCE',
                resourceType: 'pert_experience',
                resourceId: newVersion.id,
                details: { 
                    previous_version: experienceId,
                    version: newVersion.version,
                    changes: Object.keys(updates)
                }
            });

            return ApiResponse.success(res, newVersion, 'Experience updated successfully');
        } catch (error) {
            logger.error('Error updating experience:', error);
            next(error);
        }
    }

    /**
     * Soft delete experience (preserves data, marks as deleted)
     * @route DELETE /api/cpa-pert/experiences/:experienceId
     */
    async softDeleteExperience(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;
            const { reason } = req.body;

            if (!reason) {
                throw new AppError('Deletion reason is required', 400);
            }

            // Verify ownership
            const experience = await this.cpaPertService.getExperienceById(experienceId);
            if (!experience) {
                throw new AppError('Experience not found', 404);
            }
            
            await this.verifyReportOwnership(experience.report_id, userId);

            // Perform soft delete (data protection)
            await this.cpaPertService.softDeleteExperience(experienceId, userId, reason);

            // Create review history entry
            await this.cpaPertService.createReviewHistory({
                experience_id: experienceId,
                report_id: experience.report_id,
                action: 'deleted',
                previous_status: experience.approval_status,
                new_status: 'deleted',
                comments: reason
            });

            // Log soft delete
            await this.auditService.logAction({
                userId,
                action: 'SOFT_DELETE_EXPERIENCE',
                resourceType: 'pert_experience',
                resourceId: experienceId,
                details: { reason, competency: experience.sub_competency_id }
            });

            return ApiResponse.success(res, null, 'Experience deleted successfully');
        } catch (error) {
            logger.error('Error deleting experience:', error);
            next(error);
        }
    }

    /**
     * Get user's PERT reports
     * @route GET /api/cpa-pert/reports
     */
    async getReports(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { status, route_type, include_deleted } = req.query;

            const reports = await this.cpaPertService.getUserReports(userId, {
                status,
                route_type,
                include_deleted: include_deleted === 'true'
            });

            // Add summary statistics to each report
            for (const report of reports) {
                report.statistics = await this.cpaPertService.getReportStatistics(report.id);
            }

            return ApiResponse.success(res, reports);
        } catch (error) {
            logger.error('Error fetching reports:', error);
            next(error);
        }
    }

    /**
     * Get experiences for a report with task/story separation
     * @route GET /api/cpa-pert/reports/:reportId/experiences
     */
    async getExperiences(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            const { 
                competency_area, 
                proficiency_level, 
                include_versions,
                group_by_story,
                status 
            } = req.query;

            // Verify report ownership
            await this.verifyReportOwnership(reportId, userId);

            const experiences = await this.cpaPertService.getReportExperiences(reportId, {
                competency_area,
                proficiency_level,
                include_versions: include_versions === 'true',
                status
            });

            // Group by story/task if requested
            let result = experiences;
            if (group_by_story === 'true') {
                result = this.groupExperiencesByStory(experiences);
            }

            return ApiResponse.success(res, result);
        } catch (error) {
            logger.error('Error fetching experiences:', error);
            next(error);
        }
    }

    /**
     * Get competency progress with EVR requirements tracking
     * @route GET /api/cpa-pert/progress
     */
    async getCompetencyProgress(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            
            const progress = await this.cpaPertService.getCompetencyProgress(userId);
            
            // Calculate EVR-specific requirements
            const evrRequirements = this.calculateEvrRequirements(progress);
            
            // Calculate overall progress
            const summary = this.calculateProgressSummary(progress);

            return ApiResponse.success(res, {
                progress,
                summary,
                evr_requirements: evrRequirements,
                estimated_completion: this.estimateCompletionDate(progress)
            });
        } catch (error) {
            logger.error('Error fetching competency progress:', error);
            next(error);
        }
    }

    /**
     * Create EVR pre-assessment
     * @route POST /api/cpa-pert/evr-assessment
     */
    async createEvrAssessment(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const assessmentData = {
                ...req.body,
                user_id: userId,
                assessment_status: 'pending'
            };

            // Validate assessment data
            this.validateEvrAssessment(assessmentData);

            const assessment = await this.cpaPertService.createEvrAssessment(assessmentData);

            // Analyze job description for competency mapping
            const competencyMapping = await this.cpaPertService.analyzeJobDescription(
                assessmentData.job_description,
                assessmentData.position_title
            );

            // Update assessment with mapping
            await this.cpaPertService.updateEvrAssessment(assessment.id, {
                technical_exposure: competencyMapping.technical,
                enabling_exposure: competencyMapping.enabling,
                recommendations: competencyMapping.recommendations
            });

            // Log assessment creation
            await this.auditService.logAction({
                userId,
                action: 'CREATE_EVR_ASSESSMENT',
                resourceType: 'evr_assessment',
                resourceId: assessment.id,
                details: { 
                    employer: assessmentData.employer_name,
                    position: assessmentData.position_title
                }
            });

            return ApiResponse.created(res, {
                ...assessment,
                competency_mapping: competencyMapping
            }, 'EVR assessment created successfully');
        } catch (error) {
            logger.error('Error creating EVR assessment:', error);
            next(error);
        }
    }

    /**
     * Get experience templates for EVR route
     * @route GET /api/cpa-pert/templates
     */
    async getTemplates(req, res, next) {
        try {
            const { competency_id, level, industry, search, route_type } = req.query;

            const templates = await this.cpaPertService.getTemplates({
                competency_id,
                level,
                industry,
                search,
                route_type: route_type || 'EVR' // Default to EVR templates
            });

            return ApiResponse.success(res, templates);
        } catch (error) {
            logger.error('Error fetching templates:', error);
            next(error);
        }
    }

    /**
     * Get competency framework with EVR indicators
     * @route GET /api/cpa-pert/competency-framework
     */
    async getCompetencyFramework(req, res, next) {
        try {
            const { category, include_indicators } = req.query;
            
            const framework = await this.cpaPertService.getCompetencyFramework({
                category,
                include_indicators: include_indicators === 'true'
            });

            // Add EVR-specific requirements
            framework.evr_requirements = {
                technical: {
                    core: 'Level 1 in 3+ sub-areas of FR or MA',
                    depth: 'All sub-areas at Level 1, with 2+ at Level 2 in one area',
                    breadth: 'Level 1 in sub-areas from different competency areas'
                },
                enabling: {
                    progression: 'Show development from Level 1 to Level 2 over 30 months',
                    all_areas: 'Must address all 5 enabling competency areas'
                },
                time: '30 months minimum, up to 12 months prior experience'
            };

            return ApiResponse.success(res, framework);
        } catch (error) {
            logger.error('Error fetching competency framework:', error);
            next(error);
        }
    }

    /**
     * Analyze job description for EVR competency mapping
     * @route POST /api/cpa-pert/analyze-job
     */
    async analyzeJobDescription(req, res, next) {
        try {
            const { job_description, position_title } = req.body;

            if (!job_description) {
                throw new AppError('Job description is required', 400);
            }

            const analysis = await this.cpaPertService.analyzeJobDescription(
                job_description,
                position_title
            );

            return ApiResponse.success(res, analysis);
        } catch (error) {
            logger.error('Error analyzing job description:', error);
            next(error);
        }
    }

    /**
     * Export PERT report for submission
     * @route GET /api/cpa-pert/reports/:reportId/export
     */
    async exportReport(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            const { format = 'pdf' } = req.query;

            // Verify ownership
            await this.verifyReportOwnership(reportId, userId);

            // Validate report is ready for export
            const report = await this.cpaPertService.getReportById(reportId);
            const validation = await this.cpaPertService.validateReportForSubmission(reportId);
            
            if (!validation.isValid) {
                throw new AppError(`Report not ready for export: ${validation.errors.join(', ')}`, 400);
            }

            // Generate export
            const exportData = await this.cpaPertService.exportReport(reportId, format);

            // Log export
            await this.auditService.logAction({
                userId,
                action: 'EXPORT_PERT_REPORT',
                resourceType: 'pert_report',
                resourceId: reportId,
                details: { format }
            });

            // Send file response
            res.setHeader('Content-Type', exportData.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
            res.send(exportData.buffer);
        } catch (error) {
            logger.error('Error exporting report:', error);
            next(error);
        }
    }

    /**
     * Submit PERT report snapshot to CPA (immutable record)
     * @route POST /api/cpa-pert/reports/:reportId/submit
     */
    async submitReport(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            const { payload, exportedFileUrl, ackReference } = req.body || {};

            if (!payload || typeof payload !== 'object') {
                throw new AppError('Submission payload (object) is required', 400);
            }

            // Verify report ownership
            await this.verifyReportOwnership(reportId, userId);

            // Validate report readiness
            const validation = await this.cpaPertService.validateReportForSubmission(reportId);
            if (!validation.isValid) {
                return ApiResponse.badRequest(res, validation, 'Report has outstanding issues');
            }

            const submission = await this.cpaPertService.submitReport({
                report_id: reportId,
                user_id: userId,
                payload,
                exported_file_url: exportedFileUrl,
                ack_reference: ackReference
            });

            await this.auditService.logAction({
                userId,
                action: 'SUBMIT_PERT_REPORT',
                resourceType: 'pert_report',
                resourceId: reportId,
                details: { submission_id: submission.id }
            });

            return ApiResponse.created(res, submission, 'Report submitted');
        } catch (error) {
            logger.error('Error submitting report:', error);
            next(error);
        }
    }

    /**
     * Get audit trail for an experience
     * @route GET /api/cpa-pert/experiences/:experienceId/audit
     */
    async getAuditTrail(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;

            // Verify ownership
            const experience = await this.cpaPertService.getExperienceById(experienceId);
            if (!experience) {
                throw new AppError('Experience not found', 404);
            }
            
            await this.verifyReportOwnership(experience.report_id, userId);

            const auditTrail = await this.cpaPertService.getExperienceAuditTrail(experienceId);

            return ApiResponse.success(res, auditTrail);
        } catch (error) {
            logger.error('Error fetching audit trail:', error);
            next(error);
        }
    }

    /**
     * Restore soft-deleted experience
     * @route POST /api/cpa-pert/experiences/:experienceId/restore
     */
    async restoreExperience(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;

            // Verify ownership (including deleted records)
            const experience = await this.cpaPertService.getExperienceById(experienceId, true);
            if (!experience) {
                throw new AppError('Experience not found', 404);
            }
            
            if (!experience.deleted_at) {
                throw new AppError('Experience is not deleted', 400);
            }

            await this.verifyReportOwnership(experience.report_id, userId);

            // Restore the experience
            const restored = await this.cpaPertService.restoreExperience(experienceId, userId);

            // Create review history entry
            await this.cpaPertService.createReviewHistory({
                experience_id: experienceId,
                report_id: experience.report_id,
                action: 'restored',
                new_status: 'pending',
                comments: 'Experience restored from deletion'
            });

            // Log restoration
            await this.auditService.logAction({
                userId,
                action: 'RESTORE_EXPERIENCE',
                resourceType: 'pert_experience',
                resourceId: experienceId
            });

            return ApiResponse.success(res, restored, 'Experience restored successfully');
        } catch (error) {
            logger.error('Error restoring experience:', error);
            next(error);
        }
    }

    /**
     * Generate experience from template
     * @route POST /api/cpa-pert/templates/:templateId/generate
     */
    async generateExperienceFromTemplate(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { templateId } = req.params;
            const { customizations, report_id } = req.body;

            if (!report_id) {
                throw new AppError('Report ID is required', 400);
            }

            // Verify report ownership
            await this.verifyReportOwnership(report_id, userId);

            const generated = await this.cpaPertService.generateFromTemplate(
                templateId,
                customizations
            );

            // Track template usage
            await this.cpaPertService.incrementTemplateUsage(templateId);

            // Log template usage
            await this.auditService.logAction({
                userId,
                action: 'USE_PERT_TEMPLATE',
                resourceType: 'pert_template',
                resourceId: templateId,
                details: { report_id }
            });

            return ApiResponse.success(res, generated, 'Experience generated from template');
        } catch (error) {
            logger.error('Error generating from template:', error);
            next(error);
        }
    }

    /**
     * Add experience breakdown for detailed tracking
     * @route POST /api/cpa-pert/experiences/:experienceId/breakdown
     */
    async addExperienceBreakdown(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;
            
            // Verify experience ownership
            const experience = await this.cpaPertService.getExperience(experienceId);
            if (!experience) {
                throw new AppError('Experience not found', 404);
            }
            
            const breakdownData = {
                ...req.body,
                experience_id: experienceId,
                report_id: experience.report_id,
                user_id: userId
            };
            
            // Validate required fields
            const required = ['activity_type', 'activity_description', 'start_date', 'end_date', 'hours_spent'];
            const missing = required.filter(field => !breakdownData[field]);
            if (missing.length > 0) {
                throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
            }
            
            const breakdown = await this.cpaPertService.addExperienceBreakdown(breakdownData);
            
            // Log action
            await this.auditService.logAction({
                userId,
                action: 'ADD_EXPERIENCE_BREAKDOWN',
                resourceType: 'experience_breakdown',
                resourceId: breakdown.id,
                details: { experience_id: experienceId }
            });
            
            return ApiResponse.created(res, breakdown, 'Experience breakdown added successfully');
        } catch (error) {
            logger.error('Error adding experience breakdown:', error);
            next(error);
        }
    }

    /**
     * Record progress milestone
     * @route POST /api/cpa-pert/progress/milestones
     */
    async recordProgressMilestone(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            
            const milestoneData = {
                ...req.body,
                user_id: userId,
                milestone_date: req.body.milestone_date || new Date().toISOString().split('T')[0]
            };
            
            // Validate required fields
            const required = ['sub_competency_id', 'achieved_level'];
            const missing = required.filter(field => !milestoneData[field] && milestoneData[field] !== 0);
            if (missing.length > 0) {
                throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
            }
            
            const milestone = await this.cpaPertService.recordProgressMilestone(milestoneData);
            
            // Log action
            await this.auditService.logAction({
                userId,
                action: 'RECORD_PROGRESS_MILESTONE',
                resourceType: 'progress_milestone',
                resourceId: milestone.id,
                details: { 
                    competency: milestoneData.sub_competency_id,
                    level: milestoneData.achieved_level 
                }
            });
            
            return ApiResponse.created(res, milestone, 'Progress milestone recorded successfully');
        } catch (error) {
            logger.error('Error recording progress milestone:', error);
            next(error);
        }
    }

    /**
     * Track time for experience
     * @route POST /api/cpa-pert/experiences/:experienceId/time-tracking
     */
    async trackExperienceTime(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { experienceId } = req.params;
            
            const timeData = {
                ...req.body,
                experience_id: experienceId,
                user_id: userId
            };
            
            // Validate required fields
            const required = ['activity_date', 'hours_logged'];
            const missing = required.filter(field => !timeData[field] && timeData[field] !== 0);
            if (missing.length > 0) {
                throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
            }
            
            // Validate hours
            if (timeData.hours_logged <= 0 || timeData.hours_logged > 24) {
                throw new AppError('Hours logged must be between 0 and 24', 400);
            }
            
            const timeEntry = await this.cpaPertService.trackExperienceTime(timeData);
            
            return ApiResponse.created(res, timeEntry, 'Time tracked successfully');
        } catch (error) {
            logger.error('Error tracking experience time:', error);
            next(error);
        }
    }

    /**
     * Get experience breakdown
     * @route GET /api/cpa-pert/experiences/:experienceId/breakdown
     */
    async getExperienceBreakdown(req, res, next) {
        try {
            const { experienceId } = req.params;
            
            const breakdown = await this.cpaPertService.getExperienceBreakdown(experienceId);
            
            return ApiResponse.success(res, breakdown, 'Experience breakdown retrieved successfully');
        } catch (error) {
            logger.error('Error getting experience breakdown:', error);
            next(error);
        }
    }

    /**
     * Get user progress timeline
     * @route GET /api/cpa-pert/progress/timeline
     */
    async getUserProgressTimeline(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { sub_competency_id } = req.query;
            
            const timeline = await this.cpaPertService.getUserProgressTimeline(userId, sub_competency_id);
            
            return ApiResponse.success(res, timeline, 'Progress timeline retrieved successfully');
        } catch (error) {
            logger.error('Error getting progress timeline:', error);
            next(error);
        }
    }

    /**
     * Submit report to CPA
     * @route POST /api/cpa-pert/reports/:reportId/submit-to-cpa
     */
    async submitReportToCPA(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            
            // Verify report ownership
            await this.verifyReportOwnership(reportId, userId);
            
            const submissionData = {
                ...req.body,
                submission_type: req.body.submission_type || 'final'
            };
            
            const submission = await this.cpaPertService.submitReportToCPA(reportId, userId, submissionData);
            
            // Log action
            await this.auditService.logAction({
                userId,
                action: 'SUBMIT_REPORT_TO_CPA',
                resourceType: 'pert_submission',
                resourceId: submission.id,
                details: { 
                    report_id: reportId,
                    experience_count: submission.experience_count,
                    total_word_count: submission.total_word_count
                }
            });
            
            return ApiResponse.success(res, submission, 'Report submitted to CPA successfully');
        } catch (error) {
            logger.error('Error submitting report to CPA:', error);
            next(error);
        }
    }

    /**
     * Get submission history
     * @route GET /api/cpa-pert/reports/:reportId/submission-history
     */
    async getSubmissionHistory(req, res, next) {
        try {
            const userId = req.user.id || req.user.userId;
            const { reportId } = req.params;
            
            // Verify report ownership
            await this.verifyReportOwnership(reportId, userId);
            
            const query = `
                SELECT sh.*, s.submission_type, s.submission_status
                FROM ${this.cpaPertService.tablePrefix}cpa_submission_history sh
                JOIN ${this.cpaPertService.tablePrefix}cpa_pert_submissions s ON sh.submission_id = s.id
                WHERE sh.report_id = :report_id
                ORDER BY sh.action_date DESC`;
            
            const result = await this.cpaPertService.database.executeQuery(query, { report_id: reportId });
            
            return ApiResponse.success(res, result.rows, 'Submission history retrieved successfully');
        } catch (error) {
            logger.error('Error getting submission history:', error);
            next(error);
        }
    }

    // ===============================
    // Helper Methods
    // =============================== 

    validateReportData(data) {
        const required = ['report_period_start', 'report_period_end', 'route_type'];
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
        }

        // Validate route type
        if (!['EVR', 'PPR'].includes(data.route_type)) {
            throw new AppError('Invalid route type. Must be EVR or PPR', 400);
        }

        // Validate period
        const start = new Date(data.report_period_start);
        const end = new Date(data.report_period_end);
        
        if (end <= start) {
            throw new AppError('Report period end must be after start date', 400);
        }

        // Maximum reporting period is 6 months
        const monthsDiff = (end - start) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 6) {
            throw new AppError('Report period cannot exceed 6 months', 400);
        }
    }

    validateExperienceData(data) {
        // CARL method fields are required
        const carlFields = ['challenge', 'actions', 'results', 'lessons_learned'];
        const missing = carlFields.filter(field => !data[field] || data[field].trim() === '');
        
        if (missing.length > 0) {
            throw new AppError(`Missing CARL method fields: ${missing.join(', ')}`, 400);
        }

        // Validate proficiency level if provided
        if (data.proficiency_level !== undefined && ![0, 1, 2].includes(data.proficiency_level)) {
            throw new AppError('Invalid proficiency level. Must be 0, 1, or 2', 400);
        }
    }

    validateCharacterLimits(data) {
        const level = data.proficiency_level || 0;
        const charCount = data.character_count || 0;

        // Character limits based on proficiency level
        const limits = {
            0: 2500,  // Level 0: Basic (2500 chars)
            1: 3500,  // Level 1: Foundational (3500 chars)
            2: 5000   // Level 2: Competent (5000 chars)
        };

        if (charCount > limits[level]) {
            throw new AppError(
                `Level ${level} experiences must not exceed ${limits[level]} characters (currently ${charCount})`, 
                400
            );
        }

        // Minimum requirements for higher levels
        if (level === 2 && charCount < 1500) {
            throw new AppError('Level 2 experiences require at least 1500 characters', 400);
        }
    }

    validateEvrAssessment(data) {
        const required = [
            'employer_name',
            'position_title',
            'job_description',
            'start_date'
        ];
        
        const missing = required.filter(field => !data[field]);
        
        if (missing.length > 0) {
            throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
        }

        // Job description should be substantial
        if (data.job_description.length < 200) {
            throw new AppError('Job description must be at least 200 characters', 400);
        }
    }

    async verifyReportOwnership(reportId, userId) {
        const report = await this.cpaPertService.getReportById(reportId);
        
        if (!report) {
            throw new AppError('Report not found', 404);
        }
        
        if (report.user_id !== userId) {
            throw new AppError('Unauthorized access to report', 403);
        }
        
        return report;
    }

    calculateWordCount(experience) {
        const fields = ['challenge', 'actions', 'results', 'lessons_learned'];
        return fields.reduce((sum, field) => {
            return sum + (experience[field] || '').split(/\s+/).filter(Boolean).length;
        }, 0);
    }

    calculateCharacterCount(experience) {
        const fields = ['challenge', 'actions', 'results', 'lessons_learned'];
        return fields.reduce((sum, field) => {
            return sum + (experience[field] || '').length;
        }, 0);
    }

    extractCpaValues(experience) {
        const cpaValues = {
            competence: false,
            objectivity: false,
            due_care: false,
            integrity: false,
            independence: false,
            professional_behavior: false,
            confidentiality: false
        };

        // Extract CPA values from text content
        const content = `${experience.challenge} ${experience.actions} ${experience.results} ${experience.lessons_learned}`.toLowerCase();

        // Check for keywords indicating CPA values
        if (content.includes('competent') || content.includes('skilled') || content.includes('expertise')) {
            cpaValues.competence = true;
        }
        if (content.includes('objective') || content.includes('unbiased') || content.includes('impartial')) {
            cpaValues.objectivity = true;
        }
        if (content.includes('careful') || content.includes('diligent') || content.includes('thorough')) {
            cpaValues.due_care = true;
        }
        if (content.includes('honest') || content.includes('ethical') || content.includes('integrity')) {
            cpaValues.integrity = true;
        }
        if (content.includes('independent') || content.includes('autonomous')) {
            cpaValues.independence = true;
        }
        if (content.includes('professional') || content.includes('conduct')) {
            cpaValues.professional_behavior = true;
        }
        if (content.includes('confidential') || content.includes('privacy') || content.includes('secure')) {
            cpaValues.confidentiality = true;
        }

        return cpaValues;
    }

    groupExperiencesByStory(experiences) {
        const grouped = {};
        
        experiences.forEach(exp => {
            const key = exp.experience_title || 'Untitled';
            if (!grouped[key]) {
                grouped[key] = {
                    title: key,
                    experiences: [],
                    total_hours: 0,
                    competencies_covered: new Set(),
                    proficiency_levels: { 0: 0, 1: 0, 2: 0 }
                };
            }
            
            grouped[key].experiences.push(exp);
            grouped[key].total_hours += exp.time_spent_hours || 0;
            grouped[key].competencies_covered.add(exp.sub_competency_id);
            grouped[key].proficiency_levels[exp.proficiency_level]++;
        });

        // Convert sets to arrays
        Object.values(grouped).forEach(story => {
            story.competencies_covered = Array.from(story.competencies_covered);
        });

        return Object.values(grouped);
    }

    calculateEvrRequirements(progress) {
        const technical = progress.filter(p => p.category === 'technical');
        const enabling = progress.filter(p => p.category === 'enabling');

        // Core requirement: Level 1 in 3+ sub-areas of FR or MA
        const frMaProgress = technical.filter(p => 
            p.competency_area === 'FR' || p.competency_area === 'MA'
        );
        const coreMetCount = frMaProgress.filter(p => p.current_level >= 1).length;

        // Depth requirement: All sub-areas at Level 1, with 2+ at Level 2
        const depthMet = this.checkDepthRequirement(technical);

        // Breadth requirement: Multiple competency areas
        const areasWithProgress = new Set(technical.filter(p => p.current_level >= 1).map(p => p.competency_area));

        return {
            core: {
                required: 3,
                achieved: coreMetCount,
                met: coreMetCount >= 3
            },
            depth: {
                met: depthMet,
                details: this.getDepthDetails(technical)
            },
            breadth: {
                areas_covered: areasWithProgress.size,
                required: 2,
                met: areasWithProgress.size >= 2
            },
            enabling: {
                total: 5,
                level_1: enabling.filter(p => p.current_level >= 1).length,
                level_2: enabling.filter(p => p.current_level >= 2).length,
                progression_shown: enabling.some(p => p.current_level > 0)
            },
            time_requirement: {
                months_required: 30,
                months_completed: 0, // Would calculate from actual data
                prior_experience_used: 0
            }
        };
    }

    calculateProgressSummary(progress) {
        const technical = progress.filter(p => p.category === 'technical');
        const enabling = progress.filter(p => p.category === 'enabling');

        const technicalLevel2 = technical.filter(p => p.current_level >= 2).length;
        const enablingLevel2 = enabling.filter(p => p.current_level >= 2).length;

        const coreComplete = technical.filter(p => 
            p.is_core && p.current_level >= 1
        ).length >= 3;

        const depthComplete = this.checkDepthRequirement(technical);

        return {
            technical_progress: {
                total: technical.length,
                level_1: technical.filter(p => p.current_level >= 1).length,
                level_2: technicalLevel2,
                core_complete: coreComplete,
                depth_complete: depthComplete
            },
            enabling_progress: {
                total: enabling.length,
                level_1: enabling.filter(p => p.current_level >= 1).length,
                level_2: enablingLevel2
            },
            overall_percentage: this.calculateOverallPercentage(progress),
            recommendations: this.generateRecommendations(progress)
        };
    }

    checkDepthRequirement(technicalProgress) {
        // Group by competency area
        const byArea = {};
        technicalProgress.forEach(p => {
            if (!byArea[p.competency_area]) {
                byArea[p.competency_area] = [];
            }
            byArea[p.competency_area].push(p);
        });

        // Check if any area meets depth requirement
        for (const area of Object.values(byArea)) {
            const level1Count = area.filter(p => p.current_level >= 1).length;
            const level2Count = area.filter(p => p.current_level >= 2).length;
            
            // All sub-areas at Level 1, with at least 2 at Level 2
            if (level1Count === area.length && level2Count >= 2) {
                return true;
            }
        }
        
        return false;
    }

    getDepthDetails(technicalProgress) {
        const byArea = {};
        technicalProgress.forEach(p => {
            if (!byArea[p.competency_area]) {
                byArea[p.competency_area] = {
                    total: 0,
                    level_1: 0,
                    level_2: 0
                };
            }
            byArea[p.competency_area].total++;
            if (p.current_level >= 1) byArea[p.competency_area].level_1++;
            if (p.current_level >= 2) byArea[p.competency_area].level_2++;
        });

        return byArea;
    }

    calculateOverallPercentage(progress) {
        // EVR specific calculation
        const requirements = {
            technical_level_1: 10, // Minimum technical at Level 1
            technical_level_2: 4,  // Minimum technical at Level 2
            enabling_level_1: 5,   // All enabling at Level 1
            enabling_level_2: 3    // Minimum enabling at Level 2
        };

        const achieved = {
            technical_level_1: progress.filter(p => p.category === 'technical' && p.current_level >= 1).length,
            technical_level_2: progress.filter(p => p.category === 'technical' && p.current_level >= 2).length,
            enabling_level_1: progress.filter(p => p.category === 'enabling' && p.current_level >= 1).length,
            enabling_level_2: progress.filter(p => p.category === 'enabling' && p.current_level >= 2).length
        };

        let totalProgress = 0;
        let totalWeight = 0;

        Object.keys(requirements).forEach(key => {
            const weight = key.includes('level_2') ? 2 : 1; // Level 2 weighted more
            totalProgress += Math.min(1, achieved[key] / requirements[key]) * weight;
            totalWeight += weight;
        });

        return Math.min(100, Math.round((totalProgress / totalWeight) * 100));
    }

    generateRecommendations(progress) {
        const recommendations = [];
        const technical = progress.filter(p => p.category === 'technical');
        const enabling = progress.filter(p => p.category === 'enabling');

        // Check core requirement
        const coreProgress = technical.filter(p => 
            (p.competency_area === 'FR' || p.competency_area === 'MA') && p.current_level >= 1
        ).length;
        
        if (coreProgress < 3) {
            recommendations.push(`Focus on Financial Reporting or Management Accounting - need ${3 - coreProgress} more at Level 1`);
        }

        // Check Level 2 requirements
        const technicalLevel2 = technical.filter(p => p.current_level >= 2).length;
        if (technicalLevel2 < 2) {
            recommendations.push(`Develop ${2 - technicalLevel2} more technical competencies to Level 2`);
        }

        // Check enabling progression
        const enablingWithoutProgress = enabling.filter(p => p.current_level === 0);
        if (enablingWithoutProgress.length > 0) {
            recommendations.push(`Address enabling competencies: ${enablingWithoutProgress.map(p => p.sub_name).join(', ')}`);
        }

        return recommendations;
    }

    estimateCompletionDate(progress) {
        // Calculate based on current progress rate
        const overallPercentage = this.calculateOverallPercentage(progress);
        
        if (overallPercentage === 0) return null;
        if (overallPercentage === 100) return new Date().toISOString().split('T')[0];
        
        // Assume 30 months total, calculate remaining
        const monthsElapsed = 6; // Would calculate from actual start date
        const totalMonths = 30;
        const progressRate = overallPercentage / monthsElapsed;
        const remainingPercentage = 100 - overallPercentage;
        const remainingMonths = Math.ceil(remainingPercentage / progressRate);
        
        const completionDate = new Date();
        completionDate.setMonth(completionDate.getMonth() + remainingMonths);
        
        return completionDate.toISOString().split('T')[0];
    }
}

module.exports = EnhancedCpaPertController;
