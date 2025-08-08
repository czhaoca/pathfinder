const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');
const { body, query, param } = require('express-validator');

function createJobSearchRoutes(container) {
    const router = express.Router();
    const jobSearchController = container.get('jobSearchController');
    const authMiddleware = container.get('authMiddleware');
    const validate = container.get('validationMiddleware');

    // Apply authentication to all routes
    router.use(authMiddleware.authenticate());

    // Job Search Routes
    router.get('/jobs/search',
        [
            query('q').optional().isString().trim(),
            query('location').optional().isString().trim(),
            query('remoteOnly').optional().isBoolean(),
            query('experienceLevel').optional().isIn(['entry', 'mid', 'senior', 'executive']),
            query('jobType').optional().isIn(['full-time', 'part-time', 'contract', 'internship']),
            query('salaryMin').optional().isInt({ min: 0 }),
            query('salaryMax').optional().isInt({ min: 0 }),
            query('skills').optional().isString(),
            query('companies').optional().isString(),
            query('industries').optional().isString(),
            query('sortBy').optional().isIn(['posting_date', 'salary_max', 'match_score', 'company_name']),
            query('sortOrder').optional().isIn(['ASC', 'DESC']),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.searchJobs(req, res, next))
    );

    router.get('/jobs/recommended',
        [
            query('limit').optional().isInt({ min: 1, max: 50 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getRecommendedJobs(req, res, next))
    );

    router.get('/jobs/:jobId',
        [
            param('jobId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getJobDetails(req, res, next))
    );

    router.post('/jobs/match-scores',
        [
            body('jobIds').isArray().notEmpty(),
            body('jobIds.*').isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.calculateMatchScores(req, res, next))
    );

    router.post('/jobs/import',
        [
            body('url').isURL(),
            body('source').isString().notEmpty(),
            body('jobTitle').optional().isString(),
            body('companyName').optional().isString(),
            body('description').optional().isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.importJob(req, res, next))
    );

    // Job Preferences Routes
    router.get('/job-preferences',
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getJobPreferences(req, res, next))
    );

    router.put('/job-preferences',
        [
            body('targetRoles').optional().isArray(),
            body('targetCompanies').optional().isArray(),
            body('industries').optional().isArray(),
            body('locations').optional().isArray(),
            body('remotePreference').optional().isIn(['only_remote', 'prefer_remote', 'open_to_remote', 'prefer_onsite', 'only_onsite']),
            body('salaryMinExpected').optional().isInt({ min: 0 }),
            body('salaryMaxExpected').optional().isInt({ min: 0 }),
            body('jobTypes').optional().isArray(),
            body('companySizes').optional().isArray(),
            body('mustHaveBenefits').optional().isArray(),
            body('dealBreakers').optional().isArray(),
            body('searchStatus').optional().isIn(['active', 'passive', 'not_looking']),
            body('urgencyLevel').optional().isIn(['immediate', '3_months', '6_months', 'exploring'])
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.updateJobPreferences(req, res, next))
    );

    // Saved Searches Routes
    router.post('/saved-searches',
        [
            body('searchName').isString().notEmpty().trim(),
            body('criteria').isObject().notEmpty(),
            body('notificationFrequency').optional().isIn(['daily', 'weekly', 'instant'])
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.saveSearch(req, res, next))
    );

    router.get('/saved-searches',
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getSavedSearches(req, res, next))
    );

    router.delete('/saved-searches/:searchId',
        [
            param('searchId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.deleteSavedSearch(req, res, next))
    );

    // Application Routes
    router.get('/applications',
        [
            query('status').optional().isString(),
            query('startDate').optional().isISO8601(),
            query('endDate').optional().isISO8601(),
            query('company').optional().isString(),
            query('sortBy').optional().isIn(['application_date', 'status', 'company_name', 'excitement_level']),
            query('sortOrder').optional().isIn(['ASC', 'DESC']),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getApplications(req, res, next))
    );

    router.get('/applications/:applicationId',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getApplicationDetails(req, res, next))
    );

    router.post('/applications',
        [
            body('jobId').isString().notEmpty(),
            body('status').optional().isIn(['interested', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn']),
            body('applicationDate').optional().isISO8601(),
            body('resumeVersionId').optional().isString(),
            body('coverLetterId').optional().isString(),
            body('applicationMethod').optional().isIn(['platform', 'email', 'referral', 'direct']),
            body('referralContactId').optional().isString(),
            body('applicationNotes').optional().isString(),
            body('excitementLevel').optional().isInt({ min: 1, max: 5 }),
            body('fitScore').optional().isFloat({ min: 0, max: 1 }),
            body('salaryExpectationMin').optional().isInt({ min: 0 }),
            body('salaryExpectationMax').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.createApplication(req, res, next))
    );

    router.put('/applications/:applicationId',
        [
            param('applicationId').isString().notEmpty(),
            body('status').optional().isIn(['interested', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn']),
            body('resumeVersionId').optional().isString(),
            body('coverLetterId').optional().isString(),
            body('applicationNotes').optional().isString(),
            body('excitementLevel').optional().isInt({ min: 1, max: 5 }),
            body('fitScore').optional().isFloat({ min: 0, max: 1 }),
            body('salaryExpectationMin').optional().isInt({ min: 0 }),
            body('salaryExpectationMax').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.updateApplication(req, res, next))
    );

    router.delete('/applications/:applicationId',
        [
            param('applicationId').isString().notEmpty(),
            body('reason').optional().isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.withdrawApplication(req, res, next))
    );

    router.get('/applications/:applicationId/timeline',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getApplicationTimeline(req, res, next))
    );

    router.get('/applications/stats',
        [
            query('timeframe').optional().isInt({ min: 1, max: 365 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getApplicationStats(req, res, next))
    );

    router.post('/applications/bulk-update',
        [
            body('applicationIds').isArray().notEmpty(),
            body('applicationIds.*').isString(),
            body('newStatus').isIn(['interested', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn']),
            body('notes').optional().isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.bulkUpdateStatus(req, res, next))
    );

    // Interview Preparation Routes
    router.get('/interview-prep/questions',
        [
            query('companyId').optional().isString(),
            query('roleCategory').optional().isString(),
            query('questionType').optional().isIn(['behavioral', 'technical', 'situational']),
            query('difficulty').optional().isIn(['easy', 'medium', 'hard']),
            query('limit').optional().isInt({ min: 1, max: 50 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getInterviewQuestions(req, res, next))
    );

    router.get('/interview-prep/application/:applicationId',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getApplicationInterviewPrep(req, res, next))
    );

    router.post('/interview-prep/responses',
        [
            body('prepId').isString().notEmpty(),
            body('responseText').isString().notEmpty(),
            body('interviewId').optional().isString(),
            body('selfRating').optional().isInt({ min: 1, max: 5 }),
            body('needsImprovement').optional().isBoolean(),
            body('requestFeedback').optional().isBoolean()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.saveInterviewResponse(req, res, next))
    );

    router.put('/interview-prep/responses/:responseId',
        [
            param('responseId').isString().notEmpty(),
            body('responseText').optional().isString(),
            body('selfRating').optional().isInt({ min: 1, max: 5 }),
            body('needsImprovement').optional().isBoolean()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.updateInterviewResponse(req, res, next))
    );

    router.get('/interview-prep/responses',
        [
            query('prepId').optional().isString(),
            query('interviewId').optional().isString(),
            query('needsImprovement').optional().isBoolean(),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            query('offset').optional().isInt({ min: 0 })
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getUserResponses(req, res, next))
    );

    router.post('/interview-prep/questions',
        [
            body('questionText').isString().notEmpty(),
            body('companyId').optional().isString(),
            body('roleCategory').optional().isString(),
            body('questionType').optional().isIn(['behavioral', 'technical', 'situational']),
            body('difficultyLevel').optional().isIn(['easy', 'medium', 'hard']),
            body('sampleAnswer').optional().isString(),
            body('answerFramework').optional().isString(),
            body('tips').optional().isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.addCustomQuestion(req, res, next))
    );

    router.get('/interview-prep/insights',
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getInterviewInsights(req, res, next))
    );

    // Company Routes
    router.get('/companies/search',
        [
            query('q').optional().isString().trim(),
            query('industry').optional().isString(),
            query('size').optional().isString()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.searchCompanies(req, res, next))
    );

    router.get('/companies/:companyId',
        [
            param('companyId').isString().notEmpty()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.getCompanyDetails(req, res, next))
    );

    router.put('/companies/:companyId',
        [
            param('companyId').isString().notEmpty(),
            body('industry').optional().isString(),
            body('companySize').optional().isString(),
            body('headquartersLocation').optional().isString(),
            body('websiteUrl').optional().isURL(),
            body('linkedinUrl').optional().isURL(),
            body('glassdoorUrl').optional().isURL(),
            body('description').optional().isString(),
            body('cultureValues').optional().isArray(),
            body('techStack').optional().isArray(),
            body('benefitsSummary').optional().isString(),
            body('ratingGlassdoor').optional().isFloat({ min: 0, max: 5 }),
            body('ratingIndeed').optional().isFloat({ min: 0, max: 5 }),
            body('logoUrl').optional().isURL()
        ],
        validate,
        ErrorHandler.asyncWrapper((req, res, next) => jobSearchController.updateCompany(req, res, next))
    );

    return router;
}

module.exports = createJobSearchRoutes;