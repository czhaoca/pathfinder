const ApiResponse = require('../../utils/apiResponse');
const logger = require('../../utils/logger');

class JobSearchController {
    constructor(
        jobSearchService, 
        jobMatchingService, 
        applicationService, 
        interviewPrepService,
        companyService
    ) {
        this.jobSearchService = jobSearchService;
        this.jobMatchingService = jobMatchingService;
        this.applicationService = applicationService;
        this.interviewPrepService = interviewPrepService;
        this.companyService = companyService;
    }

    /**
     * Search job listings
     */
    async searchJobs(req, res, next) {
        try {
            const userId = req.user.userId;
            const searchParams = {
                query: req.query.q,
                location: req.query.location,
                remoteOnly: req.query.remoteOnly === 'true',
                experienceLevel: req.query.experienceLevel,
                jobType: req.query.jobType,
                salaryMin: req.query.salaryMin ? parseInt(req.query.salaryMin) : undefined,
                salaryMax: req.query.salaryMax ? parseInt(req.query.salaryMax) : undefined,
                skills: req.query.skills ? req.query.skills.split(',') : undefined,
                companies: req.query.companies ? req.query.companies.split(',') : undefined,
                industries: req.query.industries ? req.query.industries.split(',') : undefined,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const result = await this.jobSearchService.searchJobs(userId, searchParams);

            ApiResponse.success(res, result, 'Jobs retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get job details
     */
    async getJobDetails(req, res, next) {
        try {
            const { jobId } = req.params;
            const userId = req.user.userId;

            const job = await this.jobSearchService.getJobDetails(jobId, userId);

            ApiResponse.success(res, job, 'Job details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get recommended jobs
     */
    async getRecommendedJobs(req, res, next) {
        try {
            const userId = req.user.userId;
            const limit = req.query.limit ? parseInt(req.query.limit) : 20;

            const jobs = await this.jobSearchService.getRecommendedJobs(userId, limit);

            ApiResponse.success(res, jobs, 'Recommended jobs retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Calculate match scores for jobs
     */
    async calculateMatchScores(req, res, next) {
        try {
            const userId = req.user.userId;
            const { jobIds } = req.body;

            if (!Array.isArray(jobIds) || jobIds.length === 0) {
                return ApiResponse.error(res, 'Job IDs array is required', 400);
            }

            const scores = await this.jobMatchingService.calculateMatchScores(userId, jobIds);

            ApiResponse.success(res, scores, 'Match scores calculated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Import job from URL
     */
    async importJob(req, res, next) {
        try {
            const { url, source } = req.body;

            if (!url || !source) {
                return ApiResponse.error(res, 'URL and source are required', 400);
            }

            // This would typically scrape or use an API to get job data
            // For now, we'll return a placeholder
            const jobData = {
                job_title: req.body.jobTitle || 'Imported Job',
                company_name: req.body.companyName || 'Unknown Company',
                job_description: req.body.description || 'No description available',
                job_url: url
            };

            const jobId = await this.jobSearchService.importJob(jobData, source);

            ApiResponse.success(res, { jobId }, 'Job imported successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user job preferences
     */
    async getJobPreferences(req, res, next) {
        try {
            const userId = req.user.userId;

            const preferences = await this.jobSearchService.getUserPreferences(userId);

            ApiResponse.success(res, preferences || {}, 'Preferences retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update job preferences
     */
    async updateJobPreferences(req, res, next) {
        try {
            const userId = req.user.userId;
            const preferences = req.body;

            await this.jobSearchService.updateUserPreferences(userId, preferences);

            ApiResponse.success(res, null, 'Preferences updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Save job search
     */
    async saveSearch(req, res, next) {
        try {
            const userId = req.user.userId;
            const { searchName, criteria, notificationFrequency } = req.body;

            if (!searchName || !criteria) {
                return ApiResponse.error(res, 'Search name and criteria are required', 400);
            }

            const searchId = await this.jobSearchService.saveSearch(userId, {
                searchName,
                criteria,
                notificationFrequency
            });

            ApiResponse.success(res, { searchId }, 'Search saved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get saved searches
     */
    async getSavedSearches(req, res, next) {
        try {
            const userId = req.user.userId;

            const searches = await this.jobSearchService.getSavedSearches(userId);

            ApiResponse.success(res, searches, 'Saved searches retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete saved search
     */
    async deleteSavedSearch(req, res, next) {
        try {
            const userId = req.user.userId;
            const { searchId } = req.params;

            await this.jobSearchService.deleteSavedSearch(searchId, userId);

            ApiResponse.success(res, null, 'Search deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user applications
     */
    async getApplications(req, res, next) {
        try {
            const userId = req.user.userId;
            const filters = {
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                companyName: req.query.company,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const result = await this.applicationService.getUserApplications(userId, filters);

            ApiResponse.success(res, result, 'Applications retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get application details
     */
    async getApplicationDetails(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationId } = req.params;

            const application = await this.applicationService.getApplicationDetails(
                applicationId, 
                userId
            );

            ApiResponse.success(res, application, 'Application details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create application
     */
    async createApplication(req, res, next) {
        try {
            const userId = req.user.userId;
            const applicationData = req.body;

            const applicationId = await this.applicationService.createApplication(
                userId, 
                applicationData
            );

            ApiResponse.success(res, { applicationId }, 'Application created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update application
     */
    async updateApplication(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationId } = req.params;
            const updates = req.body;

            await this.applicationService.updateApplication(applicationId, userId, updates);

            ApiResponse.success(res, null, 'Application updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Withdraw application
     */
    async withdrawApplication(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationId } = req.params;
            const { reason } = req.body;

            await this.applicationService.withdrawApplication(applicationId, userId, reason);

            ApiResponse.success(res, null, 'Application withdrawn successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get application timeline
     */
    async getApplicationTimeline(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationId } = req.params;

            const timeline = await this.applicationService.getApplicationTimeline(
                applicationId, 
                userId
            );

            ApiResponse.success(res, timeline, 'Timeline retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get application statistics
     */
    async getApplicationStats(req, res, next) {
        try {
            const userId = req.user.userId;
            const timeframe = req.query.timeframe ? parseInt(req.query.timeframe) : 30;

            const stats = await this.applicationService.getApplicationStats(userId, timeframe);

            ApiResponse.success(res, stats, 'Statistics retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Bulk update application statuses
     */
    async bulkUpdateStatus(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationIds, newStatus, notes } = req.body;

            if (!applicationIds || !newStatus) {
                return ApiResponse.error(res, 'Application IDs and new status are required', 400);
            }

            const count = await this.applicationService.bulkUpdateStatus(
                userId,
                applicationIds,
                newStatus,
                notes
            );

            ApiResponse.success(res, { count }, 'Applications updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get interview questions
     */
    async getInterviewQuestions(req, res, next) {
        try {
            const filters = {
                companyId: req.query.companyId,
                roleCategory: req.query.roleCategory,
                questionType: req.query.questionType,
                difficultyLevel: req.query.difficulty,
                limit: req.query.limit ? parseInt(req.query.limit) : 20,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const questions = await this.interviewPrepService.getInterviewQuestions(filters);

            ApiResponse.success(res, questions, 'Questions retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get application interview prep
     */
    async getApplicationInterviewPrep(req, res, next) {
        try {
            const userId = req.user.userId;
            const { applicationId } = req.params;

            const prep = await this.interviewPrepService.getApplicationInterviewPrep(
                applicationId,
                userId
            );

            ApiResponse.success(res, prep, 'Interview prep retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Save interview response
     */
    async saveInterviewResponse(req, res, next) {
        try {
            const userId = req.user.userId;
            const responseData = req.body;

            const result = await this.interviewPrepService.saveInterviewResponse(
                userId,
                responseData
            );

            ApiResponse.success(res, result, 'Response saved successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update interview response
     */
    async updateInterviewResponse(req, res, next) {
        try {
            const userId = req.user.userId;
            const { responseId } = req.params;
            const updates = req.body;

            await this.interviewPrepService.updateInterviewResponse(
                responseId,
                userId,
                updates
            );

            ApiResponse.success(res, null, 'Response updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user interview responses
     */
    async getUserResponses(req, res, next) {
        try {
            const userId = req.user.userId;
            const filters = {
                prepId: req.query.prepId,
                interviewId: req.query.interviewId,
                needsImprovement: req.query.needsImprovement === 'true',
                limit: req.query.limit ? parseInt(req.query.limit) : 50,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };

            const responses = await this.interviewPrepService.getUserResponses(userId, filters);

            ApiResponse.success(res, responses, 'Responses retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add custom interview question
     */
    async addCustomQuestion(req, res, next) {
        try {
            const userId = req.user.userId;
            const questionData = req.body;

            const prepId = await this.interviewPrepService.addCustomQuestion(userId, questionData);

            ApiResponse.success(res, { prepId }, 'Question added successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get interview insights
     */
    async getInterviewInsights(req, res, next) {
        try {
            const userId = req.user.userId;

            const insights = await this.interviewPrepService.getInterviewInsights(userId);

            ApiResponse.success(res, insights, 'Insights retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get company details
     */
    async getCompanyDetails(req, res, next) {
        try {
            const { companyId } = req.params;

            const company = await this.companyService.getCompanyDetails(companyId);

            ApiResponse.success(res, company, 'Company details retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Search companies
     */
    async searchCompanies(req, res, next) {
        try {
            const { q: query, industry, size } = req.query;

            const companies = await this.companyService.searchCompanies({
                query,
                industry,
                size
            });

            ApiResponse.success(res, companies, 'Companies retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update company information
     */
    async updateCompany(req, res, next) {
        try {
            const { companyId } = req.params;
            const updates = req.body;

            await this.companyService.updateCompany(companyId, updates);

            ApiResponse.success(res, null, 'Company updated successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = JobSearchController;