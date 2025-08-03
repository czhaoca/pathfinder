const { ApiResponse } = require('../../utils/apiResponse');
const { AppError } = require('../../utils/errors');

class CareerPathController {
  constructor(careerPathService, skillsGapService, learningService) {
    this.careerPathService = careerPathService;
    this.skillsGapService = skillsGapService;
    this.learningService = learningService;
  }

  /**
   * Search career paths
   * GET /api/career-paths/search
   */
  async searchCareerPaths(req, res, next) {
    try {
      const { query, industry, level, limit } = req.query;

      const results = await this.careerPathService.searchCareerPaths({
        query,
        industry,
        level,
        limit: limit ? parseInt(limit) : 20
      });

      return ApiResponse.success(res, results, 'Career paths retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific career node details
   * GET /api/career-paths/:nodeId
   */
  async getCareerNode(req, res, next) {
    try {
      const { nodeId } = req.params;

      const node = await this.careerPathService.getCareerNode(nodeId);

      return ApiResponse.success(res, node, 'Career node retrieved successfully');
    } catch (error) {
      if (error.message === 'Career node not found') {
        next(new AppError('Career node not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Get possible transitions from a career node
   * GET /api/career-paths/:nodeId/transitions
   */
  async getCareerTransitions(req, res, next) {
    try {
      const { nodeId } = req.params;

      const transitions = await this.careerPathService.getCareerTransitions(nodeId);

      return ApiResponse.success(res, transitions, 'Career transitions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate career path visualization
   * POST /api/career-paths/visualize
   */
  async visualizeCareerPath(req, res, next) {
    try {
      const userId = req.user.userId;
      const { targetNodeId, currentNodeId } = req.body;

      if (!targetNodeId) {
        throw new AppError('Target node ID is required', 400);
      }

      const visualization = await this.careerPathService.generateCareerPathVisualization(
        userId,
        targetNodeId,
        currentNodeId
      );

      return ApiResponse.success(res, visualization, 'Career path visualization generated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analyze skills gap between roles
   * GET /api/skills-gap/:currentRole/:targetRole
   */
  async analyzeSkillsGap(req, res, next) {
    try {
      const { currentRole, targetRole } = req.params;

      const analysis = await this.skillsGapService.analyzeSkillsGap(
        currentRole,
        targetRole
      );

      return ApiResponse.success(res, analysis, 'Skills gap analysis completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's skills gaps for their goals
   * GET /api/skills-gap/user/:userId
   */
  async getUserSkillsGap(req, res, next) {
    try {
      const userId = req.user.userId;

      const gaps = await this.skillsGapService.getUserSkillsGap(userId);

      return ApiResponse.success(res, gaps, 'User skills gaps retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit skills self-assessment
   * POST /api/skills-gap/assessment
   */
  async submitSkillsAssessment(req, res, next) {
    try {
      const userId = req.user.userId;
      const assessmentData = req.body;

      const result = await this.skillsGapService.submitSkillsAssessment(
        userId,
        assessmentData
      );

      return ApiResponse.success(res, result, 'Skills assessment submitted');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get learning recommendations for a skill
   * GET /api/learning/recommendations/:skillId
   */
  async getLearningRecommendations(req, res, next) {
    try {
      const { skillId } = req.params;
      const filters = req.query;

      const recommendations = await this.learningService.getRecommendations(
        skillId,
        filters
      );

      return ApiResponse.success(res, recommendations, 'Learning recommendations retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get personalized learning plan
   * GET /api/learning/user/:userId/plan
   */
  async getLearningPlan(req, res, next) {
    try {
      const userId = req.user.userId;

      const plan = await this.learningService.getLearningPlan(userId);

      return ApiResponse.success(res, plan, 'Learning plan generated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log learning progress
   * POST /api/learning/progress
   */
  async logLearningProgress(req, res, next) {
    try {
      const userId = req.user.userId;
      const activityData = req.body;

      const result = await this.learningService.logLearningActivity(
        userId,
        activityData
      );

      return ApiResponse.success(res, result, 'Learning progress logged');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's career goals
   * GET /api/goals/user/:userId
   */
  async getUserGoals(req, res, next) {
    try {
      const userId = req.user.userId;

      const sql = `
        SELECT 
          g.goal_id,
          g.current_node_id,
          g.target_node_id,
          g.target_date,
          g.status,
          g.progress_percentage,
          g.notes,
          g.created_at,
          g.achieved_date,
          cn.role_title as current_role,
          tn.role_title as target_role
        FROM pf_user_career_goals g
        JOIN pf_career_nodes cn ON g.current_node_id = cn.node_id
        JOIN pf_career_nodes tn ON g.target_node_id = tn.node_id
        WHERE g.user_id = ?
        ORDER BY 
          CASE WHEN g.status = 'active' THEN 0 ELSE 1 END,
          g.created_at DESC
      `;

      const result = await req.app.locals.container.databaseService.execute(sql, [userId]);

      return ApiResponse.success(res, result.rows, 'User goals retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a career goal
   * POST /api/goals
   */
  async createGoal(req, res, next) {
    try {
      const userId = req.user.userId;
      const goalData = req.body;

      const result = await this.careerPathService.createCareerGoal(userId, goalData);

      return ApiResponse.success(res, result, 'Career goal created', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update goal progress
   * PUT /api/goals/:goalId
   */
  async updateGoal(req, res, next) {
    try {
      const userId = req.user.userId;
      const { goalId } = req.params;
      const { status, notes } = req.body;

      // Verify goal belongs to user
      const checkSql = `
        SELECT goal_id FROM pf_user_career_goals 
        WHERE goal_id = ? AND user_id = ?
      `;
      
      const db = req.app.locals.container.databaseService;
      const checkResult = await db.execute(checkSql, [goalId, userId]);

      if (checkResult.rows.length === 0) {
        throw new AppError('Goal not found', 404);
      }

      // Update goal
      const updateSql = `
        UPDATE pf_user_career_goals
        SET status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE goal_id = ?
      `;

      await db.execute(updateSql, [status, notes, goalId]);

      return ApiResponse.success(res, { goalId }, 'Goal updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get goal milestones
   * GET /api/goals/:goalId/milestones
   */
  async getGoalMilestones(req, res, next) {
    try {
      const userId = req.user.userId;
      const { goalId } = req.params;

      // Verify goal belongs to user
      const checkSql = `
        SELECT goal_id FROM pf_user_career_goals 
        WHERE goal_id = ? AND user_id = ?
      `;
      
      const db = req.app.locals.container.databaseService;
      const checkResult = await db.execute(checkSql, [goalId, userId]);

      if (checkResult.rows.length === 0) {
        throw new AppError('Goal not found', 404);
      }

      // Get milestones
      const milestonesSql = `
        SELECT 
          milestone_id,
          title,
          description,
          milestone_type,
          due_date,
          completed_date,
          status,
          completion_evidence
        FROM pf_goal_milestones
        WHERE goal_id = ?
        ORDER BY 
          CASE status 
            WHEN 'overdue' THEN 0
            WHEN 'pending' THEN 1
            WHEN 'completed' THEN 2
            ELSE 3
          END,
          due_date
      `;

      const result = await db.execute(milestonesSql, [goalId]);

      return ApiResponse.success(res, result.rows, 'Milestones retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CareerPathController;