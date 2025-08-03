const { ulid } = require('ulid');
const logger = require('../utils/logger');

class CompanyService {
    constructor(database) {
        this.database = database;
    }

    /**
     * Get company details
     */
    async getCompanyDetails(companyId) {
        try {
            const sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_job_listings j WHERE j.company_id = c.company_id AND j.is_active = 'Y') as active_job_count,
                    (SELECT COUNT(*) FROM pf_interview_prep p WHERE p.company_id = c.company_id) as interview_questions_count
                FROM pf_companies c
                WHERE c.company_id = :companyId
            `;

            const result = await this.database.execute(sql, { companyId });

            if (result.rows.length === 0) {
                throw new Error('Company not found');
            }

            const company = result.rows[0];
            return {
                ...company,
                culture_values: company.culture_values ? JSON.parse(company.culture_values) : [],
                tech_stack: company.tech_stack ? JSON.parse(company.tech_stack) : []
            };
        } catch (error) {
            logger.error('Error getting company details:', error);
            throw error;
        }
    }

    /**
     * Search companies
     */
    async searchCompanies(filters = {}) {
        try {
            const { query, industry, size, limit = 20 } = filters;

            let sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_job_listings j WHERE j.company_id = c.company_id AND j.is_active = 'Y') as active_job_count
                FROM pf_companies c
                WHERE 1=1
            `;

            const binds = {};
            const conditions = [];

            if (query) {
                conditions.push(`UPPER(c.company_name) LIKE UPPER(:query)`);
                binds.query = `%${query}%`;
            }

            if (industry) {
                conditions.push(`c.industry = :industry`);
                binds.industry = industry;
            }

            if (size) {
                conditions.push(`c.company_size = :size`);
                binds.size = size;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            sql += ` ORDER BY c.company_name ASC`;
            sql += ` FETCH FIRST :limit ROWS ONLY`;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows.map(company => ({
                ...company,
                culture_values: company.culture_values ? JSON.parse(company.culture_values) : [],
                tech_stack: company.tech_stack ? JSON.parse(company.tech_stack) : []
            }));
        } catch (error) {
            logger.error('Error searching companies:', error);
            throw error;
        }
    }

    /**
     * Create or update company
     */
    async upsertCompany(companyData) {
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
                // Update existing company
                return await this.updateCompany(existing.rows[0].company_id, companyData);
            } else {
                // Create new company
                return await this.createCompany(companyData);
            }
        } catch (error) {
            logger.error('Error upserting company:', error);
            throw error;
        }
    }

    /**
     * Create new company
     */
    async createCompany(companyData) {
        try {
            const companyId = ulid();

            const sql = `
                INSERT INTO pf_companies (
                    company_id, company_name, industry,
                    company_size, headquarters_location,
                    website_url, linkedin_url, glassdoor_url,
                    description, culture_values, tech_stack,
                    benefits_summary, rating_glassdoor,
                    rating_indeed, logo_url
                ) VALUES (
                    :companyId, :companyName, :industry,
                    :companySize, :headquartersLocation,
                    :websiteUrl, :linkedinUrl, :glassdoorUrl,
                    :description, :cultureValues, :techStack,
                    :benefitsSummary, :ratingGlassdoor,
                    :ratingIndeed, :logoUrl
                )
            `;

            await this.database.execute(sql, {
                companyId,
                companyName: companyData.company_name,
                industry: companyData.industry || null,
                companySize: companyData.company_size || null,
                headquartersLocation: companyData.headquarters_location || null,
                websiteUrl: companyData.website_url || null,
                linkedinUrl: companyData.linkedin_url || null,
                glassdoorUrl: companyData.glassdoor_url || null,
                description: companyData.description || null,
                cultureValues: companyData.culture_values ? JSON.stringify(companyData.culture_values) : null,
                techStack: companyData.tech_stack ? JSON.stringify(companyData.tech_stack) : null,
                benefitsSummary: companyData.benefits_summary || null,
                ratingGlassdoor: companyData.rating_glassdoor || null,
                ratingIndeed: companyData.rating_indeed || null,
                logoUrl: companyData.logo_url || null
            });

            await this.database.commit();
            return companyId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error creating company:', error);
            throw error;
        }
    }

    /**
     * Update company information
     */
    async updateCompany(companyId, updates) {
        try {
            const allowedFields = [
                'industry', 'company_size', 'headquarters_location',
                'website_url', 'linkedin_url', 'glassdoor_url',
                'description', 'culture_values', 'tech_stack',
                'benefits_summary', 'rating_glassdoor', 'rating_indeed',
                'logo_url'
            ];

            const updateFields = [];
            const binds = { companyId };

            for (const [key, value] of Object.entries(updates)) {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (allowedFields.includes(snakeKey)) {
                    updateFields.push(`${snakeKey} = :${snakeKey}`);
                    if (['culture_values', 'tech_stack'].includes(snakeKey)) {
                        binds[snakeKey] = value ? JSON.stringify(value) : null;
                    } else {
                        binds[snakeKey] = value;
                    }
                }
            }

            if (updateFields.length === 0) {
                return companyId;
            }

            const sql = `
                UPDATE pf_companies
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE company_id = :companyId
            `;

            await this.database.execute(sql, binds);
            await this.database.commit();

            return companyId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating company:', error);
            throw error;
        }
    }

    /**
     * Get company culture insights
     */
    async getCompanyCulture(companyId) {
        try {
            const sql = `
                SELECT 
                    c.company_name,
                    c.culture_values,
                    c.benefits_summary,
                    c.rating_glassdoor,
                    c.rating_indeed,
                    (
                        SELECT COUNT(DISTINCT p.question_text)
                        FROM pf_interview_prep p
                        WHERE p.company_id = c.company_id
                        AND p.question_type = 'behavioral'
                    ) as behavioral_questions_count
                FROM pf_companies c
                WHERE c.company_id = :companyId
            `;

            const result = await this.database.execute(sql, { companyId });

            if (result.rows.length === 0) {
                throw new Error('Company not found');
            }

            const company = result.rows[0];
            
            return {
                company_name: company.company_name,
                culture_values: company.culture_values ? JSON.parse(company.culture_values) : [],
                benefits_summary: company.benefits_summary,
                ratings: {
                    glassdoor: company.rating_glassdoor,
                    indeed: company.rating_indeed
                },
                behavioral_questions_count: company.behavioral_questions_count,
                culture_fit_indicators: this.generateCultureFitIndicators(company)
            };
        } catch (error) {
            logger.error('Error getting company culture:', error);
            throw error;
        }
    }

    /**
     * Get company interview insights
     */
    async getInterviewInsights(companyId) {
        try {
            const sql = `
                SELECT 
                    p.question_text,
                    p.question_type,
                    p.difficulty_level,
                    p.role_category,
                    p.tips,
                    p.times_asked
                FROM pf_interview_prep p
                WHERE p.company_id = :companyId
                ORDER BY p.times_asked DESC, p.created_at DESC
                FETCH FIRST 20 ROWS ONLY
            `;

            const result = await this.database.execute(sql, { companyId });

            // Group questions by type
            const questionsByType = {};
            for (const question of result.rows) {
                if (!questionsByType[question.question_type]) {
                    questionsByType[question.question_type] = [];
                }
                questionsByType[question.question_type].push(question);
            }

            // Get difficulty distribution
            const difficultyDistribution = {
                easy: 0,
                medium: 0,
                hard: 0
            };

            for (const question of result.rows) {
                if (question.difficulty_level) {
                    difficultyDistribution[question.difficulty_level]++;
                }
            }

            return {
                total_questions: result.rows.length,
                questions_by_type: questionsByType,
                difficulty_distribution: difficultyDistribution,
                most_common_questions: result.rows.slice(0, 5),
                interview_tips: this.generateInterviewTips(result.rows)
            };
        } catch (error) {
            logger.error('Error getting interview insights:', error);
            throw error;
        }
    }

    /**
     * Generate culture fit indicators
     */
    generateCultureFitIndicators(company) {
        const indicators = [];

        if (company.culture_values) {
            const values = JSON.parse(company.culture_values);
            if (values.length > 0) {
                indicators.push({
                    type: 'values',
                    description: `Company emphasizes ${values.slice(0, 3).join(', ')}`,
                    importance: 'high'
                });
            }
        }

        if (company.rating_glassdoor >= 4.0) {
            indicators.push({
                type: 'rating',
                description: 'Highly rated on Glassdoor (4.0+)',
                importance: 'medium'
            });
        }

        if (company.benefits_summary) {
            indicators.push({
                type: 'benefits',
                description: 'Comprehensive benefits package',
                importance: 'medium'
            });
        }

        return indicators;
    }

    /**
     * Generate interview tips based on questions
     */
    generateInterviewTips(questions) {
        const tips = [];

        // Check question types
        const hassTechnical = questions.some(q => q.question_type === 'technical');
        const hasBehavioral = questions.some(q => q.question_type === 'behavioral');

        if (hassTechnical) {
            tips.push('Prepare for technical questions - review fundamentals and practice coding');
        }

        if (hasBehavioral) {
            tips.push('Use STAR method for behavioral questions');
        }

        // Check difficulty
        const hardQuestions = questions.filter(q => q.difficulty_level === 'hard');
        if (hardQuestions.length > questions.length * 0.3) {
            tips.push('Expect challenging questions - practice thoroughly');
        }

        // Add general tips
        tips.push('Research recent company news and products');
        tips.push('Prepare questions to ask about the team and role');

        return tips;
    }

    /**
     * Delete company (admin only)
     */
    async deleteCompany(companyId) {
        try {
            // Check if company has active jobs
            const jobCheck = await this.database.execute(
                'SELECT COUNT(*) as count FROM pf_job_listings WHERE company_id = :companyId AND is_active = \'Y\'',
                { companyId }
            );

            if (jobCheck.rows[0].count > 0) {
                throw new Error('Cannot delete company with active job listings');
            }

            const sql = 'DELETE FROM pf_companies WHERE company_id = :companyId';
            const result = await this.database.execute(sql, { companyId });

            if (result.rowsAffected === 0) {
                throw new Error('Company not found');
            }

            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error deleting company:', error);
            throw error;
        }
    }
}

module.exports = CompanyService;