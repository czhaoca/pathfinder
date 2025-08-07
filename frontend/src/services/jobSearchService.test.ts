import { describe, it, expect, beforeEach, vi } from 'vitest';
import jobSearchService from './jobSearchService';
import { API_BASE_URL } from '@/config';

// Mock fetch globally
global.fetch = vi.fn();

// Mock auth headers
vi.mock('./authService', () => ({
  default: {
    getAuthHeaders: () => ({
      'Authorization': 'Bearer mock-token',
      'Content-Type': 'application/json',
    }),
  },
}));

describe('JobSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchJobs', () => {
    it('should search jobs with filters', async () => {
      const searchParams = {
        keywords: 'React Developer',
        location: 'San Francisco',
        jobType: ['full-time', 'remote'],
        experienceLevel: 'mid-level',
        salaryMin: 100000,
        salaryMax: 150000,
      };

      const mockResponse = {
        success: true,
        data: {
          jobs: [
            {
              id: 'job-1',
              title: 'Senior React Developer',
              company: 'Tech Corp',
              location: 'San Francisco, CA',
              salary: { min: 120000, max: 150000 },
              postedDate: '2025-08-01',
            },
          ],
          totalResults: 25,
          page: 1,
          totalPages: 3,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await jobSearchService.searchJobs(searchParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/search`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
          body: JSON.stringify(searchParams),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Senior React Developer');
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        success: true,
        data: {
          jobs: [],
          totalResults: 0,
          page: 1,
          totalPages: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await jobSearchService.searchJobs({ keywords: 'xyz123' });

      expect(result.jobs).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it('should handle search errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Search service unavailable' }),
      });

      await expect(
        jobSearchService.searchJobs({ keywords: 'developer' })
      ).rejects.toThrow('Search service unavailable');
    });
  });

  describe('getJobDetails', () => {
    it('should fetch job details', async () => {
      const jobId = 'job-123';
      const mockJob = {
        id: jobId,
        title: 'Full Stack Developer',
        company: 'StartupXYZ',
        location: 'Remote',
        salary: { min: 100000, max: 140000 },
        description: 'Build amazing products',
        requirements: ['React', 'Node.js', '3+ years experience'],
        benefits: ['Health insurance', 'Stock options'],
        postedDate: '2025-08-01',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockJob }),
      });

      const result = await jobSearchService.getJobDetails(jobId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/${jobId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result).toEqual(mockJob);
      expect(result.title).toBe('Full Stack Developer');
    });

    it('should handle job not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Job not found' }),
      });

      await expect(
        jobSearchService.getJobDetails('non-existent')
      ).rejects.toThrow('Job not found');
    });
  });

  describe('saveJob', () => {
    it('should save a job', async () => {
      const job = {
        jobId: 'job-456',
        title: 'Frontend Developer',
        company: 'Tech Inc',
        location: 'New York',
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'saved-1',
          ...job,
          savedDate: '2025-08-07',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await jobSearchService.saveJob(job);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/save`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
          body: JSON.stringify(job),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.savedDate).toBeDefined();
    });

    it('should handle duplicate save attempts', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Job already saved' }),
      });

      await expect(
        jobSearchService.saveJob({ jobId: 'job-123' })
      ).rejects.toThrow('Job already saved');
    });
  });

  describe('getSavedJobs', () => {
    it('should fetch saved jobs', async () => {
      const mockSavedJobs = [
        {
          id: 'saved-1',
          jobId: 'job-1',
          title: 'React Developer',
          company: 'Company A',
          savedDate: '2025-08-01',
        },
        {
          id: 'saved-2',
          jobId: 'job-2',
          title: 'Node Developer',
          company: 'Company B',
          savedDate: '2025-08-02',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSavedJobs }),
      });

      const result = await jobSearchService.getSavedJobs();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/saved`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result).toEqual(mockSavedJobs);
      expect(result).toHaveLength(2);
    });
  });

  describe('removeSavedJob', () => {
    it('should remove a saved job', async () => {
      const savedJobId = 'saved-123';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Job removed' }),
      });

      await jobSearchService.removeSavedJob(savedJobId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/saved/${savedJobId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });
  });

  describe('trackApplication', () => {
    it('should track job application', async () => {
      const application = {
        jobId: 'job-789',
        title: 'Backend Developer',
        company: 'Tech Solutions',
        appliedDate: '2025-08-07',
        status: 'applied',
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'app-1',
          ...application,
          timeline: [
            { status: 'applied', date: '2025-08-07' },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await jobSearchService.trackApplication(application);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/applications`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(application),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.timeline).toHaveLength(1);
    });
  });

  describe('getApplications', () => {
    it('should fetch all applications', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          jobId: 'job-1',
          status: 'applied',
          appliedDate: '2025-08-01',
        },
        {
          id: 'app-2',
          jobId: 'job-2',
          status: 'interview_scheduled',
          appliedDate: '2025-08-02',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockApplications }),
      });

      const result = await jobSearchService.getApplications();

      expect(result).toEqual(mockApplications);
      expect(result).toHaveLength(2);
    });

    it('should filter applications by status', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          jobId: 'job-1',
          status: 'interview_scheduled',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockApplications }),
      });

      const result = await jobSearchService.getApplications({
        status: 'interview_scheduled',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/applications?status=interview_scheduled`,
        expect.any(Object)
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('interview_scheduled');
    });
  });

  describe('updateApplicationStatus', () => {
    it('should update application status', async () => {
      const applicationId = 'app-123';
      const update = {
        status: 'interview_completed',
        interviewDate: '2025-08-10',
        notes: 'First round went well',
      };

      const mockResponse = {
        success: true,
        data: {
          id: applicationId,
          ...update,
          timeline: [
            { status: 'applied', date: '2025-08-01' },
            { status: 'interview_scheduled', date: '2025-08-05' },
            { status: 'interview_completed', date: '2025-08-10' },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await jobSearchService.updateApplicationStatus(
        applicationId,
        update
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/applications/${applicationId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(update),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.timeline).toHaveLength(3);
    });
  });

  describe('getMatchScore', () => {
    it('should calculate job match score', async () => {
      const jobId = 'job-999';
      const mockScore = {
        matchScore: 85,
        matchedSkills: ['React', 'Node.js', 'TypeScript'],
        missingSkills: ['Docker', 'Kubernetes'],
        recommendations: [
          'Consider learning Docker for containerization',
          'Kubernetes knowledge would be beneficial',
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockScore }),
      });

      const result = await jobSearchService.getMatchScore(jobId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/match-score`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ jobId }),
        })
      );

      expect(result).toEqual(mockScore);
      expect(result.matchScore).toBe(85);
    });
  });

  describe('getInterviewPrep', () => {
    it('should fetch interview preparation materials', async () => {
      const jobId = 'job-888';
      const mockPrep = {
        companyInfo: {
          name: 'Tech Corp',
          size: '1000-5000',
          culture: 'Innovation-focused',
        },
        commonQuestions: [
          'Tell me about yourself',
          'Why do you want to work here?',
        ],
        behavioralQuestions: [
          'Describe a challenging project',
          'How do you handle conflicts?',
        ],
        technicalTopics: ['System Design', 'Algorithms', 'React Best Practices'],
        tips: [
          'Research the company thoroughly',
          'Prepare STAR method examples',
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPrep }),
      });

      const result = await jobSearchService.getInterviewPrep(jobId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/interview-prep/${jobId}`,
        expect.any(Object)
      );

      expect(result).toEqual(mockPrep);
      expect(result.commonQuestions).toHaveLength(2);
      expect(result.technicalTopics).toContain('System Design');
    });
  });

  describe('getStatistics', () => {
    it('should fetch application statistics', async () => {
      const mockStats = {
        totalApplications: 25,
        statusBreakdown: {
          applied: 10,
          interview_scheduled: 5,
          interview_completed: 3,
          offer_received: 2,
          rejected: 5,
        },
        responseRate: 60,
        averageTimeToResponse: 7,
        interviewConversionRate: 50,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStats }),
      });

      const result = await jobSearchService.getStatistics();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/statistics`,
        expect.any(Object)
      );

      expect(result).toEqual(mockStats);
      expect(result.totalApplications).toBe(25);
      expect(result.responseRate).toBe(60);
    });

    it('should fetch statistics for date range', async () => {
      const dateRange = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await jobSearchService.getStatistics(dateRange);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/jobs/statistics?startDate=2025-01-01&endDate=2025-12-31`,
        expect.any(Object)
      );
    });
  });
});