/**
 * CPA PERT Service
 * Handles competency mapping, PERT response generation, and EVR compliance
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class CPAPertService {
  constructor(
    cpaPertRepository,
    experienceRepository,
    auditService,
    chatService
  ) {
    this.cpaPertRepository = cpaPertRepository;
    this.experienceRepository = experienceRepository;
    this.auditService = auditService;
    this.chatService = chatService;
  }

  /**
   * Analyze experience and map to CPA competencies
   */
  async analyzeExperienceCompetencies(experienceId, userId) {
    try {
      // Get experience details
      const experience = await this.experienceRepository.findById(experienceId, userId);
      if (!experience) {
        throw new Error('Experience not found');
      }

      // Get all CPA competencies
      const competencies = await this.cpaPertRepository.getAllCompetencies();

      // Use AI to analyze and map competencies
      const mappings = await this._performCompetencyMapping(experience, competencies);

      // Save mappings to database
      const savedMappings = [];
      for (const mapping of mappings) {
        const saved = await this.cpaPertRepository.createCompetencyMapping({
          mapping_id: uuidv4(),
          experience_id: experienceId,
          user_id: userId,
          competency_id: mapping.competency_id,
          relevance_score: mapping.relevance_score,
          evidence_extracted: mapping.evidence,
          mapping_method: 'AI_ASSISTED'
        });
        savedMappings.push(saved);
      }

      // Log the analysis
      await this.auditService.logUserAction({
        userId,
        action: 'ANALYZE_COMPETENCIES',
        resourceType: 'experience',
        resourceId: experienceId,
        details: { competencies_mapped: savedMappings.length }
      });

      return savedMappings;
    } catch (error) {
      logger.error('Error analyzing competencies', { error, experienceId, userId });
      throw error;
    }
  }

  /**
   * Generate PERT response for a specific competency
   */
  async generatePERTResponse(experienceId, competencyCode, proficiencyLevel, userId) {
    try {
      // Validate proficiency level
      if (![0, 1, 2].includes(proficiencyLevel)) {
        throw new Error('Invalid proficiency level. Must be 0, 1, or 2');
      }

      // Get experience and competency details
      const [experience, competency] = await Promise.all([
        this.experienceRepository.findById(experienceId, userId),
        this.cpaPertRepository.getCompetencyByCode(competencyCode)
      ]);

      if (!experience) throw new Error('Experience not found');
      if (!competency) throw new Error('Competency not found');

      // Check for existing mapping
      const mapping = await this.cpaPertRepository.getCompetencyMapping(
        experienceId,
        competency.competency_id
      );

      if (!mapping) {
        throw new Error('No competency mapping found. Please analyze experience first.');
      }

      // Generate PERT response using AI
      const pertResponse = await this._generatePERTContent(
        experience,
        competency,
        proficiencyLevel,
        mapping.evidence_extracted
      );

      // Validate character count (max 5000)
      if (pertResponse.response_text.length > 5000) {
        throw new Error('PERT response exceeds 5000 character limit');
      }

      // Save PERT response
      const savedResponse = await this.cpaPertRepository.createPERTResponse({
        response_id: uuidv4(),
        user_id: userId,
        experience_id: experienceId,
        competency_id: competency.competency_id,
        proficiency_level: proficiencyLevel,
        response_text: pertResponse.response_text,
        character_count: pertResponse.response_text.length,
        situation_text: pertResponse.situation,
        task_text: pertResponse.task,
        action_text: pertResponse.action,
        result_text: pertResponse.result,
        quantified_impact: pertResponse.quantified_impact,
        is_compliant: 'Y'
      });

      // Log the generation
      await this.auditService.logUserAction({
        userId,
        action: 'GENERATE_PERT',
        resourceType: 'pert_response',
        resourceId: savedResponse.response_id,
        details: { 
          competency_code: competencyCode,
          proficiency_level: proficiencyLevel,
          character_count: savedResponse.character_count
        }
      });

      return savedResponse;
    } catch (error) {
      logger.error('Error generating PERT response', { 
        error, 
        experienceId, 
        competencyCode, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Validate EVR requirements for user
   */
  async validateEVRRequirements(userId) {
    try {
      // Get all user's proficiency assessments
      const assessments = await this.cpaPertRepository.getUserProficiencyAssessments(userId);

      // EVR Requirements:
      // - Must demonstrate proficiency in at least 8 competency areas
      // - Must have Level 2 in at least 2 areas
      // - Must have Level 1 or higher in remaining areas

      const level2Count = assessments.filter(a => a.current_level === 2).length;
      const level1OrHigherCount = assessments.filter(a => a.current_level >= 1).length;
      const totalCompetencies = assessments.length;

      const isCompliant = 
        totalCompetencies >= 8 &&
        level2Count >= 2 &&
        level1OrHigherCount >= 8;

      const missingCompetencies = [];
      if (totalCompetencies < 8) {
        missingCompetencies.push(`Need ${8 - totalCompetencies} more competency areas`);
      }
      if (level2Count < 2) {
        missingCompetencies.push(`Need ${2 - level2Count} more Level 2 competencies`);
      }

      // Save compliance check
      const complianceCheck = await this.cpaPertRepository.createComplianceCheck({
        check_id: uuidv4(),
        user_id: userId,
        check_type: 'EVR_REQUIREMENTS',
        is_compliant: isCompliant ? 'Y' : 'N',
        total_competencies: totalCompetencies,
        competencies_met: level1OrHigherCount,
        missing_competencies: JSON.stringify(missingCompetencies),
        recommendations: this._generateEVRRecommendations(assessments)
      });

      return {
        isCompliant,
        complianceCheck,
        summary: {
          totalCompetencies,
          level2Count,
          level1OrHigherCount,
          missingCompetencies
        }
      };
    } catch (error) {
      logger.error('Error validating EVR requirements', { error, userId });
      throw error;
    }
  }

  /**
   * Assess proficiency level for a specific competency
   */
  async assessProficiencyLevel(experienceId, competencyCode, userId) {
    try {
      const competency = await this.cpaPertRepository.getCompetencyByCode(competencyCode);
      if (!competency) throw new Error('Competency not found');

      // Get all PERT responses for this competency
      const pertResponses = await this.cpaPertRepository.getUserPERTResponsesForCompetency(
        userId,
        competency.competency_id
      );

      // Determine proficiency level based on responses
      let currentLevel = 0;
      let evidence = [];

      if (pertResponses.length > 0) {
        // Find highest demonstrated level
        currentLevel = Math.max(...pertResponses.map(r => r.proficiency_level));
        
        // Collect evidence
        evidence = pertResponses.map(r => ({
          experienceId: r.experience_id,
          level: r.proficiency_level,
          quantifiedImpact: r.quantified_impact
        }));
      }

      // Create or update proficiency assessment
      const assessment = await this.cpaPertRepository.upsertProficiencyAssessment({
        assessment_id: uuidv4(),
        user_id: userId,
        competency_id: competency.competency_id,
        current_level: currentLevel,
        target_level: 2, // EVR requires Level 2
        evidence_count: pertResponses.length,
        strongest_evidence: JSON.stringify(evidence.slice(0, 3)),
        development_areas: this._identifyDevelopmentAreas(currentLevel, competency),
        next_steps: this._generateNextSteps(currentLevel, competency)
      });

      return assessment;
    } catch (error) {
      logger.error('Error assessing proficiency level', { 
        error, 
        experienceId, 
        competencyCode, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive competency report
   */
  async generateCompetencyReport(userId) {
    try {
      const [assessments, complianceCheck, pertResponses] = await Promise.all([
        this.cpaPertRepository.getUserProficiencyAssessments(userId),
        this.cpaPertRepository.getLatestComplianceCheck(userId),
        this.cpaPertRepository.getAllUserPERTResponses(userId)
      ]);

      const report = {
        userId,
        generatedAt: new Date(),
        summary: {
          totalCompetencies: assessments.length,
          level2Achieved: assessments.filter(a => a.current_level === 2).length,
          level1Achieved: assessments.filter(a => a.current_level === 1).length,
          level0Only: assessments.filter(a => a.current_level === 0).length,
          totalPERTResponses: pertResponses.length,
          evrCompliant: complianceCheck?.is_compliant === 'Y'
        },
        competencyDetails: await this._enrichCompetencyDetails(assessments),
        developmentPlan: this._generateDevelopmentPlan(assessments),
        evrReadiness: complianceCheck || { is_compliant: 'N', recommendations: 'No compliance check performed' }
      };

      // Log report generation
      await this.auditService.logUserAction({
        userId,
        action: 'GENERATE_COMPETENCY_REPORT',
        resourceType: 'report',
        details: { summary: report.summary }
      });

      return report;
    } catch (error) {
      logger.error('Error generating competency report', { error, userId });
      throw error;
    }
  }

  // Private helper methods

  async _performCompetencyMapping(experience, competencies) {
    // Use AI to analyze experience and map to competencies
    const prompt = `
      Analyze the following professional experience and identify which CPA competencies it demonstrates.
      
      Experience:
      Title: ${experience.title}
      Company: ${experience.company}
      Description: ${experience.description}
      Key Achievements: ${experience.achievements}
      
      Available Competencies:
      ${competencies.map(c => `- ${c.competency_code}: ${c.competency_name} - ${c.description}`).join('\n')}
      
      For each relevant competency, provide:
      1. Competency code
      2. Relevance score (0-1)
      3. Specific evidence from the experience
      
      Focus on competencies with strong evidence (relevance > 0.7).
    `;

    const response = await this.chatService.processMessage(prompt, experience.user_id);
    
    // Parse AI response to extract mappings
    // This is a simplified version - real implementation would parse structured response
    const mappings = [];
    const competencyMap = new Map(competencies.map(c => [c.competency_code, c]));
    
    // Example parsing logic (would be more sophisticated)
    const lines = response.split('\n');
    for (const line of lines) {
      const match = line.match(/^([\w-]+\d+\.\d+).*relevance:\s*([\d.]+).*evidence:\s*(.+)$/i);
      if (match) {
        const [, code, score, evidence] = match;
        const competency = competencyMap.get(code);
        if (competency && parseFloat(score) >= 0.7) {
          mappings.push({
            competency_id: competency.competency_id,
            relevance_score: parseFloat(score),
            evidence: evidence.trim()
          });
        }
      }
    }

    return mappings;
  }

  async _generatePERTContent(experience, competency, proficiencyLevel, evidence) {
    const levelDescriptions = JSON.parse(competency.proficiency_levels);
    const targetDescription = levelDescriptions[`level${proficiencyLevel}`];

    const prompt = `
      Generate a PERT (Practical Experience Reporting Tool) response for the following:
      
      Experience: ${experience.title} at ${experience.company}
      Competency: ${competency.competency_code} - ${competency.competency_name}
      Target Level: ${proficiencyLevel} - ${targetDescription}
      Evidence: ${evidence}
      
      Create a structured response using the STAR method (Situation, Task, Action, Result):
      1. Situation: Context and challenges (500-800 characters)
      2. Task: Specific responsibilities and objectives (400-600 characters)
      3. Action: Detailed actions taken demonstrating the competency (1500-2000 characters)
      4. Result: Quantified outcomes and impact (800-1000 characters)
      
      Requirements:
      - Total response must be under 5000 characters
      - Use professional language appropriate for CPA certification
      - Include specific quantified impacts where possible
      - Demonstrate the proficiency level clearly
      - Use first person narrative
    `;

    const response = await this.chatService.processMessage(prompt, experience.user_id);
    
    // Parse structured response
    // This is simplified - real implementation would parse formatted response
    return {
      response_text: response,
      situation: response.substring(0, 800),
      task: response.substring(800, 1400),
      action: response.substring(1400, 3400),
      result: response.substring(3400),
      quantified_impact: this._extractQuantifiedImpact(response)
    };
  }

  _extractQuantifiedImpact(text) {
    // Extract quantified metrics from text
    const metrics = [];
    const patterns = [
      /(\d+%)\s*(increase|decrease|improvement|reduction)/gi,
      /\$[\d,]+\s*(saved|generated|reduced)/gi,
      /(\d+)\s*(hours|days|weeks)\s*(saved|reduced)/gi
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        metrics.push(match[0]);
      }
    }

    return metrics.slice(0, 3).join('; ');
  }

  _generateEVRRecommendations(assessments) {
    const recommendations = [];
    
    const level2Count = assessments.filter(a => a.current_level === 2).length;
    const level1Count = assessments.filter(a => a.current_level === 1).length;
    const level0Count = assessments.filter(a => a.current_level === 0).length;

    if (level2Count < 2) {
      recommendations.push(`Focus on advancing ${2 - level2Count} competencies from Level 1 to Level 2`);
    }
    
    if (assessments.length < 8) {
      recommendations.push(`Gain experience in ${8 - assessments.length} additional competency areas`);
    }
    
    if (level0Count > 0) {
      recommendations.push(`Develop practical experience in ${level0Count} competencies currently at Level 0`);
    }

    return JSON.stringify(recommendations);
  }

  _identifyDevelopmentAreas(currentLevel, competency) {
    const areas = [];
    
    if (currentLevel < 2) {
      const levelDescriptions = JSON.parse(competency.proficiency_levels);
      const nextLevel = currentLevel + 1;
      areas.push(`Progress to Level ${nextLevel}: ${levelDescriptions[`level${nextLevel}`]}`);
    }
    
    if (currentLevel === 0) {
      areas.push('Gain hands-on experience with this competency');
      areas.push('Seek mentorship or training opportunities');
    }
    
    return JSON.stringify(areas);
  }

  _generateNextSteps(currentLevel, competency) {
    const steps = [];
    
    if (currentLevel === 0) {
      steps.push('Identify projects or tasks that involve this competency');
      steps.push('Request involvement in relevant initiatives');
    } else if (currentLevel === 1) {
      steps.push('Take on leadership roles in this competency area');
      steps.push('Mentor others to demonstrate advanced proficiency');
    }
    
    steps.push('Document specific examples and quantified impacts');
    
    return JSON.stringify(steps);
  }

  async _enrichCompetencyDetails(assessments) {
    const enriched = [];
    
    for (const assessment of assessments) {
      const competency = await this.cpaPertRepository.getCompetencyById(assessment.competency_id);
      enriched.push({
        ...assessment,
        competency_code: competency.competency_code,
        competency_name: competency.competency_name,
        category: competency.category
      });
    }
    
    return enriched;
  }

  _generateDevelopmentPlan(assessments) {
    const plan = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };
    
    // Categorize by urgency
    assessments.forEach(assessment => {
      if (assessment.current_level === 0) {
        plan.immediate.push({
          competency_id: assessment.competency_id,
          action: 'Gain initial experience',
          target: 'Level 1'
        });
      } else if (assessment.current_level === 1 && assessment.evidence_count < 3) {
        plan.shortTerm.push({
          competency_id: assessment.competency_id,
          action: 'Build additional evidence',
          target: 'Level 2'
        });
      }
    });
    
    return plan;
  }
}

module.exports = CPAPertService;