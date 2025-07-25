const { validateExperienceData } = require('../../validators/experienceValidator');
const logger = require('../../utils/logger');

class ExperienceController {
  constructor(experienceService) {
    this.experienceService = experienceService;
  }

  async listExperiences(req, res, next) {
    try {
      const filters = {
        experienceType: req.query.type,
        isCurrent: req.query.current === 'true',
        dateFrom: req.query.from,
        dateTo: req.query.to,
        searchText: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : null
      };

      const experiences = await this.experienceService.getUserExperiences(
        req.user.userId,
        filters
      );

      res.json({
        experiences,
        count: experiences.length
      });
    } catch (error) {
      next(error);
    }
  }

  async getExperience(req, res, next) {
    try {
      const { id } = req.params;
      
      const experience = await this.experienceService.getExperience(
        req.user.userId,
        id
      );

      res.json(experience);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async createExperience(req, res, next) {
    try {
      const validation = validateExperienceData(req.body);
      if (validation.error) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validation.error.details 
        });
      }

      const experience = await this.experienceService.createExperience(
        req.user.userId,
        validation.value
      );

      res.status(201).json({
        message: 'Experience created successfully',
        experience
      });
    } catch (error) {
      next(error);
    }
  }

  async updateExperience(req, res, next) {
    try {
      const { id } = req.params;
      
      const validation = validateExperienceData(req.body, true);
      if (validation.error) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validation.error.details 
        });
      }

      const experience = await this.experienceService.updateExperience(
        req.user.userId,
        id,
        validation.value
      );

      res.json({
        message: 'Experience updated successfully',
        experience
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async deleteExperience(req, res, next) {
    try {
      const { id } = req.params;
      
      await this.experienceService.deleteExperience(
        req.user.userId,
        id
      );

      res.json({
        message: 'Experience deleted successfully'
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async getExperienceStats(req, res, next) {
    try {
      const stats = await this.experienceService.getExperienceStats(req.user.userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExperienceController;