const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType } = require('docx');

class ResumeService {
  constructor(experienceRepository, userRepository, analyticsService, auditService, openaiService = null) {
    this.experienceRepository = experienceRepository;
    this.userRepository = userRepository;
    this.analyticsService = analyticsService;
    this.auditService = auditService;
    this.openaiService = openaiService;
    
    // Resume templates
    this.templates = {
      professional: require('./resumeTemplates/professional'),
      modern: require('./resumeTemplates/modern'),
      executive: require('./resumeTemplates/executive'),
      technical: require('./resumeTemplates/technical'),
      creative: require('./resumeTemplates/creative')
    };
  }

  /**
   * Generate a resume based on user experiences and selected template
   */
  async generateResume(userId, options = {}) {
    try {
      const {
        templateId = 'professional',
        targetRole = null,
        includeSkills = true,
        includeEducation = true,
        includeAchievements = true,
        atsOptimized = true,
        format = 'pdf'
      } = options;

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Gather all necessary data
      const [experiences, analytics, skills] = await Promise.all([
        this.experienceRepository.findByUser(user.schemaPrefix),
        this.analyticsService.generateAnalyticsSummary(userId),
        this.analyticsService.analyzeSkillsProgression(userId)
      ]);

      // Build resume data structure
      const resumeData = await this.buildResumeData(user, experiences, analytics, skills, targetRole);

      // Apply ATS optimization if requested
      if (atsOptimized) {
        await this.optimizeForATS(resumeData, targetRole);
      }

      // Generate resume using selected template
      const template = this.templates[templateId];
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      let resumeContent;
      if (format === 'pdf') {
        resumeContent = await this.generatePDF(resumeData, template);
      } else if (format === 'docx') {
        resumeContent = await this.generateDOCX(resumeData, template);
      } else {
        resumeContent = await this.generateJSON(resumeData);
      }

      // Log the generation
      await this.auditService.logDataAccess({
        userId,
        action: 'RESUME_GENERATED',
        resourceType: 'resume',
        resourceId: resumeData.resumeId,
        operation: 'generate',
        success: true,
        metadata: { template: templateId, format, atsOptimized }
      });

      return {
        resumeId: resumeData.resumeId,
        content: resumeContent,
        format,
        metadata: {
          template: templateId,
          generatedAt: new Date(),
          atsScore: resumeData.atsScore || null
        }
      };
    } catch (error) {
      logger.error('Failed to generate resume', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Build resume data structure from user information
   */
  async buildResumeData(user, experiences, analytics, skills, targetRole) {
    const resumeData = {
      resumeId: uuidv4(),
      personal: {
        name: user.fullName || `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone || '',
        location: user.location || '',
        linkedIn: user.linkedIn || '',
        website: user.website || '',
        summary: await this.generateProfessionalSummary(user, analytics, targetRole)
      },
      experiences: [],
      skills: [],
      education: [],
      achievements: [],
      certifications: []
    };

    // Process experiences
    const workExperiences = experiences
      .filter(exp => exp.experienceType === 'work')
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    for (const exp of workExperiences) {
      const processedExp = await this.processExperience(exp, targetRole);
      resumeData.experiences.push(processedExp);
    }

    // Process education
    const educationExperiences = experiences
      .filter(exp => exp.experienceType === 'education')
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    resumeData.education = educationExperiences.map(edu => ({
      institution: edu.organization,
      degree: edu.title,
      field: edu.department || '',
      location: edu.location || '',
      startDate: edu.startDate,
      endDate: edu.endDate || 'Present',
      gpa: edu.gpa || null,
      honors: edu.achievements || []
    }));

    // Process skills
    if (skills && skills.skills) {
      resumeData.skills = this.categorizeSkills(skills.skills);
    }

    // Extract achievements
    resumeData.achievements = await this.extractTopAchievements(experiences, analytics);

    // Extract certifications
    const certifications = experiences.filter(exp => exp.experienceType === 'certification');
    resumeData.certifications = certifications.map(cert => ({
      name: cert.title,
      issuer: cert.organization,
      date: cert.startDate,
      expiry: cert.endDate || null,
      credentialId: cert.credentialId || null
    }));

    return resumeData;
  }

  /**
   * Generate professional summary using AI
   */
  async generateProfessionalSummary(user, analytics, targetRole) {
    if (!this.openaiService || !process.env.OPENAI_API_KEY) {
      // Fallback to template-based summary
      return this.generateTemplateSummary(user, analytics);
    }

    try {
      const prompt = `Generate a professional summary for a resume. The candidate has ${analytics.totalYearsExperience} years of experience.

Top Skills: ${analytics.topSkills.map(s => s.name).join(', ')}
Career Velocity: ${this.getVelocityDescription(analytics.careerVelocityScore)}
${targetRole ? `Target Role: ${targetRole}` : ''}

Generate a 2-3 sentence professional summary that:
1. Highlights years of experience and expertise areas
2. Mentions key achievements or strengths
3. ${targetRole ? `Aligns with the ${targetRole} position` : 'Shows career progression'}
4. Uses action-oriented language
5. Avoids clichés and generic statements`;

      const summary = await this.openaiService.generateResponse(prompt);
      return summary.trim();
    } catch (error) {
      logger.warn('Failed to generate AI summary, using template', { error: error.message });
      return this.generateTemplateSummary(user, analytics);
    }
  }

  /**
   * Generate template-based summary fallback
   */
  generateTemplateSummary(user, analytics) {
    const years = Math.round(analytics.totalYearsExperience);
    const topSkills = analytics.topSkills.slice(0, 3).map(s => s.name).join(', ');
    
    return `Experienced professional with ${years}+ years in ${topSkills}. ` +
           `Proven track record of delivering high-impact solutions and driving team success. ` +
           `Seeking opportunities to leverage technical expertise and leadership experience.`;
  }

  /**
   * Process individual experience for resume
   */
  async processExperience(experience, targetRole) {
    const processed = {
      title: experience.title,
      company: experience.organization,
      location: experience.location || '',
      startDate: this.formatDate(experience.startDate),
      endDate: experience.isCurrent ? 'Present' : this.formatDate(experience.endDate),
      bullets: []
    };

    // Generate optimized bullet points
    if (experience.description || experience.achievements) {
      processed.bullets = await this.generateBulletPoints(experience, targetRole);
    }

    // Add quantified impacts
    if (experience.quantifiedImpacts && experience.quantifiedImpacts.length > 0) {
      const impactBullets = experience.quantifiedImpacts.map(impact => 
        this.formatImpactStatement(impact)
      );
      processed.bullets.push(...impactBullets);
    }

    // Limit bullets for readability
    processed.bullets = processed.bullets.slice(0, 5);

    return processed;
  }

  /**
   * Generate optimized bullet points for experience
   */
  async generateBulletPoints(experience, targetRole) {
    const bullets = [];
    
    // Parse existing description into bullets
    if (experience.description) {
      const descriptionBullets = experience.description
        .split(/[•·▪◦]|\n/)
        .map(line => line.trim())
        .filter(line => line.length > 10);
      
      bullets.push(...descriptionBullets);
    }

    // Add achievements
    if (experience.achievements && Array.isArray(experience.achievements)) {
      bullets.push(...experience.achievements);
    }

    // Optimize bullets with AI if available
    if (this.openaiService && targetRole) {
      try {
        const optimized = await this.optimizeBulletsWithAI(bullets, experience.title, targetRole);
        return optimized;
      } catch (error) {
        logger.warn('Failed to optimize bullets with AI', { error: error.message });
      }
    }

    // Apply basic optimization
    return bullets.map(bullet => this.optimizeBulletPoint(bullet));
  }

  /**
   * Optimize bullet points using AI
   */
  async optimizeBulletsWithAI(bullets, roleTitle, targetRole) {
    const prompt = `Optimize these resume bullet points for a ${roleTitle} applying to a ${targetRole} position.

Current bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Rewrite each bullet to:
1. Start with a strong action verb
2. Include quantifiable metrics where possible
3. Focus on achievements and impact, not just responsibilities
4. Use keywords relevant to ${targetRole}
5. Keep each bullet concise (under 2 lines)

Return the optimized bullets as a JSON array of strings.`;

    try {
      const response = await this.openaiService.generateResponse(prompt);
      const optimized = JSON.parse(response);
      return Array.isArray(optimized) ? optimized : bullets;
    } catch (error) {
      return bullets;
    }
  }

  /**
   * Basic bullet point optimization
   */
  optimizeBulletPoint(bullet) {
    // Remove leading dashes or bullets
    bullet = bullet.replace(/^[-•·▪◦]\s*/, '');
    
    // Ensure it starts with an action verb
    const actionVerbs = [
      'Led', 'Developed', 'Implemented', 'Managed', 'Created', 'Designed',
      'Improved', 'Increased', 'Reduced', 'Delivered', 'Coordinated',
      'Established', 'Launched', 'Optimized', 'Achieved', 'Drove'
    ];
    
    const firstWord = bullet.split(' ')[0];
    if (!actionVerbs.some(verb => firstWord.toLowerCase() === verb.toLowerCase())) {
      // Try to rephrase
      if (bullet.toLowerCase().includes('responsible for')) {
        bullet = bullet.replace(/responsible for/i, 'Managed');
      } else if (bullet.toLowerCase().includes('worked on')) {
        bullet = bullet.replace(/worked on/i, 'Developed');
      }
    }
    
    // Ensure proper capitalization
    bullet = bullet.charAt(0).toUpperCase() + bullet.slice(1);
    
    // Add period if missing
    if (!bullet.endsWith('.')) {
      bullet += '.';
    }
    
    return bullet;
  }

  /**
   * Categorize skills for resume
   */
  categorizeSkills(skills) {
    const categories = {
      'Technical Skills': [],
      'Programming Languages': [],
      'Tools & Technologies': [],
      'Soft Skills': []
    };

    skills.forEach(skill => {
      if (skill.skillCategory === 'programming') {
        categories['Programming Languages'].push(skill.skillName);
      } else if (['frontend', 'backend', 'database', 'cloud'].includes(skill.skillCategory)) {
        categories['Tools & Technologies'].push(skill.skillName);
      } else if (skill.skillCategory === 'soft') {
        categories['Soft Skills'].push(skill.skillName);
      } else {
        categories['Technical Skills'].push(skill.skillName);
      }
    });

    // Remove empty categories and format
    return Object.entries(categories)
      .filter(([_, skills]) => skills.length > 0)
      .map(([category, skills]) => ({
        category,
        skills: skills.slice(0, 10) // Limit skills per category
      }));
  }

  /**
   * Extract top achievements from experiences
   */
  async extractTopAchievements(experiences, analytics) {
    const achievements = [];
    
    // Extract achievements from experiences
    experiences.forEach(exp => {
      if (exp.achievements && Array.isArray(exp.achievements)) {
        exp.achievements.forEach(achievement => {
          achievements.push({
            achievement,
            experience: exp.title,
            organization: exp.organization,
            date: exp.startDate
          });
        });
      }
    });

    // Sort by recency and impact
    achievements.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Return top 5 achievements
    return achievements.slice(0, 5).map(a => a.achievement);
  }

  /**
   * Optimize resume for ATS (Applicant Tracking System)
   */
  async optimizeForATS(resumeData, targetRole) {
    const atsScore = {
      total: 0,
      factors: {
        keywords: 0,
        formatting: 0,
        length: 0,
        sections: 0
      }
    };

    // Check for standard sections
    const requiredSections = ['personal', 'experiences', 'skills', 'education'];
    const presentSections = requiredSections.filter(section => 
      resumeData[section] && (Array.isArray(resumeData[section]) ? resumeData[section].length > 0 : true)
    );
    atsScore.factors.sections = (presentSections.length / requiredSections.length) * 25;

    // Check keywords if target role provided
    if (targetRole && this.openaiService) {
      try {
        const keywords = await this.extractTargetKeywords(targetRole);
        const resumeText = JSON.stringify(resumeData).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
          resumeText.includes(keyword.toLowerCase())
        );
        atsScore.factors.keywords = (matchedKeywords.length / keywords.length) * 40;
      } catch (error) {
        atsScore.factors.keywords = 20; // Default score
      }
    } else {
      atsScore.factors.keywords = 20; // Default score
    }

    // Check formatting (simple structure is better for ATS)
    atsScore.factors.formatting = 25; // Assume good formatting

    // Check length (1-2 pages is ideal)
    const experienceCount = resumeData.experiences.length;
    if (experienceCount >= 3 && experienceCount <= 6) {
      atsScore.factors.length = 10;
    } else if (experienceCount < 3) {
      atsScore.factors.length = 5;
    } else {
      atsScore.factors.length = 7;
    }

    // Calculate total score
    atsScore.total = Object.values(atsScore.factors).reduce((sum, score) => sum + score, 0);
    resumeData.atsScore = atsScore;

    return resumeData;
  }

  /**
   * Extract keywords for target role
   */
  async extractTargetKeywords(targetRole) {
    if (!this.openaiService) {
      // Return common keywords
      return ['leadership', 'management', 'communication', 'problem solving', 'teamwork'];
    }

    try {
      const prompt = `List 15-20 important keywords and skills for a ${targetRole} position. Include both technical skills and soft skills. Return as a JSON array of strings.`;
      const response = await this.openaiService.generateResponse(prompt);
      const keywords = JSON.parse(response);
      return Array.isArray(keywords) ? keywords : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate PDF resume
   */
  async generatePDF(resumeData, template) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'Letter',
          margins: { top: 50, left: 50, right: 50, bottom: 50 }
        });
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Apply template styling
        template.applyPDFStyling(doc, resumeData);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate DOCX resume
   */
  async generateDOCX(resumeData, template) {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: template.generateDOCXContent(resumeData)
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      logger.error('Failed to generate DOCX', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate JSON resume (for further processing)
   */
  async generateJSON(resumeData) {
    return JSON.stringify(resumeData, null, 2);
  }

  /**
   * Get available resume templates
   */
  getAvailableTemplates() {
    return Object.keys(this.templates).map(id => ({
      id,
      name: this.templates[id].name,
      description: this.templates[id].description,
      preview: this.templates[id].preview || null
    }));
  }

  /**
   * Preview resume without generating file
   */
  async previewResume(userId, options = {}) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const [experiences, analytics, skills] = await Promise.all([
        this.experienceRepository.findByUser(user.schemaPrefix),
        this.analyticsService.generateAnalyticsSummary(userId),
        this.analyticsService.analyzeSkillsProgression(userId)
      ]);

      const resumeData = await this.buildResumeData(
        user, 
        experiences, 
        analytics, 
        skills, 
        options.targetRole
      );

      if (options.atsOptimized) {
        await this.optimizeForATS(resumeData, options.targetRole);
      }

      return resumeData;
    } catch (error) {
      logger.error('Failed to preview resume', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update resume section
   */
  async updateResumeSection(userId, section, data) {
    // This would be used for manual edits to resume sections
    // Implementation depends on whether we want to store resume drafts
    logger.info('Resume section update requested', { userId, section });
    return { success: true, message: 'Section updated' };
  }

  /**
   * Helper methods
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  }

  formatImpactStatement(impact) {
    if (impact.metric && impact.value) {
      return `${impact.description || 'Achieved'} ${impact.value}${impact.unit || ''} ${impact.metric}`;
    }
    return impact.description || '';
  }

  getVelocityDescription(velocityScore) {
    if (velocityScore >= 0.8) return 'rapidly advancing';
    if (velocityScore >= 0.6) return 'steadily progressing';
    if (velocityScore >= 0.4) return 'consistently growing';
    return 'building experience';
  }
}

module.exports = ResumeService;