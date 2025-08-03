const { ulid } = require('ulid');
const logger = require('../utils/logger');

class JobSearchService {
    constructor(database, openaiService, profileService) {
        this.database = database;
        this.openaiService = openaiService;
        this.profileService = profileService;
    }

    /**
     * Search job listings with filters
     */
    async searchJobs(userId, searchParams = {}) {
        try {
            const {
                query,
                location,
                remoteOnly,
                experienceLevel,
                jobType,
                salaryMin,
                salaryMax,
                skills,
                companies,
                industries,
                sortBy = 'posting_date',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = searchParams;

            let sql = `
                SELECT 
                    j.*,
                    c.company_name AS company_name_full,
                    c.industry,
                    c.company_size,
                    c.rating_glassdoor,
                    c.rating_indeed,
                    c.logo_url,
                    COALESCE(m.overall_score, 0) AS match_score
                FROM pf_job_listings j
                LEFT JOIN pf_companies c ON j.company_id = c.company_id
                LEFT JOIN pf_job_match_scores m ON j.job_id = m.job_id AND m.user_id = :userId
                WHERE j.is_active = 'Y'
            `;

            const binds = { userId };
            const conditions = [];

            // Add search conditions
            if (query) {
                conditions.push(`(
                    UPPER(j.job_title) LIKE UPPER(:query) OR
                    UPPER(j.company_name) LIKE UPPER(:query) OR
                    UPPER(j.job_description) LIKE UPPER(:query)
                )`);
                binds.query = `%${query}%`;
            }

            if (location) {
                conditions.push(`UPPER(j.location) LIKE UPPER(:location)`);
                binds.location = `%${location}%`;
            }

            if (remoteOnly) {
                conditions.push(`j.is_remote = 'Y'`);
            }

            if (experienceLevel) {
                conditions.push(`j.experience_level = :experienceLevel`);
                binds.experienceLevel = experienceLevel;
            }

            if (jobType) {
                conditions.push(`j.job_type = :jobType`);
                binds.jobType = jobType;
            }

            if (salaryMin) {
                conditions.push(`j.salary_max >= :salaryMin`);
                binds.salaryMin = salaryMin;
            }

            if (salaryMax) {
                conditions.push(`j.salary_min <= :salaryMax`);
                binds.salaryMax = salaryMax;
            }

            if (companies && companies.length > 0) {
                const companyPlaceholders = companies.map((_, i) => `:company${i}`).join(',');
                conditions.push(`j.company_name IN (${companyPlaceholders})`);
                companies.forEach((company, i) => {
                    binds[`company${i}`] = company;
                });
            }

            if (industries && industries.length > 0) {
                const industryPlaceholders = industries.map((_, i) => `:industry${i}`).join(',');
                conditions.push(`c.industry IN (${industryPlaceholders})`);
                industries.forEach((industry, i) => {
                    binds[`industry${i}`] = industry;
                });
            }

            if (skills && skills.length > 0) {
                // Search for jobs matching any of the provided skills
                const skillConditions = skills.map((_, i) => `
                    JSON_EXISTS(j.required_skills, '$[*]?(@ == $skill${i})') OR
                    JSON_EXISTS(j.preferred_skills, '$[*]?(@ == $skill${i})')
                `).join(' OR ');
                conditions.push(`(${skillConditions})`);
                skills.forEach((skill, i) => {
                    binds[`skill${i}`] = skill;
                });
            }

            // Add conditions to SQL
            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['posting_date', 'salary_max', 'match_score', 'company_name'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'posting_date';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            // Add pagination
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            // Parse JSON fields
            const jobs = result.rows.map(job => ({
                ...job,
                required_skills: job.required_skills ? JSON.parse(job.required_skills) : [],
                preferred_skills: job.preferred_skills ? JSON.parse(job.preferred_skills) : [],
                benefits: job.benefits ? JSON.parse(job.benefits) : []
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
                jobs,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + jobs.length < total
                }
            };
        } catch (error) {
            logger.error('Error searching jobs:', error);
            throw error;
        }
    }

    /**
     * Get detailed job information
     */
    async getJobDetails(jobId, userId) {
        try {
            const sql = `
                SELECT 
                    j.*,
                    c.*,
                    m.overall_score,
                    m.skills_match_score,
                    m.experience_match_score,
                    m.culture_fit_score,
                    m.location_match_score,
                    m.salary_match_score,
                    m.match_reasons,
                    m.missing_skills
                FROM pf_job_listings j
                LEFT JOIN pf_companies c ON j.company_id = c.company_id
                LEFT JOIN pf_job_match_scores m ON j.job_id = m.job_id AND m.user_id = :userId
                WHERE j.job_id = :jobId
            `;

            const result = await this.database.execute(sql, { jobId, userId });

            if (result.rows.length === 0) {
                throw new Error('Job not found');
            }

            const job = result.rows[0];

            // Parse JSON fields
            return {
                ...job,
                required_skills: job.required_skills ? JSON.parse(job.required_skills) : [],
                preferred_skills: job.preferred_skills ? JSON.parse(job.preferred_skills) : [],
                benefits: job.benefits ? JSON.parse(job.benefits) : [],
                culture_values: job.culture_values ? JSON.parse(job.culture_values) : [],
                tech_stack: job.tech_stack ? JSON.parse(job.tech_stack) : [],
                match_reasons: job.match_reasons ? JSON.parse(job.match_reasons) : [],
                missing_skills: job.missing_skills ? JSON.parse(job.missing_skills) : []
            };
        } catch (error) {
            logger.error('Error getting job details:', error);
            throw error;
        }
    }

    /**
     * Get AI-recommended jobs for user
     */
    async getRecommendedJobs(userId, limit = 20) {
        try {
            // Get user preferences and profile
            const preferences = await this.getUserPreferences(userId);
            const profile = await this.profileService.getUserProfile(userId);

            // Build recommendation query
            const sql = `
                SELECT 
                    j.*,
                    c.company_name AS company_name_full,
                    c.industry,
                    c.rating_glassdoor,
                    c.logo_url,
                    m.overall_score
                FROM pf_job_listings j
                LEFT JOIN pf_companies c ON j.company_id = c.company_id
                LEFT JOIN pf_job_match_scores m ON j.job_id = m.job_id AND m.user_id = :userId
                WHERE j.is_active = 'Y'
                AND (
                    m.overall_score >= 0.7 OR
                    m.overall_score IS NULL
                )
                ORDER BY 
                    CASE WHEN m.overall_score IS NOT NULL THEN 0 ELSE 1 END,
                    m.overall_score DESC NULLS LAST,
                    j.posting_date DESC
                FETCH FIRST :limit ROWS ONLY
            `;

            const result = await this.database.execute(sql, { userId, limit });

            // Calculate match scores for jobs without scores
            const jobsWithoutScores = result.rows.filter(job => !job.overall_score);
            
            for (const job of jobsWithoutScores) {
                await this.calculateAndStoreMatchScore(userId, job.job_id, profile, preferences, job);
            }

            // Re-fetch with updated scores
            const updatedResult = await this.database.execute(sql, { userId, limit });

            return updatedResult.rows.map(job => ({
                ...job,
                required_skills: job.required_skills ? JSON.parse(job.required_skills) : [],
                preferred_skills: job.preferred_skills ? JSON.parse(job.preferred_skills) : [],
                benefits: job.benefits ? JSON.parse(job.benefits) : []
            }));
        } catch (error) {
            logger.error('Error getting recommended jobs:', error);
            throw error;
        }
    }

    /**
     * Import job from external source
     */
    async importJob(jobData, source) {
        try {
            const jobId = ulid();
            
            // Check if company exists or create
            let companyId = null;
            if (jobData.company_name) {
                companyId = await this.findOrCreateCompany({
                    company_name: jobData.company_name,
                    industry: jobData.industry,
                    website_url: jobData.company_website,
                    description: jobData.company_description
                });
            }

            const sql = `
                INSERT INTO pf_job_listings (
                    job_id, external_job_id, source, company_name, company_id,
                    job_title, job_description, requirements, responsibilities,
                    required_skills, preferred_skills, experience_level,
                    experience_years_min, experience_years_max, education_requirements,
                    job_type, location, is_remote, remote_type,
                    salary_min, salary_max, salary_currency, salary_period,
                    benefits, posting_date, application_deadline,
                    job_url, apply_url
                ) VALUES (
                    :jobId, :externalJobId, :source, :companyName, :companyId,
                    :jobTitle, :jobDescription, :requirements, :responsibilities,
                    :requiredSkills, :preferredSkills, :experienceLevel,
                    :experienceYearsMin, :experienceYearsMax, :educationRequirements,
                    :jobType, :location, :isRemote, :remoteType,
                    :salaryMin, :salaryMax, :salaryCurrency, :salaryPeriod,
                    :benefits, :postingDate, :applicationDeadline,
                    :jobUrl, :applyUrl
                )
            `;

            await this.database.execute(sql, {
                jobId,
                externalJobId: jobData.external_job_id || null,
                source,
                companyName: jobData.company_name,
                companyId,
                jobTitle: jobData.job_title,
                jobDescription: jobData.job_description,
                requirements: jobData.requirements || null,
                responsibilities: jobData.responsibilities || null,
                requiredSkills: JSON.stringify(jobData.required_skills || []),
                preferredSkills: JSON.stringify(jobData.preferred_skills || []),
                experienceLevel: jobData.experience_level || null,
                experienceYearsMin: jobData.experience_years_min || null,
                experienceYearsMax: jobData.experience_years_max || null,
                educationRequirements: jobData.education_requirements || null,
                jobType: jobData.job_type || 'full-time',
                location: jobData.location || null,
                isRemote: jobData.is_remote ? 'Y' : 'N',
                remoteType: jobData.remote_type || null,
                salaryMin: jobData.salary_min || null,
                salaryMax: jobData.salary_max || null,
                salaryCurrency: jobData.salary_currency || 'USD',
                salaryPeriod: jobData.salary_period || 'yearly',
                benefits: JSON.stringify(jobData.benefits || []),
                postingDate: jobData.posting_date || new Date(),
                applicationDeadline: jobData.application_deadline || null,
                jobUrl: jobData.job_url || null,
                applyUrl: jobData.apply_url || null
            });

            await this.database.commit();
            return jobId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error importing job:', error);
            throw error;
        }
    }

    /**
     * Update job listing
     */
    async updateJob(jobId, updates) {
        try {
            const allowedFields = [
                'job_title', 'job_description', 'requirements', 'responsibilities',
                'required_skills', 'preferred_skills', 'experience_level',
                'experience_years_min', 'experience_years_max', 'education_requirements',
                'job_type', 'location', 'is_remote', 'remote_type',
                'salary_min', 'salary_max', 'salary_currency', 'salary_period',
                'benefits', 'application_deadline', 'is_active'
            ];

            const updateFields = [];
            const binds = { jobId };

            for (const [key, value] of Object.entries(updates)) {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (allowedFields.includes(snakeKey)) {
                    updateFields.push(`${snakeKey} = :${snakeKey}`);
                    if (['required_skills', 'preferred_skills', 'benefits'].includes(snakeKey)) {
                        binds[snakeKey] = JSON.stringify(value);
                    } else {
                        binds[snakeKey] = value;
                    }
                }
            }

            if (updateFields.length === 0) {
                return;
            }

            const sql = `
                UPDATE pf_job_listings
                SET ${updateFields.join(', ')}, last_updated = CURRENT_TIMESTAMP
                WHERE job_id = :jobId
            `;

            await this.database.execute(sql, binds);
            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating job:', error);
            throw error;
        }
    }

    /**
     * Deactivate old job listings
     */
    async deactivateOldJobs(daysOld = 90) {
        try {
            const sql = `
                UPDATE pf_job_listings
                SET is_active = 'N', last_updated = CURRENT_TIMESTAMP
                WHERE is_active = 'Y'
                AND posting_date < CURRENT_DATE - INTERVAL '${daysOld}' DAY
            `;

            const result = await this.database.execute(sql);
            await this.database.commit();
            
            return result.rowsAffected;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error deactivating old jobs:', error);
            throw error;
        }
    }

    /**
     * Get user job search preferences
     */
    async getUserPreferences(userId) {
        try {
            const sql = `
                SELECT * FROM pf_job_search_preferences
                WHERE user_id = :userId
            `;

            const result = await this.database.execute(sql, { userId });

            if (result.rows.length === 0) {
                return null;
            }

            const prefs = result.rows[0];
            return {
                ...prefs,
                target_roles: prefs.target_roles ? JSON.parse(prefs.target_roles) : [],
                target_companies: prefs.target_companies ? JSON.parse(prefs.target_companies) : [],
                industries: prefs.industries ? JSON.parse(prefs.industries) : [],
                locations: prefs.locations ? JSON.parse(prefs.locations) : [],
                job_types: prefs.job_types ? JSON.parse(prefs.job_types) : [],
                company_sizes: prefs.company_sizes ? JSON.parse(prefs.company_sizes) : [],
                must_have_benefits: prefs.must_have_benefits ? JSON.parse(prefs.must_have_benefits) : [],
                deal_breakers: prefs.deal_breakers ? JSON.parse(prefs.deal_breakers) : []
            };
        } catch (error) {
            logger.error('Error getting user preferences:', error);
            throw error;
        }
    }

    /**
     * Update user job search preferences
     */
    async updateUserPreferences(userId, preferences) {
        try {
            const existing = await this.getUserPreferences(userId);
            
            if (existing) {
                // Update existing preferences
                const sql = `
                    UPDATE pf_job_search_preferences
                    SET 
                        target_roles = :targetRoles,
                        target_companies = :targetCompanies,
                        industries = :industries,
                        locations = :locations,
                        remote_preference = :remotePreference,
                        salary_min_expected = :salaryMinExpected,
                        salary_max_expected = :salaryMaxExpected,
                        job_types = :jobTypes,
                        company_sizes = :companySizes,
                        must_have_benefits = :mustHaveBenefits,
                        deal_breakers = :dealBreakers,
                        search_status = :searchStatus,
                        urgency_level = :urgencyLevel,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = :userId
                `;

                await this.database.execute(sql, {
                    userId,
                    targetRoles: JSON.stringify(preferences.targetRoles || []),
                    targetCompanies: JSON.stringify(preferences.targetCompanies || []),
                    industries: JSON.stringify(preferences.industries || []),
                    locations: JSON.stringify(preferences.locations || []),
                    remotePreference: preferences.remotePreference || 'open_to_remote',
                    salaryMinExpected: preferences.salaryMinExpected || null,
                    salaryMaxExpected: preferences.salaryMaxExpected || null,
                    jobTypes: JSON.stringify(preferences.jobTypes || []),
                    companySizes: JSON.stringify(preferences.companySizes || []),
                    mustHaveBenefits: JSON.stringify(preferences.mustHaveBenefits || []),
                    dealBreakers: JSON.stringify(preferences.dealBreakers || []),
                    searchStatus: preferences.searchStatus || 'passive',
                    urgencyLevel: preferences.urgencyLevel || 'exploring'
                });
            } else {
                // Create new preferences
                const preferenceId = ulid();
                const sql = `
                    INSERT INTO pf_job_search_preferences (
                        preference_id, user_id, target_roles, target_companies,
                        industries, locations, remote_preference,
                        salary_min_expected, salary_max_expected,
                        job_types, company_sizes, must_have_benefits,
                        deal_breakers, search_status, urgency_level
                    ) VALUES (
                        :preferenceId, :userId, :targetRoles, :targetCompanies,
                        :industries, :locations, :remotePreference,
                        :salaryMinExpected, :salaryMaxExpected,
                        :jobTypes, :companySizes, :mustHaveBenefits,
                        :dealBreakers, :searchStatus, :urgencyLevel
                    )
                `;

                await this.database.execute(sql, {
                    preferenceId,
                    userId,
                    targetRoles: JSON.stringify(preferences.targetRoles || []),
                    targetCompanies: JSON.stringify(preferences.targetCompanies || []),
                    industries: JSON.stringify(preferences.industries || []),
                    locations: JSON.stringify(preferences.locations || []),
                    remotePreference: preferences.remotePreference || 'open_to_remote',
                    salaryMinExpected: preferences.salaryMinExpected || null,
                    salaryMaxExpected: preferences.salaryMaxExpected || null,
                    jobTypes: JSON.stringify(preferences.jobTypes || []),
                    companySizes: JSON.stringify(preferences.companySizes || []),
                    mustHaveBenefits: JSON.stringify(preferences.mustHaveBenefits || []),
                    dealBreakers: JSON.stringify(preferences.dealBreakers || []),
                    searchStatus: preferences.searchStatus || 'passive',
                    urgencyLevel: preferences.urgencyLevel || 'exploring'
                });
            }

            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating user preferences:', error);
            throw error;
        }
    }

    /**
     * Save job search
     */
    async saveSearch(userId, searchData) {
        try {
            const searchId = ulid();
            
            const sql = `
                INSERT INTO pf_saved_searches (
                    search_id, user_id, search_name,
                    search_criteria, notification_frequency
                ) VALUES (
                    :searchId, :userId, :searchName,
                    :searchCriteria, :notificationFrequency
                )
            `;

            await this.database.execute(sql, {
                searchId,
                userId,
                searchName: searchData.searchName,
                searchCriteria: JSON.stringify(searchData.criteria),
                notificationFrequency: searchData.notificationFrequency || 'weekly'
            });

            await this.database.commit();
            return searchId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error saving search:', error);
            throw error;
        }
    }

    /**
     * Get saved searches
     */
    async getSavedSearches(userId) {
        try {
            const sql = `
                SELECT * FROM pf_saved_searches
                WHERE user_id = :userId
                AND is_active = 'Y'
                ORDER BY created_at DESC
            `;

            const result = await this.database.execute(sql, { userId });

            return result.rows.map(search => ({
                ...search,
                search_criteria: JSON.parse(search.search_criteria)
            }));
        } catch (error) {
            logger.error('Error getting saved searches:', error);
            throw error;
        }
    }

    /**
     * Find or create company
     */
    async findOrCreateCompany(companyData) {
        try {
            // Check if company exists
            const checkSql = `
                SELECT company_id FROM pf_companies
                WHERE UPPER(company_name) = UPPER(:companyName)
            `;

            const existing = await this.database.execute(checkSql, {
                companyName: companyData.company_name
            });

            if (existing.rows.length > 0) {
                return existing.rows[0].company_id;
            }

            // Create new company
            const companyId = ulid();
            const createSql = `
                INSERT INTO pf_companies (
                    company_id, company_name, industry,
                    website_url, description
                ) VALUES (
                    :companyId, :companyName, :industry,
                    :websiteUrl, :description
                )
            `;

            await this.database.execute(createSql, {
                companyId,
                companyName: companyData.company_name,
                industry: companyData.industry || null,
                websiteUrl: companyData.website_url || null,
                description: companyData.description || null
            });

            return companyId;
        } catch (error) {
            logger.error('Error finding/creating company:', error);
            throw error;
        }
    }

    /**
     * Calculate and store match score for a job
     */
    async calculateAndStoreMatchScore(userId, jobId, profile, preferences, jobData) {
        try {
            // This is a placeholder - in a real implementation, you would use
            // the jobMatchingService to calculate the score
            const matchScore = {
                overall_score: 0.75,
                skills_match_score: 0.80,
                experience_match_score: 0.70,
                culture_fit_score: 0.65,
                location_match_score: 0.85,
                salary_match_score: 0.75,
                match_reasons: ['Strong skills match', 'Good location fit'],
                missing_skills: []
            };

            const matchId = ulid();
            const sql = `
                INSERT INTO pf_job_match_scores (
                    match_id, user_id, job_id,
                    overall_score, skills_match_score,
                    experience_match_score, culture_fit_score,
                    location_match_score, salary_match_score,
                    match_reasons, missing_skills
                ) VALUES (
                    :matchId, :userId, :jobId,
                    :overallScore, :skillsMatchScore,
                    :experienceMatchScore, :cultureFitScore,
                    :locationMatchScore, :salaryMatchScore,
                    :matchReasons, :missingSkills
                )
            `;

            await this.database.execute(sql, {
                matchId,
                userId,
                jobId,
                overallScore: matchScore.overall_score,
                skillsMatchScore: matchScore.skills_match_score,
                experienceMatchScore: matchScore.experience_match_score,
                cultureFitScore: matchScore.culture_fit_score,
                locationMatchScore: matchScore.location_match_score,
                salaryMatchScore: matchScore.salary_match_score,
                matchReasons: JSON.stringify(matchScore.match_reasons),
                missingSkills: JSON.stringify(matchScore.missing_skills)
            });

            return matchScore;
        } catch (error) {
            logger.error('Error calculating match score:', error);
            throw error;
        }
    }
}

module.exports = JobSearchService;