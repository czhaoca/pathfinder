import api from '@/lib/api';
import { 
  CompetencyMapping, 
  PertResponse, 
  CompetencyFramework,
  ProficiencyAssessment,
  ComplianceCheck,
  ValidationResult,
  CompetencyReport
} from '@/types/cpaPert';

class CpaPertService {
  async analyzeExperience(experienceData: any): Promise<CompetencyMapping> {
    return api.post<CompetencyMapping>('/cpa-pert/analyze-experience', experienceData);
  }

  async getCompetencyMapping(experienceId: string): Promise<CompetencyMapping> {
    return api.get<CompetencyMapping>(`/cpa-pert/competency-mapping/${experienceId}`);
  }

  async generateResponse(data: {
    experienceId: string;
    competencies: string[];
    template?: string;
  }): Promise<PertResponse> {
    return api.post<PertResponse>('/cpa-pert/generate-response', data);
  }

  async getComplianceCheck(): Promise<ComplianceCheck> {
    return api.get<ComplianceCheck>('/cpa-pert/compliance-check');
  }

  async validateRequirements(data: any): Promise<ValidationResult> {
    return api.post<ValidationResult>('/cpa-pert/validate-requirements', data);
  }

  async getCompetencyFramework(): Promise<CompetencyFramework> {
    return api.get<CompetencyFramework>('/cpa-pert/competency-framework');
  }

  async getProficiencyAssessment(experienceId: string): Promise<ProficiencyAssessment> {
    return api.get<ProficiencyAssessment>(`/cpa-pert/proficiency-assessment/${experienceId}`);
  }

  async getResponses(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ responses: PertResponse[]; total: number }> {
    return api.get('/cpa-pert/responses', { params });
  }

  async getCompetencyReport(): Promise<CompetencyReport> {
    return api.get<CompetencyReport>('/cpa-pert/competency-report');
  }

  async updateResponse(responseId: string, data: Partial<PertResponse>): Promise<PertResponse> {
    return api.put<PertResponse>(`/cpa-pert/response/${responseId}`, data);
  }

  async deleteResponse(responseId: string): Promise<void> {
    return api.delete(`/cpa-pert/response/${responseId}`);
  }
}

export const cpaPertService = new CpaPertService();