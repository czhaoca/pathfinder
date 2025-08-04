const ApiResponse = require('../../utils/apiResponse');
const logger = require('../../utils/logger');

class LearningController {
    constructor(
        courseService,
        skillAssessmentService,
        certificationService,
        learningPathService
    ) {
        this.courseService = courseService;
        this.skillAssessmentService = skillAssessmentService;
        this.certificationService = certificationService;
        this.learningPathService = learningPathService;
    }

    // Course endpoints

    /**
     * Search courses
     */
    async searchCourses(req, res, next) {
        try {
            const searchParams = {
                query: req.query.q,
                provider: req.query.provider,
                skills: req.query.skills ? req.query.skills.split(',') : undefined,
                difficultyLevel: req.query.difficulty,
                maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
                minRating: req.query.minRating ? parseFloat(req.query.minRating) : undefined,
                certificateRequired: req.query.certificateRequired === 'true',
                language: req.query.language,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const result = await this.courseService.searchCourses(searchParams);

            ApiResponse.success(res, result, 'Courses retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get course details
     */
    async getCourseDetails(req, res, next) {
        try {
            const { courseId } = req.params;

            const course = await this.courseService.getCourseDetails(courseId);

            ApiResponse.success(res, course, 'Course details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get recommended courses
     */
    async getRecommendedCourses(req, res, next) {
        try {
            const userId = req.user.userId;
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;

            const courses = await this.courseService.getRecommendedCourses(userId, limit);

            ApiResponse.success(res, courses, 'Recommended courses retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Enroll in course
     */
    async enrollInCourse(req, res, next) {
        try {
            const userId = req.user.userId;
            const { courseId, startDate, expectedCompletionDate, notes } = req.body;

            const enrollmentId = await this.courseService.enrollInCourse(userId, courseId, {
                startDate,
                expectedCompletionDate,
                notes
            });

            ApiResponse.success(res, { enrollmentId }, 'Enrolled in course successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update course progress
     */
    async updateCourseProgress(req, res, next) {
        try {
            const userId = req.user.userId;
            const { enrollmentId } = req.params;
            const progressData = req.body;

            await this.courseService.updateCourseProgress(enrollmentId, userId, progressData);

            ApiResponse.success(res, null, 'Course progress updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Complete course
     */
    async completeCourse(req, res, next) {
        try {
            const userId = req.user.userId;
            const { enrollmentId } = req.params;
            const completionData = req.body;

            await this.courseService.completeCourse(enrollmentId, userId, completionData);

            ApiResponse.success(res, null, 'Course completed successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get enrolled courses
     */
    async getEnrolledCourses(req, res, next) {
        try {
            const userId = req.user.userId;
            const filters = {
                status: req.query.status,
                provider: req.query.provider,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const courses = await this.courseService.getUserCourses(userId, filters);

            ApiResponse.success(res, courses, 'Enrolled courses retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get course statistics
     */
    async getCourseStats(req, res, next) {
        try {
            const userId = req.user.userId;

            const stats = await this.courseService.getCourseStats(userId);

            ApiResponse.success(res, stats, 'Course statistics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    // Assessment endpoints

    /**
     * Get available assessments
     */
    async getAssessments(req, res, next) {
        try {
            const filters = {
                skillId: req.query.skillId,
                assessmentType: req.query.type,
                difficultyLevel: req.query.difficulty,
                isActive: req.query.isActive !== 'false',
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const assessments = await this.skillAssessmentService.getAssessments(filters);

            ApiResponse.success(res, assessments, 'Assessments retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get assessment details
     */
    async getAssessmentDetails(req, res, next) {
        try {
            const { assessmentId } = req.params;

            const assessment = await this.skillAssessmentService.getAssessmentDetails(assessmentId);

            ApiResponse.success(res, assessment, 'Assessment details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Start assessment
     */
    async startAssessment(req, res, next) {
        try {
            const userId = req.user.userId;
            const { assessmentId } = req.params;

            const assessment = await this.skillAssessmentService.startAssessment(userId, assessmentId);

            ApiResponse.success(res, assessment, 'Assessment started successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Submit assessment
     */
    async submitAssessment(req, res, next) {
        try {
            const userId = req.user.userId;
            const { assessmentId } = req.params;
            const { resultId, answers, timeSpent } = req.body;

            const result = await this.skillAssessmentService.submitAssessment(resultId, userId, {
                answers,
                timeSpent
            });

            ApiResponse.success(res, result, 'Assessment submitted successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get assessment results
     */
    async getAssessmentResults(req, res, next) {
        try {
            const userId = req.user.userId;
            const filters = {
                skillId: req.query.skillId,
                passed: req.query.passed === 'true',
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const results = await this.skillAssessmentService.getUserAssessmentResults(userId, filters);

            ApiResponse.success(res, results, 'Assessment results retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get skill assessment summary
     */
    async getSkillAssessmentSummary(req, res, next) {
        try {
            const userId = req.user.userId;

            const summary = await this.skillAssessmentService.getSkillAssessmentSummary(userId);

            ApiResponse.success(res, summary, 'Skill assessment summary retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generate AI assessment
     */
    async generateAIAssessment(req, res, next) {
        try {
            const { skillId, difficultyLevel, questionCount, assessmentType } = req.body;

            const assessment = await this.skillAssessmentService.generateAIAssessment(skillId, {
                difficultyLevel,
                questionCount,
                assessmentType
            });

            ApiResponse.success(res, assessment, 'AI assessment generated successfully');
        } catch (error) {
            next(error);
        }
    }

    // Certification endpoints

    /**
     * Browse certifications
     */
    async browseCertifications(req, res, next) {
        try {
            const filters = {
                industry: req.query.industry,
                certificationLevel: req.query.level,
                issuingOrganization: req.query.organization,
                searchQuery: req.query.q,
                minDemandScore: req.query.minDemand ? parseFloat(req.query.minDemand) : undefined,
                maxCost: req.query.maxCost ? parseFloat(req.query.maxCost) : undefined,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const certifications = await this.certificationService.browseCertifications(filters);

            ApiResponse.success(res, certifications, 'Certifications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get certification details
     */
    async getCertificationDetails(req, res, next) {
        try {
            const { certificationId } = req.params;

            const certification = await this.certificationService.getCertificationDetails(certificationId);

            ApiResponse.success(res, certification, 'Certification details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add user certification
     */
    async addUserCertification(req, res, next) {
        try {
            const userId = req.user.userId;
            const certificationData = req.body;

            const userCertId = await this.certificationService.addUserCertification(
                userId,
                certificationData
            );

            ApiResponse.success(res, { userCertId }, 'Certification added successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update user certification
     */
    async updateUserCertification(req, res, next) {
        try {
            const userId = req.user.userId;
            const { userCertId } = req.params;
            const updates = req.body;

            await this.certificationService.updateUserCertification(userCertId, userId, updates);

            ApiResponse.success(res, null, 'Certification updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user certifications
     */
    async getUserCertifications(req, res, next) {
        try {
            const userId = req.user.userId;
            const includeExpired = req.query.includeExpired === 'true';

            const certifications = await this.certificationService.getUserCertifications(
                userId,
                includeExpired
            );

            ApiResponse.success(res, certifications, 'User certifications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get expiring certifications
     */
    async getExpiringCertifications(req, res, next) {
        try {
            const userId = req.user.userId;
            const daysAhead = req.query.days ? parseInt(req.query.days) : 90;

            const certifications = await this.certificationService.getExpiringCertifications(
                userId,
                daysAhead
            );

            ApiResponse.success(res, certifications, 'Expiring certifications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Track certification renewal
     */
    async trackRenewal(req, res, next) {
        try {
            const userId = req.user.userId;
            const { userCertId } = req.params;
            const renewalData = req.body;

            const result = await this.certificationService.trackRenewal(
                userCertId,
                userId,
                renewalData
            );

            ApiResponse.success(res, { certId: result }, 'Renewal tracked successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get certification statistics
     */
    async getCertificationStats(req, res, next) {
        try {
            const userId = req.user.userId;

            const stats = await this.certificationService.getCertificationStats(userId);

            ApiResponse.success(res, stats, 'Certification statistics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get recommended certifications
     */
    async getRecommendedCertifications(req, res, next) {
        try {
            const userId = req.user.userId;
            const limit = req.query.limit ? parseInt(req.query.limit) : 5;

            const certifications = await this.certificationService.getRecommendedCertifications(
                userId,
                limit
            );

            ApiResponse.success(res, certifications, 'Recommended certifications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Calculate CPE credits
     */
    async calculateCPECredits(req, res, next) {
        try {
            const userId = req.user.userId;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return ApiResponse.error(res, 'Start date and end date are required', 400);
            }

            const credits = await this.certificationService.calculateCPECredits(
                userId,
                startDate,
                endDate
            );

            ApiResponse.success(res, credits, 'CPE credits calculated successfully');
        } catch (error) {
            next(error);
        }
    }

    // Learning path endpoints

    /**
     * Browse learning paths
     */
    async browseLearningPaths(req, res, next) {
        try {
            const filters = {
                targetRole: req.query.role,
                targetLevel: req.query.level,
                difficultyLevel: req.query.difficulty,
                isPublic: req.query.public !== 'false',
                createdBy: req.query.createdBy,
                searchQuery: req.query.q,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const paths = await this.learningPathService.browseLearningPaths(filters);

            ApiResponse.success(res, paths, 'Learning paths retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get learning path details
     */
    async getLearningPathDetails(req, res, next) {
        try {
            const { pathId } = req.params;

            const path = await this.learningPathService.getLearningPathDetails(pathId);

            ApiResponse.success(res, path, 'Learning path details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create learning path
     */
    async createLearningPath(req, res, next) {
        try {
            const userId = req.user.userId;
            const pathData = req.body;

            const pathId = await this.learningPathService.createLearningPath(pathData, userId);

            ApiResponse.success(res, { pathId }, 'Learning path created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Enroll in learning path
     */
    async enrollInPath(req, res, next) {
        try {
            const userId = req.user.userId;
            const { pathId } = req.params;
            const { targetCompletionDate } = req.body;

            const userPathId = await this.learningPathService.enrollInPath(
                userId,
                pathId,
                targetCompletionDate
            );

            ApiResponse.success(res, { userPathId }, 'Enrolled in learning path successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update path progress
     */
    async updatePathProgress(req, res, next) {
        try {
            const userId = req.user.userId;
            const { userPathId } = req.params;
            const progressData = req.body;

            const progress = await this.learningPathService.updatePathProgress(
                userPathId,
                userId,
                progressData
            );

            ApiResponse.success(res, progress, 'Path progress updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user learning paths
     */
    async getUserLearningPaths(req, res, next) {
        try {
            const userId = req.user.userId;
            const filters = {
                status: req.query.status,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const paths = await this.learningPathService.getUserLearningPaths(userId, filters);

            ApiResponse.success(res, paths, 'User learning paths retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get path progress details
     */
    async getPathProgress(req, res, next) {
        try {
            const userId = req.user.userId;
            const { userPathId } = req.params;

            const progress = await this.learningPathService.getPathProgress(userPathId, userId);

            ApiResponse.success(res, progress, 'Path progress retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get recommended paths
     */
    async getRecommendedPaths(req, res, next) {
        try {
            const userId = req.user.userId;
            const limit = req.query.limit ? parseInt(req.query.limit) : 5;

            const paths = await this.learningPathService.getRecommendedPaths(userId, limit);

            ApiResponse.success(res, paths, 'Recommended paths retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    // Learning goals endpoints

    /**
     * Create learning goal
     */
    async createLearningGoal(req, res, next) {
        try {
            const userId = req.user.userId;
            const goalData = req.body;

            const goalId = await this.learningPathService.createLearningGoal(userId, goalData);

            ApiResponse.success(res, { goalId }, 'Learning goal created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get learning goals
     */
    async getLearningGoals(req, res, next) {
        try {
            const userId = req.user.userId;
            const includeCompleted = req.query.includeCompleted === 'true';

            const goals = await this.learningPathService.getUserLearningGoals(
                userId,
                includeCompleted
            );

            ApiResponse.success(res, goals, 'Learning goals retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update learning goal
     */
    async updateLearningGoal(req, res, next) {
        try {
            const userId = req.user.userId;
            const { goalId } = req.params;
            const progressData = req.body;

            await this.learningPathService.updateGoalProgress(goalId, userId, progressData);

            ApiResponse.success(res, null, 'Learning goal updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete learning goal
     */
    async deleteLearningGoal(req, res, next) {
        try {
            const userId = req.user.userId;
            const { goalId } = req.params;

            await this.learningPathService.updateGoalProgress(goalId, userId, {
                status: 'cancelled'
            });

            ApiResponse.success(res, null, 'Learning goal deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    // Analytics endpoints

    /**
     * Get learning analytics
     */
    async getLearningAnalytics(req, res, next) {
        try {
            const userId = req.user.userId;

            // Aggregate analytics from all services
            const [courseStats, certStats, assessmentSummary] = await Promise.all([
                this.courseService.getCourseStats(userId),
                this.certificationService.getCertificationStats(userId),
                this.skillAssessmentService.getSkillAssessmentSummary(userId)
            ]);

            const analytics = {
                courses: courseStats,
                certifications: certStats,
                assessments: assessmentSummary,
                summary: {
                    total_learning_hours: courseStats.total_hours,
                    skills_acquired: [
                        ...new Set([
                            ...courseStats.skills_learned,
                            ...certStats.skills_validated
                        ])
                    ],
                    active_enrollments: courseStats.in_progress,
                    completed_courses: courseStats.completed,
                    active_certifications: certStats.summary.active
                }
            };

            ApiResponse.success(res, analytics, 'Learning analytics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = LearningController;