const { ulid } = require('ulid');
const logger = require('../utils/logger');

class CertificationService {
    constructor(database, auditService) {
        this.database = database;
        this.auditService = auditService;
    }

    /**
     * Browse certification catalog
     */
    async browseCertifications(filters = {}) {
        try {
            const {
                industry,
                certificationLevel,
                issuingOrganization,
                searchQuery,
                minDemandScore,
                maxCost,
                sortBy = 'market_demand_score',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = filters;

            let sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_user_certifications uc WHERE uc.certification_id = c.certification_id) as holders_count,
                    (SELECT COUNT(*) FROM pf_user_certifications uc WHERE uc.certification_id = c.certification_id AND uc.status = 'active') as active_holders
                FROM pf_certifications c
                WHERE c.is_active = 'Y'
            `;

            const binds = {};
            const conditions = [];

            if (industry) {
                conditions.push(`c.industry = :industry`);
                binds.industry = industry;
            }

            if (certificationLevel) {
                conditions.push(`c.certification_level = :certificationLevel`);
                binds.certificationLevel = certificationLevel;
            }

            if (issuingOrganization) {
                conditions.push(`c.issuing_organization = :issuingOrganization`);
                binds.issuingOrganization = issuingOrganization;
            }

            if (searchQuery) {
                conditions.push(`(
                    UPPER(c.certification_name) LIKE UPPER(:searchQuery) OR
                    UPPER(c.description) LIKE UPPER(:searchQuery)
                )`);
                binds.searchQuery = `%${searchQuery}%`;
            }

            if (minDemandScore) {
                conditions.push(`c.market_demand_score >= :minDemandScore`);
                binds.minDemandScore = minDemandScore;
            }

            if (maxCost) {
                conditions.push(`c.cost_usd <= :maxCost`);
                binds.maxCost = maxCost;
            }

            if (conditions.length > 0) {
                sql += ' AND ' + conditions.join(' AND ');
            }

            // Add sorting
            const validSortFields = ['market_demand_score', 'average_salary_impact', 'cost_usd', 'certification_name'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'market_demand_score';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
            sql += ` ORDER BY ${sortField} ${order}`;

            // Add pagination
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = offset;
            binds.limit = Math.min(limit, 100);

            const result = await this.database.execute(sql, binds);

            return result.rows.map(cert => ({
                ...cert,
                skills_validated: cert.skills_validated ? JSON.parse(cert.skills_validated) : []
            }));
        } catch (error) {
            logger.error('Error browsing certifications:', error);
            throw error;
        }
    }

    /**
     * Get certification details
     */
    async getCertificationDetails(certificationId) {
        try {
            const sql = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM pf_user_certifications uc WHERE uc.certification_id = c.certification_id) as total_holders,
                    (SELECT COUNT(*) FROM pf_user_certifications uc WHERE uc.certification_id = c.certification_id AND uc.status = 'active') as active_holders,
                    (SELECT AVG(preparation_hours) FROM pf_user_certifications uc WHERE uc.certification_id = c.certification_id AND uc.preparation_hours IS NOT NULL) as avg_prep_hours_actual
                FROM pf_certifications c
                WHERE c.certification_id = :certificationId
            `;

            const result = await this.database.execute(sql, { certificationId });

            if (result.rows.length === 0) {
                throw new Error('Certification not found');
            }

            const cert = result.rows[0];
            return {
                ...cert,
                skills_validated: cert.skills_validated ? JSON.parse(cert.skills_validated) : []
            };
        } catch (error) {
            logger.error('Error getting certification details:', error);
            throw error;
        }
    }

    /**
     * Add user certification
     */
    async addUserCertification(userId, certificationData) {
        try {
            const userCertId = ulid();

            // Validate certification exists
            const certCheck = await this.database.execute(
                'SELECT certification_id FROM pf_certifications WHERE certification_id = :certificationId',
                { certificationId: certificationData.certificationId }
            );

            if (certCheck.rows.length === 0) {
                throw new Error('Certification not found');
            }

            // Check if already has this certification
            const existingCheck = await this.database.execute(
                'SELECT user_cert_id FROM pf_user_certifications WHERE user_id = :userId AND certification_id = :certificationId AND status = \'active\'',
                { userId, certificationId: certificationData.certificationId }
            );

            if (existingCheck.rows.length > 0) {
                throw new Error('Active certification already exists');
            }

            const sql = `
                INSERT INTO pf_user_certifications (
                    user_cert_id, user_id, certification_id,
                    credential_number, issue_date, expiry_date,
                    status, verification_url, certificate_file_url,
                    cpe_credits_earned, preparation_hours,
                    exam_score, exam_date, notes
                ) VALUES (
                    :userCertId, :userId, :certificationId,
                    :credentialNumber, :issueDate, :expiryDate,
                    :status, :verificationUrl, :certificateFileUrl,
                    :cpeCreditEarned, :preparationHours,
                    :examScore, :examDate, :notes
                )
            `;

            await this.database.execute(sql, {
                userCertId,
                userId,
                certificationId: certificationData.certificationId,
                credentialNumber: certificationData.credentialNumber || null,
                issueDate: certificationData.issueDate,
                expiryDate: certificationData.expiryDate || null,
                status: 'active',
                verificationUrl: certificationData.verificationUrl || null,
                certificateFileUrl: certificationData.certificateFileUrl || null,
                cpeCreditEarned: certificationData.cpeCreditsEarned || null,
                preparationHours: certificationData.preparationHours || null,
                examScore: certificationData.examScore || null,
                examDate: certificationData.examDate || null,
                notes: certificationData.notes || null
            });

            await this.database.commit();

            // Set renewal reminder if applicable
            if (certificationData.expiryDate) {
                await this.setRenewalReminder(userCertId, certificationData.expiryDate, userId);
            }

            await this.auditService.log({
                userId,
                action: 'CERTIFICATION_ADDED',
                resourceType: 'certification',
                resourceId: userCertId,
                details: { certificationId: certificationData.certificationId }
            });

            return userCertId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error adding user certification:', error);
            throw error;
        }
    }

    /**
     * Update user certification
     */
    async updateUserCertification(userCertId, userId, updates) {
        try {
            // Verify ownership
            const checkSql = `
                SELECT status, expiry_date FROM pf_user_certifications
                WHERE user_cert_id = :userCertId AND user_id = :userId
            `;

            const checkResult = await this.database.execute(checkSql, { userCertId, userId });

            if (checkResult.rows.length === 0) {
                throw new Error('Certification not found');
            }

            const allowedFields = [
                'credential_number', 'expiry_date', 'status',
                'verification_url', 'certificate_file_url',
                'cpe_credits_earned', 'notes'
            ];

            const updateFields = [];
            const binds = { userCertId, userId };

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
                UPDATE pf_user_certifications
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE user_cert_id = :userCertId AND user_id = :userId
            `;

            await this.database.execute(sql, binds);
            await this.database.commit();

            // Update renewal reminder if expiry date changed
            if (updates.expiryDate && updates.expiryDate !== checkResult.rows[0].expiry_date) {
                await this.setRenewalReminder(userCertId, updates.expiryDate, userId);
            }
        } catch (error) {
            await this.database.rollback();
            logger.error('Error updating user certification:', error);
            throw error;
        }
    }

    /**
     * Get user's certifications
     */
    async getUserCertifications(userId, includeExpired = false) {
        try {
            let sql = `
                SELECT 
                    uc.*,
                    c.certification_name,
                    c.issuing_organization,
                    c.certification_level,
                    c.industry,
                    c.skills_validated,
                    c.validity_period_months,
                    c.official_url,
                    CASE 
                        WHEN uc.expiry_date < CURRENT_DATE THEN 'expired'
                        WHEN uc.expiry_date < ADD_MONTHS(CURRENT_DATE, 3) THEN 'expiring_soon'
                        ELSE 'valid'
                    END as validity_status
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                WHERE uc.user_id = :userId
            `;

            const binds = { userId };

            if (!includeExpired) {
                sql += ` AND (uc.status = 'active' OR uc.status = 'renewing')`;
            }

            sql += ` ORDER BY uc.issue_date DESC`;

            const result = await this.database.execute(sql, binds);

            return result.rows.map(cert => ({
                ...cert,
                skills_validated: cert.skills_validated ? JSON.parse(cert.skills_validated) : []
            }));
        } catch (error) {
            logger.error('Error getting user certifications:', error);
            throw error;
        }
    }

    /**
     * Get expiring certifications
     */
    async getExpiringCertifications(userId, daysAhead = 90) {
        try {
            const sql = `
                SELECT 
                    uc.*,
                    c.certification_name,
                    c.issuing_organization,
                    c.renewal_requirements,
                    c.official_url,
                    TRUNC(uc.expiry_date - CURRENT_DATE) as days_until_expiry
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                WHERE uc.user_id = :userId
                AND uc.status = 'active'
                AND uc.expiry_date IS NOT NULL
                AND uc.expiry_date <= CURRENT_DATE + :daysAhead
                ORDER BY uc.expiry_date ASC
            `;

            const result = await this.database.execute(sql, { userId, daysAhead });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring certifications:', error);
            throw error;
        }
    }

    /**
     * Track certification renewal
     */
    async trackRenewal(userCertId, userId, renewalData) {
        try {
            // Get current certification
            const currentSql = `
                SELECT certification_id, expiry_date FROM pf_user_certifications
                WHERE user_cert_id = :userCertId AND user_id = :userId
            `;

            const currentResult = await this.database.execute(currentSql, { userCertId, userId });

            if (currentResult.rows.length === 0) {
                throw new Error('Certification not found');
            }

            const current = currentResult.rows[0];

            // Update current certification
            const updateSql = `
                UPDATE pf_user_certifications
                SET status = 'renewing',
                    renewal_reminder_date = :renewalReminderDate,
                    notes = notes || CHR(10) || 'Renewal in progress: ' || :renewalNotes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_cert_id = :userCertId AND user_id = :userId
            `;

            await this.database.execute(updateSql, {
                userCertId,
                userId,
                renewalReminderDate: renewalData.targetRenewalDate || null,
                renewalNotes: renewalData.notes || new Date().toISOString()
            });

            // If renewal is complete, create new certification entry
            if (renewalData.isComplete) {
                const newCertData = {
                    certificationId: current.certification_id,
                    credentialNumber: renewalData.newCredentialNumber,
                    issueDate: renewalData.newIssueDate || new Date(),
                    expiryDate: renewalData.newExpiryDate,
                    verificationUrl: renewalData.verificationUrl,
                    cpeCreditsEarned: renewalData.cpeCreditsUsed,
                    notes: `Renewed from certification ${userCertId}`
                };

                const newCertId = await this.addUserCertification(userId, newCertData);

                // Mark old certification as renewed
                await this.database.execute(
                    'UPDATE pf_user_certifications SET status = \'renewed\' WHERE user_cert_id = :userCertId',
                    { userCertId }
                );

                await this.database.commit();
                return newCertId;
            }

            await this.database.commit();
            return userCertId;
        } catch (error) {
            await this.database.rollback();
            logger.error('Error tracking renewal:', error);
            throw error;
        }
    }

    /**
     * Get certification statistics
     */
    async getCertificationStats(userId) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_certifications,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_certifications,
                    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_certifications,
                    COUNT(DISTINCT c.issuing_organization) as unique_organizations,
                    COUNT(DISTINCT c.industry) as industries_covered,
                    SUM(uc.cpe_credits_earned) as total_cpe_credits,
                    MIN(uc.issue_date) as first_certification_date,
                    MAX(uc.issue_date) as latest_certification_date
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                WHERE uc.user_id = :userId
            `;

            const result = await this.database.execute(sql, { userId });
            const stats = result.rows[0];

            // Get certifications by level
            const levelSql = `
                SELECT 
                    c.certification_level,
                    COUNT(*) as count
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                WHERE uc.user_id = :userId
                AND uc.status = 'active'
                GROUP BY c.certification_level
            `;

            const levelResult = await this.database.execute(levelSql, { userId });

            // Get skills validated
            const skillsSql = `
                SELECT DISTINCT skill
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                CROSS JOIN JSON_TABLE(c.skills_validated, '$[*]' 
                    COLUMNS (skill VARCHAR2(100) PATH '$')
                ) jt
                WHERE uc.user_id = :userId
                AND uc.status = 'active'
            `;

            const skillsResult = await this.database.execute(skillsSql, { userId });

            return {
                summary: {
                    total: parseInt(stats.total_certifications) || 0,
                    active: parseInt(stats.active_certifications) || 0,
                    expired: parseInt(stats.expired_certifications) || 0,
                    organizations: parseInt(stats.unique_organizations) || 0,
                    industries: parseInt(stats.industries_covered) || 0,
                    cpe_credits: parseFloat(stats.total_cpe_credits) || 0,
                    years_certified: stats.first_certification_date ? 
                        Math.floor((new Date() - new Date(stats.first_certification_date)) / (365 * 24 * 60 * 60 * 1000)) : 0
                },
                by_level: levelResult.rows,
                skills_validated: skillsResult.rows.map(r => r.skill)
            };
        } catch (error) {
            logger.error('Error getting certification stats:', error);
            throw error;
        }
    }

    /**
     * Get recommended certifications
     */
    async getRecommendedCertifications(userId, limit = 5) {
        try {
            // Get user's career goals and current skills
            const profileSql = `
                SELECT 
                    target_role,
                    industry_preferences
                FROM pf_user_profiles
                WHERE user_id = :userId
            `;

            const profileResult = await this.database.execute(profileSql, { userId });
            const profile = profileResult.rows[0] || {};

            // Get user's current certifications
            const currentCertsSql = `
                SELECT certification_id FROM pf_user_certifications
                WHERE user_id = :userId AND status = 'active'
            `;

            const currentCertsResult = await this.database.execute(currentCertsSql, { userId });
            const currentCertIds = currentCertsResult.rows.map(r => r.certification_id);

            // Find relevant certifications
            let sql = `
                SELECT 
                    c.*,
                    (
                        CASE 
                            WHEN c.industry = :userIndustry THEN 0.3
                            ELSE 0
                        END +
                        c.market_demand_score * 0.2 +
                        CASE 
                            WHEN c.average_salary_impact > 10000 THEN 0.2
                            WHEN c.average_salary_impact > 5000 THEN 0.1
                            ELSE 0
                        END +
                        CASE
                            WHEN c.certification_level = 'professional' THEN 0.2
                            WHEN c.certification_level = 'associate' THEN 0.1
                            ELSE 0.05
                        END
                    ) as relevance_score
                FROM pf_certifications c
                WHERE c.is_active = 'Y'
            `;

            const binds = {
                userIndustry: profile.industry_preferences || 'Technology'
            };

            if (currentCertIds.length > 0) {
                const placeholders = currentCertIds.map((_, i) => `:cert${i}`).join(',');
                sql += ` AND c.certification_id NOT IN (${placeholders})`;
                currentCertIds.forEach((id, i) => {
                    binds[`cert${i}`] = id;
                });
            }

            sql += ` ORDER BY relevance_score DESC`;
            sql += ` FETCH FIRST :limit ROWS ONLY`;
            binds.limit = limit;

            const result = await this.database.execute(sql, binds);

            return result.rows.map(cert => ({
                ...cert,
                skills_validated: cert.skills_validated ? JSON.parse(cert.skills_validated) : [],
                recommendation_reason: this.generateRecommendationReason(cert, profile)
            }));
        } catch (error) {
            logger.error('Error getting recommended certifications:', error);
            throw error;
        }
    }

    /**
     * Calculate CPE credit summary
     */
    async calculateCPECredits(userId, startDate, endDate) {
        try {
            const sql = `
                SELECT 
                    uc.certification_id,
                    c.certification_name,
                    c.issuing_organization,
                    uc.cpe_credits_earned,
                    uc.issue_date
                FROM pf_user_certifications uc
                JOIN pf_certifications c ON uc.certification_id = c.certification_id
                WHERE uc.user_id = :userId
                AND uc.cpe_credits_earned IS NOT NULL
                AND uc.issue_date BETWEEN :startDate AND :endDate
                ORDER BY uc.issue_date DESC
            `;

            const result = await this.database.execute(sql, { userId, startDate, endDate });

            const totalCredits = result.rows.reduce((sum, cert) => sum + (cert.cpe_credits_earned || 0), 0);

            return {
                total_credits: totalCredits,
                certifications: result.rows,
                period: {
                    start: startDate,
                    end: endDate
                }
            };
        } catch (error) {
            logger.error('Error calculating CPE credits:', error);
            throw error;
        }
    }

    // Helper methods

    async setRenewalReminder(userCertId, expiryDate, userId) {
        try {
            // Set reminder 90 days before expiry
            const reminderDate = new Date(expiryDate);
            reminderDate.setDate(reminderDate.getDate() - 90);

            const sql = `
                UPDATE pf_user_certifications
                SET renewal_reminder_date = :reminderDate
                WHERE user_cert_id = :userCertId
                AND user_id = :userId
            `;

            await this.database.execute(sql, { reminderDate, userCertId, userId });
        } catch (error) {
            logger.error('Error setting renewal reminder:', error);
        }
    }

    generateRecommendationReason(certification, profile) {
        const reasons = [];

        if (certification.market_demand_score >= 4) {
            reasons.push('High market demand');
        }

        if (certification.average_salary_impact >= 10000) {
            reasons.push(`Average salary increase: $${certification.average_salary_impact.toLocaleString()}`);
        }

        if (profile.industry_preferences === certification.industry) {
            reasons.push('Matches your industry preference');
        }

        if (certification.certification_level === 'professional') {
            reasons.push('Professional level certification');
        }

        return reasons.join(' • ');
    }
}

module.exports = CertificationService;