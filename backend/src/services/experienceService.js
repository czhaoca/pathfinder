const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ExperienceService {
  constructor(experienceRepository, userRepository, auditService, openaiService = null) {
    this.experienceRepository = experienceRepository;
    this.userRepository = userRepository;
    this.auditService = auditService;
    this.openaiService = openaiService;
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

  async bulkCreateExperiences(userId, experiencesData) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const createdExperiences = [];
      const errors = [];

      // Process each experience
      for (let i = 0; i < experiencesData.length; i++) {
        try {
          const enrichedData = await this.enrichExperienceData(experiencesData[i]);
          const experienceId = await this.experienceRepository.create(
            user.schemaPrefix,
            {
              ...enrichedData,
              experienceId: uuidv4()
            }
          );
          
          const created = await this.experienceRepository.findById(user.schemaPrefix, experienceId);
          createdExperiences.push(created);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      // Trigger profile regeneration once for all experiences
      if (createdExperiences.length > 0) {
        await this.triggerProfileRegeneration(userId, user.schemaPrefix);
      }

      // Log bulk creation
      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCES_BULK_CREATED',
        resourceType: 'experience',
        resourceId: null,
        operation: 'bulk_create',
        success: true,
        metadata: { 
          total: experiencesData.length,
          created: createdExperiences.length,
          failed: errors.length
        }
      });

      if (errors.length > 0) {
        logger.warn('Some experiences failed to create', { userId, errors });
      }

      return createdExperiences;
    } catch (error) {
      logger.error('Failed to bulk create experiences', { userId, error: error.message });
      throw error;
    }
  }

  async bulkUpdateExperiences(userId, updates) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const updatedExperiences = [];
      const errors = [];

      // Process each update
      for (let i = 0; i < updates.length; i++) {
        try {
          const { id, data } = updates[i];
          
          // Check if experience exists
          const existing = await this.experienceRepository.findById(
            user.schemaPrefix,
            id
          );

          if (!existing) {
            errors.push({
              index: i,
              experienceId: id,
              error: 'Experience not found'
            });
            continue;
          }

          const enrichedData = await this.enrichExperienceData(data);
          await this.experienceRepository.update(
            user.schemaPrefix,
            id,
            enrichedData
          );
          
          const updated = await this.experienceRepository.findById(user.schemaPrefix, id);
          updatedExperiences.push(updated);
        } catch (error) {
          errors.push({
            index: i,
            experienceId: updates[i].id,
            error: error.message
          });
        }
      }

      // Trigger profile regeneration once for all experiences
      if (updatedExperiences.length > 0) {
        await this.triggerProfileRegeneration(userId, user.schemaPrefix);
      }

      // Log bulk update
      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCES_BULK_UPDATED',
        resourceType: 'experience',
        resourceId: null,
        operation: 'bulk_update',
        success: true,
        metadata: { 
          total: updates.length,
          updated: updatedExperiences.length,
          failed: errors.length
        }
      });

      if (errors.length > 0) {
        logger.warn('Some experiences failed to update', { userId, errors });
      }

      return updatedExperiences;
    } catch (error) {
      logger.error('Failed to bulk update experiences', { userId, error: error.message });
      throw error;
    }
  }

  async duplicateExperience(userId, experienceId, modifications = {}) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get original experience
      const original = await this.experienceRepository.findById(
        user.schemaPrefix,
        experienceId
      );

      if (!original) {
        const error = new Error('Experience not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      // Create duplicate with modifications
      const duplicateData = {
        ...original,
        ...modifications,
        experienceId: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Remove fields that shouldn't be duplicated
      delete duplicateData.id;

      const enrichedData = await this.enrichExperienceData(duplicateData);
      const newExperienceId = await this.experienceRepository.create(
        user.schemaPrefix,
        enrichedData
      );

      // Trigger profile regeneration
      await this.triggerProfileRegeneration(userId, user.schemaPrefix);

      await this.auditService.logDataAccess({
        userId,
        action: 'EXPERIENCE_DUPLICATED',
        resourceType: 'experience',
        resourceId: newExperienceId,
        operation: 'duplicate',
        success: true,
        metadata: { 
          originalId: experienceId
        }
      });

      return await this.experienceRepository.findById(user.schemaPrefix, newExperienceId);
    } catch (error) {
      logger.error('Failed to duplicate experience', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  async extractSkills(userId, experienceId, regenerate = false) {
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

      // If skills already exist and not regenerating, return them
      if (experience.extractedSkills && experience.extractedSkills.length > 0 && !regenerate) {
        return experience.extractedSkills;
      }

      // Extract skills using AI (placeholder for now, will integrate with OpenAI)
      const skills = await this.extractSkillsWithAI(experience);

      // Update experience with extracted skills
      await this.experienceRepository.update(
        user.schemaPrefix,
        experienceId,
        { extractedSkills: skills }
      );

      await this.auditService.logDataAccess({
        userId,
        action: 'SKILLS_EXTRACTED',
        resourceType: 'experience',
        resourceId: experienceId,
        operation: 'extract_skills',
        success: true,
        metadata: { 
          skillCount: skills.length,
          regenerated: regenerate
        }
      });

      return skills;
    } catch (error) {
      logger.error('Failed to extract skills', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  async extractSkillsWithAI(experience) {
    try {
      // Check if OpenAI service is available
      if (!this.openaiService || !process.env.OPENAI_API_KEY) {
        // Fallback to keyword extraction if OpenAI is not available
        return this.extractSkillsWithKeywords(experience);
      }

      // Prepare the prompt for skill extraction
      const prompt = `Analyze the following work experience and extract relevant technical and soft skills. For each skill, categorize it and provide a confidence score (0-1).

Title: ${experience.title || 'N/A'}
Organization: ${experience.organization || 'N/A'}
Description: ${experience.description || 'N/A'}
Key Highlights: ${experience.keyHighlights ? experience.keyHighlights.join('; ') : 'N/A'}
Technologies Used: ${experience.technologiesUsed ? experience.technologiesUsed.join(', ') : 'N/A'}

Extract skills and return them in this JSON format:
[
  {
    "name": "Skill Name",
    "category": "programming|frontend|backend|database|cloud|data|soft|other",
    "confidence": 0.9
  }
]

Focus on:
1. Technical skills mentioned explicitly
2. Technologies and tools used
3. Soft skills demonstrated through achievements
4. Industry-specific knowledge
5. Methodologies and frameworks

Only include skills that are clearly evident from the experience description.`;

      const response = await this.openaiService.generateResponse(prompt);
      
      // Parse the JSON response
      try {
        const skills = JSON.parse(response);
        
        // Validate and sanitize the skills
        const validSkills = skills
          .filter(skill => 
            skill.name && 
            typeof skill.name === 'string' && 
            skill.category && 
            typeof skill.confidence === 'number' &&
            skill.confidence >= 0 && 
            skill.confidence <= 1
          )
          .map(skill => ({
            name: skill.name.trim(),
            category: this.normalizeSkillCategory(skill.category),
            confidence: Math.round(skill.confidence * 100) / 100
          }));

        // Remove duplicates
        const uniqueSkills = Array.from(
          new Map(validSkills.map(s => [s.name.toLowerCase(), s])).values()
        );

        return uniqueSkills.sort((a, b) => b.confidence - a.confidence);
      } catch (parseError) {
        logger.warn('Failed to parse OpenAI skill extraction response', { 
          error: parseError.message,
          response: response.substring(0, 200) 
        });
        
        // Fallback to keyword extraction
        return this.extractSkillsWithKeywords(experience);
      }
    } catch (error) {
      logger.error('Failed to extract skills with AI', { error: error.message });
      
      // Fallback to keyword extraction
      return this.extractSkillsWithKeywords(experience);
    }
  }

  normalizeSkillCategory(category) {
    const validCategories = ['programming', 'frontend', 'backend', 'database', 'cloud', 'data', 'soft', 'other'];
    const normalized = category.toLowerCase().trim();
    
    return validCategories.includes(normalized) ? normalized : 'other';
  }

  extractSkillsWithKeywords(experience) {
    const text = `${experience.title || ''} ${experience.organization || ''} ${experience.description || ''} ${experience.keyHighlights ? experience.keyHighlights.join(' ') : ''} ${experience.technologiesUsed ? experience.technologiesUsed.join(' ') : ''}`;
    
    // Enhanced skill extraction with categories
    const skillCategories = {
      programming: ['JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript', 'PHP', 'Scala'],
      frontend: ['React', 'Vue', 'Angular', 'HTML', 'CSS', 'Sass', 'Webpack', 'Next.js', 'Gatsby', 'Redux', 'MobX', 'Tailwind'],
      backend: ['Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Rails', 'ASP.NET', 'FastAPI', 'GraphQL', 'REST API'],
      database: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'Oracle', 'NoSQL'],
      cloud: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CloudFormation', 'CI/CD', 'DevOps', 'Jenkins'],
      data: ['Machine Learning', 'Data Science', 'Data Analysis', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Tableau'],
      soft: ['Leadership', 'Communication', 'Problem Solving', 'Team Management', 'Project Management', 'Agile', 'Scrum', 'Mentoring', 'Collaboration']
    };

    const foundSkills = [];
    const lowerText = text.toLowerCase();

    Object.entries(skillCategories).forEach(([category, skills]) => {
      skills.forEach(skill => {
        if (lowerText.includes(skill.toLowerCase())) {
          foundSkills.push({
            name: skill,
            category,
            confidence: 0.7 // Lower confidence for keyword matching
          });
        }
      });
    });

    // Remove duplicates and sort by category
    const uniqueSkills = Array.from(new Map(foundSkills.map(s => [s.name, s])).values());
    return uniqueSkills.sort((a, b) => a.category.localeCompare(b.category));
  }

  async getExperienceTemplates(category = null) {
    try {
      // TODO: Move these to database
      const templates = [
        {
          id: 'software-engineer',
          category: 'technology',
          title: 'Software Engineer',
          description: 'Design, develop, and maintain software applications. Collaborate with cross-functional teams to deliver high-quality solutions.',
          suggestedSkills: ['Programming', 'Problem Solving', 'Software Design', 'Testing'],
          template: {
            experienceType: 'work',
            title: 'Software Engineer',
            description: `• Developed and maintained [type of application] using [technologies]
• Collaborated with [team size] team members to deliver [project outcomes]
• Improved [metric] by [percentage] through [specific action]
• Implemented [feature/system] that [business impact]`
          }
        },
        {
          id: 'project-manager',
          category: 'management',
          title: 'Project Manager',
          description: 'Lead project teams, manage timelines and budgets, ensure successful project delivery.',
          suggestedSkills: ['Project Management', 'Leadership', 'Communication', 'Risk Management'],
          template: {
            experienceType: 'work',
            title: 'Project Manager',
            description: `• Managed [number] projects with budgets totaling $[amount]
• Led cross-functional teams of [size] to deliver projects [timeframe]
• Implemented [process/methodology] resulting in [improvement]
• Achieved [percentage]% on-time delivery rate across all projects`
          }
        },
        {
          id: 'data-analyst',
          category: 'data',
          title: 'Data Analyst',
          description: 'Analyze complex data sets, create visualizations, and provide actionable insights.',
          suggestedSkills: ['Data Analysis', 'SQL', 'Python', 'Visualization', 'Statistics'],
          template: {
            experienceType: 'work',
            title: 'Data Analyst',
            description: `• Analyzed [data volume] records to identify [insights/patterns]
• Created [number] dashboards and reports using [tools]
• Reduced reporting time by [percentage]% through automation
• Provided insights that led to [business outcome]`
          }
        },
        {
          id: 'volunteer-coordinator',
          category: 'nonprofit',
          title: 'Volunteer Coordinator',
          description: 'Organize volunteer programs, recruit and train volunteers, coordinate events.',
          suggestedSkills: ['Volunteer Management', 'Event Planning', 'Communication', 'Training'],
          template: {
            experienceType: 'volunteer',
            title: 'Volunteer Coordinator',
            description: `• Recruited and managed [number] volunteers for [organization]
• Organized [number] events with [total attendance] participants
• Developed training programs that improved volunteer retention by [percentage]%
• Raised $[amount] through fundraising initiatives`
          }
        }
      ];

      // Filter by category if provided
      if (category) {
        return templates.filter(t => t.category === category);
      }

      return templates;
    } catch (error) {
      logger.error('Failed to get experience templates', { category, error: error.message });
      throw error;
    }
  }
}

module.exports = ExperienceService;