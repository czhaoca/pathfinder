const { ulid } = require('ulid');
const logger = require('../utils/logger');

class ApplicationService {
    constructor(database, auditService, resumeService) {
        this.database = database;
        this.auditService = auditService;
        this.resumeService = resumeService;
    }

    /**
     * Get user's job applications
     */
    async getUserApplications(userId, filters = {}) {
        try {
            const {
                status,
                startDate,
                endDate,
                companyName,
                sortBy = 'application_date',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = filters;

            let sql = `
                SELECT 
                    a.*,
                    j.job_title,
                    j.job_type,
                    j.location,
                    j.is_remote,
                    j.salary_min,
                    j.salary_max,
                    j.job_url,
                    c.company_name AS company_name_full,
                    c.industry,
                    c.logo_url,
                    (SELECT COUNT(*) FROM pf_interviews i WHERE i.application_id = a.application_id) as interview_count,
                    (SELECT MAX(scheduled_date) FROM pf_interviews i WHERE i.application_id = a.application_id) as next_interview
                FROM pf_job_applications a
                JOIN pf_job_listings j ON a.job_id = j.job_id
                LEFT JOIN pf_companies c ON a.company_id = c.company_id
                WHERE a.user_id = :userId
            `;

            const binds = { userId };
            const conditions = [];

            if (status) {
                if (Array.isArray(status)) {
                    const statusPlaceholders = status.map((_, i) => `:status${i}`).join(',');
                    conditions.push(`a.status IN (${statusPlaceholders})`);
                    status.forEach((s, i) => {
                        binds[`status${i}`] = s;
                    });
                } else {
                    conditions.push(`a.status = :status`);
                    binds.status = status;
                }
            }

            if (startDate) {
                conditions.push(`a.application_date >= :startDate`);
                binds.startDate = startDate;
            }

            if (endDate) {
                conditions.push(`a.application_date <= :endDate`);
                binds.endDate = endDate;
            }

            if (companyName) {
                conditions.push(`UPPER(j.company_name) LIKE UPPER(:companyName)`);
                binds.companyName = `%${companyName}%`;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['application_date', 'status', 'company_name', 'excitement_level'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'application_date';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            // Add pagination
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            // Get total count
            const countSql = `
                SELECT COUNT(*) as total
                FROM pf_job_applications a
                WHERE a.user_id = :userId
                ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
            `;
            const countBinds = { ...binds };
            delete countBinds.offset;
            delete countBinds.limit;

            const countResult = await this.database.execute(countSql, countBinds);
            const total = countResult.rows[0]?.total || 0;

            return {
                applications: result.rows,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + result.rows.length < total
                }
            };
        } catch (error) {
            logger.error('Error getting user applications:', error);
            throw error;
        }
    }

    /**
     * Get application details
     */
    async getApplicationDetails(applicationId, userId) {
        try {
            const sql = `
                SELECT 
                    a.*,
                    j.*,
                    c.*,
                    r.version_name as resume_version_name,
                    r.created_at as resume_created_at,
                    con.first_name as referral_first_name,
                    con.last_name as referral_last_name
                FROM pf_job_applications a
                JOIN pf_job_listings j ON a.job_id = j.job_id
                LEFT JOIN pf_companies c ON a.company_id = c.company_id
                LEFT JOIN pf_resume_versions r ON a.resume_version_id = r.version_id
                LEFT JOIN pf_contacts con ON a.referral_contact_id = con.contact_id
                WHERE a.application_id = :applicationId
                AND a.user_id = :userId
            `;

            const result = await this.database.execute(sql, { applicationId, userId });

            if (result.rows.length === 0) {
                throw new Error('Application not found');
            }

            const application = result.rows[0];

            // Get status history
            const historySql = `
                SELECT * FROM pf_application_status_history
                WHERE application_id = :applicationId
                ORDER BY changed_date DESC
            `;

            const historyResult = await this.database.execute(historySql, { applicationId });

            // Get interviews
            const interviewsSql = `
                SELECT * FROM pf_interviews
                WHERE application_id = :applicationId
                ORDER BY scheduled_date DESC
            `;

            const interviewsResult = await this.database.execute(interviewsSql, { applicationId });

            return {
                ...application,
                required_skills: application.required_skills ? JSON.parse(application.required_skills) : [],
                preferred_skills: application.preferred_skills ? JSON.parse(application.preferred_skills) : [],
                benefits: application.benefits ? JSON.parse(application.benefits) : [],
                culture_values: application.culture_values ? JSON.parse(application.culture_values) : [],
                tech_stack: application.tech_stack ? JSON.parse(application.tech_stack) : [],
                status_history: historyResult.rows,
                interviews: interviewsResult.rows.map(interview => ({
                    ...interview,
                    interviewer_names: interview.interviewer_names ? JSON.parse(interview.interviewer_names) : [],
                    questions_asked: interview.questions_asked ? JSON.parse(interview.questions_asked) : [],
                    your_questions: interview.your_questions ? JSON.parse(interview.your_questions) : []
                }))
            };
        } catch (error) {
            logger.error('Error getting application details:', error);
            throw error;
        }
    }

    /**
     * Create job application
     */
    async createApplication(userId, applicationData) {
        try {
            const applicationId = ulid();

            // Validate job exists
            const jobCheck = await this.database.execute(
                'SELECT job_id, company_id FROM pf_job_listings WHERE job_id = :jobId',
                { jobId: applicationData.jobId }
            );

            if (jobCheck.rows.length === 0) {
                throw new Error('Job not found');
            }

            const job = jobCheck.rows[0];

            // Check if already applied
            const existingCheck = await this.database.execute(
                'SELECT application_id FROM pf_job_applications WHERE user_id = :userId AND job_id = :jobId',
                { userId, jobId: applicationData.jobId }
            );

            if (existingCheck.rows.length > 0) {
                throw new Error('Already applied to this job');
            }

            const sql = `
                INSERT INTO pf_job_applications (
                    application_id, user_id, job_id, company_id,
                    status, application_date, resume_version_id,
                    cover_letter_id, application_method,
                    referral_contact_id, application_notes,
                    excitement_level, fit_score,
                    salary_expectation_min, salary_expectation_max
                ) VALUES (
                    :applicationId, :userId, :jobId, :companyId,
                    :status, :applicationDate, :resumeVersionId,
                    :coverLetterId, :applicationMethod,
                    :referralContactId, :applicationNotes,
                    :excitementLevel, :fitScore,
                    :salaryExpectationMin, :salaryExpectationMax
                )
            `;

            await this.database.execute(sql, {
                applicationId,
                userId,
                jobId: applicationData.jobId,
                companyId: job.company_id || applicationData.companyId,
                status: applicationData.status || 'interested',
                applicationDate: applicationData.applicationDate || new Date(),
                resumeVersionId: applicationData.resumeVersionId || null,
                coverLetterId: applicationData.coverLetterId || null,
                applicationMethod: applicationData.applicationMethod || 'platform',
                referralContactId: applicationData.referralContactId || null,
                applicationNotes: applicationData.applicationNotes || null,
                excitementLevel: applicationData.excitementLevel || null,
                fitScore: applicationData.fitScore || null,
                salaryExpectationMin: applicationData.salaryExpectationMin || null,
                salaryExpectationMax: applicationData.salaryExpectationMax || null
            });

            await this.database.commit();

            // Log audit
            await this.auditService.log({
                userId,
                action: 'APPLICATION_CREATED',
                resourceType: 'application',
                resourceId: applicationId,
                details: { jobId: applicationData.jobId }
            });

            return applicationId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error creating application:', error);
            throw error;
        }
    }

    /**
     * Update application
     */
    async updateApplication(applicationId, userId, updates) {
        try {
            // Verify ownership
            const checkSql = `
                SELECT status FROM pf_job_applications
                WHERE application_id = :applicationId AND user_id = :userId
            `;

            const checkResult = await this.database.execute(checkSql, { applicationId, userId });

            if (checkResult.rows.length === 0) {
                throw new Error('Application not found');
            }

            const currentStatus = checkResult.rows[0].status;

            const allowedFields = [
                'status', 'resume_version_id', 'cover_letter_id',
                'application_notes', 'excitement_level', 'fit_score',
                'salary_expectation_min', 'salary_expectation_max'
            ];

            const updateFields = [];
            const binds = { applicationId, userId };

            for (const [key, value] of Object.entries(updates)) {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (allowedFields.includes(snakeKey)) {
                    updateFields.push(`${snakeKey} = :${snakeKey}`);
                    binds[snakeKey] = value;
                }
            }

            if (updateFields.length === 0) {
                return;
            }

            const sql = `
                UPDATE pf_job_applications
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE application_id = :applicationId AND user_id = :userId
            `;

            await this.database.execute(sql, binds);

            // If status changed, it will be logged by trigger
            if (updates.status && updates.status !== currentStatus) {
                await this.auditService.log({
                    userId,
                    action: 'APPLICATION_STATUS_CHANGED',
                    resourceType: 'application',
                    resourceId: applicationId,
                    details: { 
                        oldStatus: currentStatus, 
                        newStatus: updates.status 
                    }
                });
            }

            await this.database.commit();
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating application:', error);
            throw error;
        }
    }

    /**
     * Withdraw application
     */
    async withdrawApplication(applicationId, userId, reason) {
        try {
            const sql = `
                UPDATE pf_job_applications
                SET status = 'withdrawn', 
                    application_notes = application_notes || CHR(10) || 'Withdrawn: ' || :reason,
                    updated_at = CURRENT_TIMESTAMP
                WHERE application_id = :applicationId 
                AND user_id = :userId
                AND status NOT IN ('withdrawn', 'rejected')
            `;

            const result = await this.database.execute(sql, {
                applicationId,
                userId,
                reason: reason || 'User withdrew application'
            });

            if (result.rowsAffected === 0) {
                throw new Error('Application not found or already withdrawn/rejected');
            }

            await this.database.commit();

            await this.auditService.log({
                userId,
                action: 'APPLICATION_WITHDRAWN',
                resourceType: 'application',
                resourceId: applicationId,
                details: { reason }
            });
        } catch (error) {
            await this.database.rollback();
            logger.error('Error withdrawing application:', error);
            throw error;
        }
    }

    /**
     * Get application timeline
     */
    async getApplicationTimeline(applicationId, userId) {
        try {
            // Verify ownership
            const checkSql = `
                SELECT application_id FROM pf_job_applications
                WHERE application_id = :applicationId AND user_id = :userId
            `;

            const checkResult = await this.database.execute(checkSql, { applicationId, userId });

            if (checkResult.rows.length === 0) {
                throw new Error('Application not found');
            }

            // Get all timeline events
            const events = [];

            // Application created
            const appSql = `
                SELECT created_at, status, application_notes
                FROM pf_job_applications
                WHERE application_id = :applicationId
            `;

            const appResult = await this.database.execute(appSql, { applicationId });
            const app = appResult.rows[0];

            events.push({
                type: 'application_created',
                date: app.created_at,
                title: 'Application Started',
                description: `Initial status: ${app.status}`,
                icon: 'file-text'
            });

            // Status changes
            const statusSql = `
                SELECT old_status, new_status, changed_date, notes
                FROM pf_application_status_history
                WHERE application_id = :applicationId
                ORDER BY changed_date ASC
            `;

            const statusResult = await this.database.execute(statusSql, { applicationId });

            for (const change of statusResult.rows) {
                events.push({
                    type: 'status_change',
                    date: change.changed_date,
                    title: `Status Changed to ${this.formatStatus(change.new_status)}`,
                    description: change.notes || `From ${this.formatStatus(change.old_status)}`,
                    icon: this.getStatusIcon(change.new_status)
                });
            }

            // Interviews
            const interviewSql = `
                SELECT interview_type, scheduled_date, outcome, interview_round
                FROM pf_interviews
                WHERE application_id = :applicationId
                ORDER BY scheduled_date ASC
            `;

            const interviewResult = await this.database.execute(interviewSql, { applicationId });

            for (const interview of interviewResult.rows) {
                events.push({
                    type: 'interview',
                    date: interview.scheduled_date,
                    title: `${this.formatInterviewType(interview.interview_type)} Interview (Round ${interview.interview_round})`,
                    description: interview.outcome ? `Outcome: ${interview.outcome}` : 'Scheduled',
                    icon: 'calendar'
                });
            }

            // Sort events by date
            events.sort((a, b) => new Date(a.date) - new Date(b.date));

            return {
                applicationId,
                events,
                currentStatus: app.status,
                totalEvents: events.length
            };
        } catch (error) {
            logger.error('Error getting application timeline:', error);
            throw error;
        }
    }

    /**
     * Get application statistics
     */
    async getApplicationStats(userId, timeframe = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - timeframe);

            const sql = `
                SELECT 
                    COUNT(*) as total_applications,
                    COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested,
                    COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
                    COUNT(CASE WHEN status = 'screening' THEN 1 END) as screening,
                    COUNT(CASE WHEN status = 'interviewing' THEN 1 END) as interviewing,
                    COUNT(CASE WHEN status = 'offer' THEN 1 END) as offers,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                    COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn,
                    AVG(excitement_level) as avg_excitement,
                    COUNT(DISTINCT company_id) as unique_companies
                FROM pf_job_applications
                WHERE user_id = :userId
                AND application_date >= :startDate
            `;

            const result = await this.database.execute(sql, { userId, startDate });
            const stats = result.rows[0];

            // Get interview stats
            const interviewSql = `
                SELECT 
                    COUNT(*) as total_interviews,
                    COUNT(CASE WHEN outcome = 'passed' THEN 1 END) as passed,
                    COUNT(CASE WHEN outcome = 'failed' THEN 1 END) as failed,
                    COUNT(DISTINCT a.application_id) as applications_with_interviews
                FROM pf_interviews i
                JOIN pf_job_applications a ON i.application_id = a.application_id
                WHERE a.user_id = :userId
                AND i.scheduled_date >= :startDate
            `;

            const interviewResult = await this.database.execute(interviewSql, { userId, startDate });
            const interviewStats = interviewResult.rows[0];

            // Calculate conversion rates
            const conversionRates = {
                applied_to_screening: stats.applied > 0 ? 
                    (stats.screening + stats.interviewing + stats.offers) / stats.applied : 0,
                screening_to_interview: stats.screening > 0 ?
                    (stats.interviewing + stats.offers) / stats.screening : 0,
                interview_to_offer: stats.interviewing > 0 ?
                    stats.offers / stats.interviewing : 0,
                overall_success: stats.total_applications > 0 ?
                    stats.offers / stats.total_applications : 0
            };

            return {
                timeframe_days: timeframe,
                applications: {
                    total: parseInt(stats.total_applications),
                    by_status: {
                        interested: parseInt(stats.interested),
                        applied: parseInt(stats.applied),
                        screening: parseInt(stats.screening),
                        interviewing: parseInt(stats.interviewing),
                        offers: parseInt(stats.offers),
                        rejected: parseInt(stats.rejected),
                        withdrawn: parseInt(stats.withdrawn)
                    },
                    unique_companies: parseInt(stats.unique_companies),
                    avg_excitement: parseFloat(stats.avg_excitement) || 0
                },
                interviews: {
                    total: parseInt(interviewStats.total_interviews),
                    passed: parseInt(interviewStats.passed),
                    failed: parseInt(interviewStats.failed),
                    applications_with_interviews: parseInt(interviewStats.applications_with_interviews)
                },
                conversion_rates: conversionRates
            };
        } catch (error) {
            logger.error('Error getting application stats:', error);
            throw error;
        }
    }

    /**
     * Bulk update application statuses
     */
    async bulkUpdateStatus(userId, applicationIds, newStatus, notes) {
        try {
            if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
                throw new Error('No application IDs provided');
            }

            // Verify ownership of all applications
            const placeholders = applicationIds.map((_, i) => `:id${i}`).join(',');
            const binds = { userId };
            applicationIds.forEach((id, i) => {
                binds[`id${i}`] = id;
            });

            const checkSql = `
                SELECT application_id FROM pf_job_applications
                WHERE user_id = :userId
                AND application_id IN (${placeholders})
            `;

            const checkResult = await this.database.execute(checkSql, binds);

            if (checkResult.rows.length !== applicationIds.length) {
                throw new Error('One or more applications not found');
            }

            // Update statuses
            const updateSql = `
                UPDATE pf_job_applications
                SET status = :newStatus,
                    application_notes = CASE 
                        WHEN application_notes IS NULL THEN :notes
                        ELSE application_notes || CHR(10) || :notes
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = :userId
                AND application_id IN (${placeholders})
            `;

            binds.newStatus = newStatus;
            binds.notes = notes || `Bulk status update to ${newStatus}`;

            const result = await this.database.execute(updateSql, binds);

            await this.database.commit();

            await this.auditService.log({
                userId,
                action: 'BULK_STATUS_UPDATE',
                resourceType: 'application',
                resourceId: applicationIds.join(','),
                details: { 
                    count: result.rowsAffected,
                    newStatus,
                    notes 
                }
            });

            return result.rowsAffected;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error bulk updating statuses:', error);
            throw error;
        }
    }

    // Helper methods

    formatStatus(status) {
        const statusMap = {
            interested: 'Interested',
            applied: 'Applied',
            screening: 'Screening',
            interviewing: 'Interviewing',
            offer: 'Offer',
            rejected: 'Rejected',
            withdrawn: 'Withdrawn'
        };
        return statusMap[status] || status;
    }

    getStatusIcon(status) {
        const iconMap = {
            interested: 'star',
            applied: 'send',
            screening: 'search',
            interviewing: 'users',
            offer: 'gift',
            rejected: 'x-circle',
            withdrawn: 'arrow-left'
        };
        return iconMap[status] || 'circle';
    }

    formatInterviewType(type) {
        const typeMap = {
            phone: 'Phone',
            video: 'Video',
            onsite: 'On-site',
            technical: 'Technical',
            behavioral: 'Behavioral'
        };
        return typeMap[type] || type;
    }
}

module.exports = ApplicationService;