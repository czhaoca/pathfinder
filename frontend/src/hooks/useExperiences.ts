import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { experienceService } from '@/services/experienceService';
import { Experience, ExperienceFilters } from '@/types/experience';

export function useExperiences(filters?: ExperienceFilters) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await experienceService.getExperiences(filters);
      setExperiences(response.experiences);
      setCount(response.count);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch experiences');
      toast.error('Failed to load experiences');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createExperience = useCallback(async (data: Partial<Experience>) => {
    try {
      const response = await experienceService.createExperience(data);
      toast.success('Experience added successfully');
      await fetchExperiences();
      return response.experience;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to create experience';
      toast.error(message);
      throw err;
    }
  }, [fetchExperiences]);

  const updateExperience = useCallback(async (id: string, data: Partial<Experience>) => {
    try {
      const response = await experienceService.updateExperience(id, data);
      toast.success('Experience updated successfully');
      await fetchExperiences();
      return response.experience;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update experience';
      toast.error(message);
      throw err;
    }
  }, [fetchExperiences]);

  const deleteExperience = useCallback(async (id: string) => {
    try {
      await experienceService.deleteExperience(id);
      toast.success('Experience deleted successfully');
      await fetchExperiences();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to delete experience';
      toast.error(message);
      throw err;
    }
  }, [fetchExperiences]);

  useEffect(() => {
    fetchExperiences();
  }, [fetchExperiences]);

  return {
    experiences,
    count,
    loading,
    error,
    refetch: fetchExperiences,
    createExperience,
    updateExperience,
    deleteExperience
  };
}

export function useExperience(id: string) {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExperience = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await experienceService.getExperience(id);
        setExperience(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch experience');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchExperience();
    }
  }, [id]);

  return { experience, loading, error };
}