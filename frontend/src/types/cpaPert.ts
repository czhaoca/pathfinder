export interface CompetencyMapping {
  experienceId: string;
  competencies: {
    id: string;
    name: string;
    description: string;
    relevance: number;
    matchedSkills: string[];
  }[];
  overallMatch: number;
  suggestions: string[];
}

export interface PertResponse {
  id: string;
  experienceId: string;
  content: string;
  competencies: string[];
  wordCount: number;
  status: 'draft' | 'final' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyFramework {
  version: string;
  lastUpdated: string;
  competencies: {
    id: string;
    code: string;
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    keywords: string[];
    examples: string[];
  }[];
}

export interface ProficiencyAssessment {
  experienceId: string;
  assessments: {
    competencyId: string;
    proficiencyLevel: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
    confidence: number;
    evidence: string[];
  }[];
  overallProficiency: string;
  recommendations: string[];
}

export interface ComplianceCheck {
  status: 'compliant' | 'non-compliant' | 'partial';
  issues: {
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }[];
  lastChecked: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
  warnings: {
    field: string;
    message: string;
  }[];
}

export interface CompetencyReport {
  userId: string;
  totalExperiences: number;
  competencyCoverage: {
    competencyId: string;
    competencyName: string;
    experienceCount: number;
    averageProficiency: string;
    lastDemonstrated: string;
  }[];
  gaps: string[];
  strengths: string[];
  recommendations: string[];
  generatedAt: string;
}