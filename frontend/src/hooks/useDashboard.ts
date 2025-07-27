import { useState, useEffect } from 'react';
import { experienceService } from '@/services/experienceService';
import { chatService } from '@/services/chatService';
import { profileService } from '@/services/profileService';

export interface DashboardStats {
  totalExperiences: number;
  skillsTracked: number;
  chatSessions: number;
  profileViews: number;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalExperiences: 0,
    skillsTracked: 0,
    chatSessions: 0,
    profileViews: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data in parallel
      const [experiences, chatHistory, profile] = await Promise.all([
        experienceService.getExperiences(),
        chatService.getHistory(),
        profileService.getProfile()
      ]);

      // Extract unique skills from all experiences
      const allSkills = new Set<string>();
      experiences.forEach((exp: any) => {
        if (exp.skills && Array.isArray(exp.skills)) {
          exp.skills.forEach((skill: string) => allSkills.add(skill));
        }
      });

      setStats({
        totalExperiences: experiences.length,
        skillsTracked: allSkills.size,
        chatSessions: chatHistory.length,
        profileViews: profile.profileViews || 0
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    error,
    refetch: fetchDashboardData
  };
}