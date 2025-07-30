import { useState, useCallback, useEffect } from 'react';
import { cpaPertService } from '@/services/cpaPertService';
import { 
  CompetencyMapping, 
  PertResponse, 
  ComplianceResult,
  CompetencyReport,
  CompetencyFramework,
  GeneratePERTRequest,
  ProficiencyAssessment
} from '@/types/cpaPert';
import { toast } from 'sonner';

export function useCPAPert() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competencyFramework, setCompetencyFramework] = useState<CompetencyFramework | null>(null);

  const analyzeExperience = useCallback(async (experienceId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.analyzeExperience(experienceId);
      if (response.success) {
        toast.success(`Found ${response.data.totalMapped} competency mappings`);
        return response.data;
      } else {
        throw new Error('Failed to analyze experience');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to analyze experience';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePERTResponse = useCallback(async (
    experienceId: string,
    competencyCode: string,
    proficiencyLevel: 0 | 1 | 2
  ) => {
    try {
      setLoading(true);
      setError(null);
      const request: GeneratePERTRequest = {
        experienceId,
        competencyCode,
        proficiencyLevel
      };
      const response = await cpaPertService.generateResponse(request);
      if (response.success) {
        toast.success(`PERT response generated (${response.data.character_count} characters)`);
        return response.data;
      } else {
        throw new Error('Failed to generate PERT response');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to generate PERT response';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const batchAnalyzeExperiences = useCallback(async (experienceIds: string[]) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.batchAnalyzeExperiences(experienceIds);
      if (response.success) {
        const { successful, failed } = response.data;
        toast.success(`Analyzed ${successful.length} experiences`);
        if (failed.length > 0) {
          toast.warning(`${failed.length} experiences failed to analyze`);
        }
        return response.data;
      } else {
        throw new Error('Batch analysis failed');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to batch analyze experiences';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePERTResponse = useCallback(async (
    responseId: string,
    updates: {
      responseText: string;
      situationText?: string;
      taskText?: string;
      actionText?: string;
      resultText?: string;
      quantifiedImpact?: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.updateResponse(responseId, updates);
      if (response.success) {
        toast.success('PERT response updated successfully');
        return response.data;
      } else {
        throw new Error('Failed to update PERT response');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to update PERT response';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePERTResponse = useCallback(async (responseId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.deleteResponse(responseId);
      if (response.success) {
        toast.success(response.message || 'PERT response deleted successfully');
      } else {
        throw new Error('Failed to delete PERT response');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to delete PERT response';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCompetencyMapping = useCallback(async (experienceId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.getCompetencyMapping(experienceId);
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to get competency mapping');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to get competency mapping';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkCompliance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.getComplianceCheck();
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to check compliance');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to check compliance';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const validateRequirements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.validateRequirements();
      if (response.success) {
        const { isCompliant, recommendations } = response.data;
        if (isCompliant) {
          toast.success('EVR requirements are met!');
        } else {
          toast.warning('EVR requirements not yet met');
        }
        return response.data;
      } else {
        throw new Error('Failed to validate requirements');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to validate requirements';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProficiencyAssessment = useCallback(async (experienceId: string, competencyCode: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.getProficiencyAssessment(experienceId, competencyCode);
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to get proficiency assessment');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to get proficiency assessment';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCompetencyReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.getCompetencyReport();
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to get competency report');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to get competency report';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPERTResponses = useCallback(async (limit?: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await cpaPertService.getResponses(limit);
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to get PERT responses');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to get PERT responses';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load competency framework on mount
  useEffect(() => {
    const loadFramework = async () => {
      try {
        const response = await cpaPertService.getCompetencyFramework();
        if (response.success) {
          setCompetencyFramework(response.data);
        }
      } catch (err) {
        console.error('Failed to load competency framework:', err);
      }
    };
    loadFramework();
  }, []);

  return {
    loading,
    error,
    competencyFramework,
    analyzeExperience,
    generatePERTResponse,
    batchAnalyzeExperiences,
    updatePERTResponse,
    deletePERTResponse,
    getCompetencyMapping,
    checkCompliance,
    validateRequirements,
    getProficiencyAssessment,
    getCompetencyReport,
    getPERTResponses
  };
}