const { ulid } = require('ulid');
const logger = require('../utils/logger');

class CourseService {
    constructor(database, openaiService, skillsGapService, profileService) {
        this.database = database;
        this.openaiService = openaiService;
        this.skillsGapService = skillsGapService;
        this.profileService = profileService;
    }

    /**
     * Search courses with filters
     */
    async searchCourses(searchParams = {}) {
        try {
            const {
                query,
                provider,
                skills,
                difficultyLevel,
                maxPrice,
                minRating,
                certificateRequired,
                language,
                sortBy = 'rating',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = searchParams;

            let sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_user_courses uc WHERE uc.course_id = c.course_id) as enrollment_count
                FROM pf_courses c
                WHERE c.is_active = 'Y'
            `;

            const binds = {};
            const conditions = [];

            if (query) {
                conditions.push(`(
                    UPPER(c.course_title) LIKE UPPER(:query) OR
                    UPPER(c.course_description) LIKE UPPER(:query)
                )`);
                binds.query = `%${query}%`;
            }

            if (provider) {
                conditions.push(`c.provider = :provider`);
                binds.provider = provider;
            }

            if (difficultyLevel) {
                conditions.push(`c.difficulty_level = :difficultyLevel`);
                binds.difficultyLevel = difficultyLevel;
            }

            if (maxPrice !== undefined) {
                conditions.push(`c.price_usd <= :maxPrice`);
                binds.maxPrice = maxPrice;
            }

            if (minRating) {
                conditions.push(`c.rating >= :minRating`);
                binds.minRating = minRating;
            }

            if (certificateRequired) {
                conditions.push(`c.certificate_available = 'Y'`);
            }

            if (language) {
                conditions.push(`JSON_EXISTS(c.languages, '$[*]?(@ == $language)')`);
                binds.language = language;
            }

            if (skills && skills.length > 0) {
                const skillConditions = skills.map((_, i) => 
                    `JSON_EXISTS(c.skills_covered, '$[*]?(@ == $skill${i})')`
                ).join(' OR ');
                conditions.push(`(${skillConditions})`);
                skills.forEach((skill, i) => {
                    binds[`skill${i}`] = skill;
                });
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['rating', 'price_usd', 'duration_hours', 'enrolled_count'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'rating';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order} NULLS LAST`;

            // Add pagination
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            // Parse JSON fields
            const courses = result.rows.map(course => ({
                ...course,
                languages: course.languages ? JSON.parse(course.languages) : [],
                skills_covered: course.skills_covered ? JSON.parse(course.skills_covered) : [],
                prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
                learning_objectives: course.learning_objectives ? JSON.parse(course.learning_objectives) : []
            }));

            // Get total count
            const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
                                .replace(/ORDER BY[\s\S]*$/, '');
            const countBinds = { ...binds };
            delete countBinds.offset;
            delete countBinds.limit;

            const countResult = await this.database.execute(countSql, countBinds);
            const total = countResult.rows[0]?.total || 0;

            return {
                courses,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + courses.length < total
                }
            };
        } catch (error) {
            logger.error('Error searching courses:', error);
            throw error;
        }
    }

    /**
     * Get course details
     */
    async getCourseDetails(courseId) {
        try {
            const sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_user_courses uc WHERE uc.course_id = c.course_id) as total_enrollments,
                    (SELECT COUNT(*) FROM pf_user_courses uc WHERE uc.course_id = c.course_id AND uc.status = 'completed') as completions,
                    (SELECT AVG(user_rating) FROM pf_user_courses uc WHERE uc.course_id = c.course_id AND uc.user_rating IS NOT NULL) as user_rating_avg
                FROM pf_courses c
                WHERE c.course_id = :courseId
            `;

            const result = await this.database.execute(sql, { courseId });

            if (result.rows.length === 0) {
                throw new Error('Course not found');
            }

            const course = result.rows[0];
            return {
                ...course,
                languages: course.languages ? JSON.parse(course.languages) : [],
                skills_covered: course.skills_covered ? JSON.parse(course.skills_covered) : [],
                prerequisites: course.prerequisites ? JSON.parse(course.prerequisites) : [],
                learning_objectives: course.learning_objectives ? JSON.parse(course.learning_objectives) : []
            };
        } catch (error) {
            logger.error('Error getting course details:', error);
            throw error;
        }
    }

    /**
     * Get personalized course recommendations
     */
    async getRecommendedCourses(userId, limit = 10) {
        try {
            // Get user profile and skill gaps
            const profile = await this.profileService.getUserProfile(userId);
            const skillGaps = await this.skillsGapService.identifySkillGaps(userId);
            
            // Get user's learning preferences
            const preferences = await this.getUserLearningPreferences(userId);
            
            // Get existing recommendations
            const existingRecs = await this.getExistingRecommendations(userId);
            
            // Generate new recommendations if needed
            if (existingRecs.length < limit) {
                await this.generateRecommendations(userId, profile, skillGaps, preferences);
            }

            // Fetch recommendations with course details
            const sql = `
                SELECT 
                    r.*,
                    c.course_title,
                    c.provider,
                    c.duration_hours,
                    c.difficulty_level,
                    c.price_usd,
                    c.rating,
                    c.skills_covered,
                    c.certificate_available
                FROM pf_course_recommendations r
                JOIN pf_courses c ON r.course_id = c.course_id
                WHERE r.user_id = :userId
                AND r.valid_until >= CURRENT_DATE
                AND (r.user_action IS NULL OR r.user_action = 'viewed')
                ORDER BY r.relevance_score DESC, r.priority DESC
                FETCH FIRST :limit ROWS ONLY
            `;

            const result = await this.database.execute(sql, { userId, limit });

            return result.rows.map(rec => ({
                ...rec,
                skills_covered: rec.skills_covered ? JSON.parse(rec.skills_covered) : [],
                skill_gaps_addressed: rec.skill_gaps_addressed ? JSON.parse(rec.skill_gaps_addressed) : []
            }));
        } catch (error) {
            logger.error('Error getting recommended courses:', error);
            throw error;
        }
    }

    /**
     * Enroll user in a course
     */
    async enrollInCourse(userId, courseId, enrollmentData = {}) {
        try {
            // Check if already enrolled
            const checkSql = `
                SELECT enrollment_id FROM pf_user_courses
                WHERE user_id = :userId AND course_id = :courseId
            `;

            const existing = await this.database.execute(checkSql, { userId, courseId });

            if (existing.rows.length > 0) {
                throw new Error('Already enrolled in this course');
            }

            // Get course details
            const course = await this.getCourseDetails(courseId);

            const enrollmentId = ulid();
            const sql = `
                INSERT INTO pf_user_courses (
                    enrollment_id, user_id, course_id,
                    enrollment_date, start_date,
                    expected_completion_date, status, notes
                ) VALUES (
                    :enrollmentId, :userId, :courseId,
                    :enrollmentDate, :startDate,
                    :expectedCompletionDate, :status, :notes
                )
            `;

            const expectedCompletion = new Date();
            expectedCompletion.setDate(expectedCompletion.getDate() + (course.duration_hours / 8 * 7)); // Assuming 8 hours/week

            await this.database.execute(sql, {
                enrollmentId,
                userId,
                courseId,
                enrollmentDate: new Date(),
                startDate: enrollmentData.startDate || new Date(),
                expectedCompletionDate: enrollmentData.expectedCompletionDate || expectedCompletion,
                status: 'enrolled',
                notes: enrollmentData.notes || null
            });

            await this.database.commit();

            // Update recommendation if exists
            await this.updateRecommendationAction(userId, courseId, 'enrolled');

            return enrollmentId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error enrolling in course:', error);
            throw error;
        }
    }

    /**
     * Update course progress
     */
    async updateCourseProgress(enrollmentId, userId, progressData) {
        try {
            const { progressPercentage, timeSpentHours, status } = progressData;

            // Verify ownership
            const checkSql = `
                SELECT status, progress_percentage FROM pf_user_courses
                WHERE enrollment_id = :enrollmentId AND user_id = :userId
            `;

            const checkResult = await this.database.execute(checkSql, { enrollmentId, userId });

            if (checkResult.rows.length === 0) {
                throw new Error('Enrollment not found');
            }

            const current = checkResult.rows[0];

            const updateFields = [];
            const binds = { enrollmentId, userId };

            if (progressPercentage !== undefined) {
                updateFields.push('progress_percentage = :progressPercentage');
                binds.progressPercentage = progressPercentage;
            }

            if (timeSpentHours !== undefined) {
                updateFields.push('time_spent_hours = time_spent_hours + :timeSpentHours');
                binds.timeSpentHours = timeSpentHours;
            }

            if (status) {
                updateFields.push('status = :status');
                binds.status = status;

                if (status === 'completed') {
                    updateFields.push('actual_completion_date = CURRENT_DATE');
                }
            }

            if (updateFields.length === 0) {
                return;
            }

            const sql = `
                UPDATE pf_user_courses
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE enrollment_id = :enrollmentId AND user_id = :userId
            `;

            await this.database.execute(sql, binds);
            await this.database.commit();

            // If completed, check for certificate
            if (status === 'completed' && progressPercentage === 100) {
                await this.checkCertificateEligibility(enrollmentId, userId);
            }
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating course progress:', error);
            throw error;
        }
    }

    /**
     * Complete a course
     */
    async completeCourse(enrollmentId, userId, completionData = {}) {
        try {
            const { userRating, userReview, certificateUrl } = completionData;

            const sql = `
                UPDATE pf_user_courses
                SET status = 'completed',
                    actual_completion_date = CURRENT_DATE,
                    progress_percentage = 100,
                    user_rating = :userRating,
                    user_review = :userReview,
                    certificate_earned = :certificateEarned,
                    certificate_url = :certificateUrl,
                    updated_at = CURRENT_TIMESTAMP
                WHERE enrollment_id = :enrollmentId 
                AND user_id = :userId
                AND status != 'completed'
            `;

            const result = await this.database.execute(sql, {
                enrollmentId,
                userId,
                userRating: userRating || null,
                userReview: userReview || null,
                certificateEarned: certificateUrl ? 'Y' : 'N',
                certificateUrl: certificateUrl || null
            });

            if (result.rowsAffected === 0) {
                throw new Error('Enrollment not found or already completed');
            }

            await this.database.commit();

            // Update course recommendation if exists
            const courseSql = `
                SELECT course_id FROM pf_user_courses
                WHERE enrollment_id = :enrollmentId
            `;
            const courseResult = await this.database.execute(courseSql, { enrollmentId });
            
            if (courseResult.rows.length > 0) {
                await this.updateRecommendationAction(userId, courseResult.rows[0].course_id, 'completed');
            }
        } catch (error) {
            await this.database.rollback();
            logger.error('Error completing course:', error);
            throw error;
        }
    }

    /**
     * Get user's enrolled courses
     */
    async getUserCourses(userId, filters = {}) {
        try {
            const { status, provider, sortBy = 'enrollment_date', sortOrder = 'DESC' } = filters;

            let sql = `
                SELECT 
                    uc.*,
                    c.course_title,
                    c.provider,
                    c.duration_hours,
                    c.difficulty_level,
                    c.skills_covered,
                    c.instructor_name,
                    c.rating as course_rating
                FROM pf_user_courses uc
                JOIN pf_courses c ON uc.course_id = c.course_id
                WHERE uc.user_id = :userId
            `;

            const binds = { userId };
            const conditions = [];

            if (status) {
                if (Array.isArray(status)) {
                    const statusPlaceholders = status.map((_, i) => `:status${i}`).join(',');
                    conditions.push(`uc.status IN (${statusPlaceholders})`);
                    status.forEach((s, i) => {
                        binds[`status${i}`] = s;
                    });
                } else {
                    conditions.push(`uc.status = :status`);
                    binds.status = status;
                }
            }

            if (provider) {
                conditions.push(`c.provider = :provider`);
                binds.provider = provider;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['enrollment_date', 'progress_percentage', 'course_title', 'expected_completion_date'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'enrollment_date';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            const result = await this.database.execute(sql, binds);

            return result.rows.map(course => ({
                ...course,
                skills_covered: course.skills_covered ? JSON.parse(course.skills_covered) : []
            }));
        } catch (error) {
            logger.error('Error getting user courses:', error);
            throw error;
        }
    }

    /**
     * Get course completion statistics
     */
    async getCourseStats(userId) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_enrolled,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
                    COUNT(CASE WHEN certificate_earned = 'Y' THEN 1 END) as certificates_earned,
                    SUM(time_spent_hours) as total_hours,
                    AVG(CASE WHEN status = 'completed' THEN progress_percentage END) as avg_completion_rate,
                    AVG(user_rating) as avg_rating_given
                FROM pf_user_courses
                WHERE user_id = :userId
            `;

            const result = await this.database.execute(sql, { userId });
            const stats = result.rows[0];

            // Get skill coverage
            const skillsSql = `
                SELECT DISTINCT skill
                FROM pf_user_courses uc
                JOIN pf_courses c ON uc.course_id = c.course_id
                CROSS JOIN JSON_TABLE(c.skills_covered, '$[*]' 
                    COLUMNS (skill VARCHAR2(100) PATH '$')
                ) jt
                WHERE uc.user_id = :userId
                AND uc.status = 'completed'
            `;

            const skillsResult = await this.database.execute(skillsSql, { userId });

            return {
                total_enrolled: parseInt(stats.total_enrolled) || 0,
                completed: parseInt(stats.completed) || 0,
                in_progress: parseInt(stats.in_progress) || 0,
                abandoned: parseInt(stats.abandoned) || 0,
                certificates_earned: parseInt(stats.certificates_earned) || 0,
                total_hours: parseFloat(stats.total_hours) || 0,
                avg_completion_rate: parseFloat(stats.avg_completion_rate) || 0,
                avg_rating_given: parseFloat(stats.avg_rating_given) || 0,
                skills_learned: skillsResult.rows.map(r => r.skill),
                completion_rate: stats.total_enrolled > 0 ? 
                    (stats.completed / stats.total_enrolled * 100).toFixed(1) : 0
            };
        } catch (error) {
            logger.error('Error getting course stats:', error);
            throw error;
        }
    }

    /**
     * Import course from external provider
     */
    async importCourse(courseData, provider) {
        try {
            const courseId = ulid();

            const sql = `
                INSERT INTO pf_courses (
                    course_id, external_course_id, provider,
                    course_title, course_description, provider_url,
                    instructor_name, duration_hours, difficulty_level,
                    price_usd, price_currency, languages,
                    skills_covered, prerequisites, learning_objectives,
                    course_format, certificate_available,
                    rating, review_count, enrolled_count
                ) VALUES (
                    :courseId, :externalCourseId, :provider,
                    :courseTitle, :courseDescription, :providerUrl,
                    :instructorName, :durationHours, :difficultyLevel,
                    :priceUsd, :priceCurrency, :languages,
                    :skillsCovered, :prerequisites, :learningObjectives,
                    :courseFormat, :certificateAvailable,
                    :rating, :reviewCount, :enrolledCount
                )
            `;

            await this.database.execute(sql, {
                courseId,
                externalCourseId: courseData.external_course_id,
                provider,
                courseTitle: courseData.course_title,
                courseDescription: courseData.course_description || null,
                providerUrl: courseData.provider_url || null,
                instructorName: courseData.instructor_name || null,
                durationHours: courseData.duration_hours || null,
                difficultyLevel: courseData.difficulty_level || null,
                priceUsd: courseData.price_usd || null,
                priceCurrency: courseData.price_currency || 'USD',
                languages: JSON.stringify(courseData.languages || ['English']),
                skillsCovered: JSON.stringify(courseData.skills_covered || []),
                prerequisites: JSON.stringify(courseData.prerequisites || []),
                learningObjectives: JSON.stringify(courseData.learning_objectives || []),
                courseFormat: courseData.course_format || 'video',
                certificateAvailable: courseData.certificate_available ? 'Y' : 'N',
                rating: courseData.rating || null,
                reviewCount: courseData.review_count || null,
                enrolledCount: courseData.enrolled_count || null
            });

            await this.database.commit();
            return courseId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error importing course:', error);
            throw error;
        }
    }

    // Helper methods

    async getUserLearningPreferences(userId) {
        // This would fetch user's learning preferences
        // For now, return defaults
        return {
            preferred_difficulty: 'intermediate',
            max_price: 100,
            preferred_duration: 20,
            preferred_providers: [],
            preferred_formats: ['video', 'interactive']
        };
    }

    async getExistingRecommendations(userId) {
        const sql = `
            SELECT * FROM pf_course_recommendations
            WHERE user_id = :userId
            AND valid_until >= CURRENT_DATE
            AND (user_action IS NULL OR user_action = 'viewed')
            ORDER BY created_at DESC
        `;

        const result = await this.database.execute(sql, { userId });
        return result.rows;
    }

    async generateRecommendations(userId, profile, skillGaps, preferences) {
        try {
            // Find courses that address skill gaps
            const recommendations = [];

            for (const gap of skillGaps.slice(0, 5)) { // Top 5 gaps
                const courses = await this.findCoursesForSkill(gap.skill_name, preferences);
                
                for (const course of courses.slice(0, 2)) { // Top 2 courses per skill
                    const score = this.calculateRecommendationScore(course, gap, profile, preferences);
                    
                    if (score.overall >= 0.6) { // Threshold for recommendation
                        recommendations.push({
                            courseId: course.course_id,
                            score,
                            skillGap: gap,
                            reason: this.generateRecommendationReason(course, gap, score)
                        });
                    }
                }
            }

            // Store recommendations
            for (const rec of recommendations) {
                await this.storeRecommendation(userId, rec);
            }

            return recommendations;
        } catch (error) {
            logger.error('Error generating recommendations:', error);
            throw error;
        }
    }

    async findCoursesForSkill(skillName, preferences) {
        const sql = `
            SELECT * FROM pf_courses
            WHERE is_active = 'Y'
            AND JSON_EXISTS(skills_covered, '$[*]?(@ == $skill)')
            AND (:maxPrice IS NULL OR price_usd <= :maxPrice)
            ORDER BY rating DESC, enrolled_count DESC
            FETCH FIRST 5 ROWS ONLY
        `;

        const result = await this.database.execute(sql, {
            skill: skillName,
            maxPrice: preferences.max_price || null
        });

        return result.rows;
    }

    calculateRecommendationScore(course, skillGap, profile, preferences) {
        let skillScore = skillGap.gap_severity * 0.4; // Higher gap = higher priority
        let difficultyScore = this.matchDifficulty(course.difficulty_level, profile.experience_level) * 0.2;
        let priceScore = this.calculatePriceScore(course.price_usd, preferences.max_price) * 0.15;
        let ratingScore = (course.rating / 5) * 0.15;
        let popularityScore = Math.min(course.enrolled_count / 10000, 1) * 0.1;

        return {
            overall: skillScore + difficultyScore + priceScore + ratingScore + popularityScore,
            breakdown: {
                skill_relevance: skillScore,
                difficulty_match: difficultyScore,
                price_value: priceScore,
                quality: ratingScore,
                popularity: popularityScore
            }
        };
    }

    matchDifficulty(courseDifficulty, userLevel) {
        const levelMap = {
            'beginner': 1,
            'intermediate': 2,
            'advanced': 3,
            'expert': 4
        };

        const courseLevel = levelMap[courseDifficulty] || 2;
        const userLevelNum = levelMap[userLevel] || 2;

        const diff = Math.abs(courseLevel - userLevelNum);
        return 1 - (diff * 0.3); // Penalty for mismatch
    }

    calculatePriceScore(price, maxPrice) {
        if (!price || price === 0) return 1; // Free courses get max score
        if (!maxPrice) return 0.5; // Neutral if no preference
        return Math.max(0, 1 - (price / maxPrice));
    }

    generateRecommendationReason(course, skillGap, score) {
        const reasons = [];
        
        if (score.breakdown.skill_relevance > 0.3) {
            reasons.push(`Addresses your ${skillGap.skill_name} skill gap`);
        }
        
        if (score.breakdown.quality > 0.12) {
            reasons.push(`Highly rated course (${course.rating}/5)`);
        }
        
        if (course.certificate_available === 'Y') {
            reasons.push('Certificate available upon completion');
        }
        
        return reasons.join('. ');
    }

    async storeRecommendation(userId, recommendation) {
        const recommendationId = ulid();
        
        const sql = `
            INSERT INTO pf_course_recommendations (
                recommendation_id, user_id, course_id,
                recommendation_type, relevance_score,
                reason, skill_gaps_addressed,
                career_impact_score, priority,
                valid_until
            ) VALUES (
                :recommendationId, :userId, :courseId,
                :recommendationType, :relevanceScore,
                :reason, :skillGapsAddressed,
                :careerImpactScore, :priority,
                :validUntil
            )
        `;

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

        await this.database.execute(sql, {
            recommendationId,
            userId,
            courseId: recommendation.courseId,
            recommendationType: 'skill_gap',
            relevanceScore: recommendation.score.overall,
            reason: recommendation.reason,
            skillGapsAddressed: JSON.stringify([recommendation.skillGap.skill_name]),
            careerImpactScore: recommendation.score.breakdown.skill_relevance,
            priority: recommendation.score.overall >= 0.8 ? 'high' : 'medium',
            validUntil
        });
    }

    async updateRecommendationAction(userId, courseId, action) {
        const sql = `
            UPDATE pf_course_recommendations
            SET user_action = :action,
                action_date = CURRENT_DATE
            WHERE user_id = :userId
            AND course_id = :courseId
            AND user_action IS NULL
        `;

        await this.database.execute(sql, { userId, courseId, action });
    }

    async checkCertificateEligibility(enrollmentId, userId) {
        // Check if user is eligible for certificate
        // This would integrate with course provider APIs
        // For now, we'll mark certificate as earned if course offers it
        
        const sql = `
            UPDATE pf_user_courses uc
            SET certificate_earned = 'Y'
            WHERE uc.enrollment_id = :enrollmentId
            AND uc.user_id = :userId
            AND EXISTS (
                SELECT 1 FROM pf_courses c
                WHERE c.course_id = uc.course_id
                AND c.certificate_available = 'Y'
            )
        `;

        await this.database.execute(sql, { enrollmentId, userId });
    }
}

module.exports = CourseService;