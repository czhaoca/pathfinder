import api from '@/lib/api';
import { Experience, ExperienceFilters, ExperienceStats } from '@/types/experience';

class ExperienceService {
  async getExperiences(filters?: ExperienceFilters): Promise<{ experiences: Experience[], count: number }> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.current !== undefined) params.append('current', filters.current.toString());
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    return api.get(`/experiences?${params.toString()}`);
  }

  async getExperience(id: string): Promise<Experience> {
    return api.get(`/experiences/${id}`);
  }

  async createExperience(data: Partial<Experience>): Promise<{ message: string, experience: Experience }> {
    return api.post('/experiences', data);
  }

  async updateExperience(id: string, data: Partial<Experience>): Promise<{ message: string, experience: Experience }> {
    return api.put(`/experiences/${id}`, data);
  }

  async deleteExperience(id: string): Promise<{ message: string }> {
    return api.delete(`/experiences/${id}`);
  }

  async getStats(): Promise<ExperienceStats> {
    return api.get('/experiences/stats');
  }
}

export const experienceService = new ExperienceService();