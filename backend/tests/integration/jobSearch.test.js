/**
 * Job Search Integration Tests
 */

const request = require('supertest');
const app = require('../../src/api/app');

describe('Job Search Endpoints', () => {
  let authToken;
  let userId;
  let savedJobId;
  let applicationId;

  beforeAll(async () => {
    // Register and login to get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'jobseeker',
        email: 'jobseeker@test.com',
        password: 'Test123!@#',
        firstName: 'Job',
        lastName: 'Seeker'
      });

    if (registerResponse.status === 201) {
      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    } else {
      // Login if already registered
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'jobseeker',
          password: 'Test123!@#'
        });
      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    }
  });

  describe('POST /api/jobs/search', () => {
    it('should search for jobs with keywords', async () => {
      const response = await request(app)
        .post('/api/jobs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: 'software engineer',
          location: 'San Francisco, CA',
          radius: 25,
          jobType: ['full-time', 'contract'],
          experienceLevel: 'mid-level'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobs');
      expect(response.body.data).toHaveProperty('totalResults');
      expect(response.body.data.jobs).toBeInstanceOf(Array);
      
      if (response.body.data.jobs.length > 0) {
        const job = response.body.data.jobs[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('company');
        expect(job).toHaveProperty('location');
        expect(job).toHaveProperty('description');
        expect(job).toHaveProperty('postedDate');
      }
    });

    it('should search with salary filter', async () => {
      const response = await request(app)
        .post('/api/jobs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: 'developer',
          salaryMin: 80000,
          salaryMax: 150000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.jobs.forEach(job => {
        if (job.salary) {
          expect(job.salary.min).toBeGreaterThanOrEqual(80000);
          expect(job.salary.max).toBeLessThanOrEqual(150000);
        }
      });
    });

    it('should paginate search results', async () => {
      const response = await request(app)
        .post('/api/jobs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          keywords: 'engineer',
          page: 2,
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page', 2);
      expect(response.body.data.pagination).toHaveProperty('limit', 10);
      expect(response.body.data.pagination).toHaveProperty('totalPages');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/jobs/search')
        .send({
          keywords: 'engineer'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should get job details', async () => {
      // First search to get a job ID
      const searchResponse = await request(app)
        .post('/api/jobs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ keywords: 'software' });

      if (searchResponse.body.data.jobs.length > 0) {
        const jobId = searchResponse.body.data.jobs[0].id;

        const response = await request(app)
          .get(`/api/jobs/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', jobId);
        expect(response.body.data).toHaveProperty('fullDescription');
        expect(response.body.data).toHaveProperty('requirements');
        expect(response.body.data).toHaveProperty('benefits');
        expect(response.body.data).toHaveProperty('applicationUrl');
      }
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/non-existent-job-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/jobs/save', () => {
    it('should save a job for later', async () => {
      const response = await request(app)
        .post('/api/jobs/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'test-job-123',
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          location: 'Remote',
          notes: 'Looks interesting, review later'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('jobId', 'test-job-123');
      expect(response.body.data).toHaveProperty('savedDate');
      
      savedJobId = response.body.data.id;
    });

    it('should not save duplicate jobs', async () => {
      const response = await request(app)
        .post('/api/jobs/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'test-job-123',
          title: 'Senior Software Engineer',
          company: 'Tech Corp'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already saved');
    });
  });

  describe('GET /api/jobs/saved', () => {
    it('should get all saved jobs', async () => {
      const response = await request(app)
        .get('/api/jobs/saved')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('jobId');
      expect(response.body.data[0]).toHaveProperty('savedDate');
    });

    it('should filter saved jobs by date', async () => {
      const response = await request(app)
        .get('/api/jobs/saved')
        .query({ savedAfter: '2025-01-01' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(job => {
        expect(new Date(job.savedDate)).toBeGreaterThan(new Date('2025-01-01'));
      });
    });
  });

  describe('DELETE /api/jobs/saved/:id', () => {
    it('should remove a saved job', async () => {
      const response = await request(app)
        .delete(`/api/jobs/saved/${savedJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed');
    });
  });

  describe('POST /api/jobs/applications', () => {
    it('should track job application', async () => {
      const response = await request(app)
        .post('/api/jobs/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'applied-job-456',
          title: 'Full Stack Developer',
          company: 'StartupXYZ',
          location: 'New York, NY',
          appliedDate: new Date().toISOString(),
          status: 'applied',
          resumeVersion: 'v2.1',
          coverLetter: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status', 'applied');
      expect(response.body.data).toHaveProperty('timeline');
      
      applicationId = response.body.data.id;
    });
  });

  describe('GET /api/jobs/applications', () => {
    it('should get all job applications', async () => {
      const response = await request(app)
        .get('/api/jobs/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('jobId');
      expect(response.body.data[0]).toHaveProperty('status');
      expect(response.body.data[0]).toHaveProperty('timeline');
    });

    it('should filter applications by status', async () => {
      const response = await request(app)
        .get('/api/jobs/applications')
        .query({ status: 'applied' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(app => {
        expect(app.status).toBe('applied');
      });
    });
  });

  describe('PATCH /api/jobs/applications/:id', () => {
    it('should update application status', async () => {
      const response = await request(app)
        .patch(`/api/jobs/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'interview_scheduled',
          interviewDate: '2025-08-15T14:00:00Z',
          interviewType: 'phone',
          notes: 'First round with hiring manager'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'interview_scheduled');
      expect(response.body.data).toHaveProperty('interviewDate');
      expect(response.body.data.timeline).toContainEqual(
        expect.objectContaining({
          status: 'interview_scheduled'
        })
      );
    });

    it('should add interview feedback', async () => {
      const response = await request(app)
        .patch(`/api/jobs/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'interview_completed',
          interviewFeedback: {
            round: 1,
            interviewer: 'John Doe',
            rating: 4,
            notes: 'Strong technical skills, good culture fit',
            nextSteps: 'Second round with team'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interviewFeedback');
    });

    it('should update to offer status', async () => {
      const response = await request(app)
        .patch(`/api/jobs/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'offer_received',
          offerDetails: {
            salary: 120000,
            equity: '0.1%',
            startDate: '2025-09-01',
            deadline: '2025-08-20'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'offer_received');
      expect(response.body.data).toHaveProperty('offerDetails');
    });
  });

  describe('GET /api/jobs/statistics', () => {
    it('should get application statistics', async () => {
      const response = await request(app)
        .get('/api/jobs/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalApplications');
      expect(response.body.data).toHaveProperty('statusBreakdown');
      expect(response.body.data).toHaveProperty('responseRate');
      expect(response.body.data).toHaveProperty('averageTimeToResponse');
      expect(response.body.data).toHaveProperty('interviewConversionRate');
    });

    it('should get statistics for date range', async () => {
      const response = await request(app)
        .get('/api/jobs/statistics')
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

  describe('POST /api/jobs/match-score', () => {
    it('should calculate job match score', async () => {
      const response = await request(app)
        .post('/api/jobs/match-score')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'job-to-match',
          jobDescription: 'Looking for a senior developer with React, Node.js, and AWS experience',
          requirements: ['5+ years experience', 'React', 'Node.js', 'AWS', 'Agile']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matchScore');
      expect(response.body.data).toHaveProperty('matchedSkills');
      expect(response.body.data).toHaveProperty('missingSkills');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data.matchScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.matchScore).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/jobs/interview-prep/:jobId', () => {
    it('should get interview preparation materials', async () => {
      const response = await request(app)
        .get(`/api/jobs/interview-prep/${applicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('companyInfo');
      expect(response.body.data).toHaveProperty('commonQuestions');
      expect(response.body.data).toHaveProperty('behavioralQuestions');
      expect(response.body.data).toHaveProperty('technicalTopics');
      expect(response.body.data).toHaveProperty('tips');
    });
  });

  describe('POST /api/jobs/alerts', () => {
    let alertId;

    it('should create job alert', async () => {
      const response = await request(app)
        .post('/api/jobs/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Remote React Jobs',
          criteria: {
            keywords: ['React', 'Frontend'],
            location: 'Remote',
            jobType: 'full-time',
            salaryMin: 100000
          },
          frequency: 'daily',
          active: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('criteria');
      expect(response.body.data).toHaveProperty('active', true);
      
      alertId = response.body.data.id;
    });

    it('should get all job alerts', async () => {
      const response = await request(app)
        .get('/api/jobs/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('criteria');
    });

    it('should update job alert', async () => {
      const response = await request(app)
        .patch(`/api/jobs/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          active: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('active', false);
    });

    it('should delete job alert', async () => {
      const response = await request(app)
        .delete(`/api/jobs/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });
  });
});