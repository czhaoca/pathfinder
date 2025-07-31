const oracledb = require('oracledb');
const logger = require('../utils/logger');

class AnalyticsRepository {
  constructor(database) {
    this.database = database;
  }

  /**
   * Save skills progression data
   */
  async saveSkillsProgression(schemaPrefix, skillsProgression) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Clear existing progression data
      await connection.execute(
        `DELETE FROM ${schemaPrefix}_skills_progression`,
        [],
        { autoCommit: false }
      );

      // Insert new progression data
      for (const skill of skillsProgression) {
        await connection.execute(
          `INSERT INTO ${schemaPrefix}_skills_progression (
            progression_id, skill_name, skill_category, proficiency_level,
            confidence_score, evidence_count, first_used_date, last_used_date,
            total_months_used, contexts
          ) VALUES (
            HEXTORAW(:progressionId), :skillName, :skillCategory, :proficiencyLevel,
            :confidenceScore, :evidenceCount, :firstUsedDate, :lastUsedDate,
            :totalMonthsUsed, :contexts
          )`,
          {
            progressionId: skill.progressionId.replace(/-/g, ''),
            skillName: skill.skillName,
            skillCategory: skill.skillCategory || 'other',
            proficiencyLevel: skill.proficiencyLevel,
            confidenceScore: skill.confidenceScore,
            evidenceCount: skill.evidenceCount,
            firstUsedDate: skill.firstUsedDate,
            lastUsedDate: skill.lastUsedDate,
            totalMonthsUsed: skill.totalMonthsUsed,
            contexts: JSON.stringify(skill.contexts)
          },
          { autoCommit: false }
        );
      }

      await connection.commit();
      logger.info('Skills progression saved successfully', { 
        schemaPrefix, 
        skillCount: skillsProgression.length 
      });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save skills progression', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get skills progression data
   */
  async getSkillsProgression(schemaPrefix) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT 
          RAWTOHEX(progression_id) as progression_id,
          skill_name, skill_category, proficiency_level,
          confidence_score, evidence_count, first_used_date, 
          last_used_date, total_months_used,
          JSON_VALUE(contexts, '$') as contexts,
          created_at, updated_at
        FROM ${schemaPrefix}_skills_progression
        ORDER BY proficiency_level DESC, evidence_count DESC`,
        [],
        { 
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchInfo: {
            contexts: { type: oracledb.STRING }
          }
        }
      );

      return result.rows.map(row => ({
        ...row,
        progressionId: this.formatUuid(row.progression_id),
        contexts: this.parseJson(row.contexts, [])
      }));
    } catch (error) {
      logger.error('Failed to get skills progression', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save career milestones
   */
  async saveCareerMilestones(schemaPrefix, milestones) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      for (const milestone of milestones) {
        await connection.execute(
          `MERGE INTO ${schemaPrefix}_career_milestones m
          USING (SELECT HEXTORAW(:milestoneId) AS milestone_id FROM dual) s
          ON (m.milestone_id = s.milestone_id)
          WHEN NOT MATCHED THEN
            INSERT (milestone_id, milestone_type, milestone_date, title, 
                   description, organization, impact_score, related_experiences, 
                   related_skills, metadata)
            VALUES (
              HEXTORAW(:milestoneId), :milestoneType, :milestoneDate, :title,
              :description, :organization, :impactScore, :relatedExperiences,
              :relatedSkills, :metadata
            )`,
          {
            milestoneId: milestone.milestoneId.replace(/-/g, ''),
            milestoneType: milestone.milestoneType,
            milestoneDate: milestone.milestoneDate,
            title: milestone.title,
            description: milestone.description,
            organization: milestone.organization,
            impactScore: milestone.impactScore,
            relatedExperiences: JSON.stringify(milestone.relatedExperiences || []),
            relatedSkills: JSON.stringify(milestone.relatedSkills || []),
            metadata: JSON.stringify(milestone.metadata || {})
          },
          { autoCommit: false }
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save career milestones', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save impact scores for an experience
   */
  async saveImpactScores(schemaPrefix, experienceId, impactScores) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Delete existing scores for this experience
      await connection.execute(
        `DELETE FROM ${schemaPrefix}_experience_impact_scores 
         WHERE experience_id = HEXTORAW(:experienceId)`,
        { experienceId: experienceId.replace(/-/g, '') },
        { autoCommit: false }
      );

      // Insert new scores
      const categories = ['revenue', 'efficiency', 'teamGrowth', 'innovation'];
      
      for (const category of categories) {
        if (typeof impactScores[category] === 'number') {
          await connection.execute(
            `INSERT INTO ${schemaPrefix}_experience_impact_scores (
              score_id, experience_id, impact_category, impact_score,
              confidence_level
            ) VALUES (
              SYS_GUID(), HEXTORAW(:experienceId), :category, :score, :confidence
            )`,
            {
              experienceId: experienceId.replace(/-/g, ''),
              category,
              score: impactScores[category],
              confidence: 0.8 // Default confidence
            },
            { autoCommit: false }
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save impact scores', { 
        schemaPrefix, 
        experienceId,
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get impact scores for experiences
   */
  async getImpactScores(schemaPrefix, experienceIds = null) {
    const connection = await this.database.getConnection();
    
    try {
      let sql = `
        SELECT 
          RAWTOHEX(score_id) as score_id,
          RAWTOHEX(experience_id) as experience_id,
          impact_category, impact_score, quantified_value,
          value_unit, confidence_level, calculation_method,
          supporting_evidence, created_at
        FROM ${schemaPrefix}_experience_impact_scores
      `;

      const binds = {};
      
      if (experienceIds && experienceIds.length > 0) {
        sql += ` WHERE experience_id IN (${experienceIds.map((_, i) => `:exp${i}`).join(',')})`;
        experienceIds.forEach((id, i) => {
          binds[`exp${i}`] = Buffer.from(id.replace(/-/g, ''), 'hex');
        });
      }

      sql += ' ORDER BY experience_id, impact_category';

      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      return result.rows.map(row => ({
        ...row,
        scoreId: this.formatUuid(row.score_id),
        experienceId: this.formatUuid(row.experience_id)
      }));
    } catch (error) {
      logger.error('Failed to get impact scores', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save analytics summary
   */
  async saveAnalyticsSummary(schemaPrefix, summary) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute(
        `MERGE INTO ${schemaPrefix}_career_analytics_summary s
        USING (SELECT TRUNC(SYSDATE) AS analysis_date FROM dual) d
        ON (s.analysis_date = d.analysis_date)
        WHEN MATCHED THEN
          UPDATE SET
            total_years_experience = :totalYears,
            career_velocity_score = :velocityScore,
            skill_diversity_score = :diversityScore,
            leadership_score = :leadershipScore,
            technical_depth_score = :technicalScore,
            industry_expertise_score = :industryScore,
            top_skills = :topSkills,
            skill_gaps = :skillGaps,
            career_trajectory = :trajectory,
            recommendations = :recommendations,
            updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            summary_id, analysis_date, total_years_experience,
            career_velocity_score, skill_diversity_score, leadership_score,
            technical_depth_score, industry_expertise_score,
            top_skills, skill_gaps, career_trajectory, recommendations
          ) VALUES (
            SYS_GUID(), TRUNC(SYSDATE), :totalYears,
            :velocityScore, :diversityScore, :leadershipScore,
            :technicalScore, :industryScore,
            :topSkills, :skillGaps, :trajectory, :recommendations
          )`,
        {
          totalYears: summary.totalYearsExperience,
          velocityScore: summary.careerVelocityScore,
          diversityScore: summary.skillDiversityScore,
          leadershipScore: summary.leadershipScore,
          technicalScore: summary.technicalDepthScore,
          industryScore: summary.industryExpertiseScore,
          topSkills: JSON.stringify(summary.topSkills),
          skillGaps: JSON.stringify(summary.skillGaps),
          trajectory: JSON.stringify(summary.careerTrajectory),
          recommendations: JSON.stringify(summary.recommendations)
        }
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save analytics summary', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get latest analytics summary
   */
  async getAnalyticsSummary(schemaPrefix) {
    const connection = await this.database.getConnection();
    
    try {
      const result = await connection.execute(
        `SELECT 
          RAWTOHEX(summary_id) as summary_id,
          analysis_date, total_years_experience,
          career_velocity_score, skill_diversity_score, leadership_score,
          technical_depth_score, industry_expertise_score,
          JSON_VALUE(top_skills, '$') as top_skills,
          JSON_VALUE(skill_gaps, '$') as skill_gaps,
          JSON_VALUE(career_trajectory, '$') as career_trajectory,
          JSON_VALUE(recommendations, '$') as recommendations,
          created_at, updated_at
        FROM ${schemaPrefix}_career_analytics_summary
        WHERE analysis_date = (
          SELECT MAX(analysis_date) 
          FROM ${schemaPrefix}_career_analytics_summary
        )`,
        [],
        { 
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchInfo: {
            top_skills: { type: oracledb.STRING },
            skill_gaps: { type: oracledb.STRING },
            career_trajectory: { type: oracledb.STRING },
            recommendations: { type: oracledb.STRING }
          }
        }
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ...row,
        summaryId: this.formatUuid(row.summary_id),
        topSkills: this.parseJson(row.top_skills, []),
        skillGaps: this.parseJson(row.skill_gaps, []),
        careerTrajectory: this.parseJson(row.career_trajectory, {}),
        recommendations: this.parseJson(row.recommendations, [])
      };
    } catch (error) {
      logger.error('Failed to get analytics summary', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Save achievements
   */
  async saveAchievements(schemaPrefix, achievements) {
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      for (const achievement of achievements) {
        await connection.execute(
          `INSERT INTO ${schemaPrefix}_achievements (
            achievement_id, experience_id, achievement_type, title,
            description, impact_statement, quantified_impact,
            verification_status, evidence_url, date_achieved,
            visibility, tags
          ) VALUES (
            HEXTORAW(:achievementId), HEXTORAW(:experienceId), :achievementType, :title,
            :description, :impactStatement, :quantifiedImpact,
            :verificationStatus, :evidenceUrl, :dateAchieved,
            :visibility, :tags
          )`,
          {
            achievementId: achievement.achievementId.replace(/-/g, ''),
            experienceId: achievement.experienceId.replace(/-/g, ''),
            achievementType: achievement.achievementType,
            title: achievement.title,
            description: achievement.description,
            impactStatement: achievement.impactStatement,
            quantifiedImpact: JSON.stringify(achievement.quantifiedImpact || {}),
            verificationStatus: achievement.verificationStatus || 'self_reported',
            evidenceUrl: achievement.evidenceUrl,
            dateAchieved: achievement.dateAchieved,
            visibility: achievement.visibility || 'private',
            tags: JSON.stringify(achievement.tags || [])
          },
          { autoCommit: false }
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to save achievements', { 
        schemaPrefix, 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Helper methods
   */
  formatUuid(hexString) {
    if (!hexString || hexString.length !== 32) return hexString;
    
    return [
      hexString.substring(0, 8),
      hexString.substring(8, 12),
      hexString.substring(12, 16),
      hexString.substring(16, 20),
      hexString.substring(20, 32)
    ].join('-').toLowerCase();
  }

  parseJson(jsonString, defaultValue) {
    if (!jsonString) return defaultValue;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('Failed to parse JSON', { json: jsonString, error: error.message });
      return defaultValue;
    }
  }
}

module.exports = AnalyticsRepository;