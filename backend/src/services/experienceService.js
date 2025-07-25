const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ExperienceService {
  constructor(experienceRepository, userRepository, auditService) {
    this.experienceRepository = experienceRepository;
    this.userRepository = userRepository;
    this.auditService = auditService;
  }

  async getUserExperiences(userId, filters = {}) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const experiences = await this.experienceRepository.findByUser(
        user.schemaPrefix,
        filters
      );

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCES_VIEWED',
        resourceType: 'experience',
        resourceId: null,
        operation: 'list',
        success: true
      });

      return experiences;
    } catch (error) {
      logger.error('Failed to fetch user experiences', { userId, error: error.message });
      throw error;
    }
  }

  async getExperience(userId, experienceId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const experience = await this.experienceRepository.findById(
        user.schemaPrefix,
        experienceId
      );

      if (!experience) {
        const error = new Error('Experience not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCE_VIEWED',
        resourceType: 'experience',
        resourceId: experienceId,
        operation: 'read',
        success: true
      });

      return experience;
    } catch (error) {
      logger.error('Failed to fetch experience', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  async createExperience(userId, experienceData) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate and enrich experience data
      const enrichedData = await this.enrichExperienceData(experienceData);
      
      const experienceId = await this.experienceRepository.create(
        user.schemaPrefix,
        {
          ...enrichedData,
          experienceId: uuidv4()
        }
      );

      // Trigger profile regeneration
      await this.triggerProfileRegeneration(userId, user.schemaPrefix);

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCE_CREATED',
        resourceType: 'experience',
        resourceId: experienceId,
        operation: 'create',
        success: true
      });

      return await this.experienceRepository.findById(user.schemaPrefix, experienceId);
    } catch (error) {
      logger.error('Failed to create experience', { userId, error: error.message });
      throw error;
    }
  }

  async updateExperience(userId, experienceId, experienceData) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if experience exists
      const existing = await this.experienceRepository.findById(
        user.schemaPrefix,
        experienceId
      );

      if (!existing) {
        const error = new Error('Experience not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      // Validate and enrich experience data
      const enrichedData = await this.enrichExperienceData(experienceData);

      await this.experienceRepository.update(
        user.schemaPrefix,
        experienceId,
        enrichedData
      );

      // Trigger profile regeneration
      await this.triggerProfileRegeneration(userId, user.schemaPrefix);

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCE_UPDATED',
        resourceType: 'experience',
        resourceId: experienceId,
        operation: 'update',
        success: true
      });

      return await this.experienceRepository.findById(user.schemaPrefix, experienceId);
    } catch (error) {
      logger.error('Failed to update experience', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  async deleteExperience(userId, experienceId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existing = await this.experienceRepository.findById(
        user.schemaPrefix,
        experienceId
      );

      if (!existing) {
        const error = new Error('Experience not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      await this.experienceRepository.delete(user.schemaPrefix, experienceId);

      // Trigger profile regeneration
      await this.triggerProfileRegeneration(userId, user.schemaPrefix);

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCE_DELETED',
        resourceType: 'experience',
        resourceId: experienceId,
        operation: 'delete',
        success: true
      });

      return { message: 'Experience deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete experience', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  async enrichExperienceData(experienceData) {
    // This would be extended to include:
    // - Skills extraction from description
    // - Impact quantification
    // - Achievement highlighting
    // - Technology detection
    
    const enriched = { ...experienceData };

    // Extract skills from description (placeholder logic)
    if (experienceData.description) {
      enriched.extractedSkills = this.extractSkillsFromText(experienceData.description);
    }

    // Calculate duration if dates provided
    if (experienceData.startDate) {
      const start = new Date(experienceData.startDate);
      const end = experienceData.endDate ? new Date(experienceData.endDate) : new Date();
      const durationMonths = Math.floor((end - start) / (1000 * 60 * 60 * 24 * 30));
      enriched.durationMonths = durationMonths;
    }

    return enriched;
  }

  extractSkillsFromText(text) {
    // Placeholder skill extraction logic
    // In production, this would use NLP or a skills database
    const skillKeywords = [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS',
      'Docker', 'Kubernetes', 'Machine Learning', 'Data Analysis',
      'Project Management', 'Leadership', 'Communication', 'Problem Solving'
    ];

    const foundSkills = [];
    const lowerText = text.toLowerCase();

    skillKeywords.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });

    return foundSkills;
  }

  async triggerProfileRegeneration(userId, schemaPrefix) {
    // This would trigger an async job to regenerate user profile summaries
    // For now, we'll just log it
    logger.info('Profile regeneration triggered', { userId, schemaPrefix });
  }

  async getExperienceStats(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.experienceRepository.getStats(user.schemaPrefix);
    } catch (error) {
      logger.error('Failed to get experience stats', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = ExperienceService;