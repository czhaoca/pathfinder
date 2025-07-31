import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCPAPert } from '@/hooks/useCPAPert';
import { cpaPertService } from '@/services/cpaPertService';
import { toast } from 'sonner';

// Mock the service
vi.mock('@/services/cpaPertService');
vi.mock('sonner');

describe('useCPAPert', () => {
  const mockCompetencyFramework = [
    {
      competency_id: '1',
      main_code: 'FR',
      main_name: 'Financial Reporting',
      sub_code: 'FR1',
      sub_name: 'Financial Reporting Needs',
      category: 'Technical',
      description: 'Test description'
    }
  ];

  const mockMappings = [
    {
      mapping_id: '1',
      experience_id: 'exp123',
      competency_id: '1',
      main_code: 'FR',
      main_name: 'Financial Reporting',
      sub_code: 'FR1',
      sub_name: 'Financial Reporting Needs',
      category: 'Technical',
      relevance_score: 0.95,
      evidence: JSON.stringify(['Test evidence']),
      suggested_proficiency: 2,
      created_at: new Date().toISOString()
    }
  ];

  const mockPertResponse = {
    response_id: 'resp123',
    user_id: 'user123',
    experience_id: 'exp123',
    competency_id: '1',
    main_code: 'FR',
    main_name: 'Financial Reporting',
    sub_code: 'FR1',
    sub_name: 'Financial Reporting Needs',
    proficiency_level: 2,
    situation_text: 'Test situation',
    task_text: 'Test task',
    action_text: 'Test action',
    result_text: 'Test result',
    response_text: 'Test full response',
    character_count: 100,
    quantified_impact: 'Test impact',
    is_current: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cpaPertService.getCompetencyFramework).mockResolvedValue(mockCompetencyFramework);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should load competency framework on mount', async () => {
      const { result } = renderHook(() => useCPAPert());

      await waitFor(() => {
        expect(cpaPertService.getCompetencyFramework).toHaveBeenCalled();
        expect(result.current.competencyFramework).toEqual(mockCompetencyFramework);
      });
    });

    it('should handle framework loading error', async () => {
      vi.mocked(cpaPertService.getCompetencyFramework).mockRejectedValue(new Error('Load error'));

      const { result } = renderHook(() => useCPAPert());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load competency framework');
        expect(toast.error).toHaveBeenCalledWith('Failed to load competency framework');
      });
    });
  });

  describe('analyzeExperience', () => {
    it('should analyze experience and return mappings', async () => {
      vi.mocked(cpaPertService.analyzeExperience).mockResolvedValue(mockMappings);

      const { result } = renderHook(() => useCPAPert());

      let mappings;
      await act(async () => {
        mappings = await result.current.analyzeExperience('exp123');
      });

      expect(cpaPertService.analyzeExperience).toHaveBeenCalledWith('exp123');
      expect(mappings).toEqual(mockMappings);
      expect(toast.success).toHaveBeenCalledWith('Experience analyzed successfully');
    });

    it('should handle analysis error', async () => {
      vi.mocked(cpaPertService.analyzeExperience).mockRejectedValue(new Error('Analysis error'));

      const { result } = renderHook(() => useCPAPert());

      await act(async () => {
        await expect(result.current.analyzeExperience('exp123')).rejects.toThrow('Analysis error');
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to analyze experience');
    });
  });

  describe('generatePERTResponse', () => {
    it('should generate PERT response', async () => {
      vi.mocked(cpaPertService.generateResponse).mockResolvedValue(mockPertResponse);

      const { result } = renderHook(() => useCPAPert());

      let response;
      await act(async () => {
        response = await result.current.generatePERTResponse('exp123', '1', 2);
      });

      expect(cpaPertService.generateResponse).toHaveBeenCalledWith('exp123', '1', 2);
      expect(response).toEqual(mockPertResponse);
      expect(toast.success).toHaveBeenCalledWith('PERT response generated');
    });

    it('should validate proficiency level', async () => {
      const { result } = renderHook(() => useCPAPert());

      await act(async () => {
        await expect(result.current.generatePERTResponse('exp123', '1', 5 as any))
          .rejects.toThrow('Invalid proficiency level');
      });

      expect(cpaPertService.generateResponse).not.toHaveBeenCalled();
    });
  });

  describe('updatePERTResponse', () => {
    it('should update PERT response', async () => {
      vi.mocked(cpaPertService.updateResponse).mockResolvedValue(mockPertResponse);

      const { result } = renderHook(() => useCPAPert());

      const updates = {
        responseText: 'Updated text',
        situationText: 'Updated situation'
      };

      let response;
      await act(async () => {
        response = await result.current.updatePERTResponse('resp123', updates);
      });

      expect(cpaPertService.updateResponse).toHaveBeenCalledWith('resp123', updates);
      expect(response).toEqual(mockPertResponse);
      expect(toast.success).toHaveBeenCalledWith('Response updated successfully');
    });
  });

  describe('checkCompliance', () => {
    it('should check EVR compliance', async () => {
      const mockCompliance = {
        isCompliant: true,
        complianceCheck: {
          compliance_check_id: 'check123',
          user_id: 'user123',
          is_compliant: true,
          total_competencies: 8,
          level2_count: 2,
          level1_or_higher_count: 8,
          issues: null,
          recommendations: JSON.stringify(['Continue current progress']),
          created_at: new Date().toISOString()
        },
        summary: {
          totalCompetencies: 8,
          level2Count: 2,
          level1OrHigherCount: 8,
          missingCompetencies: []
        }
      };

      vi.mocked(cpaPertService.getComplianceCheck).mockResolvedValue(mockCompliance);

      const { result } = renderHook(() => useCPAPert());

      let compliance;
      await act(async () => {
        compliance = await result.current.checkCompliance();
      });

      expect(compliance).toEqual(mockCompliance);
    });
  });

  describe('getPERTResponses', () => {
    it('should retrieve PERT responses', async () => {
      vi.mocked(cpaPertService.getResponses).mockResolvedValue([mockPertResponse]);

      const { result } = renderHook(() => useCPAPert());

      let responses;
      await act(async () => {
        responses = await result.current.getPERTResponses(10, 'exp123');
      });

      expect(cpaPertService.getResponses).toHaveBeenCalledWith(10, 0, 'exp123');
      expect(responses).toEqual([mockPertResponse]);
    });
  });

  describe('batchGeneratePERTResponses', () => {
    it('should batch generate multiple PERT responses', async () => {
      vi.mocked(cpaPertService.batchGenerateResponses).mockResolvedValue([mockPertResponse]);

      const { result } = renderHook(() => useCPAPert());

      let responses;
      await act(async () => {
        responses = await result.current.batchGeneratePERTResponses('exp123', ['1', '2']);
      });

      expect(cpaPertService.batchGenerateResponses).toHaveBeenCalledWith('exp123', ['1', '2']);
      expect(responses).toEqual([mockPertResponse]);
      expect(toast.success).toHaveBeenCalledWith('Generated 1 PERT responses');
    });
  });

  describe('getCompetencyReport', () => {
    it('should generate competency report', async () => {
      const mockReport = {
        summary: {
          totalCompetencies: 8,
          level2Achieved: 2,
          level1Achieved: 6,
          level0Only: 0,
          totalPERTResponses: 10
        },
        competencyDetails: [],
        developmentPlan: {
          immediate: [],
          shortTerm: [],
          longTerm: []
        },
        compliance: {
          isCompliant: true,
          complianceCheck: {} as any,
          summary: {} as any
        }
      };

      vi.mocked(cpaPertService.getCompetencyReport).mockResolvedValue(mockReport);

      const { result } = renderHook(() => useCPAPert());

      let report;
      await act(async () => {
        report = await result.current.getCompetencyReport();
      });

      expect(report).toEqual(mockReport);
    });
  });

  describe('loading states', () => {
    it('should manage loading state during operations', async () => {
      vi.mocked(cpaPertService.analyzeExperience).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockMappings), 100))
      );

      const { result } = renderHook(() => useCPAPert());

      expect(result.current.loading).toBe(false);

      const promise = act(async () => {
        await result.current.analyzeExperience('exp123');
      });

      expect(result.current.loading).toBe(true);

      await promise;

      expect(result.current.loading).toBe(false);
    });
  });
});