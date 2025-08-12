/**
 * End-to-End Tests for Experience Management
 * Tests the complete experience lifecycle including creation, updating, searching, and analytics
 */

const { test, expect } = require('@playwright/test');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const TEST_USER = {
  username: `exptest_${Date.now()}`,
  email: `exptest_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  fullName: 'Experience Test User'
};

test.describe('Experience Management E2E Tests', () => {
  let authToken;
  let userId;
  let experienceId;

  test.beforeAll(async ({ request }) => {
    // Register and login test user
    const registerResponse = await request.post(`${API_URL}/auth/register`, {
      data: TEST_USER
    });
    
    const registerBody = await registerResponse.json();
    userId = registerBody.data.user.id;
    
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password
      }
    });
    
    const loginBody = await loginResponse.json();
    authToken = loginBody.data.token;
  });

  test.describe('Experience Creation', () => {
    test('should create a new work experience', async ({ request }) => {
      const experience = {
        title: 'Senior Software Engineer',
        description: 'Led development of microservices architecture, mentored junior developers, and improved system performance by 40%',
        organization: 'Tech Corp',
        startDate: '2022-01-15',
        endDate: '2023-12-31',
        isCurrent: false,
        experienceType: 'work',
        skills: ['JavaScript', 'Node.js', 'AWS', 'Microservices', 'Team Leadership'],
        highlights: [
          'Reduced API response time by 40%',
          'Mentored team of 5 developers',
          'Implemented CI/CD pipeline'
        ],
        location: 'San Francisco, CA',
        roleCategory: 'Engineering'
      };

      const response = await request.post(`${API_URL}/experiences`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: experience
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.title).toBe(experience.title);
      expect(body.data.skills).toEqual(expect.arrayContaining(experience.skills));
      
      experienceId = body.data.id;
    });

    test('should create an education experience', async ({ request }) => {
      const education = {
        title: 'Master of Computer Science',
        description: 'Focused on distributed systems and machine learning',
        organization: 'Stanford University',
        startDate: '2019-09-01',
        endDate: '2021-06-15',
        experienceType: 'education',
        skills: ['Machine Learning', 'Distributed Systems', 'Research'],
        highlights: [
          'GPA: 3.8/4.0',
          'Published 2 research papers',
          'Teaching Assistant for Algorithms'
        ],
        location: 'Stanford, CA'
      };

      const response = await request.post(`${API_URL}/experiences`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: education
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.experienceType).toBe('education');
    });

    test('should validate required fields', async ({ request }) => {
      const invalidExperience = {
        // Missing required title
        description: 'Some description'
      };

      const response = await request.post(`${API_URL}/experiences`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: invalidExperience
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.errors).toHaveProperty('title');
    });
  });

  test.describe('Experience Retrieval', () => {
    test('should get all user experiences', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
      
      // Verify experiences belong to the user
      body.data.forEach(exp => {
        expect(exp.userId).toBe(userId);
      });
    });

    test('should get specific experience by ID', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/${experienceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(experienceId);
      expect(body.data.title).toBe('Senior Software Engineer');
    });

    test('should filter experiences by type', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences?type=work`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      body.data.forEach(exp => {
        expect(exp.experienceType).toBe('work');
      });
    });

    test('should paginate experiences', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences?limit=1&offset=0`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThan(0);
    });
  });

  test.describe('Experience Update', () => {
    test('should update experience details', async ({ request }) => {
      const updates = {
        title: 'Lead Software Engineer',
        description: 'Promoted to lead role with additional responsibilities',
        skills: ['JavaScript', 'Node.js', 'AWS', 'Microservices', 'Team Leadership', 'Architecture Design']
      };

      const response = await request.put(`${API_URL}/experiences/${experienceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: updates
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.title).toBe(updates.title);
      expect(body.data.skills).toContain('Architecture Design');
    });

    test('should add highlights to experience', async ({ request }) => {
      const newHighlights = [
        'Led migration to Kubernetes',
        'Reduced infrastructure costs by 30%'
      ];

      const response = await request.post(`${API_URL}/experiences/${experienceId}/highlights`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: { highlights: newHighlights }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.highlights).toEqual(expect.arrayContaining(newHighlights));
    });
  });

  test.describe('Experience Search', () => {
    test('should search experiences by keyword', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/search?q=software`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      
      // Verify search results contain the keyword
      body.data.forEach(exp => {
        const text = `${exp.title} ${exp.description}`.toLowerCase();
        expect(text).toContain('software');
      });
    });

    test('should search by skills', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/search?skills=JavaScript,Node.js`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      body.data.forEach(exp => {
        const hasSkill = exp.skills.some(skill => 
          ['JavaScript', 'Node.js'].includes(skill)
        );
        expect(hasSkill).toBe(true);
      });
    });

    test('should search by date range', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/search?startDate=2022-01-01&endDate=2023-12-31`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      body.data.forEach(exp => {
        const start = new Date(exp.startDate);
        const end = exp.endDate ? new Date(exp.endDate) : new Date();
        
        expect(start.getTime()).toBeGreaterThanOrEqual(new Date('2022-01-01').getTime());
        expect(end.getTime()).toBeLessThanOrEqual(new Date('2023-12-31').getTime());
      });
    });
  });

  test.describe('Skills Analytics', () => {
    test('should get skills summary', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/skills/summary`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('topSkills');
      expect(body.data).toHaveProperty('skillCategories');
      expect(body.data).toHaveProperty('skillGrowth');
      
      // Verify top skills are sorted by frequency
      const frequencies = body.data.topSkills.map(s => s.frequency);
      expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
    });

    test('should get skill recommendations', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/skills/recommendations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('recommended');
      expect(body.data).toHaveProperty('trending');
      expect(body.data).toHaveProperty('complementary');
    });
  });

  test.describe('Experience Export', () => {
    test('should export experiences as JSON', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/export?format=json`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body).toHaveProperty('experiences');
      expect(body).toHaveProperty('metadata');
      expect(body.metadata).toHaveProperty('exportDate');
      expect(body.metadata).toHaveProperty('totalExperiences');
    });

    test('should export experiences as PDF', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/export?format=pdf`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('application/pdf');
      
      const buffer = await response.body();
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should export filtered experiences', async ({ request }) => {
      const response = await request.get(`${API_URL}/experiences/export?format=json&type=work`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      body.experiences.forEach(exp => {
        expect(exp.experienceType).toBe('work');
      });
    });
  });

  test.describe('Bulk Operations', () => {
    test('should bulk import experiences', async ({ request }) => {
      const experiences = [
        {
          title: 'Junior Developer',
          organization: 'StartupCo',
          startDate: '2020-06-01',
          endDate: '2021-12-31',
          experienceType: 'work',
          skills: ['Python', 'Django', 'PostgreSQL']
        },
        {
          title: 'Freelance Consultant',
          organization: 'Self-Employed',
          startDate: '2021-01-01',
          endDate: '2021-06-30',
          experienceType: 'work',
          skills: ['Consulting', 'Project Management']
        }
      ];

      const response = await request.post(`${API_URL}/experiences/bulk`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: { experiences }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.created).toBe(2);
      expect(body.data.ids).toHaveLength(2);
    });

    test('should bulk update experiences', async ({ request }) => {
      const updates = {
        experienceType: 'work',
        updates: {
          roleCategory: 'Technology'
        }
      };

      const response = await request.patch(`${API_URL}/experiences/bulk`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: updates
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data.updated).toBeGreaterThan(0);
    });
  });

  test.describe('Experience Deletion', () => {
    test('should soft delete experience', async ({ request }) => {
      const response = await request.delete(`${API_URL}/experiences/${experienceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Verify experience is soft deleted (not returned in regular queries)
      const getResponse = await request.get(`${API_URL}/experiences`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const getBody = await getResponse.json();
      const deletedExp = getBody.data.find(exp => exp.id === experienceId);
      expect(deletedExp).toBeUndefined();
    });

    test('should restore soft deleted experience', async ({ request }) => {
      const response = await request.post(`${API_URL}/experiences/${experienceId}/restore`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Verify experience is restored
      const getResponse = await request.get(`${API_URL}/experiences/${experienceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(getResponse.ok()).toBeTruthy();
    });

    test('should permanently delete experience', async ({ request }) => {
      const response = await request.delete(`${API_URL}/experiences/${experienceId}?permanent=true`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Verify experience is permanently deleted
      const getResponse = await request.get(`${API_URL}/experiences/${experienceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(getResponse.status()).toBe(404);
    });
  });
});