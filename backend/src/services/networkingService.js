const { ulid } = require('ulid');
const logger = require('../utils/logger');

class NetworkingService {
  constructor(databaseService, contactService, openaiService) {
    this.db = databaseService;
    this.contactService = contactService;
    this.openaiService = openaiService;
  }

  /**
   * Generate networking recommendations for a user
   */
  async generateRecommendations(userId) {
    try {
      // Get user's networking patterns
      const patterns = await this.analyzeNetworkingPatterns(userId);
      
      // Get career goals
      const careerGoals = await this.getUserCareerGoals(userId);
      
      // Get network gaps
      const gaps = await this.identifyNetworkGaps(userId);

      const recommendations = [];

      // Recommend reconnections
      const reconnections = await this.recommendReconnections(userId, patterns);
      recommendations.push(...reconnections);

      // Recommend new connections based on gaps
      const newConnections = await this.recommendNewConnections(userId, gaps, careerGoals);
      recommendations.push(...newConnections);

      // Recommend networking events
      const events = await this.recommendNetworkingEvents(userId, careerGoals);
      recommendations.push(...events);

      // Save recommendations
      await this.saveRecommendations(userId, recommendations);

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate recommendations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Analyze user's networking patterns
   */
  async analyzeNetworkingPatterns(userId) {
    try {
      // Get interaction frequency
      const frequencySql = `
        SELECT 
          AVG(interaction_count) as avg_interactions_per_contact,
          AVG(days_between) as avg_days_between_interactions,
          COUNT(DISTINCT contact_id) as total_active_contacts
        FROM (
          SELECT 
            contact_id,
            COUNT(*) as interaction_count,
            AVG(JULIANDAY(interaction_date) - JULIANDAY(LAG(interaction_date) OVER (PARTITION BY contact_id ORDER BY interaction_date))) as days_between
          FROM pf_interactions
          WHERE user_id = ?
            AND interaction_date > date('now', '-6 months')
          GROUP BY contact_id
        )
      `;

      const frequencyResult = await this.db.execute(frequencySql, [userId]);

      // Get relationship type distribution
      const typeSql = `
        SELECT 
          relationship_type,
          COUNT(*) as count,
          AVG(relationship_strength) as avg_strength
        FROM pf_contacts
        WHERE user_id = ?
        GROUP BY relationship_type
      `;

      const typeResult = await this.db.execute(typeSql, [userId]);

      // Get industry coverage
      const industrySql = `
        SELECT 
          SUBSTR(professional_context, 
            INSTR(professional_context, '"industry":"') + 12,
            INSTR(SUBSTR(professional_context, INSTR(professional_context, '"industry":"') + 12), '"') - 1
          ) as industry,
          COUNT(*) as count
        FROM pf_contacts
        WHERE user_id = ?
          AND professional_context LIKE '%"industry":%'
        GROUP BY industry
      `;

      const industryResult = await this.db.execute(industrySql, [userId]);

      return {
        interaction_patterns: frequencyResult.rows[0],
        relationship_distribution: typeResult.rows,
        industry_coverage: industryResult.rows
      };
    } catch (error) {
      logger.error('Failed to analyze networking patterns', { error: error.message });
      throw error;
    }
  }

  /**
   * Identify gaps in user's network
   */
  async identifyNetworkGaps(userId) {
    try {
      // Get user's career goals to understand target network
      const careerGoals = await this.getUserCareerGoals(userId);
      
      // Get current network composition
      const currentNetwork = await this.analyzeNetworkComposition(userId);

      const gaps = {
        role_gaps: [],
        industry_gaps: [],
        seniority_gaps: [],
        skill_gaps: []
      };

      // Identify role gaps based on career goals
      if (careerGoals.target_role) {
        const targetRoleConnections = await this.getConnectionsByRole(userId, careerGoals.target_role);
        if (targetRoleConnections.length < 3) {
          gaps.role_gaps.push({
            role: careerGoals.target_role,
            current_count: targetRoleConnections.length,
            recommended_count: 3,
            priority: 'high'
          });
        }
      }

      // Identify industry gaps
      if (careerGoals.target_industry && !currentNetwork.industries.includes(careerGoals.target_industry)) {
        gaps.industry_gaps.push({
          industry: careerGoals.target_industry,
          priority: 'high'
        });
      }

      // Identify seniority gaps
      const seniorityBalance = this.analyzeSeniorityBalance(currentNetwork);
      if (seniorityBalance.mentor_ratio < 0.1) {
        gaps.seniority_gaps.push({
          type: 'mentor',
          current_ratio: seniorityBalance.mentor_ratio,
          recommended_ratio: 0.15,
          priority: 'medium'
        });
      }

      return gaps;
    } catch (error) {
      logger.error('Failed to identify network gaps', { error: error.message });
      throw error;
    }
  }

  /**
   * Recommend reconnections with existing contacts
   */
  async recommendReconnections(userId, patterns) {
    try {
      const sql = `
        SELECT 
          c.*,
          MAX(i.interaction_date) as last_interaction,
          COUNT(i.interaction_id) as total_interactions,
          JULIANDAY('now') - JULIANDAY(MAX(i.interaction_date)) as days_since_last
        FROM pf_contacts c
        LEFT JOIN pf_interactions i ON c.contact_id = i.contact_id
        WHERE c.user_id = ?
          AND c.relationship_strength >= 3
        GROUP BY c.contact_id
        HAVING days_since_last > 90 OR days_since_last IS NULL
        ORDER BY c.relationship_strength DESC, days_since_last DESC
        LIMIT 5
      `;

      const result = await this.db.execute(sql, [userId]);

      const recommendations = [];

      for (const contact of result.rows) {
        const recommendation = {
          recommendation_id: ulid(),
          user_id: userId,
          recommendation_type: 'person',
          title: `Reconnect with ${contact.first_name} ${contact.last_name}`,
          description: await this.generateReconnectionMessage(contact),
          reason: this.generateReconnectionReason(contact),
          relevance_score: this.calculateReconnectionScore(contact),
          metadata: {
            contact_id: contact.contact_id,
            last_interaction: contact.last_interaction,
            days_since_last: contact.days_since_last
          }
        };

        recommendations.push(recommendation);
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to recommend reconnections', { error: error.message });
      return [];
    }
  }

  /**
   * Recommend new connections based on gaps
   */
  async recommendNewConnections(userId, gaps, careerGoals) {
    const recommendations = [];

    // Recommend based on role gaps
    for (const gap of gaps.role_gaps) {
      recommendations.push({
        recommendation_id: ulid(),
        user_id: userId,
        recommendation_type: 'person',
        title: `Connect with ${gap.role} professionals`,
        description: `Build relationships with people in ${gap.role} positions to support your career transition`,
        reason: `You currently have ${gap.current_count} connections in this role. Building a network of ${gap.recommended_count}+ contacts will provide valuable insights and opportunities.`,
        relevance_score: 0.9,
        metadata: {
          gap_type: 'role',
          target_role: gap.role,
          search_suggestions: [
            `LinkedIn search for "${gap.role}"`,
            `Industry events for ${gap.role}`,
            `Professional associations`
          ]
        }
      });
    }

    // Recommend based on industry gaps
    for (const gap of gaps.industry_gaps) {
      recommendations.push({
        recommendation_id: ulid(),
        user_id: userId,
        recommendation_type: 'group',
        title: `Join ${gap.industry} professional groups`,
        description: `Expand your network in the ${gap.industry} industry`,
        reason: `Building connections in ${gap.industry} will help you transition into this field and understand industry trends.`,
        relevance_score: 0.85,
        metadata: {
          gap_type: 'industry',
          target_industry: gap.industry,
          group_suggestions: [
            `${gap.industry} LinkedIn groups`,
            `Local ${gap.industry} meetups`,
            `${gap.industry} professional associations`
          ]
        }
      });
    }

    return recommendations;
  }

  /**
   * Recommend networking events
   */
  async recommendNetworkingEvents(userId, careerGoals) {
    const recommendations = [];

    // Get user's location and interests
    const userProfile = await this.getUserProfile(userId);

    // Recommend based on career goals
    if (careerGoals.target_industry) {
      recommendations.push({
        recommendation_id: ulid(),
        user_id: userId,
        recommendation_type: 'event',
        title: `${careerGoals.target_industry} Industry Conference`,
        description: `Attend industry conferences to build connections and learn about trends`,
        reason: `Industry conferences are excellent for meeting professionals in your target field and learning about opportunities.`,
        relevance_score: 0.8,
        metadata: {
          event_type: 'conference',
          industry: careerGoals.target_industry,
          benefits: [
            'Meet industry leaders',
            'Learn about trends',
            'Find job opportunities',
            'Build professional network'
          ]
        }
      });
    }

    // Recommend local networking events
    recommendations.push({
      recommendation_id: ulid(),
      user_id: userId,
      recommendation_type: 'event',
      title: 'Local Professional Networking Meetup',
      description: 'Join local networking groups to build connections in your area',
      reason: 'Regular local networking helps build strong professional relationships and discover hidden opportunities.',
      relevance_score: 0.75,
      metadata: {
        event_type: 'meetup',
        frequency: 'monthly',
        benefits: [
          'Build local network',
          'Practice networking skills',
          'Find referral opportunities'
        ]
      }
    });

    return recommendations;
  }

  /**
   * Save recommendations to database
   */
  async saveRecommendations(userId, recommendations) {
    try {
      for (const rec of recommendations) {
        const sql = `
          INSERT INTO pf_networking_recommendations (
            recommendation_id, user_id, recommendation_type,
            title, description, reason, relevance_score,
            metadata, expires_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '+30 days'), 'pending')
        `;

        const params = [
          rec.recommendation_id,
          rec.user_id,
          rec.recommendation_type,
          rec.title,
          rec.description,
          rec.reason,
          rec.relevance_score,
          JSON.stringify(rec.metadata || {})
        ];

        await this.db.execute(sql, params);
      }
    } catch (error) {
      logger.error('Failed to save recommendations', { error: error.message });
    }
  }

  /**
   * Get user's career goals
   */
  async getUserCareerGoals(userId) {
    try {
      const sql = `
        SELECT 
          target_node_id,
          (SELECT role_title FROM pf_career_nodes WHERE node_id = g.target_node_id) as target_role,
          (SELECT industry FROM pf_career_nodes WHERE node_id = g.target_node_id) as target_industry
        FROM pf_user_career_goals g
        WHERE user_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.db.execute(sql, [userId]);
      return result.rows[0] || {};
    } catch (error) {
      logger.error('Failed to get user career goals', { error: error.message });
      return {};
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const sql = 'SELECT * FROM pf_users WHERE user_id = ?';
      const result = await this.db.execute(sql, [userId]);
      return result.rows[0] || {};
    } catch (error) {
      logger.error('Failed to get user profile', { error: error.message });
      return {};
    }
  }

  /**
   * Analyze network composition
   */
  async analyzeNetworkComposition(userId) {
    try {
      const sql = `
        SELECT 
          professional_context,
          relationship_type,
          relationship_strength
        FROM pf_contacts
        WHERE user_id = ?
      `;

      const result = await this.db.execute(sql, [userId]);

      const composition = {
        total_contacts: result.rows.length,
        industries: new Set(),
        roles: new Set(),
        relationship_types: {},
        avg_strength: 0
      };

      let totalStrength = 0;

      result.rows.forEach(contact => {
        const context = JSON.parse(contact.professional_context || '{}');
        
        if (context.industry) {
          composition.industries.add(context.industry);
        }
        
        if (context.role) {
          composition.roles.add(context.role);
        }

        composition.relationship_types[contact.relationship_type] = 
          (composition.relationship_types[contact.relationship_type] || 0) + 1;

        totalStrength += contact.relationship_strength;
      });

      composition.industries = Array.from(composition.industries);
      composition.roles = Array.from(composition.roles);
      composition.avg_strength = totalStrength / composition.total_contacts;

      return composition;
    } catch (error) {
      logger.error('Failed to analyze network composition', { error: error.message });
      throw error;
    }
  }

  /**
   * Get connections by role
   */
  async getConnectionsByRole(userId, role) {
    try {
      const sql = `
        SELECT * FROM pf_contacts
        WHERE user_id = ?
          AND (current_title LIKE ? OR professional_context LIKE ?)
      `;

      const searchTerm = `%${role}%`;
      const result = await this.db.execute(sql, [userId, searchTerm, searchTerm]);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get connections by role', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze seniority balance in network
   */
  analyzeSeniorityBalance(networkComposition) {
    const mentorCount = networkComposition.relationship_types.mentor || 0;
    const totalCount = networkComposition.total_contacts || 1;

    return {
      mentor_ratio: mentorCount / totalCount,
      peer_ratio: (networkComposition.relationship_types.peer || 0) / totalCount,
      total_contacts: totalCount
    };
  }

  /**
   * Generate reconnection message
   */
  async generateReconnectionMessage(contact) {
    if (this.openaiService) {
      try {
        const prompt = `Generate a brief, friendly reconnection message for ${contact.first_name} ${contact.last_name} who works at ${contact.current_company}. Last interaction was ${contact.days_since_last} days ago.`;
        const response = await this.openaiService.generateResponse(prompt);
        return response;
      } catch (error) {
        logger.error('Failed to generate AI message', { error: error.message });
      }
    }

    // Fallback message
    return `It's been a while since you connected with ${contact.first_name}. Consider reaching out to catch up on their work at ${contact.current_company} and share your recent experiences.`;
  }

  /**
   * Generate reconnection reason
   */
  generateReconnectionReason(contact) {
    const reasons = [];

    if (contact.relationship_strength >= 4) {
      reasons.push('Strong professional relationship worth maintaining');
    }

    if (contact.days_since_last > 180) {
      reasons.push('Over 6 months since last interaction');
    }

    if (contact.total_interactions > 5) {
      reasons.push('History of valuable interactions');
    }

    return reasons.join('. ');
  }

  /**
   * Calculate reconnection score
   */
  calculateReconnectionScore(contact) {
    let score = 0.5; // Base score

    // Adjust based on relationship strength
    score += (contact.relationship_strength - 3) * 0.1;

    // Adjust based on time since last interaction
    if (contact.days_since_last > 365) {
      score -= 0.1;
    } else if (contact.days_since_last > 180) {
      score += 0.1;
    } else if (contact.days_since_last > 90) {
      score += 0.2;
    }

    // Adjust based on interaction history
    if (contact.total_interactions > 10) {
      score += 0.1;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Get networking insights
   */
  async getNetworkingInsights(userId) {
    try {
      // Network growth
      const growthSql = `
        SELECT 
          COUNT(CASE WHEN created_at > date('now', '-30 days') THEN 1 END) as new_contacts_30d,
          COUNT(CASE WHEN created_at > date('now', '-90 days') THEN 1 END) as new_contacts_90d,
          COUNT(*) as total_contacts
        FROM pf_contacts
        WHERE user_id = ?
      `;

      const growthResult = await this.db.execute(growthSql, [userId]);

      // Interaction velocity
      const velocitySql = `
        SELECT 
          COUNT(CASE WHEN interaction_date > date('now', '-30 days') THEN 1 END) as interactions_30d,
          COUNT(DISTINCT CASE WHEN interaction_date > date('now', '-30 days') THEN contact_id END) as active_contacts_30d,
          AVG(CASE WHEN interaction_date > date('now', '-30 days') THEN duration_minutes END) as avg_duration_30d
        FROM pf_interactions
        WHERE user_id = ?
      `;

      const velocityResult = await this.db.execute(velocitySql, [userId]);

      // Relationship health
      const healthSql = `
        SELECT 
          AVG(relationship_strength) as avg_relationship_strength,
          COUNT(CASE WHEN relationship_strength >= 4 THEN 1 END) as strong_relationships,
          COUNT(CASE WHEN last_interaction_date < date('now', '-180 days') THEN 1 END) as dormant_relationships
        FROM pf_contacts
        WHERE user_id = ?
      `;

      const healthResult = await this.db.execute(healthSql, [userId]);

      return {
        network_growth: growthResult.rows[0],
        interaction_velocity: velocityResult.rows[0],
        relationship_health: healthResult.rows[0],
        insights: this.generateInsights(growthResult.rows[0], velocityResult.rows[0], healthResult.rows[0])
      };
    } catch (error) {
      logger.error('Failed to get networking insights', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate actionable insights
   */
  generateInsights(growth, velocity, health) {
    const insights = [];

    // Growth insights
    if (growth.new_contacts_30d === 0) {
      insights.push({
        type: 'growth',
        priority: 'high',
        message: 'You haven\'t added new contacts in 30 days. Consider attending networking events.',
        action: 'Find networking events'
      });
    }

    // Velocity insights
    if (velocity.interactions_30d < velocity.active_contacts_30d * 0.5) {
      insights.push({
        type: 'engagement',
        priority: 'medium',
        message: 'Your interaction frequency is low. Consider scheduling regular check-ins.',
        action: 'Schedule coffee chats'
      });
    }

    // Health insights
    if (health.dormant_relationships > health.strong_relationships) {
      insights.push({
        type: 'maintenance',
        priority: 'high',
        message: 'Many relationships are becoming dormant. Time to reconnect!',
        action: 'Review dormant contacts'
      });
    }

    return insights;
  }
}

module.exports = NetworkingService;