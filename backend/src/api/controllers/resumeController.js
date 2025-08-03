class ResumeController {
  constructor(resumeService) {
    this.resumeService = resumeService;
  }

  /**
   * Generate a resume
   */
  async generateResume(req, res, next) {
    try {
      const {
        templateId = 'professional',
        targetRole,
        includeSkills = true,
        includeEducation = true,
        includeAchievements = true,
        atsOptimized = true,
        format = 'pdf'
      } = req.body;

      // Validate format
      const validFormats = ['pdf', 'docx', 'json'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          error: 'Invalid format',
          message: `Format must be one of: ${validFormats.join(', ')}`
        });
      }

      const result = await this.resumeService.generateResume(req.user.userId, {
        templateId,
        targetRole,
        includeSkills,
        includeEducation,
        includeAchievements,
        atsOptimized,
        format
      });

      // Set appropriate headers based on format
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="resume-${result.resumeId}.pdf"`);
      } else if (format === 'docx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="resume-${result.resumeId}.docx"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
      }

      // For binary formats, send the buffer directly
      if (format === 'pdf' || format === 'docx') {
        res.send(result.content);
      } else {
        res.json({
          resumeId: result.resumeId,
          content: JSON.parse(result.content),
          metadata: result.metadata
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Preview resume without generating file
   */
  async previewResume(req, res, next) {
    try {
      const {
        templateId = 'professional',
        targetRole,
        atsOptimized = true
      } = req.query;

      const resumeData = await this.resumeService.previewResume(req.user.userId, {
        templateId,
        targetRole,
        atsOptimized: atsOptimized === 'true'
      });

      res.json({
        preview: resumeData,
        atsScore: resumeData.atsScore || null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available resume templates
   */
  async getTemplates(req, res, next) {
    try {
      const templates = this.resumeService.getAvailableTemplates();
      
      res.json({
        templates,
        count: templates.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a specific section of the resume
   */
  async updateSection(req, res, next) {
    try {
      const { section } = req.params;
      const { data } = req.body;

      // Validate section
      const validSections = ['personal', 'summary', 'experiences', 'skills', 'education', 'achievements', 'certifications'];
      if (!validSections.includes(section)) {
        return res.status(400).json({
          error: 'Invalid section',
          message: `Section must be one of: ${validSections.join(', ')}`
        });
      }

      const result = await this.resumeService.updateResumeSection(
        req.user.userId,
        section,
        data
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ATS optimization suggestions
   */
  async getATSOptimization(req, res, next) {
    try {
      const { targetRole } = req.query;

      if (!targetRole) {
        return res.status(400).json({
          error: 'Target role required',
          message: 'Please provide a target role for ATS optimization'
        });
      }

      // Generate preview with ATS optimization
      const resumeData = await this.resumeService.previewResume(req.user.userId, {
        targetRole,
        atsOptimized: true
      });

      const suggestions = [];

      // Check ATS score factors
      if (resumeData.atsScore) {
        const { factors, total } = resumeData.atsScore;
        
        if (factors.keywords < 30) {
          suggestions.push({
            category: 'keywords',
            priority: 'high',
            suggestion: `Add more keywords relevant to ${targetRole} position`,
            improvement: `Could improve score by ${40 - factors.keywords} points`
          });
        }

        if (factors.sections < 20) {
          suggestions.push({
            category: 'sections',
            priority: 'medium',
            suggestion: 'Include all standard resume sections (Experience, Skills, Education)',
            improvement: `Could improve score by ${25 - factors.sections} points`
          });
        }

        if (total < 70) {
          suggestions.push({
            category: 'overall',
            priority: 'high',
            suggestion: 'Consider using simpler formatting and including more relevant keywords',
            improvement: 'Aim for a score of 70+ for better ATS compatibility'
          });
        }
      }

      res.json({
        atsScore: resumeData.atsScore,
        suggestions,
        optimizationTips: [
          'Use standard section headings',
          'Avoid images, graphics, and complex formatting',
          'Include keywords from the job description',
          'Use standard fonts (Arial, Calibri, Times New Roman)',
          'Save as .docx for best ATS compatibility'
        ]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate multiple resume versions for A/B testing
   */
  async generateVersions(req, res, next) {
    try {
      const { targetRoles = [], templates = ['professional'] } = req.body;

      if (targetRoles.length === 0) {
        return res.status(400).json({
          error: 'No target roles provided',
          message: 'Please provide at least one target role'
        });
      }

      const versions = [];

      for (const role of targetRoles) {
        for (const template of templates) {
          const result = await this.resumeService.generateResume(req.user.userId, {
            templateId: template,
            targetRole: role,
            atsOptimized: true,
            format: 'json'
          });

          versions.push({
            targetRole: role,
            template,
            resumeId: result.resumeId,
            atsScore: result.metadata.atsScore,
            generatedAt: result.metadata.generatedAt
          });
        }
      }

      res.json({
        versions,
        count: versions.length
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ResumeController;