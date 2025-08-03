const { ulid } = require('ulid');
const logger = require('../utils/logger');

class LearningService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Get learning recommendations for a specific skill
   */
  async getRecommendations(skillId, filters = {}) {
    const {
      maxCost = null,
      difficultyLevel = null,
      resourceType = null,
      freeOnly = false,
      limit = 10
    } = filters;

    try {
      let sql = `
        SELECT 
          resource_id,
          skill_id,
          title,
          provider,
          url,
          resource_type,
          duration_hours,
          cost,
          currency,
          difficulty_level,
          rating,
          reviews_count,
          is_free,
          last_verified
        FROM pf_learning_resources
        WHERE skill_id = ?
      `;
      const params = [skillId];

      if (freeOnly) {
        sql += ` AND is_free = 'Y'`;
      } else if (maxCost !== null) {
        sql += ` AND cost <= ?`;
        params.push(maxCost);
      }

      if (difficultyLevel) {
        sql += ` AND difficulty_level = ?`;
        params.push(difficultyLevel);
      }

      if (resourceType) {
        sql += ` AND resource_type = ?`;
        params.push(resourceType);
      }

      // Order by rating and reviews
      sql += ` ORDER BY rating DESC, reviews_count DESC LIMIT ?`;
      params.push(limit);

      const result = await this.db.execute(sql, params);

      // Enrich with additional recommendations
      const resources = result.rows.map(row => ({
        ...row,
        is_free: row.is_free === 'Y',
        estimated_completion_days: Math.ceil(row.duration_hours / 2), // Assuming 2 hours/day
        value_score: this.calculateValueScore(row)
      }));

      return {
        skill_id: skillId,
        resources: resources,
        summary: this.generateLearningSummary(resources)
      };
    } catch (error) {
      logger.error('Failed to get learning recommendations', { error: error.message, skillId });
      throw error;
    }
  }

  /**
   * Get personalized learning plan for a user
   */
  async getLearningPlan(userId) {
    try {
      // Get user's active goals and skill gaps
      const goalsSql = `
        SELECT DISTINCT
          g.goal_id,
          g.target_node_id,
          g.target_date,
          sp.skill_id,
          sp.current_level,
          sp.target_level,
          sp.learning_hours_logged,
          sc.skill_name,
          sc.category
        FROM pf_user_career_goals g
        JOIN pf_user_skills_progress sp ON g.goal_id = sp.goal_id
        LEFT JOIN pf_ref_skills_catalog sc ON sp.skill_id = sc.skill_id
        WHERE g.user_id = ? 
          AND g.status = 'active'
          AND sp.current_level < sp.target_level
        ORDER BY g.target_date, (sp.target_level - sp.current_level) DESC
      `;

      const goalsResult = await this.db.execute(goalsSql, [userId]);

      if (goalsResult.rows.length === 0) {
        return {
          message: 'No active learning needs found. Set a career goal to get started!',
          plan: []
        };
      }

      // Group skills by goal and priority
      const skillsByGoal = {};
      goalsResult.rows.forEach(row => {
        if (!skillsByGoal[row.goal_id]) {
          skillsByGoal[row.goal_id] = {
            goal_id: row.goal_id,
            target_date: row.target_date,
            skills: []
          };
        }
        skillsByGoal[row.goal_id].skills.push({
          skill_id: row.skill_id,
          skill_name: row.skill_name || row.skill_id,
          category: row.category,
          current_level: row.current_level,
          target_level: row.target_level,
          gap: row.target_level - row.current_level,
          hours_logged: row.learning_hours_logged
        });
      });

      // Create learning plan
      const learningPlan = [];
      
      for (const goal of Object.values(skillsByGoal)) {
        // Calculate time until target date
        const monthsRemaining = this.calculateMonthsRemaining(goal.target_date);
        
        // Prioritize skills
        const prioritizedSkills = this.prioritizeSkills(goal.skills, monthsRemaining);
        
        // Get resources for top priority skills
        for (const skill of prioritizedSkills.slice(0, 3)) { // Top 3 skills per goal
          const resources = await this.getRecommendations(skill.skill_id, {
            limit: 3,
            maxCost: 100 // Reasonable budget filter
          });

          learningPlan.push({
            goal_id: goal.goal_id,
            skill: skill,
            priority: skill.priority,
            recommended_hours_per_week: skill.recommended_hours,
            resources: resources.resources,
            milestones: this.generateSkillMilestones(skill)
          });
        }
      }

      // Generate weekly schedule
      const weeklySchedule = this.generateWeeklySchedule(learningPlan);

      return {
        plan: learningPlan,
        weekly_schedule: weeklySchedule,
        total_hours_per_week: weeklySchedule.total_hours,
        estimated_completion: this.estimatePlanCompletion(learningPlan)
      };
    } catch (error) {
      logger.error('Failed to get learning plan', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Log learning activity
   */
  async logLearningActivity(userId, activityData) {
    const {
      resourceId,
      skillId,
      activityType,
      hoursSpent,
      progressPercentage,
      notes
    } = activityData;

    try {
      const activityId = ulid();
      
      // Insert activity log
      await this.db.execute(
        `INSERT INTO pf_learning_activities (
          activity_id, user_id, resource_id, skill_id,
          activity_type, hours_spent, progress_percentage, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [activityId, userId, resourceId, skillId, 
         activityType, hoursSpent, progressPercentage, notes]
      );

      // Update skills progress if hours spent
      if (hoursSpent > 0) {
        await this.updateSkillProgress(userId, skillId, hoursSpent);
      }

      // Check for achievements
      const achievements = await this.checkLearningAchievements(userId, skillId);

      return {
        activity_id: activityId,
        logged: true,
        achievements: achievements
      };
    } catch (error) {
      logger.error('Failed to log learning activity', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update skill progress with learning hours
   */
  async updateSkillProgress(userId, skillId, hoursToAdd) {
    try {
      // Update all active goals that include this skill
      const sql = `
        UPDATE pf_user_skills_progress
        SET learning_hours_logged = learning_hours_logged + ?,
            last_activity_date = TRUNC(CURRENT_DATE),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? 
          AND skill_id = ?
          AND goal_id IN (
            SELECT goal_id 
            FROM pf_user_career_goals 
            WHERE user_id = ? AND status = 'active'
          )
      `;

      await this.db.execute(sql, [hoursToAdd, userId, skillId, userId]);

      // Auto-update skill level based on hours (every 20 hours = 1 level)
      await this.db.execute(
        `UPDATE pf_user_skills_progress
         SET current_level = LEAST(
           FLOOR(learning_hours_logged / 20) + 1,
           target_level
         )
         WHERE user_id = ? 
           AND skill_id = ?
           AND current_level < FLOOR(learning_hours_logged / 20) + 1`,
        [userId, skillId]
      );
    } catch (error) {
      logger.error('Failed to update skill progress', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate value score for a resource
   */
  calculateValueScore(resource) {
    let score = 0;
    
    // Rating component (0-5 points)
    score += resource.rating || 0;
    
    // Cost component (0-3 points)
    if (resource.is_free === 'Y') {
      score += 3;
    } else if (resource.cost < 50) {
      score += 2;
    } else if (resource.cost < 100) {
      score += 1;
    }
    
    // Duration component (0-2 points)
    if (resource.duration_hours <= 10) {
      score += 2;
    } else if (resource.duration_hours <= 30) {
      score += 1;
    }
    
    // Reviews component (0-2 points)
    if (resource.reviews_count > 1000) {
      score += 2;
    } else if (resource.reviews_count > 100) {
      score += 1;
    }
    
    return Math.round(score * 10) / 10; // Round to 1 decimal
  }

  /**
   * Generate learning summary
   */
  generateLearningSummary(resources) {
    const freeResources = resources.filter(r => r.is_free);
    const totalHours = resources.reduce((sum, r) => sum + r.duration_hours, 0);
    const avgRating = resources.reduce((sum, r) => sum + (r.rating || 0), 0) / resources.length;

    return {
      total_resources: resources.length,
      free_resources: freeResources.length,
      total_hours: totalHours,
      average_rating: Math.round(avgRating * 10) / 10,
      estimated_cost_range: {
        min: Math.min(...resources.filter(r => !r.is_free).map(r => r.cost || 0)),
        max: Math.max(...resources.filter(r => !r.is_free).map(r => r.cost || 0))
      }
    };
  }

  /**
   * Calculate months remaining until target date
   */
  calculateMonthsRemaining(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target - now;
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0, diffMonths);
  }

  /**
   * Prioritize skills based on gap and time remaining
   */
  prioritizeSkills(skills, monthsRemaining) {
    return skills.map(skill => {
      // Calculate priority score
      let priority = skill.gap * 10; // Base priority on gap size
      
      // Adjust for time pressure
      if (monthsRemaining < 6) {
        priority *= 2;
      } else if (monthsRemaining < 12) {
        priority *= 1.5;
      }
      
      // Adjust for progress already made
      if (skill.hours_logged > 0) {
        priority *= 0.8; // Lower priority if already working on it
      }

      // Calculate recommended hours per week
      const totalHoursNeeded = skill.gap * 20; // 20 hours per level
      const weeksRemaining = monthsRemaining * 4;
      const recommendedHours = Math.ceil(totalHoursNeeded / weeksRemaining);

      return {
        ...skill,
        priority: Math.round(priority),
        recommended_hours: Math.min(recommendedHours, 10) // Cap at 10 hours/week
      };
    }).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate skill milestones
   */
  generateSkillMilestones(skill) {
    const milestones = [];
    const levelsToGain = skill.gap;
    
    for (let i = 1; i <= levelsToGain; i++) {
      const currentLevel = skill.current_level + i;
      milestones.push({
        level: currentLevel,
        title: `Reach Level ${currentLevel} in ${skill.skill_name}`,
        hours_required: i * 20,
        suggested_checkpoint: this.getLevelCheckpoint(skill.skill_id, currentLevel)
      });
    }

    return milestones;
  }

  /**
   * Get checkpoint suggestion for skill level
   */
  getLevelCheckpoint(skillId, level) {
    // This would ideally come from a database of skill-specific checkpoints
    const genericCheckpoints = {
      1: 'Complete foundational tutorials and exercises',
      2: 'Build a small project using this skill',
      3: 'Complete an intermediate course or certification',
      4: 'Contribute to open source or work projects',
      5: 'Mentor others or create advanced content'
    };

    return genericCheckpoints[level] || `Demonstrate proficiency at level ${level}`;
  }

  /**
   * Generate weekly learning schedule
   */
  generateWeeklySchedule(learningPlan) {
    const schedule = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
      total_hours: 0
    };

    const days = Object.keys(schedule).filter(d => d !== 'total_hours');
    let dayIndex = 0;

    // Distribute learning across the week
    learningPlan.forEach(item => {
      const hoursPerSession = Math.min(item.recommended_hours_per_week / 3, 2); // Max 2 hours per session
      const sessionsNeeded = Math.ceil(item.recommended_hours_per_week / hoursPerSession);

      for (let i = 0; i < sessionsNeeded; i++) {
        const day = days[dayIndex % days.length];
        schedule[day].push({
          skill: item.skill.skill_name,
          hours: hoursPerSession,
          resource: item.resources[0]?.title || 'Self-study'
        });
        schedule.total_hours += hoursPerSession;
        dayIndex++;
      }
    });

    return schedule;
  }

  /**
   * Estimate plan completion
   */
  estimatePlanCompletion(learningPlan) {
    const totalHoursNeeded = learningPlan.reduce(
      (sum, item) => sum + (item.skill.gap * 20), 0
    );
    const hoursPerWeek = learningPlan.reduce(
      (sum, item) => sum + item.recommended_hours_per_week, 0
    );
    
    const weeksToComplete = Math.ceil(totalHoursNeeded / hoursPerWeek);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + (weeksToComplete * 7));

    return {
      total_hours_needed: totalHoursNeeded,
      weeks_to_complete: weeksToComplete,
      estimated_date: completionDate
    };
  }

  /**
   * Check for learning achievements
   */
  async checkLearningAchievements(userId, skillId) {
    const achievements = [];

    try {
      // Check total hours milestone
      const hoursSql = `
        SELECT SUM(hours_spent) as total_hours
        FROM pf_learning_activities
        WHERE user_id = ? AND skill_id = ?
      `;
      
      const hoursResult = await this.db.execute(hoursSql, [userId, skillId]);
      const totalHours = hoursResult.rows[0]?.total_hours || 0;

      // Hour milestones
      const hourMilestones = [10, 25, 50, 100];
      for (const milestone of hourMilestones) {
        if (totalHours >= milestone && totalHours < milestone + 5) {
          achievements.push({
            type: 'hours_milestone',
            title: `${milestone} Hours Invested`,
            description: `You've dedicated ${milestone} hours to learning ${skillId}!`
          });
        }
      }

      // Check streak
      const streakSql = `
        SELECT COUNT(DISTINCT activity_date) as days_active
        FROM pf_learning_activities
        WHERE user_id = ? 
          AND skill_id = ?
          AND activity_date >= TRUNC(CURRENT_DATE) - 7
      `;
      
      const streakResult = await this.db.execute(streakSql, [userId, skillId]);
      const daysActive = streakResult.rows[0]?.days_active || 0;

      if (daysActive >= 7) {
        achievements.push({
          type: 'streak',
          title: 'Week Warrior',
          description: 'Learning every day for a week!'
        });
      }

      return achievements;
    } catch (error) {
      logger.error('Failed to check achievements', { error: error.message });
      return achievements;
    }
  }
}

module.exports = LearningService;