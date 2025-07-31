const logger = require('../../utils/logger');

class AnalyticsController {
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * Get skills progression analysis
   */
  async getSkillsProgression(req, res, next) {
    try {
      const result = await this.analyticsService.analyzeSkillsProgression(req.user.userId);
      
      res.json({
        skills: result.skills,
        summary: result.summary,
        lastUpdated: new Date()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get career trajectory visualization data
   */
  async getCareerTrajectory(req, res, next) {
    try {
      const trajectory = await this.analyticsService.generateCareerTrajectory(req.user.userId);
      
      res.json(trajectory);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Quantify achievements for a specific experience
   */
  async quantifyAchievements(req, res, next) {
    try {
      const { experienceId } = req.params;
      
      const result = await this.analyticsService.quantifyAchievements(
        req.user.userId,
        experienceId
      );
      
      res.json(result);
    } catch (error) {
      if (error.message === 'Experience not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(req, res, next) {
    try {
      const { refresh = false } = req.query;
      
      // If refresh is requested or no summary exists, generate new one
      const summary = await this.analyticsService.generateAnalyticsSummary(req.user.userId);
      
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get impact scores for all experiences
   */
  async getImpactScores(req, res, next) {
    try {
      const { experienceIds } = req.query;
      
      // Parse experience IDs if provided
      const ids = experienceIds ? experienceIds.split(',') : null;
      
      const scores = await this.analyticsService.getExperienceImpactScores(
        req.user.userId,
        ids
      );
      
      res.json({
        scores,
        count: scores.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get skill recommendations based on career goals
   */
  async getSkillRecommendations(req, res, next) {
    try {
      const { targetRole, currentSkills } = req.body;
      
      const recommendations = await this.analyticsService.generateSkillRecommendations(
        req.user.userId,
        targetRole,
        currentSkills
      );
      
      res.json(recommendations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate career insights
   */
  async getCareerInsights(req, res, next) {
    try {
      const insights = await this.analyticsService.generateCareerInsights(req.user.userId);
      
      res.json(insights);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalytics(req, res, next) {
    try {
      const { format = 'json' } = req.query;
      
      const analyticsData = await this.analyticsService.exportAnalyticsData(
        req.user.userId,
        format
      );
      
      // Set appropriate headers based on format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="career-analytics.csv"');
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="career-analytics.pdf"');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }
      
      res.send(analyticsData);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnalyticsController;