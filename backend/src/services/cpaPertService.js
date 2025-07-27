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
   * Batch analyze multiple experiences
   */
  async batchAnalyzeExperiences(experienceIds, userId) {
    try {
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: experienceIds.length,
          processed: 0,
          competenciesFound: 0
        }
      };

      // Process in batches of 5 to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < experienceIds.length; i += batchSize) {
        const batch = experienceIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (experienceId) => {
          try {
            const mappings = await this.analyzeExperienceCompetencies(experienceId, userId);
            results.successful.push({
              experienceId,
              competenciesFound: mappings.length
            });
            results.summary.competenciesFound += mappings.length;
          } catch (error) {
            results.failed.push({
              experienceId,
              error: error.message
            });
          }
          results.summary.processed++;
        });

        await Promise.all(batchPromises);
      }

      // Log batch analysis
      await this.auditService.logUserAction({
        userId,
        action: 'BATCH_ANALYZE_EXPERIENCES',
        resourceType: 'batch_operation',
        details: results.summary
      });

      return results;
    } catch (error) {
      logger.error('Error in batch analysis', { error, userId });
      throw error;
    }
  }

  /**
   * Batch generate PERT responses for multiple competencies
   */
  async batchGeneratePERTResponses(requests, userId) {
    try {
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: requests.length,
          generated: 0,
          totalCharacters: 0
        }
      };

      // Validate all requests first
      for (const request of requests) {
        if (!request.experienceId || !request.competencyCode || request.proficiencyLevel === undefined) {
          results.failed.push({
            request,
            error: 'Missing required fields'
          });
        }
      }

      // Process valid requests
      const validRequests = requests.filter(r => 
        r.experienceId && r.competencyCode && r.proficiencyLevel !== undefined
      );

      for (const request of validRequests) {
        try {
          const response = await this.generatePERTResponse(
            request.experienceId,
            request.competencyCode,
            request.proficiencyLevel,
            userId
          );
          
          results.successful.push({
            responseId: response.response_id,
            experienceId: request.experienceId,
            competencyCode: request.competencyCode,
            characterCount: response.character_count
          });
          
          results.summary.generated++;
          results.summary.totalCharacters += response.character_count;
        } catch (error) {
          results.failed.push({
            request,
            error: error.message
          });
        }
      }

      // Log batch generation
      await this.auditService.logUserAction({
        userId,
        action: 'BATCH_GENERATE_PERT',
        resourceType: 'batch_operation',
        details: results.summary
      });

      return results;
    } catch (error) {
      logger.error('Error in batch PERT generation', { error, userId });
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
      Organization: ${experience.organization || experience.company}
      Department: ${experience.department || ''}
      Duration: ${experience.start_date} to ${experience.end_date || 'Present'}
      Description: ${experience.description}
      Key Achievements: ${experience.key_highlights || experience.achievements || ''}
      Skills: ${experience.extracted_skills?.join(', ') || ''}
      
      Available CPA Competencies:
      ${competencies.map(c => `
        Code: ${c.competency_code}
        Name: ${c.competency_name}
        Category: ${c.category}
        Description: ${c.description}
        Keywords: ${c.keywords || ''}
      `).join('\n---\n')}
      
      Please analyze and provide a JSON response with the following structure:
      {
        "mappings": [
          {
            "competency_code": "string",
            "relevance_score": number (0.0-1.0),
            "evidence": "specific evidence from the experience",
            "keywords_matched": ["keyword1", "keyword2"],
            "confidence": "high|medium|low"
          }
        ]
      }
      
      Guidelines:
      - Only include competencies with relevance_score >= 0.7
      - Provide specific evidence quotes from the experience
      - Match keywords from competency descriptions
      - Consider the context and depth of experience
      - Focus on technical and enabling competencies
    `;

    try {
      const response = await this.chatService.processMessage(prompt, experience.user_id);
      
      // Parse JSON response
      let parsedResponse;
      try {
        // Extract JSON from response (handle cases where AI adds explanation)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('Failed to parse AI response as JSON, falling back to text parsing', { parseError });
        return this._fallbackTextParsing(response, competencies);
      }

      // Validate and process mappings
      const mappings = [];
      const competencyMap = new Map(competencies.map(c => [c.competency_code, c]));
      
      for (const mapping of parsedResponse.mappings || []) {
        const competency = competencyMap.get(mapping.competency_code);
        if (competency && mapping.relevance_score >= 0.7) {
          mappings.push({
            competency_id: competency.competency_id,
            relevance_score: Math.min(mapping.relevance_score, 1.0),
            evidence: mapping.evidence || '',
            keywords_matched: mapping.keywords_matched || [],
            confidence: mapping.confidence || 'medium'
          });
        }
      }

      // Sort by relevance score descending
      mappings.sort((a, b) => b.relevance_score - a.relevance_score);

      return mappings;
    } catch (error) {
      logger.error('Error in competency mapping', { error });
      throw new Error('Failed to perform competency mapping');
    }
  }

  _fallbackTextParsing(response, competencies) {
    // Fallback parsing logic for non-JSON responses
    const mappings = [];
    const competencyMap = new Map(competencies.map(c => [c.competency_code, c]));
    
    // Look for patterns like "TC-1.1: 0.85" or "competency TC-1.1 with relevance 0.85"
    const patterns = [
      /([A-Z]{2,3}-\d+\.\d+)[:\s]+(\d*\.?\d+)/gi,
      /competency\s+([A-Z]{2,3}-\d+\.\d+).*?relevance\s+(\d*\.?\d+)/gi,
      /([A-Z]{2,3}-\d+\.\d+).*?score[:\s]+(\d*\.?\d+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const [, code, score] = match;
        const competency = competencyMap.get(code);
        const relevanceScore = parseFloat(score);
        
        if (competency && relevanceScore >= 0.7 && relevanceScore <= 1.0) {
          // Extract evidence (text around the match)
          const startIdx = Math.max(0, match.index - 100);
          const endIdx = Math.min(response.length, match.index + match[0].length + 200);
          const evidence = response.substring(startIdx, endIdx).trim();
          
          mappings.push({
            competency_id: competency.competency_id,
            relevance_score: relevanceScore,
            evidence: evidence,
            keywords_matched: [],
            confidence: 'low'
          });
        }
      }
    }

    return mappings;
  }

  async _generatePERTContent(experience, competency, proficiencyLevel, evidence) {
    const levelDescriptions = JSON.parse(competency.proficiency_levels || '{}');
    const targetDescription = levelDescriptions[`level${proficiencyLevel}`] || '';

    const prompt = `
      Generate a PERT (Practical Experience Reporting Tool) response for CPA Canada certification.
      
      CONTEXT:
      Experience: ${experience.title} at ${experience.organization || experience.company}
      Department: ${experience.department || 'N/A'}
      Duration: ${experience.start_date} to ${experience.end_date || 'Present'}
      
      COMPETENCY TO DEMONSTRATE:
      Code: ${competency.competency_code}
      Name: ${competency.competency_name}
      Category: ${competency.category}
      Target Proficiency Level: ${proficiencyLevel}
      Level Description: ${targetDescription}
      
      EVIDENCE FROM EXPERIENCE:
      ${evidence}
      
      INSTRUCTIONS:
      Generate a professional PERT response using the STAR method with the following structure:
      
      {
        "situation": "Describe the context, business environment, and specific challenges faced. Include relevant background about the organization, industry, and your role. (500-800 characters)",
        "task": "Explain your specific responsibilities, objectives, and what needed to be accomplished. Be clear about your role versus team contributions. (400-600 characters)",
        "action": "Detail the specific actions YOU took to demonstrate this competency at Level ${proficiencyLevel}. Include technical skills, professional judgment, analysis methods, and decision-making process. This should be the most detailed section. (1500-2000 characters)",
        "result": "Quantify the outcomes and business impact of your actions. Include specific metrics, percentages, dollar amounts, time savings, or other measurable improvements. Explain how this demonstrated the competency. (800-1000 characters)",
        "quantified_impact": ["List 2-3 specific quantified achievements"],
        "competency_demonstration": "Brief explanation of how this demonstrates Level ${proficiencyLevel} proficiency"
      }
      
      REQUIREMENTS:
      - Total response must be under 5000 characters
      - Use first-person narrative ("I analyzed...", "I developed...")
      - Include specific technical accounting/business terminology
      - Demonstrate progression appropriate for Level ${proficiencyLevel}
      - Focus on YOUR individual contributions
      - Include quantified results wherever possible
      - Ensure professional tone suitable for regulatory submission
    `;

    try {
      const response = await this.chatService.processMessage(prompt, experience.user_id);
      
      // Parse structured response
      let parsedResponse;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('Failed to parse PERT response as JSON', { parseError });
        // Fallback to text parsing
        return this._fallbackPERTParsing(response);
      }

      // Validate character counts
      const situation = this._truncateToLimit(parsedResponse.situation || '', 800);
      const task = this._truncateToLimit(parsedResponse.task || '', 600);
      const action = this._truncateToLimit(parsedResponse.action || '', 2000);
      const result = this._truncateToLimit(parsedResponse.result || '', 1000);

      // Combine into full response
      const fullResponse = `SITUATION:\n${situation}\n\nTASK:\n${task}\n\nACTION:\n${action}\n\nRESULT:\n${result}`;

      // Ensure total is under 5000 characters
      if (fullResponse.length > 5000) {
        // Trim action section first as it's the longest
        const excess = fullResponse.length - 5000;
        const trimmedAction = action.substring(0, action.length - excess - 50);
        const adjustedResponse = `SITUATION:\n${situation}\n\nTASK:\n${task}\n\nACTION:\n${trimmedAction}...\n\nRESULT:\n${result}`;
        
        return {
          response_text: adjustedResponse,
          situation: situation,
          task: task,
          action: trimmedAction,
          result: result,
          quantified_impact: Array.isArray(parsedResponse.quantified_impact) 
            ? parsedResponse.quantified_impact.join('; ') 
            : this._extractQuantifiedImpact(result)
        };
      }

      return {
        response_text: fullResponse,
        situation: situation,
        task: task,
        action: action,
        result: result,
        quantified_impact: Array.isArray(parsedResponse.quantified_impact) 
          ? parsedResponse.quantified_impact.join('; ') 
          : this._extractQuantifiedImpact(result)
      };
    } catch (error) {
      logger.error('Error generating PERT content', { error });
      throw new Error('Failed to generate PERT response');
    }
  }

  _truncateToLimit(text, limit) {
    if (text.length <= limit) return text;
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, limit);
    const lastPeriod = truncated.lastIndexOf('.');
    return lastPeriod > limit - 100 ? truncated.substring(0, lastPeriod + 1) : truncated + '...';
  }

  _fallbackPERTParsing(response) {
    // Extract sections based on keywords
    const sections = {
      situation: this._extractSection(response, ['SITUATION:', 'Situation:', 'Context:'], 800),
      task: this._extractSection(response, ['TASK:', 'Task:', 'Responsibility:'], 600),
      action: this._extractSection(response, ['ACTION:', 'Action:', 'Actions taken:'], 2000),
      result: this._extractSection(response, ['RESULT:', 'Result:', 'Outcome:'], 1000)
    };

    const fullResponse = Object.entries(sections)
      .map(([key, value]) => `${key.toUpperCase()}:\n${value}`)
      .join('\n\n');

    return {
      response_text: fullResponse.substring(0, 5000),
      situation: sections.situation,
      task: sections.task,
      action: sections.action,
      result: sections.result,
      quantified_impact: this._extractQuantifiedImpact(sections.result)
    };
  }

  _extractSection(text, markers, maxLength) {
    for (const marker of markers) {
      const index = text.indexOf(marker);
      if (index !== -1) {
        const start = index + marker.length;
        const nextMarkerIndex = text.search(/\n(SITUATION|TASK|ACTION|RESULT|Situation|Task|Action|Result):/);
        const end = nextMarkerIndex > start ? nextMarkerIndex : text.length;
        return this._truncateToLimit(text.substring(start, end).trim(), maxLength);
      }
    }
    return '';
  }

  _extractQuantifiedImpact(text) {
    // Extract quantified metrics from text
    const metrics = [];
    
    // Patterns to match various quantified impacts
    const patterns = [
      /(\d+\.?\d*)\s*%\s*([a-zA-Z\s]+)/g,  // Percentages
      /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*([a-zA-Z\s]+)/g,  // Dollar amounts
      /(\d+(?:,\d{3})*)\s*(hours?|days?|weeks?|months?)\s*([a-zA-Z\s]+)/g,  // Time savings
      /(\d+(?:,\d{3})*)\s*(clients?|customers?|accounts?|transactions?|reports?)/g,  // Counts
      /(increased|decreased|reduced|improved|saved)\s*.*?by\s*(\d+\.?\d*\s*%?)/gi,  // Improvements
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        metrics.push(match[0].trim());
      }
    });

    // Return up to 3 most relevant metrics
    return metrics.slice(0, 3).join('; ') || 'Quantified impact to be specified';
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