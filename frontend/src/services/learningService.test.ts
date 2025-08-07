import { describe, it, expect, beforeEach, vi } from 'vitest';
import learningService from './learningService';
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

describe('LearningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCourses', () => {
    it('should fetch available courses', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'React Fundamentals',
          provider: 'Tech Academy',
          duration: '4 weeks',
          difficulty: 'beginner',
          skills: ['React', 'JavaScript'],
        },
        {
          id: 'course-2',
          title: 'Advanced Node.js',
          provider: 'Code School',
          duration: '6 weeks',
          difficulty: 'advanced',
          skills: ['Node.js', 'Express'],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCourses }),
      });

      const result = await learningService.getCourses();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/courses`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result).toEqual(mockCourses);
      expect(result).toHaveLength(2);
    });

    it('should filter courses by skill', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'React Advanced Patterns',
          skills: ['React'],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCourses }),
      });

      const result = await learningService.getCourses({ skill: 'React' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/courses?skill=React`,
        expect.any(Object)
      );

      expect(result).toHaveLength(1);
      expect(result[0].skills).toContain('React');
    });

    it('should filter courses by difficulty', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          title: 'JavaScript Basics',
          difficulty: 'beginner',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCourses }),
      });

      const result = await learningService.getCourses({ difficulty: 'beginner' });

      expect(result[0].difficulty).toBe('beginner');
    });
  });

  describe('enrollInCourse', () => {
    it('should enroll in a course', async () => {
      const enrollment = {
        courseId: 'course-123',
        startDate: '2025-08-10',
        targetCompletionDate: '2025-09-10',
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'enrollment-1',
          ...enrollment,
          enrollmentDate: '2025-08-07',
          progress: 0,
          status: 'enrolled',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.enrollInCourse(enrollment);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/courses/enroll`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(enrollment),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.status).toBe('enrolled');
      expect(result.progress).toBe(0);
    });

    it('should handle duplicate enrollment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Already enrolled in this course' }),
      });

      await expect(
        learningService.enrollInCourse({ courseId: 'course-123' })
      ).rejects.toThrow('Already enrolled in this course');
    });
  });

  describe('getEnrolledCourses', () => {
    it('should fetch enrolled courses', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          courseId: 'course-1',
          progress: 50,
          status: 'in_progress',
        },
        {
          id: 'enrollment-2',
          courseId: 'course-2',
          progress: 100,
          status: 'completed',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEnrollments }),
      });

      const result = await learningService.getEnrolledCourses();

      expect(result).toEqual(mockEnrollments);
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          status: 'completed',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEnrollments }),
      });

      const result = await learningService.getEnrolledCourses({ 
        status: 'completed' 
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/courses/enrolled?status=completed`,
        expect.any(Object)
      );

      expect(result[0].status).toBe('completed');
    });
  });

  describe('updateCourseProgress', () => {
    it('should update course progress', async () => {
      const courseId = 'course-123';
      const progressUpdate = {
        progress: 75,
        completedModules: ['intro', 'basics', 'intermediate'],
        currentModule: 'advanced',
      };

      const mockResponse = {
        success: true,
        data: {
          id: courseId,
          ...progressUpdate,
          status: 'in_progress',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.updateCourseProgress(
        courseId,
        progressUpdate
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/courses/${courseId}/progress`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(progressUpdate),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.progress).toBe(75);
    });

    it('should complete a course', async () => {
      const courseId = 'course-456';
      const completion = {
        progress: 100,
        status: 'completed',
        completionDate: '2025-08-07',
      };

      const mockResponse = {
        success: true,
        data: {
          id: courseId,
          ...completion,
          certificate: true,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.updateCourseProgress(
        courseId,
        completion
      );

      expect(result.status).toBe('completed');
      expect(result.certificate).toBe(true);
    });
  });

  describe('getCertifications', () => {
    it('should fetch available certifications', async () => {
      const mockCertifications = [
        {
          id: 'cert-1',
          name: 'AWS Solutions Architect',
          provider: 'AWS',
          level: 'professional',
          validityPeriod: '3 years',
        },
        {
          id: 'cert-2',
          name: 'Google Cloud Engineer',
          provider: 'Google',
          level: 'associate',
          validityPeriod: '2 years',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCertifications }),
      });

      const result = await learningService.getCertifications();

      expect(result).toEqual(mockCertifications);
      expect(result).toHaveLength(2);
    });

    it('should filter certifications by provider', async () => {
      const mockCertifications = [
        {
          id: 'cert-1',
          name: 'AWS Developer',
          provider: 'AWS',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCertifications }),
      });

      const result = await learningService.getCertifications({ provider: 'AWS' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/certifications?provider=AWS`,
        expect.any(Object)
      );

      expect(result[0].provider).toBe('AWS');
    });
  });

  describe('trackCertification', () => {
    it('should track certification pursuit', async () => {
      const certification = {
        certificationId: 'cert-aws',
        targetDate: '2025-12-31',
        studyPlan: {
          hoursPerWeek: 10,
          resources: ['Official guide', 'Practice tests'],
        },
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'tracking-1',
          ...certification,
          status: 'preparing',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.trackCertification(certification);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/certifications/track`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(certification),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.status).toBe('preparing');
    });
  });

  describe('createLearningPath', () => {
    it('should create a learning path', async () => {
      const learningPath = {
        title: 'Full Stack Developer Path',
        description: 'Complete path to full stack development',
        targetRole: 'Full Stack Developer',
        duration: '6 months',
        modules: [
          {
            name: 'Frontend',
            courses: ['react-basics', 'css-advanced'],
          },
          {
            name: 'Backend',
            courses: ['node-basics', 'database-design'],
          },
        ],
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'path-1',
          ...learningPath,
          progress: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.createLearningPath(learningPath);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/paths`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(learningPath),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.progress).toBe(0);
    });
  });

  describe('getLearningPaths', () => {
    it('should fetch user learning paths', async () => {
      const mockPaths = [
        {
          id: 'path-1',
          title: 'Frontend Developer Path',
          progress: 33,
        },
        {
          id: 'path-2',
          title: 'DevOps Engineer Path',
          progress: 0,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPaths }),
      });

      const result = await learningService.getLearningPaths();

      expect(result).toEqual(mockPaths);
      expect(result).toHaveLength(2);
    });
  });

  describe('setLearningGoals', () => {
    it('should create learning goals', async () => {
      const goals = {
        year: 2025,
        goals: [
          {
            skill: 'React',
            targetLevel: 'expert',
            currentLevel: 'intermediate',
            deadline: '2025-06-30',
          },
          {
            skill: 'Docker',
            targetLevel: 'intermediate',
            currentLevel: 'beginner',
            deadline: '2025-12-31',
          },
        ],
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'goals-1',
          ...goals,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.setLearningGoals(goals);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/goals`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(goals),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.goals).toHaveLength(2);
    });
  });

  describe('getLearningGoals', () => {
    it('should fetch learning goals', async () => {
      const mockGoals = [
        {
          id: 'goals-1',
          year: 2025,
          goals: [
            { skill: 'React', targetLevel: 'expert' },
          ],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockGoals }),
      });

      const result = await learningService.getLearningGoals();

      expect(result).toEqual(mockGoals);
    });

    it('should fetch goals for specific year', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      await learningService.getLearningGoals({ year: 2025 });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/goals?year=2025`,
        expect.any(Object)
      );
    });
  });

  describe('getRecommendations', () => {
    it('should fetch learning recommendations', async () => {
      const mockRecommendations = {
        courses: [
          { id: 'course-1', title: 'Recommended Course 1' },
        ],
        certifications: [
          { id: 'cert-1', name: 'Recommended Cert 1' },
        ],
        skills: ['Docker', 'Kubernetes'],
        learningPaths: [
          { id: 'path-1', title: 'Recommended Path 1' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRecommendations }),
      });

      const result = await learningService.getRecommendations();

      expect(result).toEqual(mockRecommendations);
      expect(result.skills).toContain('Docker');
    });

    it('should get recommendations for target role', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await learningService.getRecommendations({ 
        targetRole: 'Senior Developer' 
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/recommendations?targetRole=Senior%20Developer`,
        expect.any(Object)
      );
    });
  });

  describe('getAnalytics', () => {
    it('should fetch learning analytics', async () => {
      const mockAnalytics = {
        totalCoursesCompleted: 5,
        totalHoursLearned: 120,
        skillsAcquired: ['React', 'Node.js', 'Docker'],
        certificationsEarned: 2,
        learningStreak: 15,
        monthlyProgress: [
          { month: 'Jan', hours: 20 },
          { month: 'Feb', hours: 25 },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAnalytics }),
      });

      const result = await learningService.getAnalytics();

      expect(result).toEqual(mockAnalytics);
      expect(result.totalCoursesCompleted).toBe(5);
      expect(result.learningStreak).toBe(15);
    });

    it('should fetch analytics for date range', async () => {
      const dateRange = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await learningService.getAnalytics(dateRange);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/analytics?startDate=2025-01-01&endDate=2025-12-31`,
        expect.any(Object)
      );
    });
  });

  describe('assessSkill', () => {
    it('should assess skill level', async () => {
      const assessment = {
        skill: 'JavaScript',
        assessmentType: 'quiz',
        score: 85,
        totalQuestions: 100,
      };

      const mockResponse = {
        success: true,
        data: {
          skill: 'JavaScript',
          level: 'advanced',
          percentile: 75,
          recommendations: ['Consider TypeScript', 'Learn advanced patterns'],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await learningService.assessSkill(assessment);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/learning/skills/assess`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(assessment),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.level).toBe('advanced');
      expect(result.percentile).toBe(75);
    });
  });
});