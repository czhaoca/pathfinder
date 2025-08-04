const express = require('express');
const { body, query, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

const router = express.Router();

module.exports = (container) => {
    const learningController = container.resolve('learningController');

    // Apply authentication to all routes
    router.use(authenticate);

    // Course Routes
    router.get('/courses/search',
        [
            query('q').optional().isString().trim(),
            query('provider').optional().isString(),
            query('skills').optional().isString(),
            query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
            query('maxPrice').optional().isFloat({ min: 0 }),
            query('minRating').optional().isFloat({ min: 0, max: 5 }),
            query('certificateRequired').optional().isBoolean(),
            query('language').optional().isString(),
            query('sortBy').optional().isIn(['rating', 'price_usd', 'duration_hours', 'enrolled_count']),
            query('sortOrder').optional().isIn(['ASC', 'DESC']),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.searchCourses.bind(learningController)
    );

    router.get('/courses/recommended',
        [
            query('limit').optional().isInt({ min: 1, max: 20 })
        ],
        validate,
        learningController.getRecommendedCourses.bind(learningController)
    );

    router.get('/courses/enrolled',
        [
            query('status').optional().isString(),
            query('provider').optional().isString(),
            query('sortBy').optional().isString(),
            query('sortOrder').optional().isIn(['ASC', 'DESC'])
        ],
        validate,
        learningController.getEnrolledCourses.bind(learningController)
    );

    router.get('/courses/stats',
        learningController.getCourseStats.bind(learningController)
    );

    router.get('/courses/:courseId',
        [
            param('courseId').isString().notEmpty()
        ],
        validate,
        learningController.getCourseDetails.bind(learningController)
    );

    router.post('/courses/enroll',
        [
            body('courseId').isString().notEmpty(),
            body('startDate').optional().isISO8601(),
            body('expectedCompletionDate').optional().isISO8601(),
            body('notes').optional().isString()
        ],
        validate,
        learningController.enrollInCourse.bind(learningController)
    );

    router.put('/courses/:enrollmentId/progress',
        [
            param('enrollmentId').isString().notEmpty(),
            body('progressPercentage').optional().isInt({ min: 0, max: 100 }),
            body('timeSpentHours').optional().isFloat({ min: 0 }),
            body('status').optional().isIn(['enrolled', 'in_progress', 'completed', 'abandoned'])
        ],
        validate,
        learningController.updateCourseProgress.bind(learningController)
    );

    router.post('/courses/:enrollmentId/complete',
        [
            param('enrollmentId').isString().notEmpty(),
            body('userRating').optional().isInt({ min: 1, max: 5 }),
            body('userReview').optional().isString(),
            body('certificateUrl').optional().isURL()
        ],
        validate,
        learningController.completeCourse.bind(learningController)
    );

    // Assessment Routes
    router.get('/assessments',
        [
            query('skillId').optional().isString(),
            query('type').optional().isIn(['quiz', 'project', 'peer_review', 'self_assessment']),
            query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
            query('isActive').optional().isBoolean(),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.getAssessments.bind(learningController)
    );

    router.get('/assessments/results',
        [
            query('skillId').optional().isString(),
            query('passed').optional().isBoolean(),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.getAssessmentResults.bind(learningController)
    );

    router.get('/assessments/summary',
        learningController.getSkillAssessmentSummary.bind(learningController)
    );

    router.get('/assessments/:assessmentId',
        [
            param('assessmentId').isString().notEmpty()
        ],
        validate,
        learningController.getAssessmentDetails.bind(learningController)
    );

    router.post('/assessments/:assessmentId/start',
        [
            param('assessmentId').isString().notEmpty()
        ],
        validate,
        learningController.startAssessment.bind(learningController)
    );

    router.post('/assessments/:assessmentId/submit',
        [
            param('assessmentId').isString().notEmpty(),
            body('resultId').isString().notEmpty(),
            body('answers').isObject().notEmpty(),
            body('timeSpent').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.submitAssessment.bind(learningController)
    );

    router.post('/assessments/generate',
        [
            body('skillId').isString().notEmpty(),
            body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
            body('questionCount').optional().isInt({ min: 5, max: 50 }),
            body('assessmentType').optional().isIn(['quiz', 'project', 'peer_review', 'self_assessment'])
        ],
        validate,
        learningController.generateAIAssessment.bind(learningController)
    );

    // Certification Routes
    router.get('/certifications/catalog',
        [
            query('industry').optional().isString(),
            query('level').optional().isIn(['foundational', 'associate', 'professional', 'expert']),
            query('organization').optional().isString(),
            query('q').optional().isString().trim(),
            query('minDemand').optional().isFloat({ min: 0, max: 5 }),
            query('maxCost').optional().isFloat({ min: 0 }),
            query('sortBy').optional().isIn(['market_demand_score', 'average_salary_impact', 'cost_usd', 'certification_name']),
            query('sortOrder').optional().isIn(['ASC', 'DESC']),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.browseCertifications.bind(learningController)
    );

    router.get('/certifications/my',
        [
            query('includeExpired').optional().isBoolean()
        ],
        validate,
        learningController.getUserCertifications.bind(learningController)
    );

    router.get('/certifications/expiring',
        [
            query('days').optional().isInt({ min: 1, max: 365 })
        ],
        validate,
        learningController.getExpiringCertifications.bind(learningController)
    );

    router.get('/certifications/recommended',
        [
            query('limit').optional().isInt({ min: 1, max: 10 })
        ],
        validate,
        learningController.getRecommendedCertifications.bind(learningController)
    );

    router.get('/certifications/stats',
        learningController.getCertificationStats.bind(learningController)
    );

    router.get('/certifications/cpe-credits',
        [
            query('startDate').isISO8601(),
            query('endDate').isISO8601()
        ],
        validate,
        learningController.calculateCPECredits.bind(learningController)
    );

    router.get('/certifications/:certificationId',
        [
            param('certificationId').isString().notEmpty()
        ],
        validate,
        learningController.getCertificationDetails.bind(learningController)
    );

    router.post('/certifications/add',
        [
            body('certificationId').isString().notEmpty(),
            body('credentialNumber').optional().isString(),
            body('issueDate').isISO8601(),
            body('expiryDate').optional().isISO8601(),
            body('verificationUrl').optional().isURL(),
            body('certificateFileUrl').optional().isURL(),
            body('cpeCreditsEarned').optional().isFloat({ min: 0 }),
            body('preparationHours').optional().isInt({ min: 0 }),
            body('examScore').optional().isString(),
            body('examDate').optional().isISO8601(),
            body('notes').optional().isString()
        ],
        validate,
        learningController.addUserCertification.bind(learningController)
    );

    router.put('/certifications/:userCertId',
        [
            param('userCertId').isString().notEmpty(),
            body('credentialNumber').optional().isString(),
            body('expiryDate').optional().isISO8601(),
            body('status').optional().isIn(['active', 'expired', 'revoked', 'renewing']),
            body('verificationUrl').optional().isURL(),
            body('certificateFileUrl').optional().isURL(),
            body('cpeCreditsEarned').optional().isFloat({ min: 0 }),
            body('notes').optional().isString()
        ],
        validate,
        learningController.updateUserCertification.bind(learningController)
    );

    router.post('/certifications/:userCertId/renew',
        [
            param('userCertId').isString().notEmpty(),
            body('targetRenewalDate').optional().isISO8601(),
            body('notes').optional().isString(),
            body('isComplete').optional().isBoolean(),
            body('newCredentialNumber').optional().isString(),
            body('newIssueDate').optional().isISO8601(),
            body('newExpiryDate').optional().isISO8601(),
            body('verificationUrl').optional().isURL(),
            body('cpeCreditsUsed').optional().isFloat({ min: 0 })
        ],
        validate,
        learningController.trackRenewal.bind(learningController)
    );

    // Learning Path Routes
    router.get('/learning-paths',
        [
            query('role').optional().isString(),
            query('level').optional().isIn(['entry', 'mid', 'senior', 'expert']),
            query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
            query('public').optional().isBoolean(),
            query('createdBy').optional().isString(),
            query('q').optional().isString().trim(),
            query('sortBy').optional().isIn(['popularity_score', 'completion_count', 'average_rating', 'created_at']),
            query('sortOrder').optional().isIn(['ASC', 'DESC']),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        learningController.browseLearningPaths.bind(learningController)
    );

    router.get('/learning-paths/my',
        [
            query('status').optional().isString(),
            query('sortBy').optional().isString(),
            query('sortOrder').optional().isIn(['ASC', 'DESC'])
        ],
        validate,
        learningController.getUserLearningPaths.bind(learningController)
    );

    router.get('/learning-paths/recommended',
        [
            query('limit').optional().isInt({ min: 1, max: 10 })
        ],
        validate,
        learningController.getRecommendedPaths.bind(learningController)
    );

    router.get('/learning-paths/:pathId',
        [
            param('pathId').isString().notEmpty()
        ],
        validate,
        learningController.getLearningPathDetails.bind(learningController)
    );

    router.post('/learning-paths',
        [
            body('pathName').isString().notEmpty().trim(),
            body('pathDescription').optional().isString(),
            body('targetRole').optional().isString(),
            body('targetLevel').optional().isIn(['entry', 'mid', 'senior', 'expert']),
            body('estimatedDurationWeeks').optional().isInt({ min: 1 }),
            body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']),
            body('skillsGained').optional().isArray(),
            body('prerequisites').optional().isArray(),
            body('isPublic').optional().isBoolean(),
            body('tags').optional().isArray(),
            body('steps').optional().isArray()
        ],
        validate,
        learningController.createLearningPath.bind(learningController)
    );

    router.post('/learning-paths/:pathId/enroll',
        [
            param('pathId').isString().notEmpty(),
            body('targetCompletionDate').optional().isISO8601()
        ],
        validate,
        learningController.enrollInPath.bind(learningController)
    );

    router.put('/learning-paths/:userPathId/progress',
        [
            param('userPathId').isString().notEmpty(),
            body('stepId').isString().notEmpty(),
            body('status').isIn(['not_started', 'in_progress', 'completed', 'skipped']),
            body('timeSpent').optional().isFloat({ min: 0 }),
            body('score').optional().isFloat({ min: 0 }),
            body('feedback').optional().isString()
        ],
        validate,
        learningController.updatePathProgress.bind(learningController)
    );

    router.get('/learning-paths/:userPathId/progress',
        [
            param('userPathId').isString().notEmpty()
        ],
        validate,
        learningController.getPathProgress.bind(learningController)
    );

    // Learning Goals Routes
    router.get('/learning-goals',
        [
            query('includeCompleted').optional().isBoolean()
        ],
        validate,
        learningController.getLearningGoals.bind(learningController)
    );

    router.post('/learning-goals',
        [
            body('goalTitle').isString().notEmpty().trim(),
            body('goalDescription').optional().isString(),
            body('targetDate').isISO8601(),
            body('goalType').isIn(['skill_acquisition', 'certification', 'course_completion', 'project']),
            body('targetSkillId').optional().isString(),
            body('targetSkillLevel').optional().isIn(['novice', 'competent', 'proficient', 'expert']),
            body('relatedPathId').optional().isString()
        ],
        validate,
        learningController.createLearningGoal.bind(learningController)
    );

    router.put('/learning-goals/:goalId',
        [
            param('goalId').isString().notEmpty(),
            body('progressPercentage').optional().isInt({ min: 0, max: 100 }),
            body('status').optional().isIn(['active', 'completed', 'missed', 'cancelled']),
            body('notes').optional().isString()
        ],
        validate,
        learningController.updateLearningGoal.bind(learningController)
    );

    router.delete('/learning-goals/:goalId',
        [
            param('goalId').isString().notEmpty()
        ],
        validate,
        learningController.deleteLearningGoal.bind(learningController)
    );

    // Analytics Routes
    router.get('/learning/analytics',
        learningController.getLearningAnalytics.bind(learningController)
    );

    return router;
};