const express = require('express');
const { body, query, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

const router = express.Router();

module.exports = (container) => {
    const jobSearchController = container.resolve('jobSearchController');

    // Apply authentication to all routes
    router.use(authenticate);

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
        jobSearchController.searchJobs.bind(jobSearchController)
    );

    router.get('/jobs/recommended',
        [
            query('limit').optional().isInt({ min: 1, max: 50 })
        ],
        validate,
        jobSearchController.getRecommendedJobs.bind(jobSearchController)
    );

    router.get('/jobs/:jobId',
        [
            param('jobId').isString().notEmpty()
        ],
        validate,
        jobSearchController.getJobDetails.bind(jobSearchController)
    );

    router.post('/jobs/match-scores',
        [
            body('jobIds').isArray().notEmpty(),
            body('jobIds.*').isString()
        ],
        validate,
        jobSearchController.calculateMatchScores.bind(jobSearchController)
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
        jobSearchController.importJob.bind(jobSearchController)
    );

    // Job Preferences Routes
    router.get('/job-preferences',
        jobSearchController.getJobPreferences.bind(jobSearchController)
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
        jobSearchController.updateJobPreferences.bind(jobSearchController)
    );

    // Saved Searches Routes
    router.post('/saved-searches',
        [
            body('searchName').isString().notEmpty().trim(),
            body('criteria').isObject().notEmpty(),
            body('notificationFrequency').optional().isIn(['daily', 'weekly', 'instant'])
        ],
        validate,
        jobSearchController.saveSearch.bind(jobSearchController)
    );

    router.get('/saved-searches',
        jobSearchController.getSavedSearches.bind(jobSearchController)
    );

    router.delete('/saved-searches/:searchId',
        [
            param('searchId').isString().notEmpty()
        ],
        validate,
        jobSearchController.deleteSavedSearch.bind(jobSearchController)
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
        jobSearchController.getApplications.bind(jobSearchController)
    );

    router.get('/applications/:applicationId',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        jobSearchController.getApplicationDetails.bind(jobSearchController)
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
        jobSearchController.createApplication.bind(jobSearchController)
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
        jobSearchController.updateApplication.bind(jobSearchController)
    );

    router.delete('/applications/:applicationId',
        [
            param('applicationId').isString().notEmpty(),
            body('reason').optional().isString()
        ],
        validate,
        jobSearchController.withdrawApplication.bind(jobSearchController)
    );

    router.get('/applications/:applicationId/timeline',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        jobSearchController.getApplicationTimeline.bind(jobSearchController)
    );

    router.get('/applications/stats',
        [
            query('timeframe').optional().isInt({ min: 1, max: 365 })
        ],
        validate,
        jobSearchController.getApplicationStats.bind(jobSearchController)
    );

    router.post('/applications/bulk-update',
        [
            body('applicationIds').isArray().notEmpty(),
            body('applicationIds.*').isString(),
            body('newStatus').isIn(['interested', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn']),
            body('notes').optional().isString()
        ],
        validate,
        jobSearchController.bulkUpdateStatus.bind(jobSearchController)
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
        jobSearchController.getInterviewQuestions.bind(jobSearchController)
    );

    router.get('/interview-prep/application/:applicationId',
        [
            param('applicationId').isString().notEmpty()
        ],
        validate,
        jobSearchController.getApplicationInterviewPrep.bind(jobSearchController)
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
        jobSearchController.saveInterviewResponse.bind(jobSearchController)
    );

    router.put('/interview-prep/responses/:responseId',
        [
            param('responseId').isString().notEmpty(),
            body('responseText').optional().isString(),
            body('selfRating').optional().isInt({ min: 1, max: 5 }),
            body('needsImprovement').optional().isBoolean()
        ],
        validate,
        jobSearchController.updateInterviewResponse.bind(jobSearchController)
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
        jobSearchController.getUserResponses.bind(jobSearchController)
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
        jobSearchController.addCustomQuestion.bind(jobSearchController)
    );

    router.get('/interview-prep/insights',
        jobSearchController.getInterviewInsights.bind(jobSearchController)
    );

    // Company Routes
    router.get('/companies/search',
        [
            query('q').optional().isString().trim(),
            query('industry').optional().isString(),
            query('size').optional().isString()
        ],
        validate,
        jobSearchController.searchCompanies.bind(jobSearchController)
    );

    router.get('/companies/:companyId',
        [
            param('companyId').isString().notEmpty()
        ],
        validate,
        jobSearchController.getCompanyDetails.bind(jobSearchController)
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
        jobSearchController.updateCompany.bind(jobSearchController)
    );

    return router;
};