/**
 * Enhanced CPA PERT Service with EVR Support
 * Implements append-only operations with soft delete protection
 * Handles all business logic for PERT reporting
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class EnhancedCpaPertService {
    constructor(database, cacheManager, aiService) {
        this.database = database;
        this.cache = cacheManager;
        this.aiService = aiService;
        this.tablePrefix = process.env.TABLE_PREFIX || 'pf_';
    }

    /**
     * Create a new PERT report with version control
     */
    async createReport(reportData) {
        try {
            const reportId = uuidv4();
            const query = `
                INSERT INTO ${this.tablePrefix}cpa_pert_reports (
                    id, user_id, report_period_start, report_period_end,
                    submission_deadline, route_type, status, employer_name,
                    position_title, hours_worked, version, created_at, updated_at
                ) VALUES (
                    :id, :user_id, :report_period_start, :report_period_end,
                    :submission_deadline, :route_type, :status, :employer_name,
                    :position_title, :hours_worked, :version, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: reportId,
                ...reportData
            });

            // Invalidate user's report cache
            await this.cache.invalidate(`user_reports_${reportData.user_id}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating PERT report:', error);
            throw error;
        }
    }

    /**
     * Add experience with CARL method validation (Append-only)
     */
    async addExperience(experienceData) {
        try {
            const experienceId = uuidv4();
            
            // Validate competency exists
            await this.validateCompetency(experienceData.sub_competency_id);

            const query = `
                INSERT INTO ${this.tablePrefix}cpa_pert_experiences (
                    id, report_id, sub_competency_id, experience_title, experience_date,
                    proficiency_level, challenge, actions, results, lessons_learned,
                    time_spent_hours, complexity_level, collaboration_type, tools_used,
                    cpa_values, word_count, character_count, approval_status, version,
                    created_at, updated_at
                ) VALUES (
                    :id, :report_id, :sub_competency_id, :experience_title, :experience_date,
                    :proficiency_level, :challenge, :actions, :results, :lessons_learned,
                    :time_spent_hours, :complexity_level, :collaboration_type, :tools_used,
                    :cpa_values, :word_count, :character_count, :approval_status, :version,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: experienceId,
                ...experienceData,
                tools_used: experienceData.tools_used ? JSON.stringify(experienceData.tools_used) : null,
                cpa_values: JSON.stringify(experienceData.cpa_values || {})
            });

            // Invalidate report cache
            await this.cache.invalidate(`report_experiences_${experienceData.report_id}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error adding experience:', error);
            throw error;
        }
    }

    /**
     * Create new version of experience (preserves history)
     */
    async createExperienceVersion(originalId, updatedData) {
        try {
            const newId = uuidv4();
            
            // Mark original as not current (soft versioning)
            await this.database.executeQuery(
                `UPDATE ${this.tablePrefix}cpa_pert_experiences 
                 SET updated_at = CURRENT_TIMESTAMP 
                 WHERE id = :id`,
                { id: originalId }
            );

            // Create new version
            const query = `
                INSERT INTO ${this.tablePrefix}cpa_pert_experiences (
                    id, report_id, sub_competency_id, experience_title, experience_date,
                    proficiency_level, challenge, actions, results, lessons_learned,
                    time_spent_hours, complexity_level, collaboration_type, tools_used,
                    cpa_values, word_count, character_count, approval_status, version,
                    previous_version_id, last_edited_by, created_at, updated_at
                ) VALUES (
                    :id, :report_id, :sub_competency_id, :experience_title, :experience_date,
                    :proficiency_level, :challenge, :actions, :results, :lessons_learned,
                    :time_spent_hours, :complexity_level, :collaboration_type, :tools_used,
                    :cpa_values, :word_count, :character_count, :approval_status, :version,
                    :previous_version_id, :last_edited_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: newId,
                ...updatedData,
                tools_used: updatedData.tools_used ? JSON.stringify(updatedData.tools_used) : null,
                cpa_values: JSON.stringify(updatedData.cpa_values || {})
            });

            // Invalidate caches
            await this.cache.invalidate(`experience_${originalId}`);
            await this.cache.invalidate(`report_experiences_${updatedData.report_id}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating experience version:', error);
            throw error;
        }
    }

    /**
     * Soft delete experience (preserves data with deletion metadata)
     */
    async softDeleteExperience(experienceId, userId, reason) {
        try {
            const query = `
                UPDATE ${this.tablePrefix}cpa_pert_experiences 
                SET deleted_at = CURRENT_TIMESTAMP,
                    deleted_by = :deleted_by,
                    deletion_reason = :reason,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id 
                AND deleted_at IS NULL
                RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: experienceId,
                deleted_by: userId,
                reason
            });

            if (result.rows.length === 0) {
                throw new Error('Experience not found or already deleted');
            }

            // Invalidate caches
            await this.cache.invalidate(`experience_${experienceId}`);
            await this.cache.invalidate(`report_experiences_${result.rows[0].report_id}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error soft deleting experience:', error);
            throw error;
        }
    }

    /**
     * Restore soft-deleted experience
     */
    async restoreExperience(experienceId, userId) {
        try {
            const query = `
                UPDATE ${this.tablePrefix}cpa_pert_experiences 
                SET deleted_at = NULL,
                    deleted_by = NULL,
                    deletion_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP,
                    last_edited_by = :user_id
                WHERE id = :id 
                AND deleted_at IS NOT NULL
                RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: experienceId,
                user_id: userId
            });

            if (result.rows.length === 0) {
                throw new Error('Experience not found or not deleted');
            }

            // Invalidate caches
            await this.cache.invalidate(`experience_${experienceId}`);
            await this.cache.invalidate(`report_experiences_${result.rows[0].report_id}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error restoring experience:', error);
            throw error;
        }
    }

    /**
     * Get user's PERT reports with filtering
     */
    async getUserReports(userId, filters = {}) {
        const cacheKey = `user_reports_${userId}_${JSON.stringify(filters)}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            let query = `
                SELECT r.*, 
                       COUNT(DISTINCT e.id) as experience_count,
                       SUM(e.time_spent_hours) as total_hours
                FROM ${this.tablePrefix}cpa_pert_reports r
                LEFT JOIN ${this.tablePrefix}cpa_pert_experiences e 
                    ON r.id = e.report_id AND e.deleted_at IS NULL
                WHERE r.user_id = :user_id`;

            const params = { user_id: userId };

            if (!filters.include_deleted) {
                query += ' AND r.deleted_at IS NULL';
            }

            if (filters.status) {
                query += ' AND r.status = :status';
                params.status = filters.status;
            }

            if (filters.route_type) {
                query += ' AND r.route_type = :route_type';
                params.route_type = filters.route_type;
            }

            query += ' GROUP BY r.id ORDER BY r.created_at DESC';

            const result = await this.database.executeQuery(query, params);
            return result.rows;
        }, 300); // Cache for 5 minutes
    }

    /**
     * Get report experiences with grouping options
     */
    async getReportExperiences(reportId, filters = {}) {
        const cacheKey = `report_experiences_${reportId}_${JSON.stringify(filters)}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            let query = `
                SELECT e.*, 
                       c.name as competency_name,
                       c.code as competency_code,
                       ca.name as competency_area_name,
                       ca.code as competency_area_code,
                       ca.category as competency_category
                FROM ${this.tablePrefix}cpa_pert_experiences e
                JOIN ${this.tablePrefix}cpa_sub_competencies c ON e.sub_competency_id = c.id
                JOIN ${this.tablePrefix}cpa_competency_areas ca ON c.competency_area_id = ca.id
                WHERE e.report_id = :report_id`;

            const params = { report_id: reportId };

            // Exclude deleted unless requested
            if (!filters.include_deleted) {
                query += ' AND e.deleted_at IS NULL';
            }

            if (filters.competency_area) {
                query += ' AND ca.code = :competency_area';
                params.competency_area = filters.competency_area;
            }

            if (filters.proficiency_level !== undefined) {
                query += ' AND e.proficiency_level = :proficiency_level';
                params.proficiency_level = filters.proficiency_level;
            }

            if (filters.status) {
                query += ' AND e.approval_status = :status';
                params.status = filters.status;
            }

            // Include version history if requested
            if (filters.include_versions) {
                query += ' ORDER BY e.experience_date, e.version DESC';
            } else {
                // Get only latest version of each experience
                query = `
                    WITH latest_versions AS (
                        SELECT DISTINCT ON (COALESCE(previous_version_id, id)) 
                            e.*,
                            c.name as competency_name,
                            c.code as competency_code,
                            ca.name as competency_area_name,
                            ca.code as competency_area_code,
                            ca.category as competency_category
                        FROM ${this.tablePrefix}cpa_pert_experiences e
                        JOIN ${this.tablePrefix}cpa_sub_competencies c ON e.sub_competency_id = c.id
                        JOIN ${this.tablePrefix}cpa_competency_areas ca ON c.competency_area_id = ca.id
                        WHERE e.report_id = :report_id
                        ${!filters.include_deleted ? 'AND e.deleted_at IS NULL' : ''}
                        ORDER BY COALESCE(previous_version_id, id), version DESC
                    )
                    SELECT * FROM latest_versions
                    ORDER BY experience_date DESC`;
            }

            const result = await this.database.executeQuery(query, params);
            return result.rows;
        }, 300); // Cache for 5 minutes
    }

    /**
     * Get competency progress for user
     */
    async getCompetencyProgress(userId) {
        const cacheKey = `competency_progress_${userId}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            const query = `
                SELECT 
                    c.id as competency_id,
                    c.code as sub_code,
                    c.name as sub_name,
                    ca.code as competency_area,
                    ca.name as area_name,
                    ca.category,
                    ca.requirements,
                    COALESCE(cp.current_level, 0) as current_level,
                    cp.target_level,
                    cp.experiences_count,
                    cp.last_experience_date,
                    cp.progress_percentage,
                    ca.requirements->>'core' = 'true' as is_core,
                    COUNT(e.id) as total_experiences,
                    MAX(e.proficiency_level) as highest_level_achieved
                FROM ${this.tablePrefix}cpa_sub_competencies c
                JOIN ${this.tablePrefix}cpa_competency_areas ca ON c.competency_area_id = ca.id
                LEFT JOIN ${this.tablePrefix}cpa_competency_progress cp 
                    ON c.id = cp.sub_competency_id AND cp.user_id = :user_id AND cp.deleted_at IS NULL
                LEFT JOIN ${this.tablePrefix}cpa_pert_experiences e 
                    ON c.id = e.sub_competency_id 
                    AND e.report_id IN (
                        SELECT id FROM ${this.tablePrefix}cpa_pert_reports 
                        WHERE user_id = :user_id AND deleted_at IS NULL
                    )
                    AND e.deleted_at IS NULL
                WHERE ca.deleted_at IS NULL AND c.deleted_at IS NULL
                GROUP BY c.id, c.code, c.name, ca.code, ca.name, ca.category, ca.requirements,
                         cp.current_level, cp.target_level, cp.experiences_count, 
                         cp.last_experience_date, cp.progress_percentage
                ORDER BY ca.display_order, c.display_order`;

            const result = await this.database.executeQuery(query, { user_id: userId });
            return result.rows;
        }, 600); // Cache for 10 minutes
    }

    /**
     * Update competency progress based on new experience
     */
    async updateCompetencyProgress(userId, subCompetencyId, newLevel) {
        try {
            // Check if progress record exists
            const checkQuery = `
                SELECT * FROM ${this.tablePrefix}cpa_competency_progress 
                WHERE user_id = :user_id AND sub_competency_id = :sub_competency_id
                AND deleted_at IS NULL`;

            const existing = await this.database.executeQuery(checkQuery, {
                user_id: userId,
                sub_competency_id: subCompetencyId
            });

            let query;
            if (existing.rows.length > 0) {
                // Update existing progress
                query = `
                    UPDATE ${this.tablePrefix}cpa_competency_progress 
                    SET current_level = GREATEST(current_level, :new_level),
                        experiences_count = experiences_count + 1,
                        last_experience_date = CURRENT_DATE,
                        progress_percentage = CASE 
                            WHEN target_level IS NULL THEN 0
                            ELSE LEAST(100, (GREATEST(current_level, :new_level)::float / target_level) * 100)
                        END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = :user_id 
                    AND sub_competency_id = :sub_competency_id
                    AND deleted_at IS NULL
                    RETURNING *`;
            } else {
                // Create new progress record
                query = `
                    INSERT INTO ${this.tablePrefix}cpa_competency_progress (
                        id, user_id, sub_competency_id, current_level, 
                        experiences_count, last_experience_date, progress_percentage,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :user_id, :sub_competency_id, :new_level,
                        1, CURRENT_DATE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING *`;
            }

            const result = await this.database.executeQuery(query, {
                user_id: userId,
                sub_competency_id: subCompetencyId,
                new_level: newLevel
            });

            // Invalidate progress cache
            await this.cache.invalidate(`competency_progress_${userId}`);

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating competency progress:', error);
            throw error;
        }
    }

    /**
     * Create review history entry for audit trail
     */
    async createReviewHistory(historyData) {
        try {
            const query = `
                INSERT INTO ${this.tablePrefix}cpa_pert_review_history (
                    id, experience_id, report_id, reviewer_id, action,
                    previous_status, new_status, comments, changes_made, created_at
                ) VALUES (
                    gen_random_uuid(), :experience_id, :report_id, :reviewer_id, :action,
                    :previous_status, :new_status, :comments, :changes_made, CURRENT_TIMESTAMP
                ) RETURNING *`;

            const result = await this.database.executeQuery(query, {
                ...historyData,
                changes_made: historyData.changes_made ? 
                    JSON.stringify(historyData.changes_made) : null
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating review history:', error);
            throw error;
        }
    }

    /**
     * Get report statistics
     */
    async getReportStatistics(reportId) {
        const cacheKey = `report_stats_${reportId}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            const query = `
                SELECT 
                    COUNT(DISTINCT e.id) as total_experiences,
                    COUNT(DISTINCT e.sub_competency_id) as competencies_covered,
                    COUNT(DISTINCT ca.id) as areas_covered,
                    SUM(e.time_spent_hours) as total_hours,
                    AVG(e.word_count) as avg_word_count,
                    COUNT(CASE WHEN e.proficiency_level = 0 THEN 1 END) as level_0_count,
                    COUNT(CASE WHEN e.proficiency_level = 1 THEN 1 END) as level_1_count,
                    COUNT(CASE WHEN e.proficiency_level = 2 THEN 1 END) as level_2_count,
                    COUNT(CASE WHEN e.approval_status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN e.approval_status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN e.approval_status = 'rejected' THEN 1 END) as rejected_count
                FROM ${this.tablePrefix}cpa_pert_experiences e
                JOIN ${this.tablePrefix}cpa_sub_competencies c ON e.sub_competency_id = c.id
                JOIN ${this.tablePrefix}cpa_competency_areas ca ON c.competency_area_id = ca.id
                WHERE e.report_id = :report_id AND e.deleted_at IS NULL`;

            const result = await this.database.executeQuery(query, { report_id: reportId });
            return result.rows[0];
        }, 300); // Cache for 5 minutes
    }

    /**
     * Create EVR assessment
     */
    async createEvrAssessment(assessmentData) {
        try {
            const assessmentId = uuidv4();
            const query = `
                INSERT INTO ${this.tablePrefix}cpa_evr_assessments (
                    id, user_id, employer_name, position_title, job_description,
                    start_date, reporting_relationship, team_size, industry,
                    assessment_status, created_at, updated_at
                ) VALUES (
                    :id, :user_id, :employer_name, :position_title, :job_description,
                    :start_date, :reporting_relationship, :team_size, :industry,
                    :assessment_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: assessmentId,
                ...assessmentData
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating EVR assessment:', error);
            throw error;
        }
    }

    /**
     * Update EVR assessment with competency mapping
     */
    async updateEvrAssessment(assessmentId, updates) {
        try {
            const query = `
                UPDATE ${this.tablePrefix}cpa_evr_assessments 
                SET technical_exposure = :technical_exposure,
                    enabling_exposure = :enabling_exposure,
                    recommendations = :recommendations,
                    assessment_status = 'completed',
                    assessment_date = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                RETURNING *`;

            const result = await this.database.executeQuery(query, {
                id: assessmentId,
                technical_exposure: JSON.stringify(updates.technical_exposure),
                enabling_exposure: JSON.stringify(updates.enabling_exposure),
                recommendations: updates.recommendations
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating EVR assessment:', error);
            throw error;
        }
    }

    /**
     * Analyze job description for competency mapping using AI
     */
    async analyzeJobDescription(jobDescription, positionTitle) {
        try {
            const prompt = `
                Analyze this job description for a ${positionTitle} position and map it to CPA competencies.
                
                Job Description:
                ${jobDescription}
                
                Map to these CPA competency areas:
                Technical: FR (Financial Reporting), MA (Management Accounting), AS (Audit), FM (Finance), TX (Taxation)
                Enabling: PS (Professional Behavior), CM (Problem-Solving), CO (Communication), SE (Self-Management), TW (Teamwork)
                
                Return a JSON object with:
                - technical: array of competency codes with expected exposure level (0-2)
                - enabling: array of competency codes with expected exposure level (0-2)
                - recommendations: array of strings for development areas
            `;

            const response = await this.aiService.generateResponse(prompt, {
                max_tokens: 1000,
                temperature: 0.3
            });

            // Parse AI response
            const competencyMapping = JSON.parse(response);
            
            return {
                technical: competencyMapping.technical || [],
                enabling: competencyMapping.enabling || [],
                recommendations: competencyMapping.recommendations || []
            };
        } catch (error) {
            logger.error('Error analyzing job description:', error);
            // Return default mapping if AI fails
            return {
                technical: [
                    { code: 'FR', level: 1 },
                    { code: 'MA', level: 1 }
                ],
                enabling: [
                    { code: 'PS', level: 1 },
                    { code: 'CO', level: 1 },
                    { code: 'TW', level: 1 }
                ],
                recommendations: [
                    'Focus on developing financial reporting skills',
                    'Build experience in team collaboration',
                    'Strengthen communication abilities'
                ]
            };
        }
    }

    /**
     * Get experience templates
     */
    async getTemplates(filters = {}) {
        const cacheKey = `pert_templates_${JSON.stringify(filters)}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            let query = `
                SELECT t.*, 
                       c.name as competency_name,
                       c.code as competency_code,
                       u.username as created_by_name
                FROM ${this.tablePrefix}cpa_pert_templates t
                JOIN ${this.tablePrefix}cpa_sub_competencies c ON t.sub_competency_id = c.id
                LEFT JOIN ${this.tablePrefix}users u ON t.created_by = u.user_id
                WHERE t.deleted_at IS NULL`;

            const params = {};

            if (filters.competency_id) {
                query += ' AND t.sub_competency_id = :competency_id';
                params.competency_id = filters.competency_id;
            }

            if (filters.level !== undefined) {
                query += ' AND t.proficiency_level = :level';
                params.level = filters.level;
            }

            if (filters.industry) {
                query += ' AND t.industry = :industry';
                params.industry = filters.industry;
            }

            if (filters.search) {
                query += ` AND (
                    t.template_name ILIKE :search OR
                    t.keywords @> ARRAY[:search_exact]
                )`;
                params.search = `%${filters.search}%`;
                params.search_exact = filters.search;
            }

            if (filters.route_type) {
                // Filter templates suitable for specific route
                if (filters.route_type === 'EVR') {
                    query += ' AND t.is_public = true';
                }
            }

            query += ' ORDER BY t.usage_count DESC, t.rating DESC NULLS LAST';

            const result = await this.database.executeQuery(query, params);
            return result.rows;
        }, 600); // Cache for 10 minutes
    }

    /**
     * Generate experience from template
     */
    async generateFromTemplate(templateId, customizations = {}) {
        try {
            // Get template
            const templateQuery = `
                SELECT * FROM ${this.tablePrefix}cpa_pert_templates 
                WHERE id = :template_id AND deleted_at IS NULL`;
            
            const templateResult = await this.database.executeQuery(templateQuery, {
                template_id: templateId
            });

            if (templateResult.rows.length === 0) {
                throw new Error('Template not found');
            }

            const template = templateResult.rows[0];

            // Apply customizations to template
            const generated = {
                sub_competency_id: template.sub_competency_id,
                proficiency_level: template.proficiency_level,
                challenge: this.customizeText(template.challenge_template, customizations),
                actions: this.customizeText(template.actions_template, customizations),
                results: this.customizeText(template.results_template, customizations),
                lessons_learned: this.customizeText(template.lessons_template, customizations),
                complexity_level: customizations.complexity_level || 'moderate',
                collaboration_type: customizations.collaboration_type || 'team'
            };

            return generated;
        } catch (error) {
            logger.error('Error generating from template:', error);
            throw error;
        }
    }

    /**
     * Increment template usage counter
     */
    async incrementTemplateUsage(templateId) {
        try {
            await this.database.executeQuery(
                `UPDATE ${this.tablePrefix}cpa_pert_templates 
                 SET usage_count = usage_count + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :template_id`,
                { template_id: templateId }
            );
        } catch (error) {
            logger.error('Error incrementing template usage:', error);
        }
    }

    /**
     * Get competency framework with indicators
     */
    async getCompetencyFramework(options = {}) {
        const cacheKey = `competency_framework_${JSON.stringify(options)}`;
        
        return await this.cache.getOrSet(cacheKey, async () => {
            let query = `
                SELECT 
                    ca.id as area_id,
                    ca.code as area_code,
                    ca.name as area_name,
                    ca.description as area_description,
                    ca.category,
                    ca.requirements,
                    ca.display_order as area_order,
                    c.id as competency_id,
                    c.code as competency_code,
                    c.name as competency_name,
                    c.description as competency_description,
                    c.display_order as competency_order`;

            if (options.include_indicators) {
                query += `,
                    c.level_0_indicators,
                    c.level_1_indicators,
                    c.level_2_indicators,
                    c.example_tasks`;
            }

            query += `
                FROM ${this.tablePrefix}cpa_competency_areas ca
                LEFT JOIN ${this.tablePrefix}cpa_sub_competencies c ON ca.id = c.competency_area_id
                WHERE ca.deleted_at IS NULL AND c.deleted_at IS NULL`;

            const params = {};

            if (options.category) {
                query += ' AND ca.category = :category';
                params.category = options.category;
            }

            query += ' ORDER BY ca.display_order, c.display_order';

            const result = await this.database.executeQuery(query, params);

            // Group by area
            const framework = {};
            result.rows.forEach(row => {
                if (!framework[row.area_code]) {
                    framework[row.area_code] = {
                        id: row.area_id,
                        code: row.area_code,
                        name: row.area_name,
                        description: row.area_description,
                        category: row.category,
                        requirements: row.requirements,
                        competencies: []
                    };
                }

                if (row.competency_id) {
                    const competency = {
                        id: row.competency_id,
                        code: row.competency_code,
                        name: row.competency_name,
                        description: row.competency_description
                    };

                    if (options.include_indicators) {
                        competency.level_0_indicators = row.level_0_indicators;
                        competency.level_1_indicators = row.level_1_indicators;
                        competency.level_2_indicators = row.level_2_indicators;
                        competency.example_tasks = row.example_tasks;
                    }

                    framework[row.area_code].competencies.push(competency);
                }
            });

            return Object.values(framework);
        }, 3600); // Cache for 1 hour
    }

    /**
     * Validate report for submission
     */
    async validateReportForSubmission(reportId) {
        try {
            // Get report statistics
            const stats = await this.getReportStatistics(reportId);
            
            // Get competency progress
            const report = await this.getReportById(reportId);
            const progress = await this.getCompetencyProgress(report.user_id);

            const errors = [];
            const warnings = [];

            // Validation rules for EVR
            if (report.route_type === 'EVR') {
                // Minimum experiences
                if (stats.total_experiences < 10) {
                    errors.push(`Need at least 10 experiences (current: ${stats.total_experiences})`);
                }

                // Technical competency coverage
                const technicalProgress = progress.filter(p => p.category === 'technical');
                const technicalLevel1 = technicalProgress.filter(p => p.current_level >= 1).length;
                if (technicalLevel1 < 5) {
                    errors.push(`Need Level 1 in at least 5 technical competencies (current: ${technicalLevel1})`);
                }

                // Enabling competency coverage
                const enablingProgress = progress.filter(p => p.category === 'enabling');
                const enablingWithProgress = enablingProgress.filter(p => p.current_level > 0).length;
                if (enablingWithProgress < 5) {
                    errors.push(`Need progress in all 5 enabling competencies (current: ${enablingWithProgress})`);
                }

                // Level 2 requirements
                const level2Count = progress.filter(p => p.current_level >= 2).length;
                if (level2Count < 2) {
                    warnings.push(`Recommend at least 2 competencies at Level 2 (current: ${level2Count})`);
                }
            }

            // General validations
            if (stats.pending_count > 0) {
                warnings.push(`${stats.pending_count} experiences pending review`);
            }

            if (stats.rejected_count > 0) {
                errors.push(`${stats.rejected_count} experiences need revision`);
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                statistics: stats
            };
        } catch (error) {
            logger.error('Error validating report for submission:', error);
            throw error;
        }
    }

    /**
     * Export report in specified format
     */
    async exportReport(reportId, format = 'pdf') {
        try {
            // Get all report data
            const report = await this.getReportById(reportId);
            const experiences = await this.getReportExperiences(reportId);
            const statistics = await this.getReportStatistics(reportId);
            const progress = await this.getCompetencyProgress(report.user_id);

            // Prepare export data
            const exportData = {
                report,
                experiences,
                statistics,
                progress,
                generated_at: new Date().toISOString()
            };

            // Format-specific export logic would go here
            // For now, return structured data
            if (format === 'json') {
                return {
                    contentType: 'application/json',
                    filename: `pert-report-${reportId}.json`,
                    buffer: Buffer.from(JSON.stringify(exportData, null, 2))
                };
            }

            // PDF generation would require additional library
            throw new Error(`Export format ${format} not yet implemented`);
        } catch (error) {
            logger.error('Error exporting report:', error);
            throw error;
        }
    }

    /**
     * Get experience audit trail
     */
    async getExperienceAuditTrail(experienceId) {
        try {
            const query = `
                SELECT 
                    h.*,
                    u.username as reviewer_name
                FROM ${this.tablePrefix}cpa_pert_review_history h
                LEFT JOIN ${this.tablePrefix}users u ON h.reviewer_id = u.user_id
                WHERE h.experience_id = :experience_id
                ORDER BY h.created_at DESC`;

            const result = await this.database.executeQuery(query, {
                experience_id: experienceId
            });

            return result.rows;
        } catch (error) {
            logger.error('Error fetching audit trail:', error);
            throw error;
        }
    }

    // Helper methods

    async getReportById(reportId) {
        const query = `
            SELECT * FROM ${this.tablePrefix}cpa_pert_reports 
            WHERE id = :report_id`;
        
        const result = await this.database.executeQuery(query, { report_id: reportId });
        return result.rows[0];
    }

    async getExperienceById(experienceId, includeDeleted = false) {
        let query = `
            SELECT * FROM ${this.tablePrefix}cpa_pert_experiences 
            WHERE id = :experience_id`;
        
        if (!includeDeleted) {
            query += ' AND deleted_at IS NULL';
        }
        
        const result = await this.database.executeQuery(query, { 
            experience_id: experienceId 
        });
        return result.rows[0];
    }

    async validateCompetency(competencyId) {
        const query = `
            SELECT * FROM ${this.tablePrefix}cpa_sub_competencies 
            WHERE id = :competency_id AND deleted_at IS NULL`;
        
        const result = await this.database.executeQuery(query, { 
            competency_id: competencyId 
        });
        
        if (result.rows.length === 0) {
            throw new Error('Invalid competency ID');
        }
        
        return result.rows[0];
    }

    customizeText(template, customizations) {
        if (!template) return '';
        
        let text = template;
        
        // Replace placeholders with customizations
        Object.keys(customizations).forEach(key => {
            const placeholder = `{{${key}}}`;
            if (text.includes(placeholder)) {
                text = text.replace(new RegExp(placeholder, 'g'), customizations[key]);
            }
        });
        
        return text;
    }
}

module.exports = EnhancedCpaPertService;