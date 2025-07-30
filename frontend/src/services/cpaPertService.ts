import api from '@/lib/api';
import { 
  CompetencyMapping, 
  PertResponse, 
  CompetencyFramework,
  ProficiencyAssessment,
  ComplianceCheck,
  ComplianceResult,
  ValidationResult,
  CompetencyReport,
  AnalyzeExperienceRequest,
  AnalyzeExperienceResponse,
  GeneratePERTRequest,
  BatchAnalyzeRequest,
  BatchAnalyzeResponse,
  BatchGenerateRequest,
  BatchGenerateResponse
} from '@/types/cpaPert';

class CpaPertService {
  async analyzeExperience(experienceId: string): Promise<AnalyzeExperienceResponse> {
    const request: AnalyzeExperienceRequest = { experienceId };
    return api.post<AnalyzeExperienceResponse>('/cpa-pert/analyze-experience', request);
  }

  async getCompetencyMapping(experienceId: string): Promise<{ success: boolean; data: CompetencyMapping[] }> {
    return api.get<{ success: boolean; data: CompetencyMapping[] }>(`/cpa-pert/competency-mapping/${experienceId}`);
  }

  async generateResponse(data: GeneratePERTRequest): Promise<{ success: boolean; data: PertResponse }> {
    return api.post<{ success: boolean; data: PertResponse }>('/cpa-pert/generate-response', data);
  }

  async getComplianceCheck(): Promise<{ success: boolean; data: ComplianceResult }> {
    return api.get<{ success: boolean; data: ComplianceResult }>('/cpa-pert/compliance-check');
  }

  async validateRequirements(): Promise<{ success: boolean; data: ValidationResult }> {
    return api.post<{ success: boolean; data: ValidationResult }>('/cpa-pert/validate-requirements', {});
  }

  async getCompetencyFramework(): Promise<{ success: boolean; data: CompetencyFramework }> {
    return api.get<{ success: boolean; data: CompetencyFramework }>('/cpa-pert/competency-framework');
  }

  async getProficiencyAssessment(experienceId: string, competencyCode: string): Promise<{ success: boolean; data: ProficiencyAssessment }> {
    return api.get<{ success: boolean; data: ProficiencyAssessment }>(
      `/cpa-pert/proficiency-assessment/${experienceId}?competencyCode=${competencyCode}`
    );
  }

  async getResponses(limit?: number): Promise<{ success: boolean; data: PertResponse[]; total: number }> {
    const params = limit ? { limit } : undefined;
    return api.get<{ success: boolean; data: PertResponse[]; total: number }>('/cpa-pert/responses', { params });
  }

  async getCompetencyReport(): Promise<{ success: boolean; data: CompetencyReport }> {
    return api.get<{ success: boolean; data: CompetencyReport }>('/cpa-pert/competency-report');
  }

  async updateResponse(responseId: string, data: {
    responseText: string;
    situationText?: string;
    taskText?: string;
    actionText?: string;
    resultText?: string;
    quantifiedImpact?: string;
  }): Promise<{ success: boolean; data: PertResponse }> {
    return api.put<{ success: boolean; data: PertResponse }>(`/cpa-pert/response/${responseId}`, data);
  }

  async deleteResponse(responseId: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(`/cpa-pert/response/${responseId}`);
  }

  async batchAnalyzeExperiences(experienceIds: string[]): Promise<BatchAnalyzeResponse> {
    const request: BatchAnalyzeRequest = { experienceIds };
    return api.post<BatchAnalyzeResponse>('/cpa-pert/batch/analyze', request);
  }

  async batchGeneratePERTResponses(requests: Array<{
    experienceId: string;
    competencyCode: string;
    proficiencyLevel: 0 | 1 | 2;
  }>): Promise<BatchGenerateResponse> {
    const request: BatchGenerateRequest = { requests };
    return api.post<BatchGenerateResponse>('/cpa-pert/batch/generate', request);
  }
}

export const cpaPertService = new CpaPertService();