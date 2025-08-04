const { ulid } = require('ulid');
const logger = require('../utils/logger');

class LearningPathService {
    constructor(database, courseService, skillAssessmentService, certificationService) {
        this.database = database;
        this.courseService = courseService;
        this.skillAssessmentService = skillAssessmentService;
        this.certificationService = certificationService;
    }

    /**
     * Browse learning paths
     */
    async browseLearningPaths(filters = {}) {
        try {
            const {
                targetRole,
                targetLevel,
                difficultyLevel,
                isPublic,
                createdBy,
                searchQuery,
                sortBy = 'popularity_score',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = filters;

            let sql = `
                SELECT 
                    p.*,
                    u.username as creator_name,
                    (SELECT COUNT(*) FROM pf_user_learning_paths ulp WHERE ulp.path_id = p.path_id) as enrollment_count,
                    (SELECT COUNT(*) FROM pf_user_learning_paths ulp WHERE ulp.path_id = p.path_id AND ulp.status = 'completed') as completion_count
                FROM pf_learning_paths p
                LEFT JOIN pf_users u ON p.created_by = u.user_id
                WHERE 1=1
            `;

            const binds = {};
            const conditions = [];

            if (targetRole) {
                conditions.push(`p.target_role = :targetRole`);
                binds.targetRole = targetRole;
            }

            if (targetLevel) {
                conditions.push(`p.target_level = :targetLevel`);
                binds.targetLevel = targetLevel;
            }

            if (difficultyLevel) {
                conditions.push(`p.difficulty_level = :difficultyLevel`);
                binds.difficultyLevel = difficultyLevel;
            }

            if (isPublic !== undefined) {
                conditions.push(`p.is_public = :isPublic`);
                binds.isPublic = isPublic ? 'Y' : 'N';
            }

            if (createdBy) {
                conditions.push(`p.created_by = :createdBy`);
                binds.createdBy = createdBy;
            }

            if (searchQuery) {
                conditions.push(`(
                    UPPER(p.path_name) LIKE UPPER(:searchQuery) OR
                    UPPER(p.path_description) LIKE UPPER(:searchQuery)
                )`);
                binds.searchQuery = `%${searchQuery}%`;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['popularity_score', 'completion_count', 'average_rating', 'created_at'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'popularity_score';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            // Add pagination
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows.map(path => ({
                ...path,
                skills_gained: path.skills_gained ? JSON.parse(path.skills_gained) : [],
                prerequisites: path.prerequisites ? JSON.parse(path.prerequisites) : [],
                tags: path.tags ? JSON.parse(path.tags) : []
            }));
        } catch (error) {
            logger.error('Error browsing learning paths:', error);
            throw error;
        }
    }

    /**
     * Get learning path details with steps
     */
    async getLearningPathDetails(pathId) {
        try {
            // Get path details
            const pathSql = `
                SELECT 
                    p.*,
                    u.username as creator_name,
                    (SELECT COUNT(*) FROM pf_user_learning_paths ulp WHERE ulp.path_id = p.path_id) as enrollment_count
                FROM pf_learning_paths p
                LEFT JOIN pf_users u ON p.created_by = u.user_id
                WHERE p.path_id = :pathId
            `;

            const pathResult = await this.database.execute(pathSql, { pathId });

            if (pathResult.rows.length === 0) {
                throw new Error('Learning path not found');
            }

            const path = pathResult.rows[0];

            // Get path steps
            const stepsSql = `
                SELECT 
                    s.*,
                    CASE 
                        WHEN s.step_type = 'course' THEN c.course_title
                        WHEN s.step_type = 'assessment' THEN a.assessment_name
                        WHEN s.step_type = 'certification' THEN cert.certification_name
                        ELSE s.step_name
                    END as resource_name,
                    CASE
                        WHEN s.step_type = 'course' THEN c.duration_hours
                        ELSE s.estimated_hours
                    END as actual_hours
                FROM pf_learning_path_steps s
                LEFT JOIN pf_courses c ON s.step_type = 'course' AND s.resource_id = c.course_id
                LEFT JOIN pf_skill_assessments a ON s.step_type = 'assessment' AND s.resource_id = a.assessment_id
                LEFT JOIN pf_certifications cert ON s.step_type = 'certification' AND s.resource_id = cert.certification_id
                WHERE s.path_id = :pathId
                ORDER BY s.step_number
            `;

            const stepsResult = await this.database.execute(stepsSql, { pathId });

            return {
                ...path,
                skills_gained: path.skills_gained ? JSON.parse(path.skills_gained) : [],
                prerequisites: path.prerequisites ? JSON.parse(path.prerequisites) : [],
                tags: path.tags ? JSON.parse(path.tags) : [],
                steps: stepsResult.rows.map(step => ({
                    ...step,
                    dependencies: step.dependencies ? JSON.parse(step.dependencies) : []
                }))
            };
        } catch (error) {
            logger.error('Error getting learning path details:', error);
            throw error;
        }
    }

    /**
     * Create custom learning path
     */
    async createLearningPath(pathData, createdBy) {
        try {
            const pathId = ulid();

            const sql = `
                INSERT INTO pf_learning_paths (
                    path_id, path_name, path_description,
                    created_by, target_role, target_level,
                    estimated_duration_weeks, difficulty_level,
                    skills_gained, prerequisites,
                    is_public, tags
                ) VALUES (
                    :pathId, :pathName, :pathDescription,
                    :createdBy, :targetRole, :targetLevel,
                    :estimatedDurationWeeks, :difficultyLevel,
                    :skillsGained, :prerequisites,
                    :isPublic, :tags
                )
            `;

            await this.database.execute(sql, {
                pathId,
                pathName: pathData.pathName,
                pathDescription: pathData.pathDescription || null,
                createdBy,
                targetRole: pathData.targetRole || null,
                targetLevel: pathData.targetLevel || null,
                estimatedDurationWeeks: pathData.estimatedDurationWeeks || null,
                difficultyLevel: pathData.difficultyLevel || 'intermediate',
                skillsGained: JSON.stringify(pathData.skillsGained || []),
                prerequisites: JSON.stringify(pathData.prerequisites || []),
                isPublic: pathData.isPublic ? 'Y' : 'N',
                tags: JSON.stringify(pathData.tags || [])
            });

            // Add steps if provided
            if (pathData.steps && pathData.steps.length > 0) {
                await this.addPathSteps(pathId, pathData.steps);
            }

            await this.database.commit();
            return pathId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error creating learning path:', error);
            throw error;
        }
    }

    /**
     * Add steps to learning path
     */
    async addPathSteps(pathId, steps) {
        try {
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const stepId = ulid();

                const sql = `
                    INSERT INTO pf_learning_path_steps (
                        step_id, path_id, step_number,
                        step_type, resource_id,
                        step_name, step_description,
                        estimated_hours, is_optional,
                        dependencies, success_criteria
                    ) VALUES (
                        :stepId, :pathId, :stepNumber,
                        :stepType, :resourceId,
                        :stepName, :stepDescription,
                        :estimatedHours, :isOptional,
                        :dependencies, :successCriteria
                    )
                `;

                await this.database.execute(sql, {
                    stepId,
                    pathId,
                    stepNumber: i + 1,
                    stepType: step.stepType,
                    resourceId: step.resourceId || null,
                    stepName: step.stepName,
                    stepDescription: step.stepDescription || null,
                    estimatedHours: step.estimatedHours || null,
                    isOptional: step.isOptional ? 'Y' : 'N',
                    dependencies: JSON.stringify(step.dependencies || []),
                    successCriteria: step.successCriteria || null
                });
            }
        } catch (error) {
            logger.error('Error adding path steps:', error);
            throw error;
        }
    }

    /**
     * Enroll in learning path
     */
    async enrollInPath(userId, pathId, targetDate = null) {
        try {
            // Check if already enrolled
            const checkSql = `
                SELECT user_path_id FROM pf_user_learning_paths
                WHERE user_id = :userId AND path_id = :pathId
                AND status IN ('active', 'paused')
            `;

            const existing = await this.database.execute(checkSql, { userId, pathId });

            if (existing.rows.length > 0) {
                throw new Error('Already enrolled in this path');
            }

            // Get path details
            const path = await this.getLearningPathDetails(pathId);

            const userPathId = ulid();
            const sql = `
                INSERT INTO pf_user_learning_paths (
                    user_path_id, user_id, path_id,
                    start_date, target_completion_date,
                    current_step_number, progress_percentage,
                    status
                ) VALUES (
                    :userPathId, :userId, :pathId,
                    CURRENT_DATE, :targetCompletionDate,
                    1, 0, 'active'
                )
            `;

            const targetCompletionDate = targetDate || this.calculateTargetDate(path.estimated_duration_weeks);

            await this.database.execute(sql, {
                userPathId,
                userId,
                pathId,
                targetCompletionDate
            });

            // Initialize progress for all steps
            await this.initializeStepProgress(userPathId, path.steps);

            await this.database.commit();
            return userPathId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error enrolling in path:', error);
            throw error;
        }
    }

    /**
     * Update learning path progress
     */
    async updatePathProgress(userPathId, userId, progressData) {
        try {
            const { stepId, status, timeSpent, score, feedback } = progressData;

            // Verify ownership
            const checkSql = `
                SELECT 
                    ulp.path_id,
                    ulp.current_step_number,
                    ulp.status as path_status
                FROM pf_user_learning_paths ulp
                WHERE ulp.user_path_id = :userPathId
                AND ulp.user_id = :userId
            `;

            const checkResult = await this.database.execute(checkSql, { userPathId, userId });

            if (checkResult.rows.length === 0) {
                throw new Error('Enrollment not found');
            }

            const enrollment = checkResult.rows[0];

            if (enrollment.path_status !== 'active') {
                throw new Error('Learning path is not active');
            }

            // Update step progress
            const updateStepSql = `
                UPDATE pf_user_path_progress
                SET status = :status,
                    time_spent_hours = NVL(time_spent_hours, 0) + :timeSpent,
                    score = :score,
                    feedback = :feedback,
                    completion_date = CASE WHEN :status = 'completed' THEN CURRENT_DATE ELSE NULL END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_path_id = :userPathId
                AND step_id = :stepId
            `;

            await this.database.execute(updateStepSql, {
                userPathId,
                stepId,
                status,
                timeSpent: timeSpent || 0,
                score: score || null,
                feedback: feedback || null
            });

            // Calculate overall progress
            const progressSql = `
                SELECT 
                    COUNT(*) as total_steps,
                    COUNT(CASE WHEN upp.status = 'completed' THEN 1 END) as completed_steps,
                    COUNT(CASE WHEN s.is_optional = 'N' THEN 1 END) as required_steps,
                    COUNT(CASE WHEN upp.status = 'completed' AND s.is_optional = 'N' THEN 1 END) as completed_required,
                    MAX(CASE WHEN upp.status = 'completed' THEN s.step_number ELSE 0 END) as last_completed_step
                FROM pf_user_path_progress upp
                JOIN pf_learning_path_steps s ON upp.step_id = s.step_id
                WHERE upp.user_path_id = :userPathId
            `;

            const progressResult = await this.database.execute(progressSql, { userPathId });
            const progress = progressResult.rows[0];

            const progressPercentage = progress.required_steps > 0 ?
                Math.round((progress.completed_required / progress.required_steps) * 100) : 0;

            // Update path enrollment
            const updatePathSql = `
                UPDATE pf_user_learning_paths
                SET progress_percentage = :progressPercentage,
                    current_step_number = :currentStepNumber,
                    time_invested_hours = (
                        SELECT SUM(time_spent_hours) 
                        FROM pf_user_path_progress 
                        WHERE user_path_id = :userPathId
                    ),
                    status = CASE 
                        WHEN :progressPercentage = 100 THEN 'completed'
                        ELSE status
                    END,
                    actual_completion_date = CASE
                        WHEN :progressPercentage = 100 THEN CURRENT_DATE
                        ELSE NULL
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_path_id = :userPathId
            `;

            await this.database.execute(updatePathSql, {
                userPathId,
                progressPercentage,
                currentStepNumber: progress.last_completed_step + 1
            });

            await this.database.commit();

            return {
                progressPercentage,
                completedSteps: progress.completed_steps,
                totalSteps: progress.total_steps,
                currentStep: progress.last_completed_step + 1
            };
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating path progress:', error);
            throw error;
        }
    }

    /**
     * Get user's learning paths
     */
    async getUserLearningPaths(userId, filters = {}) {
        try {
            const { status, sortBy = 'start_date', sortOrder = 'DESC' } = filters;

            let sql = `
                SELECT 
                    ulp.*,
                    p.path_name,
                    p.path_description,
                    p.target_role,
                    p.difficulty_level,
                    p.estimated_duration_weeks,
                    p.skills_gained,
                    (
                        SELECT COUNT(*) 
                        FROM pf_user_path_progress upp 
                        WHERE upp.user_path_id = ulp.user_path_id 
                        AND upp.status = 'completed'
                    ) as completed_steps,
                    (
                        SELECT COUNT(*) 
                        FROM pf_learning_path_steps s 
                        WHERE s.path_id = ulp.path_id
                    ) as total_steps
                FROM pf_user_learning_paths ulp
                JOIN pf_learning_paths p ON ulp.path_id = p.path_id
                WHERE ulp.user_id = :userId
            `;

            const binds = { userId };

            if (status) {
                if (Array.isArray(status)) {
                    const statusPlaceholders = status.map((_, i) => `:status${i}`).join(',');
                    sql += ` AND ulp.status IN (${statusPlaceholders})`;
                    status.forEach((s, i) => {
                        binds[`status${i}`] = s;
                    });
                } else {
                    sql += ` AND ulp.status = :status`;
                    binds.status = status;
                }
            }

            // Add sorting
            const validSortFields = ['start_date', 'progress_percentage', 'path_name'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'start_date';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            const result = await this.database.execute(sql, binds);

            return result.rows.map(path => ({
                ...path,
                skills_gained: path.skills_gained ? JSON.parse(path.skills_gained) : []
            }));
        } catch (error) {
            logger.error('Error getting user learning paths:', error);
            throw error;
        }
    }

    /**
     * Get path progress details
     */
    async getPathProgress(userPathId, userId) {
        try {
            // Verify ownership and get path details
            const pathSql = `
                SELECT 
                    ulp.*,
                    p.path_name,
                    p.estimated_duration_weeks
                FROM pf_user_learning_paths ulp
                JOIN pf_learning_paths p ON ulp.path_id = p.path_id
                WHERE ulp.user_path_id = :userPathId
                AND ulp.user_id = :userId
            `;

            const pathResult = await this.database.execute(pathSql, { userPathId, userId });

            if (pathResult.rows.length === 0) {
                throw new Error('Learning path enrollment not found');
            }

            const enrollment = pathResult.rows[0];

            // Get step progress
            const stepsSql = `
                SELECT 
                    upp.*,
                    s.step_number,
                    s.step_name,
                    s.step_type,
                    s.estimated_hours,
                    s.is_optional,
                    s.dependencies,
                    CASE 
                        WHEN s.step_type = 'course' THEN c.course_title
                        WHEN s.step_type = 'assessment' THEN a.assessment_name
                        WHEN s.step_type = 'certification' THEN cert.certification_name
                        ELSE s.step_name
                    END as resource_name
                FROM pf_user_path_progress upp
                JOIN pf_learning_path_steps s ON upp.step_id = s.step_id
                LEFT JOIN pf_courses c ON s.step_type = 'course' AND s.resource_id = c.course_id
                LEFT JOIN pf_skill_assessments a ON s.step_type = 'assessment' AND s.resource_id = a.assessment_id
                LEFT JOIN pf_certifications cert ON s.step_type = 'certification' AND s.resource_id = cert.certification_id
                WHERE upp.user_path_id = :userPathId
                ORDER BY s.step_number
            `;

            const stepsResult = await this.database.execute(stepsSql, { userPathId });

            const steps = stepsResult.rows.map(step => ({
                ...step,
                dependencies: step.dependencies ? JSON.parse(step.dependencies) : []
            }));

            // Calculate completion estimate
            const remainingHours = steps
                .filter(s => s.status !== 'completed')
                .reduce((sum, s) => sum + (s.estimated_hours || 0), 0);

            const estimatedCompletionDate = this.estimateCompletionDate(remainingHours, enrollment.time_invested_hours);

            return {
                enrollment,
                steps,
                summary: {
                    totalSteps: steps.length,
                    completedSteps: steps.filter(s => s.status === 'completed').length,
                    inProgressSteps: steps.filter(s => s.status === 'in_progress').length,
                    remainingHours,
                    estimatedCompletionDate,
                    onTrack: estimatedCompletionDate <= new Date(enrollment.target_completion_date)
                }
            };
        } catch (error) {
            logger.error('Error getting path progress:', error);
            throw error;
        }
    }

    /**
     * Get recommended learning paths
     */
    async getRecommendedPaths(userId, limit = 5) {
        try {
            // Get user profile and goals
            const profileSql = `
                SELECT 
                    target_role,
                    experience_level,
                    industry_preferences
                FROM pf_user_profiles
                WHERE user_id = :userId
            `;

            const profileResult = await this.database.execute(profileSql, { userId });
            const profile = profileResult.rows[0] || {};

            // Get user's completed and current paths
            const userPathsSql = `
                SELECT path_id FROM pf_user_learning_paths
                WHERE user_id = :userId
                AND status IN ('active', 'completed', 'paused')
            `;

            const userPathsResult = await this.database.execute(userPathsSql, { userId });
            const userPathIds = userPathsResult.rows.map(r => r.path_id);

            // Find recommended paths
            let sql = `
                SELECT 
                    p.*,
                    (
                        CASE 
                            WHEN p.target_role = :targetRole THEN 0.4
                            ELSE 0
                        END +
                        CASE 
                            WHEN p.target_level = :targetLevel THEN 0.2
                            ELSE 0
                        END +
                        (p.popularity_score / 10000) * 0.2 +
                        CASE
                            WHEN p.average_rating >= 4 THEN 0.2
                            WHEN p.average_rating >= 3 THEN 0.1
                            ELSE 0
                        END
                    ) as relevance_score
                FROM pf_learning_paths p
                WHERE p.is_public = 'Y'
            `;

            const binds = {
                targetRole: profile.target_role || 'Software Engineer',
                targetLevel: this.mapExperienceToLevel(profile.experience_level)
            };

            if (userPathIds.length > 0) {
                const placeholders = userPathIds.map((_, i) => `:path${i}`).join(',');
                sql += ` AND p.path_id NOT IN (${placeholders})`;
                userPathIds.forEach((id, i) => {
                    binds[`path${i}`] = id;
                });
            }

            sql += ` ORDER BY relevance_score DESC`;
            sql += ` FETCH FIRST :limit ROWS ONLY`;
            binds.limit = limit;

            const result = await this.database.execute(sql, binds);

            return result.rows.map(path => ({
                ...path,
                skills_gained: path.skills_gained ? JSON.parse(path.skills_gained) : [],
                prerequisites: path.prerequisites ? JSON.parse(path.prerequisites) : [],
                tags: path.tags ? JSON.parse(path.tags) : [],
                recommendation_reason: this.generatePathRecommendationReason(path, profile)
            }));
        } catch (error) {
            logger.error('Error getting recommended paths:', error);
            throw error;
        }
    }

    /**
     * Create learning goals
     */
    async createLearningGoal(userId, goalData) {
        try {
            const goalId = ulid();

            const sql = `
                INSERT INTO pf_learning_goals (
                    goal_id, user_id, goal_title,
                    goal_description, target_date,
                    goal_type, target_skill_id,
                    target_skill_level, related_path_id
                ) VALUES (
                    :goalId, :userId, :goalTitle,
                    :goalDescription, :targetDate,
                    :goalType, :targetSkillId,
                    :targetSkillLevel, :relatedPathId
                )
            `;

            await this.database.execute(sql, {
                goalId,
                userId,
                goalTitle: goalData.goalTitle,
                goalDescription: goalData.goalDescription || null,
                targetDate: goalData.targetDate,
                goalType: goalData.goalType,
                targetSkillId: goalData.targetSkillId || null,
                targetSkillLevel: goalData.targetSkillLevel || null,
                relatedPathId: goalData.relatedPathId || null
            });

            await this.database.commit();
            return goalId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error creating learning goal:', error);
            throw error;
        }
    }

    /**
     * Get user's learning goals
     */
    async getUserLearningGoals(userId, includeCompleted = false) {
        try {
            let sql = `
                SELECT 
                    g.*,
                    s.skill_name,
                    p.path_name,
                    CASE 
                        WHEN g.target_date < CURRENT_DATE AND g.status = 'active' THEN 'overdue'
                        WHEN g.target_date < CURRENT_DATE + 7 AND g.status = 'active' THEN 'due_soon'
                        ELSE g.status
                    END as effective_status
                FROM pf_learning_goals g
                LEFT JOIN pf_skills s ON g.target_skill_id = s.skill_id
                LEFT JOIN pf_learning_paths p ON g.related_path_id = p.path_id
                WHERE g.user_id = :userId
            `;

            const binds = { userId };

            if (!includeCompleted) {
                sql += ` AND g.status IN ('active', 'missed')`;
            }

            sql += ` ORDER BY g.target_date ASC, g.created_at DESC`;

            const result = await this.database.execute(sql, binds);

            return result.rows;
        } catch (error) {
            logger.error('Error getting learning goals:', error);
            throw error;
        }
    }

    /**
     * Update learning goal progress
     */
    async updateGoalProgress(goalId, userId, progressData) {
        try {
            const { progressPercentage, status, notes } = progressData;

            const sql = `
                UPDATE pf_learning_goals
                SET progress_percentage = :progressPercentage,
                    status = :status,
                    notes = :notes,
                    completion_date = CASE 
                        WHEN :status = 'completed' THEN CURRENT_DATE 
                        ELSE completion_date 
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE goal_id = :goalId
                AND user_id = :userId
            `;

            const result = await this.database.execute(sql, {
                goalId,
                userId,
                progressPercentage: progressPercentage || null,
                status: status || 'active',
                notes: notes || null
            });

            if (result.rowsAffected === 0) {
                throw new Error('Goal not found');
            }

            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating goal progress:', error);
            throw error;
        }
    }

    // Helper methods

    calculateTargetDate(estimatedWeeks) {
        if (!estimatedWeeks) {
            estimatedWeeks = 12; // Default 3 months
        }
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + (estimatedWeeks * 7));
        return targetDate;
    }

    async initializeStepProgress(userPathId, steps) {
        for (const step of steps) {
            const progressId = ulid();
            
            const sql = `
                INSERT INTO pf_user_path_progress (
                    progress_id, user_path_id, step_id,
                    status
                ) VALUES (
                    :progressId, :userPathId, :stepId,
                    'not_started'
                )
            `;

            await this.database.execute(sql, {
                progressId,
                userPathId,
                stepId: step.step_id
            });
        }
    }

    estimateCompletionDate(remainingHours, currentPace) {
        // Assume 5 hours per week of learning time
        const hoursPerWeek = 5;
        const weeksRemaining = remainingHours / hoursPerWeek;
        
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + (weeksRemaining * 7));
        
        return completionDate;
    }

    mapExperienceToLevel(experienceLevel) {
        const mapping = {
            'entry': 'entry',
            'junior': 'entry',
            'mid': 'mid',
            'senior': 'senior',
            'lead': 'senior',
            'principal': 'expert',
            'executive': 'expert'
        };
        
        return mapping[experienceLevel] || 'mid';
    }

    generatePathRecommendationReason(path, profile) {
        const reasons = [];

        if (path.target_role === profile.target_role) {
            reasons.push(`Designed for ${path.target_role} role`);
        }

        if (path.popularity_score > 1000) {
            reasons.push('Highly popular path');
        }

        if (path.average_rating >= 4) {
            reasons.push(`Rated ${path.average_rating}/5 by learners`);
        }

        if (path.completion_count > 100) {
            reasons.push(`${path.completion_count} successful completions`);
        }

        return reasons.join(' • ');
    }
}

module.exports = LearningPathService;