const { validateExperienceData } = require('../../validators/experienceValidator');

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

  async bulkCreateExperiences(req, res, next) {
    try {
      const { experiences } = req.body;
      
      if (!Array.isArray(experiences) || experiences.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request', 
          details: 'Experiences must be a non-empty array' 
        });
      }

      // Validate each experience
      const validationErrors = [];
      const validExperiences = [];
      
      experiences.forEach((exp, index) => {
        const validation = validateExperienceData(exp);
        if (validation.error) {
          validationErrors.push({
            index,
            errors: validation.error.details
          });
        } else {
          validExperiences.push(validation.value);
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed for some experiences',
          details: validationErrors
        });
      }

      const createdExperiences = await this.experienceService.bulkCreateExperiences(
        req.user.userId,
        validExperiences
      );

      res.status(201).json({
        message: `${createdExperiences.length} experiences created successfully`,
        experiences: createdExperiences
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateExperiences(req, res, next) {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request', 
          details: 'Updates must be a non-empty array' 
        });
      }

      // Validate each update
      const validationErrors = [];
      const validUpdates = [];
      
      updates.forEach((update, index) => {
        if (!update.id) {
          validationErrors.push({
            index,
            errors: [{ message: 'Experience ID is required' }]
          });
        } else {
          const validation = validateExperienceData(update.data, true);
          if (validation.error) {
            validationErrors.push({
              index,
              errors: validation.error.details
            });
          } else {
            validUpdates.push({
              id: update.id,
              data: validation.value
            });
          }
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed for some updates',
          details: validationErrors
        });
      }

      const updatedExperiences = await this.experienceService.bulkUpdateExperiences(
        req.user.userId,
        validUpdates
      );

      res.json({
        message: `${updatedExperiences.length} experiences updated successfully`,
        experiences: updatedExperiences
      });
    } catch (error) {
      next(error);
    }
  }

  async duplicateExperience(req, res, next) {
    try {
      const { id } = req.params;
      const { modifications } = req.body;

      const duplicatedExperience = await this.experienceService.duplicateExperience(
        req.user.userId,
        id,
        modifications
      );

      res.status(201).json({
        message: 'Experience duplicated successfully',
        experience: duplicatedExperience
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async extractSkills(req, res, next) {
    try {
      const { id } = req.params;
      const { regenerate = false } = req.body;

      const skills = await this.experienceService.extractSkills(
        req.user.userId,
        id,
        regenerate
      );

      res.json({
        message: 'Skills extracted successfully',
        skills
      });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }

  async getExperienceTemplates(req, res, next) {
    try {
      const { category } = req.query;
      
      const templates = await this.experienceService.getExperienceTemplates(category);

      res.json({
        templates,
        count: templates.length
      });
    } catch (error) {
      next(error);
    }
  }

  async searchExperiences(req, res, next) {
    try {
      const searchParams = {
        q: req.query.q,
        skills: req.query.skills ? req.query.skills.split(',') : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        type: req.query.type,
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const results = await this.experienceService.searchExperiences(
        req.user.userId,
        searchParams
      );

      res.json({
        success: true,
        data: results.experiences,
        pagination: {
          total: results.total,
          limit: searchParams.limit,
          offset: searchParams.offset
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getSkillsSummary(req, res, next) {
    try {
      const summary = await this.experienceService.getSkillsSummary(req.user.userId);

      res.json({
        success: true,
        data: {
          topSkills: summary.topSkills,
          skillCategories: summary.categories,
          skillGrowth: summary.growth,
          totalSkills: summary.total
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getSkillsRecommendations(req, res, next) {
    try {
      const { targetRole } = req.query;
      
      const recommendations = await this.experienceService.getSkillsRecommendations(
        req.user.userId,
        targetRole
      );

      res.json({
        success: true,
        data: {
          recommended: recommendations.recommended,
          trending: recommendations.trending,
          complementary: recommendations.complementary
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async exportExperiences(req, res, next) {
    try {
      const format = req.query.format || 'json';
      const filters = {
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const exportData = await this.experienceService.exportExperiences(
        req.user.userId,
        format,
        filters
      );

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=experiences.pdf');
        res.send(exportData);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=experiences.csv');
        res.send(exportData);
      } else {
        // JSON format
        res.json({
          experiences: exportData.experiences,
          metadata: {
            exportDate: new Date().toISOString(),
            totalExperiences: exportData.experiences.length,
            filters: filters
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExperienceController;