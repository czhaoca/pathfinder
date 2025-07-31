const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class AnalyticsService {
  constructor(analyticsRepository, experienceRepository, userRepository, auditService, openaiService = null) {
    this.analyticsRepository = analyticsRepository;
    this.experienceRepository = experienceRepository;
    this.userRepository = userRepository;
    this.auditService = auditService;
    this.openaiService = openaiService;
  }

  /**
   * Analyze and track skill progression for a user
   */
  async analyzeSkillsProgression(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get all user experiences
      const experiences = await this.experienceRepository.findByUser(user.schemaPrefix);
      
      // Extract and analyze skills from all experiences
      const skillsMap = new Map();
      
      for (const experience of experiences) {
        const skills = experience.extractedSkills || [];
        const startDate = new Date(experience.startDate);
        const endDate = experience.endDate ? new Date(experience.endDate) : new Date();
        const monthsUsed = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));

        skills.forEach(skill => {
          const skillKey = typeof skill === 'string' ? skill : skill.name;
          const existing = skillsMap.get(skillKey);
          
          if (existing) {
            existing.evidenceCount++;
            existing.totalMonthsUsed += monthsUsed;
            existing.lastUsedDate = endDate > existing.lastUsedDate ? endDate : existing.lastUsedDate;
            existing.firstUsedDate = startDate < existing.firstUsedDate ? startDate : existing.firstUsedDate;
            existing.contexts.push({
              experienceId: experience.experienceId,
              title: experience.title,
              organization: experience.organization
            });
          } else {
            skillsMap.set(skillKey, {
              skillName: skillKey,
              skillCategory: skill.category || 'other',
              evidenceCount: 1,
              totalMonthsUsed: monthsUsed,
              firstUsedDate: startDate,
              lastUsedDate: endDate,
              confidenceScore: skill.confidence || 0.7,
              contexts: [{
                experienceId: experience.experienceId,
                title: experience.title,
                organization: experience.organization
              }]
            });
          }
        });
      }

      // Calculate proficiency levels based on usage
      const skillsProgression = Array.from(skillsMap.entries()).map(([skillName, data]) => {
        const proficiencyLevel = this.calculateProficiencyLevel(data);
        return {
          progressionId: uuidv4(),
          skillName,
          ...data,
          proficiencyLevel
        };
      });

      // Save skills progression data
      await this.analyticsRepository.saveSkillsProgression(user.schemaPrefix, skillsProgression);

      // Log the analysis
      await this.auditService.logDataAccess({
        userId,
        action: 'SKILLS_PROGRESSION_ANALYZED',
        resourceType: 'analytics',
        resourceId: null,
        operation: 'analyze',
        success: true,
        metadata: { skillCount: skillsProgression.length }
      });

      return {
        skills: skillsProgression,
        summary: this.generateSkillsSummary(skillsProgression)
      };
    } catch (error) {
      logger.error('Failed to analyze skills progression', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate proficiency level based on usage data
   */
  calculateProficiencyLevel(skillData) {
    const { totalMonthsUsed, evidenceCount } = skillData;
    
    // Scoring factors
    const monthsScore = Math.min(totalMonthsUsed / 60, 1) * 0.6; // Max 5 years
    const evidenceScore = Math.min(evidenceCount / 10, 1) * 0.4; // Max 10 experiences
    
    const totalScore = monthsScore + evidenceScore;
    
    if (totalScore >= 0.8) return 5; // Expert
    if (totalScore >= 0.6) return 4; // Advanced
    if (totalScore >= 0.4) return 3; // Intermediate
    if (totalScore >= 0.2) return 2; // Basic
    return 1; // Beginner
  }

  /**
   * Generate career trajectory visualization data
   */
  async generateCareerTrajectory(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const experiences = await this.experienceRepository.findByUser(user.schemaPrefix);
      const milestones = await this.extractCareerMilestones(experiences);
      
      // Sort experiences chronologically
      const timeline = experiences
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .map(exp => ({
          experienceId: exp.experienceId,
          title: exp.title,
          organization: exp.organization,
          startDate: exp.startDate,
          endDate: exp.endDate || 'Present',
          type: exp.experienceType,
          level: this.inferSeniorityLevel(exp.title),
          skills: exp.extractedSkills || [],
          impact: exp.quantifiedImpacts || []
        }));

      // Calculate career velocity (progression speed)
      const careerVelocity = this.calculateCareerVelocity(timeline);
      
      // Identify career pivots and transitions
      const transitions = this.identifyCareerTransitions(timeline);

      await this.auditService.logDataAccess({
        userId,
        action: 'CAREER_TRAJECTORY_GENERATED',
        resourceType: 'analytics',
        resourceId: null,
        operation: 'analyze',
        success: true
      });

      return {
        timeline,
        milestones,
        transitions,
        careerVelocity,
        projectedPath: await this.projectCareerPath(timeline, user)
      };
    } catch (error) {
      logger.error('Failed to generate career trajectory', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Extract significant career milestones from experiences
   */
  async extractCareerMilestones(experiences) {
    const milestones = [];
    
    for (const exp of experiences) {
      // Identify role changes
      if (exp.experienceType === 'work') {
        milestones.push({
          milestoneId: uuidv4(),
          milestoneType: 'role_change',
          milestoneDate: exp.startDate,
          title: `Started as ${exp.title}`,
          description: `Joined ${exp.organization || 'organization'} as ${exp.title}`,
          organization: exp.organization,
          impactScore: this.calculateRoleImpact(exp),
          relatedExperiences: [exp.experienceId]
        });
      }
      
      // Identify achievements
      if (exp.achievements && exp.achievements.length > 0) {
        exp.achievements.forEach(achievement => {
          milestones.push({
            milestoneId: uuidv4(),
            milestoneType: 'achievement',
            milestoneDate: exp.startDate, // Approximate
            title: achievement,
            description: `Achievement at ${exp.organization}`,
            organization: exp.organization,
            impactScore: 0.7,
            relatedExperiences: [exp.experienceId]
          });
        });
      }
    }
    
    return milestones.sort((a, b) => new Date(a.milestoneDate) - new Date(b.milestoneDate));
  }

  /**
   * Calculate career velocity (speed of progression)
   */
  calculateCareerVelocity(timeline) {
    if (timeline.length < 2) return 0;
    
    let progressionScore = 0;
    let transitionCount = 0;
    
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      
      // Check for level progression
      if (curr.level > prev.level) {
        progressionScore += (curr.level - prev.level);
        transitionCount++;
      }
    }
    
    // Calculate years of experience
    const firstExp = timeline[0];
    const lastExp = timeline[timeline.length - 1];
    const yearsExperience = (new Date(lastExp.endDate === 'Present' ? new Date() : lastExp.endDate) - 
                            new Date(firstExp.startDate)) / (365 * 24 * 60 * 60 * 1000);
    
    // Velocity = progression per year
    return yearsExperience > 0 ? (progressionScore / yearsExperience) : 0;
  }

  /**
   * Identify career transitions and pivots
   */
  identifyCareerTransitions(timeline) {
    const transitions = [];
    
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      
      // Check for industry change
      if (prev.organization && curr.organization && 
          this.detectIndustryChange(prev, curr)) {
        transitions.push({
          type: 'industry_change',
          from: prev,
          to: curr,
          date: curr.startDate
        });
      }
      
      // Check for role type change
      if (this.detectRoleTypeChange(prev.title, curr.title)) {
        transitions.push({
          type: 'role_pivot',
          from: prev,
          to: curr,
          date: curr.startDate
        });
      }
    }
    
    return transitions;
  }

  /**
   * Quantify achievements and calculate impact scores
   */
  async quantifyAchievements(userId, experienceId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const experience = await this.experienceRepository.findById(user.schemaPrefix, experienceId);
      if (!experience) {
        throw new Error('Experience not found');
      }

      // Extract quantifiable metrics from description and achievements
      const metrics = await this.extractMetrics(experience);
      
      // Calculate impact scores for different categories
      const impactScores = {
        revenue: this.calculateRevenueImpact(metrics, experience),
        efficiency: this.calculateEfficiencyImpact(metrics, experience),
        teamGrowth: this.calculateTeamImpact(metrics, experience),
        innovation: this.calculateInnovationImpact(metrics, experience),
        overall: 0
      };
      
      // Calculate overall impact
      impactScores.overall = Object.values(impactScores)
        .filter(v => typeof v === 'number')
        .reduce((sum, score) => sum + score, 0) / 4;

      // Save impact scores
      await this.analyticsRepository.saveImpactScores(user.schemaPrefix, experienceId, impactScores);

      await this.auditService.logDataAccess({
        userId,
        action: 'ACHIEVEMENTS_QUANTIFIED',
        resourceType: 'analytics',
        resourceId: experienceId,
        operation: 'analyze',
        success: true,
        metadata: { impactScore: impactScores.overall }
      });

      return {
        experienceId,
        metrics,
        impactScores,
        suggestions: this.generateImpactSuggestions(experience, metrics)
      };
    } catch (error) {
      logger.error('Failed to quantify achievements', { userId, experienceId, error: error.message });
      throw error;
    }
  }

  /**
   * Extract quantifiable metrics from experience using AI
   */
  async extractMetrics(experience) {
    if (this.openaiService && process.env.OPENAI_API_KEY) {
      try {
        const prompt = `Extract quantifiable metrics and achievements from this experience. Look for numbers, percentages, dollar amounts, time savings, team sizes, etc.

Title: ${experience.title}
Organization: ${experience.organization}
Description: ${experience.description}
Achievements: ${experience.achievements ? experience.achievements.join('; ') : 'N/A'}

Return metrics in JSON format:
{
  "revenue": { "value": number, "unit": "dollars|percentage", "context": "description" },
  "costSavings": { "value": number, "unit": "dollars|percentage", "context": "description" },
  "efficiency": { "value": number, "unit": "hours|percentage", "context": "description" },
  "teamSize": { "value": number, "unit": "people", "context": "description" },
  "projectScale": { "value": number, "unit": "users|transactions|etc", "context": "description" },
  "other": [{ "metric": "name", "value": number, "unit": "unit", "context": "description" }]
}`;

        const response = await this.openaiService.generateResponse(prompt);
        return JSON.parse(response);
      } catch (error) {
        logger.warn('Failed to extract metrics with AI', { error: error.message });
      }
    }

    // Fallback to pattern matching
    return this.extractMetricsWithPatterns(experience);
  }

  /**
   * Extract metrics using regex patterns
   */
  extractMetricsWithPatterns(experience) {
    const text = `${experience.title} ${experience.description} ${experience.achievements?.join(' ') || ''}`;
    const metrics = {
      revenue: null,
      costSavings: null,
      efficiency: null,
      teamSize: null,
      projectScale: null,
      other: []
    };

    // Revenue patterns ($X, X% revenue increase)
    const revenuePattern = /\$?([\d,]+(?:\.\d+)?)[kKmMbB]?\s*(?:in\s+)?(?:revenue|sales)|(?:increased|grew|generated)\s+revenue\s+(?:by\s+)?([\d.]+)%/gi;
    const revenueMatch = revenuePattern.exec(text);
    if (revenueMatch) {
      metrics.revenue = {
        value: this.parseNumber(revenueMatch[1] || revenueMatch[2]),
        unit: revenueMatch[1] ? 'dollars' : 'percentage',
        context: revenueMatch[0]
      };
    }

    // Team size patterns
    const teamPattern = /(?:led|managed|team of|collaborated with)\s+([\d]+)\s*(?:people|engineers|developers|members)/gi;
    const teamMatch = teamPattern.exec(text);
    if (teamMatch) {
      metrics.teamSize = {
        value: parseInt(teamMatch[1]),
        unit: 'people',
        context: teamMatch[0]
      };
    }

    // Efficiency patterns (X% faster, saved X hours)
    const efficiencyPattern = /([\d.]+)%\s*(?:faster|improvement|efficiency)|saved\s+([\d,]+)\s*(?:hours|days)/gi;
    const efficiencyMatch = efficiencyPattern.exec(text);
    if (efficiencyMatch) {
      metrics.efficiency = {
        value: this.parseNumber(efficiencyMatch[1] || efficiencyMatch[2]),
        unit: efficiencyMatch[1] ? 'percentage' : 'hours',
        context: efficiencyMatch[0]
      };
    }

    return metrics;
  }

  /**
   * Helper function to parse numbers with k/m/b suffixes
   */
  parseNumber(str) {
    if (!str) return 0;
    str = str.replace(/,/g, '');
    const num = parseFloat(str);
    if (str.match(/[kK]$/)) return num * 1000;
    if (str.match(/[mM]$/)) return num * 1000000;
    if (str.match(/[bB]$/)) return num * 1000000000;
    return num;
  }

  /**
   * Calculate impact scores for different categories
   */
  calculateRevenueImpact(metrics, experience) {
    if (!metrics.revenue) return 0;
    
    // Score based on revenue impact
    const value = metrics.revenue.value;
    const unit = metrics.revenue.unit;
    
    if (unit === 'percentage') {
      // Percentage improvements
      if (value >= 100) return 1.0;
      if (value >= 50) return 0.8;
      if (value >= 25) return 0.6;
      if (value >= 10) return 0.4;
      return 0.2;
    } else {
      // Dollar amounts (assume in thousands)
      if (value >= 10000) return 1.0; // $10M+
      if (value >= 1000) return 0.8;  // $1M+
      if (value >= 100) return 0.6;   // $100K+
      if (value >= 10) return 0.4;    // $10K+
      return 0.2;
    }
  }

  calculateEfficiencyImpact(metrics, experience) {
    if (!metrics.efficiency) return 0;
    
    const value = metrics.efficiency.value;
    const unit = metrics.efficiency.unit;
    
    if (unit === 'percentage') {
      if (value >= 75) return 1.0;
      if (value >= 50) return 0.8;
      if (value >= 25) return 0.6;
      if (value >= 10) return 0.4;
      return 0.2;
    }
    
    return 0.5; // Default for time savings
  }

  calculateTeamImpact(metrics, experience) {
    if (!metrics.teamSize) return 0;
    
    const size = metrics.teamSize.value;
    
    if (size >= 50) return 1.0;
    if (size >= 20) return 0.8;
    if (size >= 10) return 0.6;
    if (size >= 5) return 0.4;
    return 0.2;
  }

  calculateInnovationImpact(metrics, experience) {
    // Look for innovation keywords
    const text = `${experience.description} ${experience.achievements?.join(' ') || ''}`.toLowerCase();
    const innovationKeywords = ['launched', 'created', 'built', 'designed', 'implemented', 'pioneered', 'introduced', 'developed'];
    
    const keywordCount = innovationKeywords.filter(keyword => text.includes(keyword)).length;
    
    return Math.min(keywordCount * 0.2, 1.0);
  }

  /**
   * Generate suggestions for improving impact documentation
   */
  generateImpactSuggestions(experience, metrics) {
    const suggestions = [];
    
    if (!metrics.revenue) {
      suggestions.push({
        category: 'revenue',
        suggestion: 'Add revenue impact: Did this work increase sales, reduce costs, or improve profitability?'
      });
    }
    
    if (!metrics.efficiency) {
      suggestions.push({
        category: 'efficiency',
        suggestion: 'Quantify efficiency gains: How much time/resources were saved? What processes were improved?'
      });
    }
    
    if (!metrics.teamSize && experience.experienceType === 'work') {
      suggestions.push({
        category: 'leadership',
        suggestion: 'Specify team involvement: How many people did you work with or lead?'
      });
    }
    
    return suggestions;
  }

  /**
   * Generate comprehensive analytics summary
   */
  async generateAnalyticsSummary(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Gather all analytics data
      const [skillsData, trajectoryData, experiences] = await Promise.all([
        this.analyzeSkillsProgression(userId),
        this.generateCareerTrajectory(userId),
        this.experienceRepository.findByUser(user.schemaPrefix)
      ]);

      // Calculate summary scores
      const summary = {
        summaryId: uuidv4(),
        analysisDate: new Date(),
        totalYearsExperience: this.calculateTotalExperience(experiences),
        careerVelocityScore: trajectoryData.careerVelocity,
        skillDiversityScore: this.calculateSkillDiversity(skillsData.skills),
        leadershipScore: await this.calculateLeadershipScore(experiences),
        technicalDepthScore: this.calculateTechnicalDepth(skillsData.skills),
        industryExpertiseScore: this.calculateIndustryExpertise(experiences),
        topSkills: this.getTopSkills(skillsData.skills, 10),
        skillGaps: await this.identifySkillGaps(skillsData.skills, trajectoryData),
        careerTrajectory: trajectoryData,
        recommendations: await this.generateRecommendations(skillsData, trajectoryData, experiences)
      };

      // Save summary
      await this.analyticsRepository.saveAnalyticsSummary(user.schemaPrefix, summary);

      await this.auditService.logDataAccess({
        userId,
        action: 'ANALYTICS_SUMMARY_GENERATED',
        resourceType: 'analytics',
        resourceId: summary.summaryId,
        operation: 'analyze',
        success: true
      });

      return summary;
    } catch (error) {
      logger.error('Failed to generate analytics summary', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods for calculations
   */
  calculateTotalExperience(experiences) {
    if (experiences.length === 0) return 0;
    
    const workExperiences = experiences.filter(exp => exp.experienceType === 'work');
    if (workExperiences.length === 0) return 0;
    
    const sortedExperiences = workExperiences.sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );
    
    const firstDate = new Date(sortedExperiences[0].startDate);
    const lastDate = sortedExperiences.some(exp => exp.isCurrent) 
      ? new Date() 
      : new Date(sortedExperiences[sortedExperiences.length - 1].endDate);
    
    return Math.round((lastDate - firstDate) / (365 * 24 * 60 * 60 * 1000) * 10) / 10;
  }

  calculateSkillDiversity(skills) {
    if (skills.length === 0) return 0;
    
    const categories = new Set(skills.map(s => s.skillCategory));
    const categoryScore = Math.min(categories.size / 6, 1) * 0.5; // 6 main categories
    const countScore = Math.min(skills.length / 30, 1) * 0.5; // 30 skills is very diverse
    
    return categoryScore + countScore;
  }

  async calculateLeadershipScore(experiences) {
    const leadershipIndicators = {
      titles: ['manager', 'director', 'vp', 'president', 'chief', 'head', 'lead', 'senior'],
      achievements: ['led', 'managed', 'directed', 'oversaw', 'supervised', 'mentored', 'coached'],
      teamSize: 0
    };
    
    let score = 0;
    let indicators = 0;
    
    experiences.forEach(exp => {
      // Check title
      const titleLower = exp.title.toLowerCase();
      if (leadershipIndicators.titles.some(indicator => titleLower.includes(indicator))) {
        score += 0.2;
        indicators++;
      }
      
      // Check achievements
      const text = `${exp.description} ${exp.achievements?.join(' ') || ''}`.toLowerCase();
      const leadershipActions = leadershipIndicators.achievements.filter(action => 
        text.includes(action)
      ).length;
      
      if (leadershipActions > 0) {
        score += Math.min(leadershipActions * 0.1, 0.3);
        indicators++;
      }
      
      // Check team size
      if (exp.teamSize && exp.teamSize > 0) {
        score += Math.min(exp.teamSize / 50, 0.3); // Max 0.3 for 50+ team
        indicators++;
      }
    });
    
    return Math.min(score, 1);
  }

  calculateTechnicalDepth(skills) {
    const advancedSkills = skills.filter(s => s.proficiencyLevel >= 4).length;
    const expertSkills = skills.filter(s => s.proficiencyLevel === 5).length;
    
    const depthScore = (advancedSkills * 0.1 + expertSkills * 0.2);
    return Math.min(depthScore, 1);
  }

  calculateIndustryExpertise(experiences) {
    // Group by organization/industry
    const industries = new Map();
    let totalMonths = 0;
    
    experiences.forEach(exp => {
      if (exp.experienceType === 'work' && exp.organization) {
        const months = this.calculateMonthsDuration(exp.startDate, exp.endDate);
        totalMonths += months;
        
        const current = industries.get(exp.organization) || 0;
        industries.set(exp.organization, current + months);
      }
    });
    
    if (totalMonths === 0) return 0;
    
    // Calculate concentration (how focused in specific industries)
    const concentrations = Array.from(industries.values()).map(months => months / totalMonths);
    const maxConcentration = Math.max(...concentrations);
    
    // Also consider total experience
    const experienceScore = Math.min(totalMonths / 120, 0.5); // 10 years max
    const concentrationScore = maxConcentration * 0.5;
    
    return experienceScore + concentrationScore;
  }

  calculateMonthsDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    return Math.floor((end - start) / (1000 * 60 * 60 * 24 * 30));
  }

  getTopSkills(skills, limit = 10) {
    return skills
      .sort((a, b) => {
        // Sort by proficiency level first, then by evidence count
        if (b.proficiencyLevel !== a.proficiencyLevel) {
          return b.proficiencyLevel - a.proficiencyLevel;
        }
        return b.evidenceCount - a.evidenceCount;
      })
      .slice(0, limit)
      .map(skill => ({
        name: skill.skillName,
        category: skill.skillCategory,
        proficiencyLevel: skill.proficiencyLevel,
        monthsUsed: skill.totalMonthsUsed
      }));
  }

  async identifySkillGaps(currentSkills, trajectory) {
    // This would ideally use job market data and career path analysis
    // For now, we'll use a simplified approach
    
    const currentSkillNames = new Set(currentSkills.map(s => s.skillName.toLowerCase()));
    const gaps = [];
    
    // Based on trajectory, suggest missing skills
    const lastRole = trajectory.timeline[trajectory.timeline.length - 1];
    if (lastRole) {
      const suggestedSkills = await this.getSuggestedSkillsForRole(lastRole.title);
      
      suggestedSkills.forEach(suggested => {
        if (!currentSkillNames.has(suggested.toLowerCase())) {
          gaps.push({
            skill: suggested,
            importance: 'high',
            reason: `Common skill for ${lastRole.title} roles`
          });
        }
      });
    }
    
    return gaps;
  }

  async getSuggestedSkillsForRole(roleTitle) {
    // Simplified skill suggestions based on role
    const roleLower = roleTitle.toLowerCase();
    
    if (roleLower.includes('software') || roleLower.includes('engineer')) {
      return ['JavaScript', 'Python', 'Git', 'Docker', 'AWS', 'Testing', 'CI/CD'];
    }
    if (roleLower.includes('manager')) {
      return ['Leadership', 'Project Management', 'Agile', 'Communication', 'Budgeting'];
    }
    if (roleLower.includes('data')) {
      return ['Python', 'SQL', 'Machine Learning', 'Statistics', 'Visualization'];
    }
    
    return [];
  }

  async generateRecommendations(skillsData, trajectoryData, experiences) {
    const recommendations = [];
    
    // Skill development recommendations
    if (skillsData.skills.filter(s => s.proficiencyLevel >= 4).length < 3) {
      recommendations.push({
        type: 'skill_development',
        priority: 'high',
        recommendation: 'Focus on deepening expertise in 2-3 core skills to reach advanced proficiency',
        action: 'Identify your most used skills and pursue advanced training or certifications'
      });
    }
    
    // Career velocity recommendations
    if (trajectoryData.careerVelocity < 0.5) {
      recommendations.push({
        type: 'career_growth',
        priority: 'medium',
        recommendation: 'Consider pursuing opportunities for career advancement',
        action: 'Look for stretch assignments or leadership opportunities in your current role'
      });
    }
    
    // Documentation recommendations
    const experiencesWithoutMetrics = experiences.filter(exp => 
      !exp.quantifiedImpacts || exp.quantifiedImpacts.length === 0
    );
    
    if (experiencesWithoutMetrics.length > experiences.length * 0.5) {
      recommendations.push({
        type: 'impact_documentation',
        priority: 'high',
        recommendation: 'Quantify your achievements to better demonstrate impact',
        action: 'Add metrics and numbers to your experience descriptions'
      });
    }
    
    return recommendations;
  }

  /**
   * Infer seniority level from job title
   */
  inferSeniorityLevel(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('chief') || titleLower.includes('vp') || titleLower.includes('president')) return 5;
    if (titleLower.includes('director') || titleLower.includes('head')) return 4;
    if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('principal')) return 3;
    if (titleLower.includes('mid') || (!titleLower.includes('junior') && !titleLower.includes('intern'))) return 2;
    return 1;
  }

  detectIndustryChange(prev, curr) {
    // Simplified industry detection
    // In production, this would use industry classification codes
    return prev.organization !== curr.organization;
  }

  detectRoleTypeChange(prevTitle, currTitle) {
    const prevType = this.classifyRoleType(prevTitle);
    const currType = this.classifyRoleType(currTitle);
    return prevType !== currType;
  }

  classifyRoleType(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('engineer') || titleLower.includes('developer')) return 'technical';
    if (titleLower.includes('manager') || titleLower.includes('director')) return 'management';
    if (titleLower.includes('analyst')) return 'analytical';
    if (titleLower.includes('designer')) return 'creative';
    
    return 'other';
  }

  calculateRoleImpact(experience) {
    // Simple impact calculation based on available data
    let impact = 0.5; // Base score
    
    if (experience.teamSize && experience.teamSize > 10) impact += 0.2;
    if (experience.achievements && experience.achievements.length > 2) impact += 0.2;
    if (experience.quantifiedImpacts && experience.quantifiedImpacts.length > 0) impact += 0.1;
    
    return Math.min(impact, 1);
  }

  generateSkillsSummary(skillsProgression) {
    const totalSkills = skillsProgression.length;
    const expertSkills = skillsProgression.filter(s => s.proficiencyLevel === 5).length;
    const advancedSkills = skillsProgression.filter(s => s.proficiencyLevel >= 4).length;
    
    const categoryCounts = {};
    skillsProgression.forEach(skill => {
      categoryCounts[skill.skillCategory] = (categoryCounts[skill.skillCategory] || 0) + 1;
    });
    
    return {
      totalSkills,
      expertSkills,
      advancedSkills,
      skillsByCategory: categoryCounts,
      averageProficiency: skillsProgression.reduce((sum, s) => sum + s.proficiencyLevel, 0) / totalSkills
    };
  }

  async projectCareerPath(timeline, user) {
    // Simple career projection based on current trajectory
    // In production, this would use ML models and industry data
    
    if (timeline.length === 0) return null;
    
    const currentRole = timeline[timeline.length - 1];
    const currentLevel = currentRole.level;
    
    const projections = [];
    
    // Short term (1-2 years)
    if (currentLevel < 5) {
      projections.push({
        timeframe: '1-2 years',
        possibleRoles: this.getNextLevelRoles(currentRole.title, currentLevel),
        requiredSkills: await this.getSuggestedSkillsForRole(currentRole.title),
        probability: 0.7
      });
    }
    
    // Medium term (3-5 years)
    if (currentLevel < 4) {
      projections.push({
        timeframe: '3-5 years',
        possibleRoles: this.getNextLevelRoles(currentRole.title, currentLevel + 1),
        requiredSkills: ['Leadership', 'Strategic Planning', 'Business Acumen'],
        probability: 0.5
      });
    }
    
    return projections;
  }

  getNextLevelRoles(currentTitle, currentLevel) {
    // Simplified role progression
    const progressions = {
      'engineer': ['Senior Engineer', 'Lead Engineer', 'Principal Engineer', 'Engineering Manager', 'Director of Engineering'],
      'developer': ['Senior Developer', 'Lead Developer', 'Principal Developer', 'Development Manager', 'Director of Development'],
      'analyst': ['Senior Analyst', 'Lead Analyst', 'Principal Analyst', 'Analytics Manager', 'Director of Analytics'],
      'manager': ['Senior Manager', 'Director', 'Senior Director', 'VP', 'SVP']
    };
    
    // Find matching progression path
    const titleLower = currentTitle.toLowerCase();
    for (const [key, path] of Object.entries(progressions)) {
      if (titleLower.includes(key)) {
        return path.slice(currentLevel, currentLevel + 2);
      }
    }
    
    return [`Senior ${currentTitle}`, `Lead ${currentTitle}`];
  }
}

module.exports = AnalyticsService;