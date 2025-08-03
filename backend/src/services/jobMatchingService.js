const { ulid } = require('ulid');
const logger = require('../utils/logger');

class JobMatchingService {
    constructor(database, profileService, experienceService) {
        this.database = database;
        this.profileService = profileService;
        this.experienceService = experienceService;
        
        // Matching weights
        this.weights = {
            skills: 0.40,
            experience: 0.25,
            culture: 0.15,
            location: 0.10,
            salary: 0.10
        };
    }

    /**
     * Calculate match scores for multiple jobs
     */
    async calculateMatchScores(userId, jobIds) {
        try {
            // Get user profile and preferences
            const profile = await this.profileService.getUserProfile(userId);
            const preferences = await this.getUserPreferences(userId);
            const userSkills = await this.getUserSkills(userId);
            const experiences = await this.experienceService.getUserExperiences(userId);

            const matchScores = [];

            for (const jobId of jobIds) {
                const job = await this.getJobData(jobId);
                if (!job) continue;

                const score = await this.calculateSingleJobMatch(
                    userId,
                    jobId,
                    job,
                    profile,
                    preferences,
                    userSkills,
                    experiences
                );

                matchScores.push(score);
            }

            return matchScores;
        } catch (error) {
            logger.error('Error calculating match scores:', error);
            throw error;
        }
    }

    /**
     * Calculate match score for a single job
     */
    async calculateSingleJobMatch(userId, jobId, job, profile, preferences, userSkills, experiences) {
        try {
            // Calculate individual component scores
            const skillsScore = this.calculateSkillsMatch(
                userSkills,
                job.required_skills || [],
                job.preferred_skills || []
            );

            const experienceScore = this.calculateExperienceMatch(
                experiences,
                job.experience_level,
                job.experience_years_min,
                job.experience_years_max,
                job.industry
            );

            const cultureScore = await this.calculateCultureFit(
                profile,
                preferences,
                job.company_id
            );

            const locationScore = this.calculateLocationMatch(
                preferences,
                job.location,
                job.is_remote,
                job.remote_type
            );

            const salaryScore = this.calculateSalaryMatch(
                preferences,
                job.salary_min,
                job.salary_max,
                job.salary_currency
            );

            // Calculate weighted overall score
            const overallScore = (
                this.weights.skills * skillsScore.score +
                this.weights.experience * experienceScore.score +
                this.weights.culture * cultureScore.score +
                this.weights.location * locationScore.score +
                this.weights.salary * salaryScore.score
            );

            // Compile match reasons and missing skills
            const matchReasons = [];
            const missingSkills = skillsScore.missingSkills;

            if (skillsScore.score >= 0.8) {
                matchReasons.push('Strong skills match');
            }
            if (experienceScore.score >= 0.8) {
                matchReasons.push('Excellent experience alignment');
            }
            if (locationScore.score >= 0.9) {
                matchReasons.push('Perfect location match');
            }
            if (salaryScore.score >= 0.8) {
                matchReasons.push('Salary expectations align well');
            }

            // Store the match score
            await this.storeMatchScore(userId, jobId, {
                overall_score: overallScore,
                skills_match_score: skillsScore.score,
                experience_match_score: experienceScore.score,
                culture_fit_score: cultureScore.score,
                location_match_score: locationScore.score,
                salary_match_score: salaryScore.score,
                match_reasons: matchReasons,
                missing_skills: missingSkills
            });

            return {
                jobId,
                overallScore,
                componentScores: {
                    skills: skillsScore,
                    experience: experienceScore,
                    culture: cultureScore,
                    location: locationScore,
                    salary: salaryScore
                },
                matchReasons,
                missingSkills
            };
        } catch (error) {
            logger.error('Error calculating single job match:', error);
            throw error;
        }
    }

    /**
     * Calculate skills match score
     */
    calculateSkillsMatch(userSkills, requiredSkills, preferredSkills) {
        const userSkillSet = new Set(userSkills.map(s => s.skill_name.toLowerCase()));
        const requiredSet = new Set(requiredSkills.map(s => s.toLowerCase()));
        const preferredSet = new Set(preferredSkills.map(s => s.toLowerCase()));

        // Calculate required skills coverage
        let requiredMatches = 0;
        const missingRequired = [];
        
        for (const skill of requiredSet) {
            if (userSkillSet.has(skill)) {
                requiredMatches++;
            } else {
                missingRequired.push(skill);
            }
        }

        // Calculate preferred skills coverage
        let preferredMatches = 0;
        for (const skill of preferredSet) {
            if (userSkillSet.has(skill)) {
                preferredMatches++;
            }
        }

        // Calculate scores
        const requiredCoverage = requiredSet.size > 0 ? 
            requiredMatches / requiredSet.size : 1.0;
        const preferredCoverage = preferredSet.size > 0 ? 
            preferredMatches / preferredSet.size : 0.0;

        // Weight required skills more heavily
        const score = (requiredCoverage * 0.7) + (preferredCoverage * 0.3);

        return {
            score: Math.min(score, 1.0),
            requiredCoverage,
            preferredCoverage,
            missingSkills: missingRequired,
            matchedRequired: requiredMatches,
            matchedPreferred: preferredMatches
        };
    }

    /**
     * Calculate experience match score
     */
    calculateExperienceMatch(experiences, targetLevel, minYears, maxYears, industry) {
        let score = 0;
        const factors = [];

        // Calculate total years of experience
        const totalYears = this.calculateTotalExperience(experiences);

        // Check years of experience range
        if (minYears || maxYears) {
            if (totalYears >= (minYears || 0) && totalYears <= (maxYears || 100)) {
                score += 0.4;
                factors.push('Years of experience matches');
            } else if (totalYears > (maxYears || 100)) {
                score += 0.3; // Overqualified is better than underqualified
                factors.push('Overqualified but experienced');
            } else {
                score += 0.1;
                factors.push('Below required experience');
            }
        } else {
            score += 0.4; // No specific requirement
        }

        // Check experience level
        const userLevel = this.determineExperienceLevel(totalYears, experiences);
        if (targetLevel) {
            const levelMatch = this.compareLevels(userLevel, targetLevel);
            score += levelMatch * 0.3;
            if (levelMatch >= 0.8) {
                factors.push('Experience level matches well');
            }
        } else {
            score += 0.3;
        }

        // Check industry experience
        if (industry) {
            const industryExp = experiences.filter(exp => 
                exp.industry && exp.industry.toLowerCase() === industry.toLowerCase()
            );
            
            if (industryExp.length > 0) {
                score += 0.3;
                factors.push('Has industry experience');
            } else {
                score += 0.1;
            }
        } else {
            score += 0.3;
        }

        return {
            score: Math.min(score, 1.0),
            totalYears,
            experienceLevel: userLevel,
            factors
        };
    }

    /**
     * Calculate culture fit score
     */
    async calculateCultureFit(profile, preferences, companyId) {
        try {
            if (!companyId) {
                return { score: 0.5, factors: ['No company data available'] };
            }

            const company = await this.getCompanyData(companyId);
            if (!company) {
                return { score: 0.5, factors: ['Company not found'] };
            }

            let score = 0.5; // Base score
            const factors = [];

            // Check company size preference
            if (preferences?.company_sizes && company.company_size) {
                if (preferences.company_sizes.includes(company.company_size)) {
                    score += 0.2;
                    factors.push('Company size matches preference');
                }
            }

            // Check industry alignment
            if (preferences?.industries && company.industry) {
                if (preferences.industries.includes(company.industry)) {
                    score += 0.2;
                    factors.push('Industry aligns with interests');
                }
            }

            // Check company ratings
            if (company.rating_glassdoor >= 4.0 || company.rating_indeed >= 4.0) {
                score += 0.1;
                factors.push('Highly rated company');
            }

            return {
                score: Math.min(score, 1.0),
                factors
            };
        } catch (error) {
            logger.error('Error calculating culture fit:', error);
            return { score: 0.5, factors: ['Error calculating culture fit'] };
        }
    }

    /**
     * Calculate location match score
     */
    calculateLocationMatch(preferences, jobLocation, isRemote, remoteType) {
        let score = 0;
        const factors = [];

        // Check remote preference
        if (isRemote === 'Y') {
            if (preferences?.remote_preference === 'only_remote') {
                score = 1.0;
                factors.push('Perfect remote match');
            } else if (preferences?.remote_preference === 'prefer_remote') {
                score = 0.9;
                factors.push('Remote work available');
            } else if (preferences?.remote_preference === 'open_to_remote') {
                score = 0.8;
                factors.push('Remote option available');
            } else {
                score = 0.6;
            }
        } else {
            // Not remote
            if (preferences?.remote_preference === 'only_remote') {
                score = 0.0;
                factors.push('Not remote (requirement not met)');
            } else if (preferences?.locations && jobLocation) {
                // Check location match
                const locationMatch = preferences.locations.some(loc => 
                    jobLocation.toLowerCase().includes(loc.toLowerCase())
                );
                
                if (locationMatch) {
                    score = 1.0;
                    factors.push('Location matches preference');
                } else {
                    score = 0.3;
                    factors.push('Location not in preferences');
                }
            } else {
                score = 0.5; // Neutral
            }
        }

        return {
            score,
            factors,
            isRemote: isRemote === 'Y',
            remoteType
        };
    }

    /**
     * Calculate salary match score
     */
    calculateSalaryMatch(preferences, jobSalaryMin, jobSalaryMax, currency) {
        if (!preferences?.salary_min_expected && !preferences?.salary_max_expected) {
            return { score: 0.5, factors: ['No salary preference set'] };
        }

        if (!jobSalaryMin && !jobSalaryMax) {
            return { score: 0.5, factors: ['No salary information available'] };
        }

        let score = 0;
        const factors = [];

        const userMin = preferences.salary_min_expected || 0;
        const userMax = preferences.salary_max_expected || Infinity;
        const jobMin = jobSalaryMin || 0;
        const jobMax = jobSalaryMax || Infinity;

        // Check if ranges overlap
        if (jobMax >= userMin && jobMin <= userMax) {
            // Calculate overlap percentage
            const overlapMin = Math.max(jobMin, userMin);
            const overlapMax = Math.min(jobMax, userMax);
            const overlapRange = overlapMax - overlapMin;
            const userRange = userMax - userMin || 1;
            const overlapPercentage = overlapRange / userRange;

            score = Math.min(overlapPercentage, 1.0);
            
            if (score >= 0.8) {
                factors.push('Excellent salary match');
            } else if (score >= 0.5) {
                factors.push('Good salary overlap');
            } else {
                factors.push('Some salary overlap');
            }
        } else if (jobMin > userMax) {
            score = 0.8; // Job pays more than expected
            factors.push('Salary exceeds expectations');
        } else {
            score = 0.2; // Job pays less
            factors.push('Salary below expectations');
        }

        return {
            score,
            factors,
            salaryRange: { min: jobMin, max: jobMax, currency }
        };
    }

    /**
     * Store match score in database
     */
    async storeMatchScore(userId, jobId, scoreData) {
        try {
            // Check if score already exists
            const checkSql = `
                SELECT match_id FROM pf_job_match_scores
                WHERE user_id = :userId AND job_id = :jobId
            `;

            const existing = await this.database.execute(checkSql, { userId, jobId });

            if (existing.rows.length > 0) {
                // Update existing score
                const updateSql = `
                    UPDATE pf_job_match_scores
                    SET 
                        overall_score = :overallScore,
                        skills_match_score = :skillsMatchScore,
                        experience_match_score = :experienceMatchScore,
                        culture_fit_score = :cultureFitScore,
                        location_match_score = :locationMatchScore,
                        salary_match_score = :salaryMatchScore,
                        match_reasons = :matchReasons,
                        missing_skills = :missingSkills,
                        created_at = CURRENT_TIMESTAMP
                    WHERE user_id = :userId AND job_id = :jobId
                `;

                await this.database.execute(updateSql, {
                    userId,
                    jobId,
                    overallScore: scoreData.overall_score,
                    skillsMatchScore: scoreData.skills_match_score,
                    experienceMatchScore: scoreData.experience_match_score,
                    cultureFitScore: scoreData.culture_fit_score,
                    locationMatchScore: scoreData.location_match_score,
                    salaryMatchScore: scoreData.salary_match_score,
                    matchReasons: JSON.stringify(scoreData.match_reasons),
                    missingSkills: JSON.stringify(scoreData.missing_skills)
                });
            } else {
                // Insert new score
                const matchId = ulid();
                const insertSql = `
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

                await this.database.execute(insertSql, {
                    matchId,
                    userId,
                    jobId,
                    overallScore: scoreData.overall_score,
                    skillsMatchScore: scoreData.skills_match_score,
                    experienceMatchScore: scoreData.experience_match_score,
                    cultureFitScore: scoreData.culture_fit_score,
                    locationMatchScore: scoreData.location_match_score,
                    salaryMatchScore: scoreData.salary_match_score,
                    matchReasons: JSON.stringify(scoreData.match_reasons),
                    missingSkills: JSON.stringify(scoreData.missing_skills)
                });
            }

            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error storing match score:', error);
            throw error;
        }
    }

    /**
     * Get match scores for user
     */
    async getUserMatchScores(userId, minScore = 0) {
        try {
            const sql = `
                SELECT 
                    m.*,
                    j.job_title,
                    j.company_name,
                    j.location,
                    j.salary_min,
                    j.salary_max,
                    j.is_remote
                FROM pf_job_match_scores m
                JOIN pf_job_listings j ON m.job_id = j.job_id
                WHERE m.user_id = :userId
                AND m.overall_score >= :minScore
                AND j.is_active = 'Y'
                ORDER BY m.overall_score DESC
            `;

            const result = await this.database.execute(sql, { userId, minScore });

            return result.rows.map(row => ({
                ...row,
                match_reasons: row.match_reasons ? JSON.parse(row.match_reasons) : [],
                missing_skills: row.missing_skills ? JSON.parse(row.missing_skills) : []
            }));
        } catch (error) {
            logger.error('Error getting user match scores:', error);
            throw error;
        }
    }

    // Helper methods

    async getUserPreferences(userId) {
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
    }

    async getUserSkills(userId) {
        const sql = `
            SELECT DISTINCT 
                s.skill_name,
                MAX(es.proficiency_level) as proficiency_level,
                MAX(es.years_of_experience) as years_of_experience
            FROM pf_experience_skills es
            JOIN pf_experiences_detailed ed ON es.experience_id = ed.experience_id
            JOIN pf_skills s ON es.skill_id = s.skill_id
            WHERE ed.user_id = :userId
            GROUP BY s.skill_name
            ORDER BY years_of_experience DESC
        `;

        const result = await this.database.execute(sql, { userId });
        return result.rows;
    }

    async getJobData(jobId) {
        const sql = `
            SELECT * FROM pf_job_listings
            WHERE job_id = :jobId
        `;

        const result = await this.database.execute(sql, { jobId });

        if (result.rows.length === 0) {
            return null;
        }

        const job = result.rows[0];
        return {
            ...job,
            required_skills: job.required_skills ? JSON.parse(job.required_skills) : [],
            preferred_skills: job.preferred_skills ? JSON.parse(job.preferred_skills) : [],
            benefits: job.benefits ? JSON.parse(job.benefits) : []
        };
    }

    async getCompanyData(companyId) {
        const sql = `
            SELECT * FROM pf_companies
            WHERE company_id = :companyId
        `;

        const result = await this.database.execute(sql, { companyId });

        if (result.rows.length === 0) {
            return null;
        }

        const company = result.rows[0];
        return {
            ...company,
            culture_values: company.culture_values ? JSON.parse(company.culture_values) : [],
            tech_stack: company.tech_stack ? JSON.parse(company.tech_stack) : []
        };
    }

    calculateTotalExperience(experiences) {
        const now = new Date();
        let totalMonths = 0;

        for (const exp of experiences) {
            const start = new Date(exp.start_date);
            const end = exp.end_date ? new Date(exp.end_date) : now;
            const months = (end - start) / (1000 * 60 * 60 * 24 * 30);
            totalMonths += months;
        }

        return Math.round(totalMonths / 12 * 10) / 10; // Years with 1 decimal
    }

    determineExperienceLevel(totalYears, experiences) {
        // Check for management experience
        const hasManagement = experiences.some(exp => 
            exp.role_title.toLowerCase().includes('manager') ||
            exp.role_title.toLowerCase().includes('director') ||
            exp.role_title.toLowerCase().includes('lead') ||
            exp.role_title.toLowerCase().includes('head')
        );

        if (totalYears < 2) {
            return 'entry';
        } else if (totalYears < 5) {
            return 'mid';
        } else if (totalYears < 10) {
            return hasManagement ? 'senior' : 'mid';
        } else {
            return hasManagement ? 'executive' : 'senior';
        }
    }

    compareLevels(userLevel, targetLevel) {
        const levels = ['entry', 'mid', 'senior', 'executive'];
        const userIndex = levels.indexOf(userLevel);
        const targetIndex = levels.indexOf(targetLevel);

        if (userIndex === targetIndex) {
            return 1.0; // Perfect match
        } else if (Math.abs(userIndex - targetIndex) === 1) {
            return 0.7; // Close match
        } else if (userIndex > targetIndex) {
            return 0.5; // Overqualified
        } else {
            return 0.3; // Underqualified
        }
    }
}

module.exports = JobMatchingService;