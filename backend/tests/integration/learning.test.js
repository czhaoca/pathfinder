/**
 * Learning & Development Integration Tests
 */

const request = require('supertest');
const app = require('../../src/api/app');

describe('Learning & Development Endpoints', () => {
  let authToken;
  let userId;
  let courseId;
  let certificationId;
  let learningPathId;
  let goalId;

  beforeAll(async () => {
    // Register and login to get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'learner',
        email: 'learner@test.com',
        password: 'Test123!@#',
        firstName: 'Active',
        lastName: 'Learner'
      });

    if (registerResponse.status === 201) {
      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    } else {
      // Login if already registered
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'learner',
          password: 'Test123!@#'
        });
      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    }
  });

  describe('GET /api/learning/courses', () => {
    it('should get available courses', async () => {
      const response = await request(app)
        .get('/api/learning/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('title');
      expect(response.body.data[0]).toHaveProperty('provider');
      expect(response.body.data[0]).toHaveProperty('duration');
      expect(response.body.data[0]).toHaveProperty('difficulty');
      expect(response.body.data[0]).toHaveProperty('skills');
    });

    it('should filter courses by skill', async () => {
      const response = await request(app)
        .get('/api/learning/courses')
        .query({ skill: 'JavaScript' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(course => {
        expect(course.skills).toContain('JavaScript');
      });
    });

    it('should filter courses by difficulty', async () => {
      const response = await request(app)
        .get('/api/learning/courses')
        .query({ difficulty: 'beginner' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(course => {
        expect(course.difficulty).toBe('beginner');
      });
    });

    it('should search courses by keyword', async () => {
      const response = await request(app)
        .get('/api/learning/courses')
        .query({ search: 'react' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(course => {
        expect(
          course.title.toLowerCase().includes('react') ||
          course.description.toLowerCase().includes('react')
        ).toBe(true);
      });
    });
  });

  describe('POST /api/learning/courses/enroll', () => {
    it('should enroll in a course', async () => {
      const response = await request(app)
        .post('/api/learning/courses/enroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId: 'react-fundamentals',
          startDate: new Date().toISOString(),
          targetCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('courseId');
      expect(response.body.data).toHaveProperty('enrollmentDate');
      expect(response.body.data).toHaveProperty('progress', 0);
      expect(response.body.data).toHaveProperty('status', 'enrolled');
      
      courseId = response.body.data.id;
    });

    it('should not allow duplicate enrollment', async () => {
      const response = await request(app)
        .post('/api/learning/courses/enroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId: 'react-fundamentals'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already enrolled');
    });
  });

  describe('GET /api/learning/courses/enrolled', () => {
    it('should get enrolled courses', async () => {
      const response = await request(app)
        .get('/api/learning/courses/enrolled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('courseId');
      expect(response.body.data[0]).toHaveProperty('progress');
      expect(response.body.data[0]).toHaveProperty('status');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/learning/courses/enrolled')
        .query({ status: 'enrolled' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(enrollment => {
        expect(enrollment.status).toBe('enrolled');
      });
    });
  });

  describe('PATCH /api/learning/courses/:id/progress', () => {
    it('should update course progress', async () => {
      const response = await request(app)
        .patch(`/api/learning/courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          progress: 25,
          completedModules: ['introduction', 'basics'],
          currentModule: 'components'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('progress', 25);
      expect(response.body.data).toHaveProperty('completedModules');
    });

    it('should complete a course', async () => {
      const response = await request(app)
        .patch(`/api/learning/courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          progress: 100,
          status: 'completed',
          completionDate: new Date().toISOString(),
          certificate: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data).toHaveProperty('completionDate');
      expect(response.body.data).toHaveProperty('certificate', true);
    });
  });

  describe('GET /api/learning/certifications', () => {
    it('should get available certifications', async () => {
      const response = await request(app)
        .get('/api/learning/certifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('provider');
      expect(response.body.data[0]).toHaveProperty('level');
      expect(response.body.data[0]).toHaveProperty('requirements');
      expect(response.body.data[0]).toHaveProperty('validityPeriod');
    });

    it('should filter certifications by provider', async () => {
      const response = await request(app)
        .get('/api/learning/certifications')
        .query({ provider: 'AWS' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(cert => {
        expect(cert.provider).toBe('AWS');
      });
    });
  });

  describe('POST /api/learning/certifications/track', () => {
    it('should track certification pursuit', async () => {
      const response = await request(app)
        .post('/api/learning/certifications/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certificationId: 'aws-solutions-architect',
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          studyPlan: {
            hoursPerWeek: 10,
            resources: ['Official guide', 'Practice tests'],
            milestones: [
              { name: 'Complete study guide', date: '2025-09-01' },
              { name: 'Practice exam 1', date: '2025-09-15' }
            ]
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('certificationId');
      expect(response.body.data).toHaveProperty('status', 'preparing');
      expect(response.body.data).toHaveProperty('studyPlan');
      
      certificationId = response.body.data.id;
    });
  });

  describe('PATCH /api/learning/certifications/:id', () => {
    it('should update certification status', async () => {
      const response = await request(app)
        .patch(`/api/learning/certifications/${certificationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'scheduled',
          examDate: '2025-10-15',
          examLocation: 'Online'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'scheduled');
      expect(response.body.data).toHaveProperty('examDate');
    });

    it('should record certification achievement', async () => {
      const response = await request(app)
        .patch(`/api/learning/certifications/${certificationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'achieved',
          achievementDate: new Date().toISOString(),
          score: 850,
          certificateNumber: 'AWS-123456',
          expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'achieved');
      expect(response.body.data).toHaveProperty('certificateNumber');
      expect(response.body.data).toHaveProperty('expiryDate');
    });
  });

  describe('POST /api/learning/paths', () => {
    it('should create a learning path', async () => {
      const response = await request(app)
        .post('/api/learning/paths')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Full Stack Development',
          description: 'Complete path to become a full stack developer',
          targetRole: 'Full Stack Developer',
          duration: '6 months',
          modules: [
            {
              name: 'Frontend Fundamentals',
              courses: ['html-css-basics', 'javascript-essentials', 'react-fundamentals'],
              duration: '2 months'
            },
            {
              name: 'Backend Development',
              courses: ['node-basics', 'express-api', 'database-design'],
              duration: '2 months'
            },
            {
              name: 'DevOps & Deployment',
              courses: ['docker-basics', 'ci-cd', 'cloud-deployment'],
              duration: '2 months'
            }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('modules');
      expect(response.body.data).toHaveProperty('progress', 0);
      
      learningPathId = response.body.data.id;
    });
  });

  describe('GET /api/learning/paths', () => {
    it('should get user learning paths', async () => {
      const response = await request(app)
        .get('/api/learning/paths')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('title');
      expect(response.body.data[0]).toHaveProperty('progress');
      expect(response.body.data[0]).toHaveProperty('modules');
    });
  });

  describe('PATCH /api/learning/paths/:id/progress', () => {
    it('should update learning path progress', async () => {
      const response = await request(app)
        .patch(`/api/learning/paths/${learningPathId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completedModules: ['Frontend Fundamentals'],
          currentModule: 'Backend Development',
          overallProgress: 33
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overallProgress', 33);
      expect(response.body.data).toHaveProperty('currentModule');
    });
  });

  describe('POST /api/learning/goals', () => {
    it('should create learning goals', async () => {
      const response = await request(app)
        .post('/api/learning/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          year: 2025,
          goals: [
            {
              skill: 'AWS',
              targetLevel: 'advanced',
              currentLevel: 'intermediate',
              deadline: '2025-06-30'
            },
            {
              skill: 'Python',
              targetLevel: 'intermediate',
              currentLevel: 'beginner',
              deadline: '2025-12-31'
            }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('year', 2025);
      expect(response.body.data).toHaveProperty('goals');
      expect(response.body.data.goals).toHaveLength(2);
      
      goalId = response.body.data.id;
    });
  });

  describe('GET /api/learning/goals', () => {
    it('should get learning goals', async () => {
      const response = await request(app)
        .get('/api/learning/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('year');
      expect(response.body.data[0]).toHaveProperty('goals');
    });

    it('should get goals for specific year', async () => {
      const response = await request(app)
        .get('/api/learning/goals')
        .query({ year: 2025 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(goal => {
        expect(goal.year).toBe(2025);
      });
    });
  });

  describe('PATCH /api/learning/goals/:id', () => {
    it('should update goal progress', async () => {
      const response = await request(app)
        .patch(`/api/learning/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          goals: [
            {
              skill: 'AWS',
              targetLevel: 'advanced',
              currentLevel: 'advanced',
              deadline: '2025-06-30',
              completed: true,
              completedDate: '2025-05-15'
            },
            {
              skill: 'Python',
              targetLevel: 'intermediate',
              currentLevel: 'beginner',
              deadline: '2025-12-31',
              progress: 25
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.goals[0]).toHaveProperty('completed', true);
      expect(response.body.data.goals[1]).toHaveProperty('progress', 25);
    });
  });

  describe('GET /api/learning/recommendations', () => {
    it('should get personalized learning recommendations', async () => {
      const response = await request(app)
        .get('/api/learning/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('courses');
      expect(response.body.data).toHaveProperty('certifications');
      expect(response.body.data).toHaveProperty('skills');
      expect(response.body.data).toHaveProperty('learningPaths');
    });

    it('should get recommendations for specific career goal', async () => {
      const response = await request(app)
        .get('/api/learning/recommendations')
        .query({ targetRole: 'Senior Full Stack Developer' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('targetRole', 'Senior Full Stack Developer');
      expect(response.body.data).toHaveProperty('skillGaps');
      expect(response.body.data).toHaveProperty('prioritizedRecommendations');
    });
  });

  describe('GET /api/learning/analytics', () => {
    it('should get learning analytics', async () => {
      const response = await request(app)
        .get('/api/learning/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCoursesCompleted');
      expect(response.body.data).toHaveProperty('totalHoursLearned');
      expect(response.body.data).toHaveProperty('skillsAcquired');
      expect(response.body.data).toHaveProperty('certificationsEarned');
      expect(response.body.data).toHaveProperty('learningStreak');
      expect(response.body.data).toHaveProperty('monthlyProgress');
    });

    it('should get analytics for date range', async () => {
      const response = await request(app)
        .get('/api/learning/analytics')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-12-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('dateRange');
    });
  });

  describe('POST /api/learning/skills/assess', () => {
    it('should assess skill level', async () => {
      const response = await request(app)
        .post('/api/learning/skills/assess')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skill: 'JavaScript',
          assessmentType: 'quiz',
          score: 85,
          totalQuestions: 100,
          timeSpent: 3600
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('skill', 'JavaScript');
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('percentile');
      expect(response.body.data).toHaveProperty('recommendations');
    });
  });
});