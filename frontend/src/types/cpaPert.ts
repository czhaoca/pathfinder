// CPA Competency Types
export interface CPACompetency {
  competency_id: string;
  category: 'Technical' | 'Enabling';
  area_code: string;
  area_name: string;
  sub_code: string;
  sub_name: string;
  description: string;
  evr_relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  level_1_criteria: string;
  level_2_criteria: string;
  guiding_questions: string;
  is_active: number;
}

export interface CompetencyMapping {
  mapping_id: string;
  experience_id: string;
  user_id: string;
  competency_id: string;
  relevance_score: number;
  evidence_extracted: string;
  mapping_method: 'AI_ASSISTED' | 'MANUAL';
  is_validated: number;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
  // Joined competency data
  area_code?: string;
  sub_code?: string;
  sub_name?: string;
  category?: string;
}

export interface PertResponse {
  response_id: string;
  user_id: string;
  experience_id: string;
  competency_id: string;
  proficiency_level: 0 | 1 | 2;
  response_text: string;
  character_count: number;
  situation_text: string;
  task_text: string;
  action_text: string;
  result_text: string;
  quantified_impact: string;
  is_compliant: string;
  compliance_notes?: string;
  version: number;
  is_current: number;
  created_at: string;
  updated_at: string;
  // Joined competency data
  area_code?: string;
  sub_code?: string;
  sub_name?: string;
  category?: string;
}

export interface CompetencyFramework {
  Technical: CompetencyCategory[];
  Enabling: CompetencyCategory[];
}

export interface CompetencyCategory {
  competencyId: string;
  areaCode: string;
  areaName: string;
  subCode: string;
  subName: string;
  description: string;
  evrRelevance: string;
  level1Criteria: string;
  level2Criteria: string;
  guidingQuestions: string;
}

export interface ProficiencyAssessment {
  assessment_id: string;
  user_id: string;
  competency_id: string;
  current_level: 0 | 1 | 2;
  target_level: 0 | 1 | 2;
  assessment_date: string;
  evidence_count: number;
  strongest_evidence: string;
  development_areas: string;
  next_steps: string;
  created_at: string;
  updated_at: string;
  // Joined competency data
  competency_code?: string;
  competency_name?: string;
  category?: string;
}

export interface ComplianceCheck {
  check_id: string;
  user_id: string;
  check_type: string;
  check_date: string;
  is_compliant: string;
  total_competencies: number;
  competencies_met: number;
  missing_competencies: string;
  recommendations: string;
  thirty_month_start?: string;
  thirty_month_end?: string;
  twelve_month_rule_met: number;
  expiry_date?: string;
  created_at: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  complianceCheck: ComplianceCheck;
  summary: {
    totalCompetencies: number;
    level2Count: number;
    level1OrHigherCount: number;
    missingCompetencies: string[];
  };
}

export interface ValidationResult {
  isCompliant: boolean;
  details: {
    totalCompetencies: number;
    level2Count: number;
    level1OrHigherCount: number;
    missingCompetencies: string[];
  };
  recommendations: string[];
}

export interface CompetencyReport {
  userId: string;
  generatedAt: string;
  summary: {
    totalCompetencies: number;
    level2Achieved: number;
    level1Achieved: number;
    level0Only: number;
    totalPERTResponses: number;
    evrCompliant: boolean;
  };
  competencyDetails: Array<ProficiencyAssessment & {
    competency_code: string;
    competency_name: string;
    category: string;
  }>;
  developmentPlan: {
    immediate: DevelopmentAction[];
    shortTerm: DevelopmentAction[];
    longTerm: DevelopmentAction[];
  };
  evrReadiness: ComplianceCheck | { is_compliant: string; recommendations: string };
}

export interface DevelopmentAction {
  competency_id: string;
  action: string;
  target: string;
}

// Request/Response Types for API calls
export interface AnalyzeExperienceRequest {
  experienceId: string;
}

export interface AnalyzeExperienceResponse {
  success: boolean;
  data: {
    experienceId: string;
    mappings: CompetencyMapping[];
    totalMapped: number;
  };
}

export interface GeneratePERTRequest {
  experienceId: string;
  competencyCode: string;
  proficiencyLevel: 0 | 1 | 2;
}

export interface BatchAnalyzeRequest {
  experienceIds: string[];
}

export interface BatchAnalyzeResponse {
  success: boolean;
  data: {
    successful: Array<{
      experienceId: string;
      competenciesFound: number;
    }>;
    failed: Array<{
      experienceId: string;
      error: string;
    }>;
    summary: {
      total: number;
      processed: number;
      competenciesFound: number;
    };
  };
}

export interface BatchGenerateRequest {
  requests: Array<{
    experienceId: string;
    competencyCode: string;
    proficiencyLevel: 0 | 1 | 2;
  }>;
}

export interface BatchGenerateResponse {
  success: boolean;
  data: {
    successful: Array<{
      responseId: string;
      experienceId: string;
      competencyCode: string;
      characterCount: number;
    }>;
    failed: Array<{
      request: any;
      error: string;
    }>;
    summary: {
      total: number;
      generated: number;
      totalCharacters: number;
    };
  };
}