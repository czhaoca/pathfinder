const { ulid } = require('ulid');
const logger = require('../utils/logger');

class CareerPathService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Search career paths by role title or industry
   */
  async searchCareerPaths(searchParams) {
    const { query, industry, level, limit = 20 } = searchParams;

    try {
      let sql = `
        SELECT 
          node_id,
          role_title,
          role_level,
          industry,
          typical_years_experience,
          salary_range_min,
          salary_range_max,
          description
        FROM pf_career_nodes
        WHERE 1=1
      `;
      const params = [];

      if (query) {
        sql += ` AND UPPER(role_title) LIKE UPPER(?)`;
        params.push(`%${query}%`);
      }

      if (industry) {
        sql += ` AND industry = ?`;
        params.push(industry);
      }

      if (level) {
        sql += ` AND role_level = ?`;
        params.push(level);
      }

      sql += ` ORDER BY typical_years_experience, role_title LIMIT ?`;
      params.push(limit);

      const result = await this.db.execute(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to search career paths', { error: error.message });
      throw error;
    }
  }

  /**
   * Get detailed information about a specific career node
   */
  async getCareerNode(nodeId) {
    try {
      const sql = `
        SELECT 
          node_id,
          role_title,
          role_level,
          industry,
          typical_years_experience,
          salary_range_min,
          salary_range_max,
          required_skills,
          preferred_skills,
          description,
          created_at,
          updated_at
        FROM pf_career_nodes
        WHERE node_id = ?
      `;

      const result = await this.db.execute(sql, [nodeId]);
      if (result.rows.length === 0) {
        throw new Error('Career node not found');
      }

      const node = result.rows[0];
      // Parse JSON fields
      node.required_skills = JSON.parse(node.required_skills || '[]');
      node.preferred_skills = JSON.parse(node.preferred_skills || '[]');

      return node;
    } catch (error) {
      logger.error('Failed to get career node', { error: error.message, nodeId });
      throw error;
    }
  }

  /**
   * Get possible career transitions from a given node
   */
  async getCareerTransitions(fromNodeId) {
    try {
      const sql = `
        SELECT 
          t.transition_id,
          t.from_node_id,
          t.to_node_id,
          t.typical_duration_months,
          t.difficulty_score,
          t.required_skills_gap,
          t.success_rate,
          t.transition_strategies,
          n.role_title as to_role_title,
          n.role_level as to_role_level,
          n.industry as to_industry,
          n.salary_range_min as to_salary_min,
          n.salary_range_max as to_salary_max
        FROM pf_career_transitions t
        JOIN pf_career_nodes n ON t.to_node_id = n.node_id
        WHERE t.from_node_id = ?
        ORDER BY t.difficulty_score, t.typical_duration_months
      `;

      const result = await this.db.execute(sql, [fromNodeId]);
      
      // Parse JSON fields
      return result.rows.map(row => ({
        ...row,
        required_skills_gap: JSON.parse(row.required_skills_gap || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get career transitions', { error: error.message, fromNodeId });
      throw error;
    }
  }

  /**
   * Generate visualization data for career paths
   */
  async generateCareerPathVisualization(userId, targetNodeId) {
    try {
      // First, get user's current role from their profile or recent experiences
      const currentRole = await this.getUserCurrentRole(userId);
      
      if (!currentRole) {
        throw new Error('Unable to determine current role');
      }

      // Find all paths from current role to target role
      const paths = await this.findCareerPaths(currentRole.node_id, targetNodeId);

      // Get all unique nodes in the paths
      const nodeIds = new Set();
      paths.forEach(path => {
        path.forEach(nodeId => nodeIds.add(nodeId));
      });

      // Get node details
      const nodes = await this.getMultipleNodes(Array.from(nodeIds));

      // Get all transitions between these nodes
      const transitions = await this.getTransitionsBetweenNodes(Array.from(nodeIds));

      return {
        current_node: currentRole,
        target_node_id: targetNodeId,
        nodes: nodes,
        transitions: transitions,
        suggested_paths: paths.slice(0, 3) // Top 3 paths
      };
    } catch (error) {
      logger.error('Failed to generate career path visualization', { 
        error: error.message, 
        userId, 
        targetNodeId 
      });
      throw error;
    }
  }

  /**
   * Find career paths between two nodes using BFS
   */
  async findCareerPaths(fromNodeId, toNodeId, maxDepth = 5) {
    try {
      // Get all transitions for pathfinding
      const allTransitions = await this.getAllTransitions();
      
      // Build adjacency list
      const graph = {};
      allTransitions.forEach(t => {
        if (!graph[t.from_node_id]) {
          graph[t.from_node_id] = [];
        }
        graph[t.from_node_id].push({
          to: t.to_node_id,
          difficulty: t.difficulty_score,
          duration: t.typical_duration_months
        });
      });

      // BFS to find all paths
      const paths = [];
      const queue = [[fromNodeId]];
      
      while (queue.length > 0) {
        const currentPath = queue.shift();
        const lastNode = currentPath[currentPath.length - 1];
        
        if (currentPath.length > maxDepth) continue;
        
        if (lastNode === toNodeId) {
          paths.push(currentPath);
          continue;
        }
        
        const neighbors = graph[lastNode] || [];
        for (const neighbor of neighbors) {
          if (!currentPath.includes(neighbor.to)) {
            queue.push([...currentPath, neighbor.to]);
          }
        }
      }

      // Sort paths by total difficulty and duration
      return paths.sort((a, b) => {
        const scoreA = this.calculatePathScore(a, allTransitions);
        const scoreB = this.calculatePathScore(b, allTransitions);
        return scoreA - scoreB;
      });
    } catch (error) {
      logger.error('Failed to find career paths', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate path score based on difficulty and duration
   */
  calculatePathScore(path, transitions) {
    let totalDifficulty = 0;
    let totalDuration = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const transition = transitions.find(
        t => t.from_node_id === path[i] && t.to_node_id === path[i + 1]
      );
      if (transition) {
        totalDifficulty += transition.difficulty_score;
        totalDuration += transition.typical_duration_months;
      }
    }

    // Weighted score: difficulty is more important than duration
    return totalDifficulty * 2 + totalDuration / 12;
  }

  /**
   * Get user's current role based on profile and experiences
   */
  async getUserCurrentRole(userId) {
    try {
      // First check if user has set a current role in their goals
      const goalSql = `
        SELECT current_node_id 
        FROM pf_user_career_goals 
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const goalResult = await this.db.execute(goalSql, [userId]);
      if (goalResult.rows.length > 0 && goalResult.rows[0].current_node_id) {
        return await this.getCareerNode(goalResult.rows[0].current_node_id);
      }

      // Otherwise, try to infer from recent experiences
      const expSql = `
        SELECT 
          title,
          company,
          is_current
        FROM experiences_level1
        WHERE user_id = ?
        ORDER BY is_current DESC, end_date DESC NULLS FIRST
        LIMIT 1
      `;

      const expResult = await this.db.execute(expSql, [userId]);
      if (expResult.rows.length > 0) {
        // Try to match the title to a career node
        const matchResult = await this.searchCareerPaths({ 
          query: expResult.rows[0].title,
          limit: 1 
        });
        
        if (matchResult.length > 0) {
          return matchResult[0];
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user current role', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get multiple nodes by IDs
   */
  async getMultipleNodes(nodeIds) {
    if (nodeIds.length === 0) return [];

    try {
      const placeholders = nodeIds.map(() => '?').join(',');
      const sql = `
        SELECT 
          node_id,
          role_title,
          role_level,
          industry,
          typical_years_experience,
          salary_range_min,
          salary_range_max,
          required_skills,
          preferred_skills,
          description
        FROM pf_career_nodes
        WHERE node_id IN (${placeholders})
      `;

      const result = await this.db.execute(sql, nodeIds);
      
      return result.rows.map(row => ({
        ...row,
        required_skills: JSON.parse(row.required_skills || '[]'),
        preferred_skills: JSON.parse(row.preferred_skills || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get multiple nodes', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all transitions for pathfinding
   */
  async getAllTransitions() {
    try {
      const sql = `
        SELECT 
          transition_id,
          from_node_id,
          to_node_id,
          typical_duration_months,
          difficulty_score,
          success_rate
        FROM pf_career_transitions
      `;

      const result = await this.db.execute(sql);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get all transitions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get transitions between specific nodes
   */
  async getTransitionsBetweenNodes(nodeIds) {
    if (nodeIds.length === 0) return [];

    try {
      const placeholders = nodeIds.map(() => '?').join(',');
      const sql = `
        SELECT 
          transition_id,
          from_node_id,
          to_node_id,
          typical_duration_months,
          difficulty_score,
          required_skills_gap,
          success_rate,
          transition_strategies
        FROM pf_career_transitions
        WHERE from_node_id IN (${placeholders})
          AND to_node_id IN (${placeholders})
      `;

      const result = await this.db.execute(sql, [...nodeIds, ...nodeIds]);
      
      return result.rows.map(row => ({
        ...row,
        required_skills_gap: JSON.parse(row.required_skills_gap || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get transitions between nodes', { error: error.message });
      throw error;
    }
  }

  /**
   * Create or update a user's career goal
   */
  async createCareerGoal(userId, goalData) {
    const {
      currentNodeId,
      targetNodeId,
      targetDate,
      notes
    } = goalData;

    try {
      // Check if user already has an active goal for this target
      const existingGoal = await this.db.execute(
        `SELECT goal_id FROM pf_user_career_goals 
         WHERE user_id = ? AND target_node_id = ? AND status = 'active'`,
        [userId, targetNodeId]
      );

      if (existingGoal.rows.length > 0) {
        throw new Error('Active goal already exists for this target role');
      }

      const goalId = ulid();
      const sql = `
        INSERT INTO pf_user_career_goals (
          goal_id, user_id, current_node_id, target_node_id,
          target_date, status, progress_percentage, notes
        ) VALUES (?, ?, ?, ?, ?, 'active', 0, ?)
      `;

      await this.db.execute(sql, [
        goalId, userId, currentNodeId, targetNodeId,
        targetDate, notes
      ]);

      // Create initial milestones based on the path
      await this.createInitialMilestones(goalId, currentNodeId, targetNodeId);

      return { goalId };
    } catch (error) {
      logger.error('Failed to create career goal', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create initial milestones for a career goal
   */
  async createInitialMilestones(goalId, currentNodeId, targetNodeId) {
    try {
      // Get the transition details
      const transition = await this.db.execute(
        `SELECT required_skills_gap, typical_duration_months 
         FROM pf_career_transitions 
         WHERE from_node_id = ? AND to_node_id = ?`,
        [currentNodeId, targetNodeId]
      );

      if (transition.rows.length === 0) {
        // No direct transition, find a path
        const paths = await this.findCareerPaths(currentNodeId, targetNodeId);
        if (paths.length === 0) return;
        
        // Create milestones for each step in the shortest path
        const path = paths[0];
        for (let i = 0; i < path.length - 1; i++) {
          await this.createMilestone(goalId, {
            title: `Transition to ${path[i + 1]} role`,
            description: `Complete requirements for transitioning from ${path[i]} to ${path[i + 1]}`,
            milestone_type: 'skill',
            due_date: null // Will be calculated based on typical duration
          });
        }
      } else {
        // Create milestones based on required skills
        const skills = JSON.parse(transition.rows[0].required_skills_gap || '[]');
        
        for (const skillId of skills) {
          await this.createMilestone(goalId, {
            title: `Develop ${skillId} skill`,
            description: `Achieve proficiency in ${skillId}`,
            milestone_type: 'skill',
            due_date: null
          });
        }
      }
    } catch (error) {
      logger.error('Failed to create initial milestones', { error: error.message, goalId });
    }
  }

  /**
   * Create a milestone for a goal
   */
  async createMilestone(goalId, milestoneData) {
    const milestoneId = ulid();
    const sql = `
      INSERT INTO pf_goal_milestones (
        milestone_id, goal_id, title, description,
        milestone_type, due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    await this.db.execute(sql, [
      milestoneId,
      goalId,
      milestoneData.title,
      milestoneData.description,
      milestoneData.milestone_type,
      milestoneData.due_date
    ]);

    return milestoneId;
  }
}

module.exports = CareerPathService;