import { useState, useCallback } from 'react';
import { cpaPertService } from '@/services/cpaPertService';
import { 
  CompetencyMapping, 
  PertResponse, 
  ComplianceCheck,
  CompetencyReport
} from '@/types/cpaPert';
import { toast } from 'sonner';

export function useCPAPert() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeExperience = useCallback(async (experienceId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await cpaPertService.analyzeExperience({ experienceId });
      toast.success('Experience analyzed successfully');
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to analyze experience';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePERTResponse = useCallback(async (
    experienceId: string,
    competencies: string[],
    template?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const result = await cpaPertService.generateResponse({
        experienceId,
        competencies,
        template
      });
      toast.success('PERT response generated successfully');
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to generate PERT response';
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
      const result = await cpaPertService.batchAnalyzeExperiences(experienceIds);
      toast.success(`Analyzed ${result.successful.length} experiences`);
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} experiences failed to analyze`);
      }
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to batch analyze experiences';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePERTResponse = useCallback(async (
    responseId: string,
    updates: Partial<PertResponse>
  ) => {
    try {
      setLoading(true);
      setError(null);
      const result = await cpaPertService.updateResponse(responseId, updates);
      toast.success('PERT response updated successfully');
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to update PERT response';
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
      await cpaPertService.deleteResponse(responseId);
      toast.success('PERT response deleted successfully');
    } catch (err: any) {
      const message = err.message || 'Failed to delete PERT response';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    analyzeExperience,
    generatePERTResponse,
    batchAnalyzeExperiences,
    updatePERTResponse,
    deletePERTResponse
  };
}