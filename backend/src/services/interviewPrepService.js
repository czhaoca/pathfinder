const { ulid } = require('ulid');
const logger = require('../utils/logger');

class InterviewPrepService {
    constructor(database, openaiService, profileService) {
        this.database = database;
        this.openaiService = openaiService;
        this.profileService = profileService;
    }

    /**
     * Get interview questions for a company/role
     */
    async getInterviewQuestions(filters = {}) {
        try {
            const {
                companyId,
                roleCategory,
                questionType,
                difficultyLevel,
                limit = 20,
                offset = 0
            } = filters;

            let sql = `
                SELECT 
                    p.*,
                    c.company_name,
                    c.industry,
                    (SELECT COUNT(*) FROM pf_interview_responses r WHERE r.prep_id = p.prep_id) as response_count
                FROM pf_interview_prep p
                LEFT JOIN pf_companies c ON p.company_id = c.company_id
                WHERE 1=1
            `;

            const binds = {};
            const conditions = [];

            if (companyId) {
                conditions.push(`p.company_id = :companyId`);
                binds.companyId = companyId;
            }

            if (roleCategory) {
                conditions.push(`p.role_category = :roleCategory`);
                binds.roleCategory = roleCategory;
            }

            if (questionType) {
                conditions.push(`p.question_type = :questionType`);
                binds.questionType = questionType;
            }

            if (difficultyLevel) {
                conditions.push(`p.difficulty_level = :difficultyLevel`);
                binds.difficultyLevel = difficultyLevel;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            sql += ` ORDER BY p.times_asked DESC, p.created_at DESC`;
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

            binds.offset = offset;
            binds.limit = Math.min(limit, 50);

            const result = await this.database.execute(sql, binds);

            return result.rows;
        } catch (error) {
            logger.error('Error getting interview questions:', error);
            throw error;
        }
    }

    /**
     * Get interview prep for specific application
     */
    async getApplicationInterviewPrep(applicationId, userId) {
        try {
            // Get application details
            const appSql = `
                SELECT 
                    a.job_id,
                    j.job_title,
                    j.company_id,
                    j.company_name,
                    j.required_skills,
                    j.job_description,
                    c.industry,
                    c.culture_values
                FROM pf_job_applications a
                JOIN pf_job_listings j ON a.job_id = j.job_id
                LEFT JOIN pf_companies c ON j.company_id = c.company_id
                WHERE a.application_id = :applicationId
                AND a.user_id = :userId
            `;

            const appResult = await this.database.execute(appSql, { applicationId, userId });

            if (appResult.rows.length === 0) {
                throw new Error('Application not found');
            }

            const application = appResult.rows[0];
            application.required_skills = application.required_skills ? 
                JSON.parse(application.required_skills) : [];
            application.culture_values = application.culture_values ?
                JSON.parse(application.culture_values) : [];

            // Get role category from job title
            const roleCategory = this.inferRoleCategory(application.job_title);

            // Get company-specific questions
            const companyQuestions = await this.getInterviewQuestions({
                companyId: application.company_id,
                limit: 10
            });

            // Get role-specific questions
            const roleQuestions = await this.getInterviewQuestions({
                roleCategory,
                limit: 10
            });

            // Get general behavioral questions
            const behavioralQuestions = await this.getInterviewQuestions({
                questionType: 'behavioral',
                limit: 5
            });

            // Generate personalized questions using AI
            const personalizedQuestions = await this.generatePersonalizedQuestions(
                application,
                userId
            );

            return {
                application: {
                    job_title: application.job_title,
                    company_name: application.company_name,
                    industry: application.industry
                },
                questions: {
                    company_specific: companyQuestions,
                    role_specific: roleQuestions,
                    behavioral: behavioralQuestions,
                    personalized: personalizedQuestions
                },
                tips: this.getInterviewTips(application),
                preparation_checklist: this.getPreparationChecklist()
            };
        } catch (error) {
            logger.error('Error getting application interview prep:', error);
            throw error;
        }
    }

    /**
     * Save user's response to interview question
     */
    async saveInterviewResponse(userId, responseData) {
        try {
            const responseId = ulid();

            const sql = `
                INSERT INTO pf_interview_responses (
                    response_id, user_id, prep_id,
                    interview_id, response_text,
                    self_rating, needs_improvement
                ) VALUES (
                    :responseId, :userId, :prepId,
                    :interviewId, :responseText,
                    :selfRating, :needsImprovement
                )
            `;

            await this.database.execute(sql, {
                responseId,
                userId,
                prepId: responseData.prepId,
                interviewId: responseData.interviewId || null,
                responseText: responseData.responseText,
                selfRating: responseData.selfRating || null,
                needsImprovement: responseData.needsImprovement ? 'Y' : 'N'
            });

            await this.database.commit();

            // Get AI feedback if requested
            if (responseData.requestFeedback) {
                const feedback = await this.getResponseFeedback(
                    responseData.prepId,
                    responseData.responseText,
                    userId
                );
                return { responseId, feedback };
            }

            return { responseId };
        } catch (error) {
            await this.database.rollback();
            logger.error('Error saving interview response:', error);
            throw error;
        }
    }

    /**
     * Update interview response
     */
    async updateInterviewResponse(responseId, userId, updates) {
        try {
            const allowedFields = ['response_text', 'self_rating', 'needs_improvement'];
            const updateFields = [];
            const binds = { responseId, userId };

            for (const [key, value] of Object.entries(updates)) {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (allowedFields.includes(snakeKey)) {
                    updateFields.push(`${snakeKey} = :${snakeKey}`);
                    if (snakeKey === 'needs_improvement') {
                        binds[snakeKey] = value ? 'Y' : 'N';
                    } else {
                        binds[snakeKey] = value;
                    }
                }
            }

            if (updateFields.length === 0) {
                return;
            }

            const sql = `
                UPDATE pf_interview_responses
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE response_id = :responseId AND user_id = :userId
            `;

            await this.database.execute(sql, binds);
            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating interview response:', error);
            throw error;
        }
    }

    /**
     * Get user's interview responses
     */
    async getUserResponses(userId, filters = {}) {
        try {
            const { prepId, interviewId, needsImprovement, limit = 50, offset = 0 } = filters;

            let sql = `
                SELECT 
                    r.*,
                    p.question_text,
                    p.question_type,
                    p.difficulty_level,
                    p.role_category,
                    c.company_name
                FROM pf_interview_responses r
                JOIN pf_interview_prep p ON r.prep_id = p.prep_id
                LEFT JOIN pf_companies c ON p.company_id = c.company_id
                WHERE r.user_id = :userId
            `;

            const binds = { userId };
            const conditions = [];

            if (prepId) {
                conditions.push(`r.prep_id = :prepId`);
                binds.prepId = prepId;
            }

            if (interviewId) {
                conditions.push(`r.interview_id = :interviewId`);
                binds.interviewId = interviewId;
            }

            if (needsImprovement !== undefined) {
                conditions.push(`r.needs_improvement = :needsImprovement`);
                binds.needsImprovement = needsImprovement ? 'Y' : 'N';
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            sql += ` ORDER BY r.updated_at DESC`;
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows;
        } catch (error) {
            logger.error('Error getting user responses:', error);
            throw error;
        }
    }

    /**
     * Add custom interview question
     */
    async addCustomQuestion(userId, questionData) {
        try {
            const prepId = ulid();

            const sql = `
                INSERT INTO pf_interview_prep (
                    prep_id, company_id, role_category,
                    question_text, question_type,
                    difficulty_level, sample_answer,
                    answer_framework, tips, source
                ) VALUES (
                    :prepId, :companyId, :roleCategory,
                    :questionText, :questionType,
                    :difficultyLevel, :sampleAnswer,
                    :answerFramework, :tips, :source
                )
            `;

            await this.database.execute(sql, {
                prepId,
                companyId: questionData.companyId || null,
                roleCategory: questionData.roleCategory || 'general',
                questionText: questionData.questionText,
                questionType: questionData.questionType || 'behavioral',
                difficultyLevel: questionData.difficultyLevel || 'medium',
                sampleAnswer: questionData.sampleAnswer || null,
                answerFramework: questionData.answerFramework || 'STAR',
                tips: questionData.tips || null,
                source: 'user_submitted'
            });

            await this.database.commit();

            logger.info(`User ${userId} added custom interview question`);

            return prepId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error adding custom question:', error);
            throw error;
        }
    }

    /**
     * Get interview insights and analytics
     */
    async getInterviewInsights(userId) {
        try {
            // Get response statistics
            const statsSql = `
                SELECT 
                    COUNT(*) as total_responses,
                    AVG(self_rating) as avg_rating,
                    COUNT(CASE WHEN needs_improvement = 'Y' THEN 1 END) as needs_improvement_count,
                    COUNT(DISTINCT prep_id) as unique_questions_practiced
                FROM pf_interview_responses
                WHERE user_id = :userId
            `;

            const statsResult = await this.database.execute(statsSql, { userId });
            const stats = statsResult.rows[0];

            // Get question type breakdown
            const typesSql = `
                SELECT 
                    p.question_type,
                    COUNT(r.response_id) as response_count,
                    AVG(r.self_rating) as avg_rating
                FROM pf_interview_responses r
                JOIN pf_interview_prep p ON r.prep_id = p.prep_id
                WHERE r.user_id = :userId
                GROUP BY p.question_type
            `;

            const typesResult = await this.database.execute(typesSql, { userId });

            // Get most practiced companies
            const companiesSql = `
                SELECT 
                    c.company_name,
                    COUNT(r.response_id) as practice_count
                FROM pf_interview_responses r
                JOIN pf_interview_prep p ON r.prep_id = p.prep_id
                JOIN pf_companies c ON p.company_id = c.company_id
                WHERE r.user_id = :userId
                GROUP BY c.company_name
                ORDER BY practice_count DESC
                FETCH FIRST 5 ROWS ONLY
            `;

            const companiesResult = await this.database.execute(companiesSql, { userId });

            // Get improvement areas
            const improvementSql = `
                SELECT 
                    p.question_type,
                    p.question_text,
                    r.self_rating
                FROM pf_interview_responses r
                JOIN pf_interview_prep p ON r.prep_id = p.prep_id
                WHERE r.user_id = :userId
                AND r.needs_improvement = 'Y'
                ORDER BY r.updated_at DESC
                FETCH FIRST 10 ROWS ONLY
            `;

            const improvementResult = await this.database.execute(improvementSql, { userId });

            return {
                overall_stats: {
                    total_responses: parseInt(stats.total_responses),
                    avg_rating: parseFloat(stats.avg_rating) || 0,
                    needs_improvement_count: parseInt(stats.needs_improvement_count),
                    unique_questions_practiced: parseInt(stats.unique_questions_practiced)
                },
                by_question_type: typesResult.rows,
                most_practiced_companies: companiesResult.rows,
                improvement_areas: improvementResult.rows,
                recommendations: await this.getImprovementRecommendations(userId, stats, typesResult.rows)
            };
        } catch (error) {
            logger.error('Error getting interview insights:', error);
            throw error;
        }
    }

    /**
     * Generate personalized interview questions using AI
     */
    async generatePersonalizedQuestions(application, userId) {
        try {
            const profile = await this.profileService.getUserProfile(userId);
            
            const prompt = `Generate 5 personalized interview questions for a ${application.job_title} position at ${application.company_name}.
                Company industry: ${application.industry}
                Required skills: ${application.required_skills.join(', ')}
                
                Create questions that:
                1. Test specific technical skills relevant to the role
                2. Assess cultural fit with the company
                3. Explore past experiences relevant to this position
                4. Challenge the candidate appropriately
                5. Allow the candidate to showcase their strengths
                
                Format each question as JSON with fields: question_text, question_type (technical/behavioral/situational), difficulty_level (easy/medium/hard), and tips.`;

            const response = await this.openaiService.generateResponse(prompt);
            
            // Parse and validate AI response
            try {
                const questions = JSON.parse(response);
                return Array.isArray(questions) ? questions : [];
            } catch (parseError) {
                logger.warn('Failed to parse AI-generated questions:', parseError);
                return [];
            }
        } catch (error) {
            logger.error('Error generating personalized questions:', error);
            return [];
        }
    }

    /**
     * Get AI feedback on interview response
     */
    async getResponseFeedback(prepId, responseText, userId) {
        try {
            // Get the question details
            const questionSql = `
                SELECT question_text, question_type, answer_framework, sample_answer
                FROM pf_interview_prep
                WHERE prep_id = :prepId
            `;

            const questionResult = await this.database.execute(questionSql, { prepId });

            if (questionResult.rows.length === 0) {
                throw new Error('Question not found');
            }

            const question = questionResult.rows[0];

            const prompt = `Analyze this interview response and provide constructive feedback.
                
                Question: ${question.question_text}
                Question Type: ${question.question_type}
                Recommended Framework: ${question.answer_framework}
                
                User's Response: ${responseText}
                
                Provide feedback on:
                1. Structure and clarity
                2. Specific examples and details
                3. Relevance to the question
                4. Areas for improvement
                5. What was done well
                
                Also provide a suggested improved response that maintains the user's authentic voice while addressing any weaknesses.`;

            const feedback = await this.openaiService.generateResponse(prompt);

            return {
                feedback,
                question_type: question.question_type,
                framework: question.answer_framework
            };
        } catch (error) {
            logger.error('Error getting response feedback:', error);
            throw error;
        }
    }

    /**
     * Get improvement recommendations based on user's practice data
     */
    async getImprovementRecommendations(userId, stats, typeBreakdown) {
        const recommendations = [];

        // Check overall practice volume
        if (stats.total_responses < 10) {
            recommendations.push({
                priority: 'high',
                area: 'practice_volume',
                message: 'Practice more interview questions to build confidence',
                action: 'Aim for at least 20 practice responses'
            });
        }

        // Check average rating
        if (stats.avg_rating < 3) {
            recommendations.push({
                priority: 'high',
                area: 'response_quality',
                message: 'Focus on improving response quality',
                action: 'Review STAR method and practice structuring answers'
            });
        }

        // Check question type coverage
        const questionTypes = ['behavioral', 'technical', 'situational'];
        const practicedTypes = new Set(typeBreakdown.map(t => t.question_type));
        
        for (const type of questionTypes) {
            if (!practicedTypes.has(type)) {
                recommendations.push({
                    priority: 'medium',
                    area: 'question_diversity',
                    message: `Practice more ${type} questions`,
                    action: `Add ${type} questions to your practice routine`
                });
            }
        }

        // Check improvement needs
        if (stats.needs_improvement_count > stats.total_responses * 0.3) {
            recommendations.push({
                priority: 'high',
                area: 'focused_improvement',
                message: 'Many responses marked for improvement',
                action: 'Review and revise responses marked as needing improvement'
            });
        }

        return recommendations;
    }

    /**
     * Get interview tips based on application
     */
    getInterviewTips(application) {
        const tips = [
            {
                category: 'Company Research',
                tips: [
                    `Research ${application.company_name}'s recent news and developments`,
                    `Understand their products, services, and market position`,
                    `Review their mission, vision, and values`,
                    `Check Glassdoor for interview experiences`
                ]
            },
            {
                category: 'Technical Preparation',
                tips: [
                    'Review the required skills listed in the job description',
                    'Prepare examples demonstrating each required skill',
                    'Be ready to discuss technical challenges and solutions',
                    'Practice explaining complex concepts simply'
                ]
            },
            {
                category: 'Behavioral Questions',
                tips: [
                    'Use the STAR method (Situation, Task, Action, Result)',
                    'Prepare 5-7 stories that showcase different skills',
                    'Quantify your achievements whenever possible',
                    'Practice your answers out loud'
                ]
            },
            {
                category: 'Questions to Ask',
                tips: [
                    'Prepare thoughtful questions about the role and team',
                    'Ask about growth opportunities and career development',
                    'Inquire about team culture and collaboration',
                    'Show genuine interest in the company\'s future'
                ]
            }
        ];

        return tips;
    }

    /**
     * Get preparation checklist
     */
    getPreparationChecklist() {
        return [
            { task: 'Research company thoroughly', category: 'research' },
            { task: 'Review job description and requirements', category: 'research' },
            { task: 'Prepare STAR stories for common questions', category: 'practice' },
            { task: 'Practice technical questions if applicable', category: 'practice' },
            { task: 'Prepare questions to ask the interviewer', category: 'questions' },
            { task: 'Plan your outfit and test video setup', category: 'logistics' },
            { task: 'Review your resume and be ready to discuss', category: 'documents' },
            { task: 'Get a good night\'s sleep', category: 'wellness' },
            { task: 'Arrive/login 10-15 minutes early', category: 'logistics' }
        ];
    }

    /**
     * Infer role category from job title
     */
    inferRoleCategory(jobTitle) {
        const titleLower = jobTitle.toLowerCase();
        
        if (titleLower.includes('software') || titleLower.includes('engineer') || 
            titleLower.includes('developer') || titleLower.includes('programmer')) {
            return 'software_engineer';
        } else if (titleLower.includes('product') && titleLower.includes('manager')) {
            return 'product_manager';
        } else if (titleLower.includes('data') && titleLower.includes('scientist')) {
            return 'data_scientist';
        } else if (titleLower.includes('design')) {
            return 'designer';
        } else if (titleLower.includes('market')) {
            return 'marketing';
        } else if (titleLower.includes('sales')) {
            return 'sales';
        } else if (titleLower.includes('manager') || titleLower.includes('director')) {
            return 'management';
        } else {
            return 'general';
        }
    }
}

module.exports = InterviewPrepService;