const { ulid } = require('ulid');
const logger = require('../utils/logger');

class SkillsGapService {
  constructor(databaseService, careerPathService) {
    this.db = databaseService;
    this.careerPathService = careerPathService;
  }

  /**
   * Analyze skills gap between current role and target role
   */
  async analyzeSkillsGap(currentNodeId, targetNodeId) {
    try {
      // Get both nodes
      const [currentNode, targetNode] = await Promise.all([
        this.careerPathService.getCareerNode(currentNodeId),
        this.careerPathService.getCareerNode(targetNodeId)
      ]);

      // Get user's current skills (if userId provided)
      // For now, we'll assume user has all required skills for current role
      const currentSkills = new Set([
        ...currentNode.required_skills,
        ...currentNode.preferred_skills.slice(0, Math.floor(currentNode.preferred_skills.length / 2))
      ]);

      // Calculate gaps
      const requiredGaps = targetNode.required_skills.filter(
        skill => !currentSkills.has(skill)
      );
      const preferredGaps = targetNode.preferred_skills.filter(
        skill => !currentSkills.has(skill)
      );

      // Get transition if it exists
      const transitionSql = `
        SELECT 
          typical_duration_months,
          difficulty_score,
          required_skills_gap,
          success_rate,
          transition_strategies
        FROM pf_career_transitions
        WHERE from_node_id = ? AND to_node_id = ?
      `;
      
      const transitionResult = await this.db.execute(transitionSql, [currentNodeId, targetNodeId]);
      const transition = transitionResult.rows[0] || null;

      // Get skill details and learning resources
      const allGapSkills = [...new Set([...requiredGaps, ...preferredGaps])];
      const skillDetails = await this.getSkillDetails(allGapSkills);
      const learningResources = await this.getLearningResourcesForSkills(allGapSkills);

      return {
        current_role: {
          node_id: currentNode.node_id,
          title: currentNode.role_title,
          level: currentNode.role_level
        },
        target_role: {
          node_id: targetNode.node_id,
          title: targetNode.role_title,
          level: targetNode.role_level,
          salary_range: {
            min: targetNode.salary_range_min,
            max: targetNode.salary_range_max
          }
        },
        skills_gap: {
          required: requiredGaps.map(skillId => ({
            skill_id: skillId,
            ...skillDetails[skillId],
            priority: 'high',
            resources: learningResources[skillId] || []
          })),
          preferred: preferredGaps.map(skillId => ({
            skill_id: skillId,
            ...skillDetails[skillId],
            priority: 'medium',
            resources: learningResources[skillId] || []
          }))
        },
        transition_info: transition ? {
          typical_duration_months: transition.typical_duration_months,
          difficulty_score: transition.difficulty_score,
          success_rate: transition.success_rate,
          strategies: transition.transition_strategies,
          required_skills: JSON.parse(transition.required_skills_gap || '[]')
        } : null,
        estimated_time_to_transition: this.estimateTransitionTime(requiredGaps.length, preferredGaps.length),
        transferable_skills: Array.from(currentSkills).filter(
          skill => targetNode.required_skills.includes(skill) || 
                   targetNode.preferred_skills.includes(skill)
        )
      };
    } catch (error) {
      logger.error('Failed to analyze skills gap', { 
        error: error.message, 
        currentNodeId, 
        targetNodeId 
      });
      throw error;
    }
  }

  /**
   * Get user's skills gap for their active goals
   */
  async getUserSkillsGap(userId) {
    try {
      // Get user's active goals
      const goalsSql = `
        SELECT 
          g.goal_id,
          g.current_node_id,
          g.target_node_id,
          g.target_date,
          g.progress_percentage,
          cn.role_title as current_role,
          tn.role_title as target_role
        FROM pf_user_career_goals g
        JOIN pf_career_nodes cn ON g.current_node_id = cn.node_id
        JOIN pf_career_nodes tn ON g.target_node_id = tn.node_id
        WHERE g.user_id = ? AND g.status = 'active'
        ORDER BY g.created_at DESC
      `;

      const goalsResult = await this.db.execute(goalsSql, [userId]);
      
      if (goalsResult.rows.length === 0) {
        return { goals: [], message: 'No active career goals found' };
      }

      // Analyze gap for each goal
      const gapsAnalysis = await Promise.all(
        goalsResult.rows.map(async (goal) => {
          const gap = await this.analyzeSkillsGap(
            goal.current_node_id,
            goal.target_node_id
          );

          // Get user's progress on skills
          const progress = await this.getUserSkillsProgress(userId, goal.goal_id);

          return {
            goal_id: goal.goal_id,
            current_role: goal.current_role,
            target_role: goal.target_role,
            target_date: goal.target_date,
            overall_progress: goal.progress_percentage,
            skills_gap: gap.skills_gap,
            skills_progress: progress,
            estimated_completion: this.estimateCompletionDate(
              gap.skills_gap,
              progress,
              goal.target_date
            )
          };
        })
      );

      return { goals: gapsAnalysis };
    } catch (error) {
      logger.error('Failed to get user skills gap', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Submit a skills self-assessment
   */
  async submitSkillsAssessment(userId, assessmentData) {
    const { goalId, skills } = assessmentData;

    try {
      // Verify goal belongs to user
      const goalCheck = await this.db.execute(
        'SELECT goal_id FROM pf_user_career_goals WHERE goal_id = ? AND user_id = ?',
        [goalId, userId]
      );

      if (goalCheck.rows.length === 0) {
        throw new Error('Goal not found or does not belong to user');
      }

      // Update or insert skills progress
      for (const skill of skills) {
        const existingProgress = await this.db.execute(
          `SELECT progress_id FROM pf_user_skills_progress 
           WHERE user_id = ? AND goal_id = ? AND skill_id = ?`,
          [userId, goalId, skill.skill_id]
        );

        if (existingProgress.rows.length > 0) {
          // Update existing progress
          await this.db.execute(
            `UPDATE pf_user_skills_progress 
             SET current_level = ?, 
                 last_activity_date = TRUNC(CURRENT_DATE),
                 updated_at = CURRENT_TIMESTAMP
             WHERE progress_id = ?`,
            [skill.current_level, existingProgress.rows[0].progress_id]
          );
        } else {
          // Insert new progress
          const progressId = ulid();
          await this.db.execute(
            `INSERT INTO pf_user_skills_progress (
              progress_id, user_id, goal_id, skill_id,
              current_level, target_level
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [progressId, userId, goalId, skill.skill_id, 
             skill.current_level, skill.target_level || 4]
          );
        }
      }

      // Update goal progress
      await this.updateGoalProgress(goalId);

      return { success: true, message: 'Skills assessment saved successfully' };
    } catch (error) {
      logger.error('Failed to submit skills assessment', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get skill details from the catalog
   */
  async getSkillDetails(skillIds) {
    if (skillIds.length === 0) return {};

    try {
      const placeholders = skillIds.map(() => '?').join(',');
      const sql = `
        SELECT 
          skill_id,
          skill_name,
          category,
          description
        FROM pf_ref_skills_catalog
        WHERE skill_id IN (${placeholders})
      `;

      const result = await this.db.execute(sql, skillIds);
      
      // Create a map for easy lookup
      const skillMap = {};
      result.rows.forEach(row => {
        skillMap[row.skill_id] = {
          name: row.skill_name,
          category: row.category,
          description: row.description
        };
      });

      // Add placeholder for skills not in catalog
      skillIds.forEach(skillId => {
        if (!skillMap[skillId]) {
          skillMap[skillId] = {
            name: skillId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            category: 'Other',
            description: null
          };
        }
      });

      return skillMap;
    } catch (error) {
      logger.error('Failed to get skill details', { error: error.message });
      throw error;
    }
  }

  /**
   * Get learning resources for skills
   */
  async getLearningResourcesForSkills(skillIds) {
    if (skillIds.length === 0) return {};

    try {
      const placeholders = skillIds.map(() => '?').join(',');
      const sql = `
        SELECT 
          skill_id,
          resource_id,
          title,
          provider,
          url,
          resource_type,
          duration_hours,
          cost,
          currency,
          difficulty_level,
          rating,
          is_free
        FROM pf_learning_resources
        WHERE skill_id IN (${placeholders})
        ORDER BY rating DESC, is_free DESC
      `;

      const result = await this.db.execute(sql, skillIds);
      
      // Group resources by skill
      const resourceMap = {};
      result.rows.forEach(row => {
        if (!resourceMap[row.skill_id]) {
          resourceMap[row.skill_id] = [];
        }
        resourceMap[row.skill_id].push({
          resource_id: row.resource_id,
          title: row.title,
          provider: row.provider,
          url: row.url,
          type: row.resource_type,
          duration_hours: row.duration_hours,
          cost: row.cost,
          currency: row.currency,
          difficulty_level: row.difficulty_level,
          rating: row.rating,
          is_free: row.is_free === 'Y'
        });
      });

      return resourceMap;
    } catch (error) {
      logger.error('Failed to get learning resources', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's progress on skills for a goal
   */
  async getUserSkillsProgress(userId, goalId) {
    try {
      const sql = `
        SELECT 
          skill_id,
          current_level,
          target_level,
          learning_hours_logged,
          certifications_earned,
          last_activity_date
        FROM pf_user_skills_progress
        WHERE user_id = ? AND goal_id = ?
      `;

      const result = await this.db.execute(sql, [userId, goalId]);
      
      const progressMap = {};
      result.rows.forEach(row => {
        progressMap[row.skill_id] = {
          current_level: row.current_level,
          target_level: row.target_level,
          hours_logged: row.learning_hours_logged,
          certifications: JSON.parse(row.certifications_earned || '[]'),
          last_activity: row.last_activity_date,
          progress_percentage: (row.current_level / row.target_level) * 100
        };
      });

      return progressMap;
    } catch (error) {
      logger.error('Failed to get user skills progress', { error: error.message });
      throw error;
    }
  }

  /**
   * Update goal progress based on skills progress
   */
  async updateGoalProgress(goalId) {
    try {
      // Calculate overall progress based on skills
      const sql = `
        SELECT 
          COUNT(*) as total_skills,
          AVG(current_level / NULLIF(target_level, 0)) as avg_progress
        FROM pf_user_skills_progress
        WHERE goal_id = ?
      `;

      const result = await this.db.execute(sql, [goalId]);
      const progress = Math.round((result.rows[0].avg_progress || 0) * 100);

      // Update goal
      await this.db.execute(
        `UPDATE pf_user_career_goals 
         SET progress_percentage = ?, updated_at = CURRENT_TIMESTAMP
         WHERE goal_id = ?`,
        [progress, goalId]
      );

      // Check if goal is achieved
      if (progress >= 100) {
        await this.db.execute(
          `UPDATE pf_user_career_goals 
           SET status = 'achieved', achieved_date = TRUNC(CURRENT_DATE)
           WHERE goal_id = ? AND status = 'active'`,
          [goalId]
        );
      }
    } catch (error) {
      logger.error('Failed to update goal progress', { error: error.message, goalId });
    }
  }

  /**
   * Estimate time to complete transition
   */
  estimateTransitionTime(requiredSkillsCount, preferredSkillsCount) {
    // Rough estimate: 3 months per required skill, 2 months per preferred skill
    const requiredTime = requiredSkillsCount * 3;
    const preferredTime = Math.floor(preferredSkillsCount * 0.5) * 2; // Only need half of preferred
    
    return {
      minimum_months: requiredTime,
      recommended_months: requiredTime + preferredTime,
      factors: [
        'Time commitment (part-time vs full-time learning)',
        'Prior experience and learning ability',
        'Access to mentorship and resources',
        'Practical application opportunities'
      ]
    };
  }

  /**
   * Estimate completion date based on progress
   */
  estimateCompletionDate(skillsGap, progress, targetDate) {
    const totalSkills = skillsGap.required.length + Math.floor(skillsGap.preferred.length / 2);
    let completedSkills = 0;

    // Count completed skills
    Object.values(progress).forEach(p => {
      if (p.progress_percentage >= 80) {
        completedSkills++;
      }
    });

    const remainingSkills = totalSkills - completedSkills;
    const monthsPerSkill = 3; // Average
    const estimatedMonths = remainingSkills * monthsPerSkill;

    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + estimatedMonths);

    return {
      estimated_date: estimatedDate,
      on_track: estimatedDate <= new Date(targetDate),
      months_remaining: estimatedMonths
    };
  }
}

module.exports = SkillsGapService;