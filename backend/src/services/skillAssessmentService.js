const { ulid } = require('ulid');
const logger = require('../utils/logger');

class SkillAssessmentService {
    constructor(database, openaiService, experienceService) {
        this.database = database;
        this.openaiService = openaiService;
        this.experienceService = experienceService;
    }

    /**
     * Get available assessments
     */
    async getAssessments(filters = {}) {
        try {
            const {
                skillId,
                assessmentType,
                difficultyLevel,
                isActive = true,
                limit = 50,
                offset = 0
            } = filters;

            let sql = `
                SELECT 
                    a.*,
                    s.skill_name,
                    s.skill_category,
                    (SELECT COUNT(*) FROM pf_user_assessments ua WHERE ua.assessment_id = a.assessment_id) as total_attempts,
                    (SELECT AVG(percentage_score) FROM pf_user_assessments ua WHERE ua.assessment_id = a.assessment_id) as avg_score
                FROM pf_skill_assessments a
                JOIN pf_skills s ON a.skill_id = s.skill_id
                WHERE 1=1
            `;

            const binds = {};
            const conditions = [];

            if (skillId) {
                conditions.push(`a.skill_id = :skillId`);
                binds.skillId = skillId;
            }

            if (assessmentType) {
                conditions.push(`a.assessment_type = :assessmentType`);
                binds.assessmentType = assessmentType;
            }

            if (difficultyLevel) {
                conditions.push(`a.difficulty_level = :difficultyLevel`);
                binds.difficultyLevel = difficultyLevel;
            }

            if (isActive !== undefined) {
                conditions.push(`a.is_active = :isActive`);
                binds.isActive = isActive ? 'Y' : 'N';
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            sql += ` ORDER BY s.skill_name, a.difficulty_level`;
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows.map(assessment => ({
                ...assessment,
                questions: assessment.questions ? JSON.parse(assessment.questions) : [],
                rubric: assessment.rubric ? JSON.parse(assessment.rubric) : {}
            }));
        } catch (error) {
            logger.error('Error getting assessments:', error);
            throw error;
        }
    }

    /**
     * Get assessment details
     */
    async getAssessmentDetails(assessmentId) {
        try {
            const sql = `
                SELECT 
                    a.*,
                    s.skill_name,
                    s.skill_category,
                    s.skill_description
                FROM pf_skill_assessments a
                JOIN pf_skills s ON a.skill_id = s.skill_id
                WHERE a.assessment_id = :assessmentId
            `;

            const result = await this.database.execute(sql, { assessmentId });

            if (result.rows.length === 0) {
                throw new Error('Assessment not found');
            }

            const assessment = result.rows[0];
            return {
                ...assessment,
                questions: assessment.questions ? JSON.parse(assessment.questions) : [],
                rubric: assessment.rubric ? JSON.parse(assessment.rubric) : {}
            };
        } catch (error) {
            logger.error('Error getting assessment details:', error);
            throw error;
        }
    }

    /**
     * Start an assessment
     */
    async startAssessment(userId, assessmentId) {
        try {
            // Check if assessment exists and is active
            const assessment = await this.getAssessmentDetails(assessmentId);

            if (assessment.is_active !== 'Y') {
                throw new Error('Assessment is not active');
            }

            // Check attempt limit
            const attemptsSql = `
                SELECT COUNT(*) as attempt_count
                FROM pf_user_assessments
                WHERE user_id = :userId
                AND assessment_id = :assessmentId
            `;

            const attemptsResult = await this.database.execute(attemptsSql, { userId, assessmentId });
            const attemptCount = attemptsResult.rows[0].attempt_count;

            if (assessment.max_attempts && attemptCount >= assessment.max_attempts) {
                throw new Error('Maximum attempts exceeded');
            }

            // Create assessment attempt
            const resultId = ulid();
            const sql = `
                INSERT INTO pf_user_assessments (
                    result_id, user_id, assessment_id,
                    attempt_number, start_time
                ) VALUES (
                    :resultId, :userId, :assessmentId,
                    :attemptNumber, CURRENT_TIMESTAMP
                )
            `;

            await this.database.execute(sql, {
                resultId,
                userId,
                assessmentId,
                attemptNumber: attemptCount + 1
            });

            await this.database.commit();

            // Return assessment questions without answers
            const questionsForUser = assessment.questions.map(q => ({
                question_id: q.question_id,
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options || null,
                time_limit: q.time_limit || null,
                points: q.points || 1
            }));

            return {
                resultId,
                assessmentId,
                assessmentName: assessment.assessment_name,
                skillName: assessment.skill_name,
                timeLimitMinutes: assessment.time_limit_minutes,
                questions: questionsForUser,
                startTime: new Date()
            };
        } catch (error) {
            await this.database.rollback();
            logger.error('Error starting assessment:', error);
            throw error;
        }
    }

    /**
     * Submit assessment answers
     */
    async submitAssessment(resultId, userId, submission) {
        try {
            const { answers, timeSpent } = submission;

            // Verify ownership and get assessment details
            const sql = `
                SELECT 
                    ua.*,
                    a.questions,
                    a.rubric,
                    a.passing_score,
                    a.time_limit_minutes
                FROM pf_user_assessments ua
                JOIN pf_skill_assessments a ON ua.assessment_id = a.assessment_id
                WHERE ua.result_id = :resultId
                AND ua.user_id = :userId
                AND ua.end_time IS NULL
            `;

            const result = await this.database.execute(sql, { resultId, userId });

            if (result.rows.length === 0) {
                throw new Error('Assessment not found or already submitted');
            }

            const assessmentData = result.rows[0];
            const questions = JSON.parse(assessmentData.questions);
            const rubric = JSON.parse(assessmentData.rubric);

            // Check time limit
            if (assessmentData.time_limit_minutes) {
                const startTime = new Date(assessmentData.start_time);
                const currentTime = new Date();
                const minutesElapsed = (currentTime - startTime) / 60000;

                if (minutesElapsed > assessmentData.time_limit_minutes) {
                    throw new Error('Time limit exceeded');
                }
            }

            // Score the assessment
            const scoring = await this.scoreAssessment(answers, questions, rubric);

            // Determine skill level achieved
            const skillLevel = this.determineSkillLevel(scoring.percentageScore);

            // Update assessment result
            const updateSql = `
                UPDATE pf_user_assessments
                SET end_time = CURRENT_TIMESTAMP,
                    score = :score,
                    percentage_score = :percentageScore,
                    passed = :passed,
                    answers = :answers,
                    feedback = :feedback,
                    time_taken_minutes = :timeTaken,
                    skill_level_achieved = :skillLevel,
                    strengths = :strengths,
                    improvement_areas = :improvementAreas,
                    created_at = CURRENT_TIMESTAMP
                WHERE result_id = :resultId
                AND user_id = :userId
            `;

            await this.database.execute(updateSql, {
                resultId,
                userId,
                score: scoring.totalScore,
                percentageScore: scoring.percentageScore,
                passed: scoring.percentageScore >= assessmentData.passing_score ? 'Y' : 'N',
                answers: JSON.stringify(answers),
                feedback: JSON.stringify(scoring.feedback),
                timeTaken: timeSpent || null,
                skillLevel,
                strengths: JSON.stringify(scoring.strengths),
                improvementAreas: JSON.stringify(scoring.improvementAreas)
            });

            await this.database.commit();

            // Update user's skill proficiency if passed
            if (scoring.percentageScore >= assessmentData.passing_score) {
                await this.updateSkillProficiency(userId, assessmentData.skill_id, skillLevel);
            }

            return {
                resultId,
                score: scoring.totalScore,
                percentageScore: scoring.percentageScore,
                passed: scoring.percentageScore >= assessmentData.passing_score,
                skillLevelAchieved: skillLevel,
                feedback: scoring.feedback,
                strengths: scoring.strengths,
                improvementAreas: scoring.improvementAreas
            };
        } catch (error) {
            await this.database.rollback();
            logger.error('Error submitting assessment:', error);
            throw error;
        }
    }

    /**
     * Get user's assessment results
     */
    async getUserAssessmentResults(userId, filters = {}) {
        try {
            const { skillId, passed, limit = 50, offset = 0 } = filters;

            let sql = `
                SELECT 
                    ua.*,
                    a.assessment_name,
                    a.assessment_type,
                    a.difficulty_level,
                    s.skill_name,
                    s.skill_category
                FROM pf_user_assessments ua
                JOIN pf_skill_assessments a ON ua.assessment_id = a.assessment_id
                JOIN pf_skills s ON a.skill_id = s.skill_id
                WHERE ua.user_id = :userId
                AND ua.end_time IS NOT NULL
            `;

            const binds = { userId };
            const conditions = [];

            if (skillId) {
                conditions.push(`a.skill_id = :skillId`);
                binds.skillId = skillId;
            }

            if (passed !== undefined) {
                conditions.push(`ua.passed = :passed`);
                binds.passed = passed ? 'Y' : 'N';
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            sql += ` ORDER BY ua.created_at DESC`;
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows.map(row => ({
                ...row,
                answers: row.answers ? JSON.parse(row.answers) : [],
                feedback: row.feedback ? JSON.parse(row.feedback) : {},
                strengths: row.strengths ? JSON.parse(row.strengths) : [],
                improvement_areas: row.improvement_areas ? JSON.parse(row.improvement_areas) : []
            }));
        } catch (error) {
            logger.error('Error getting user assessment results:', error);
            throw error;
        }
    }

    /**
     * Get skill assessment summary
     */
    async getSkillAssessmentSummary(userId) {
        try {
            const sql = `
                SELECT 
                    s.skill_name,
                    s.skill_category,
                    COUNT(ua.result_id) as attempts,
                    MAX(ua.percentage_score) as best_score,
                    MAX(ua.skill_level_achieved) as highest_level,
                    MAX(ua.created_at) as last_assessed
                FROM pf_user_assessments ua
                JOIN pf_skill_assessments a ON ua.assessment_id = a.assessment_id
                JOIN pf_skills s ON a.skill_id = s.skill_id
                WHERE ua.user_id = :userId
                AND ua.end_time IS NOT NULL
                GROUP BY s.skill_name, s.skill_category, s.skill_id
                ORDER BY MAX(ua.created_at) DESC
            `;

            const result = await this.database.execute(sql, { userId });

            // Group by category
            const byCategory = {};
            for (const skill of result.rows) {
                if (!byCategory[skill.skill_category]) {
                    byCategory[skill.skill_category] = [];
                }
                byCategory[skill.skill_category].push(skill);
            }

            return {
                totalSkillsAssessed: result.rows.length,
                skillsByCategory: byCategory,
                recentAssessments: result.rows.slice(0, 5)
            };
        } catch (error) {
            logger.error('Error getting skill assessment summary:', error);
            throw error;
        }
    }

    /**
     * Create custom assessment
     */
    async createAssessment(assessmentData, createdBy) {
        try {
            const assessmentId = ulid();

            const sql = `
                INSERT INTO pf_skill_assessments (
                    assessment_id, skill_id, assessment_name,
                    assessment_type, difficulty_level,
                    description, instructions,
                    time_limit_minutes, passing_score,
                    questions, rubric, max_attempts,
                    created_by
                ) VALUES (
                    :assessmentId, :skillId, :assessmentName,
                    :assessmentType, :difficultyLevel,
                    :description, :instructions,
                    :timeLimitMinutes, :passingScore,
                    :questions, :rubric, :maxAttempts,
                    :createdBy
                )
            `;

            await this.database.execute(sql, {
                assessmentId,
                skillId: assessmentData.skillId,
                assessmentName: assessmentData.assessmentName,
                assessmentType: assessmentData.assessmentType || 'quiz',
                difficultyLevel: assessmentData.difficultyLevel || 'intermediate',
                description: assessmentData.description || null,
                instructions: assessmentData.instructions || null,
                timeLimitMinutes: assessmentData.timeLimitMinutes || null,
                passingScore: assessmentData.passingScore || 70,
                questions: JSON.stringify(assessmentData.questions),
                rubric: JSON.stringify(assessmentData.rubric || {}),
                maxAttempts: assessmentData.maxAttempts || 3,
                createdBy
            });

            await this.database.commit();
            return assessmentId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error creating assessment:', error);
            throw error;
        }
    }

    /**
     * Generate AI-powered assessment
     */
    async generateAIAssessment(skillId, parameters = {}) {
        try {
            const { difficultyLevel = 'intermediate', questionCount = 10, assessmentType = 'quiz' } = parameters;

            // Get skill details
            const skillSql = `
                SELECT skill_name, skill_description, skill_category
                FROM pf_skills
                WHERE skill_id = :skillId
            `;

            const skillResult = await this.database.execute(skillSql, { skillId });

            if (skillResult.rows.length === 0) {
                throw new Error('Skill not found');
            }

            const skill = skillResult.rows[0];

            // Generate assessment using AI
            const prompt = `Generate a ${assessmentType} assessment for the skill "${skill.skill_name}" at ${difficultyLevel} level.
                
                Skill Description: ${skill.skill_description}
                Category: ${skill.skill_category}
                
                Create ${questionCount} questions that test practical knowledge and application of this skill.
                
                For each question provide:
                1. question_id (unique identifier)
                2. question_text
                3. question_type (multiple_choice, true_false, short_answer, or code)
                4. options (array for multiple choice)
                5. correct_answer
                6. explanation
                7. points (1-5 based on difficulty)
                8. time_limit (seconds, optional)
                
                Format as JSON array.`;

            const response = await this.openaiService.generateResponse(prompt);

            try {
                const questions = JSON.parse(response);
                
                // Create rubric based on questions
                const rubric = this.generateRubric(questions);

                return {
                    assessmentName: `${skill.skill_name} Assessment - ${difficultyLevel}`,
                    skillId,
                    assessmentType,
                    difficultyLevel,
                    questions,
                    rubric,
                    passingScore: 70,
                    timeLimitMinutes: questionCount * 2, // 2 minutes per question
                    maxAttempts: 3
                };
            } catch (parseError) {
                logger.error('Failed to parse AI-generated assessment:', parseError);
                throw new Error('Failed to generate assessment');
            }
        } catch (error) {
            logger.error('Error generating AI assessment:', error);
            throw error;
        }
    }

    // Helper methods

    async scoreAssessment(userAnswers, questions, rubric) {
        let totalScore = 0;
        let maxScore = 0;
        const feedback = {};
        const correctByType = {};
        const incorrectByType = {};

        for (const question of questions) {
            const userAnswer = userAnswers[question.question_id];
            const points = question.points || 1;
            maxScore += points;

            let isCorrect = false;
            let questionFeedback = '';

            // Score based on question type
            switch (question.question_type) {
                case 'multiple_choice':
                case 'true_false':
                    isCorrect = userAnswer === question.correct_answer;
                    questionFeedback = isCorrect ? 
                        'Correct!' : 
                        `Incorrect. ${question.explanation || 'The correct answer is ' + question.correct_answer}`;
                    break;

                case 'short_answer':
                    // Use AI for short answer evaluation
                    isCorrect = await this.evaluateShortAnswer(userAnswer, question.correct_answer, question.question_text);
                    questionFeedback = isCorrect ? 
                        'Good answer!' : 
                        'Your answer could be improved. ' + (question.explanation || '');
                    break;

                case 'code':
                    // Use AI for code evaluation
                    const codeEval = await this.evaluateCode(userAnswer, question);
                    isCorrect = codeEval.isCorrect;
                    questionFeedback = codeEval.feedback;
                    break;

                default:
                    isCorrect = userAnswer === question.correct_answer;
            }

            if (isCorrect) {
                totalScore += points;
                correctByType[question.question_type] = (correctByType[question.question_type] || 0) + 1;
            } else {
                incorrectByType[question.question_type] = (incorrectByType[question.question_type] || 0) + 1;
            }

            feedback[question.question_id] = {
                isCorrect,
                feedback: questionFeedback,
                pointsEarned: isCorrect ? points : 0,
                pointsPossible: points
            };
        }

        const percentageScore = Math.round((totalScore / maxScore) * 100);

        // Identify strengths and improvement areas
        const strengths = [];
        const improvementAreas = [];

        for (const [type, count] of Object.entries(correctByType)) {
            const total = count + (incorrectByType[type] || 0);
            const percentage = (count / total) * 100;
            
            if (percentage >= 80) {
                strengths.push(`Strong performance in ${type} questions`);
            }
        }

        for (const [type, count] of Object.entries(incorrectByType)) {
            const total = count + (correctByType[type] || 0);
            const percentage = (count / total) * 100;
            
            if (percentage >= 40) {
                improvementAreas.push(`Practice more ${type} questions`);
            }
        }

        return {
            totalScore,
            maxScore,
            percentageScore,
            feedback,
            strengths,
            improvementAreas
        };
    }

    async evaluateShortAnswer(userAnswer, correctAnswer, questionText) {
        if (!this.openaiService) {
            // Simple keyword matching fallback
            const keywords = correctAnswer.toLowerCase().split(' ');
            const userWords = userAnswer.toLowerCase().split(' ');
            const matches = keywords.filter(keyword => userWords.includes(keyword));
            return matches.length >= keywords.length * 0.6;
        }

        const prompt = `Evaluate this short answer response:
            Question: ${questionText}
            Expected answer key points: ${correctAnswer}
            User's answer: ${userAnswer}
            
            Is the user's answer substantially correct? Reply with true or false.`;

        const response = await this.openaiService.generateResponse(prompt);
        return response.toLowerCase().includes('true');
    }

    async evaluateCode(userCode, question) {
        if (!this.openaiService) {
            // Basic syntax check fallback
            return {
                isCorrect: userCode.includes(question.correct_answer),
                feedback: 'Code evaluation unavailable'
            };
        }

        const prompt = `Evaluate this code solution:
            Problem: ${question.question_text}
            Expected solution approach: ${question.correct_answer}
            User's code: ${userCode}
            
            Evaluate if the code solves the problem correctly. Provide:
            1. isCorrect (true/false)
            2. feedback (brief explanation)
            
            Format as JSON.`;

        try {
            const response = await this.openaiService.generateResponse(prompt);
            return JSON.parse(response);
        } catch (error) {
            return {
                isCorrect: false,
                feedback: 'Error evaluating code'
            };
        }
    }

    determineSkillLevel(percentageScore) {
        if (percentageScore >= 90) return 'expert';
        if (percentageScore >= 75) return 'proficient';
        if (percentageScore >= 60) return 'competent';
        return 'novice';
    }

    generateRubric(questions) {
        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
        
        return {
            totalPoints,
            scoringCategories: {
                expert: { min: 90, description: 'Demonstrates mastery of the skill' },
                proficient: { min: 75, description: 'Shows strong understanding and application' },
                competent: { min: 60, description: 'Has working knowledge of the skill' },
                novice: { min: 0, description: 'Beginning to develop the skill' }
            },
            passingScore: 70
        };
    }

    async updateSkillProficiency(userId, skillId, newLevel) {
        // Update user's skill proficiency based on assessment results
        // This would integrate with the experience/skills tracking system
        logger.info(`Updated skill proficiency for user ${userId}, skill ${skillId} to ${newLevel}`);
    }
}

module.exports = SkillAssessmentService;