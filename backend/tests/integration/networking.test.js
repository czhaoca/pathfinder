/**
 * Professional Networking Integration Tests
 */

const request = require('supertest');
const app = require('../../src/api/app');

describe('Professional Networking Endpoints', () => {
  let authToken;
  let userId;
  let contactId;
  let connectionId;
  let meetingId;
  let groupId;
  let eventId;

  beforeAll(async () => {
    // Register and login to get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'networker',
        email: 'networker@test.com',
        password: 'Test123!@#',
        firstName: 'Active',
        lastName: 'Networker'
      });

    if (registerResponse.status === 201) {
      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    } else {
      // Login if already registered
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'networker',
          password: 'Test123!@#'
        });
      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    }
  });

  describe('POST /api/networking/contacts', () => {
    it('should create a new contact', async () => {
      const response = await request(app)
        .post('/api/networking/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
          company: 'Tech Corp',
          position: 'Senior Developer',
          linkedinUrl: 'https://linkedin.com/in/johndoe',
          howMet: 'Conference - React Summit 2025',
          notes: 'Expert in React and Node.js',
          tags: ['technology', 'react', 'mentor']
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('firstName', 'John');
      expect(response.body.data).toHaveProperty('lastName', 'Doe');
      expect(response.body.data).toHaveProperty('tags');
      expect(response.body.data).toHaveProperty('createdAt');
      
      contactId = response.body.data.id;
    });

    it('should prevent duplicate contacts', async () => {
      const response = await request(app)
        .post('/api/networking/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/networking/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Jane'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
    });
  });

  describe('GET /api/networking/contacts', () => {
    it('should get all contacts', async () => {
      const response = await request(app)
        .get('/api/networking/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('firstName');
      expect(response.body.data[0]).toHaveProperty('lastName');
      expect(response.body.data[0]).toHaveProperty('company');
    });

    it('should filter contacts by tag', async () => {
      const response = await request(app)
        .get('/api/networking/contacts')
        .query({ tag: 'technology' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(contact => {
        expect(contact.tags).toContain('technology');
      });
    });

    it('should search contacts by name', async () => {
      const response = await request(app)
        .get('/api/networking/contacts')
        .query({ search: 'john' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(contact => {
        const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
        expect(fullName).toContain('john');
      });
    });

    it('should filter by company', async () => {
      const response = await request(app)
        .get('/api/networking/contacts')
        .query({ company: 'Tech Corp' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(contact => {
        expect(contact.company).toBe('Tech Corp');
      });
    });
  });

  describe('GET /api/networking/contacts/:id', () => {
    it('should get contact details', async () => {
      const response = await request(app)
        .get(`/api/networking/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', contactId);
      expect(response.body.data).toHaveProperty('firstName');
      expect(response.body.data).toHaveProperty('interactionHistory');
      expect(response.body.data).toHaveProperty('connectionStrength');
    });

    it('should return 404 for non-existent contact', async () => {
      const response = await request(app)
        .get('/api/networking/contacts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /api/networking/contacts/:id', () => {
    it('should update contact information', async () => {
      const response = await request(app)
        .patch(`/api/networking/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          position: 'Engineering Manager',
          company: 'New Tech Corp',
          notes: 'Recently promoted, now managing a team of 10'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('position', 'Engineering Manager');
      expect(response.body.data).toHaveProperty('company', 'New Tech Corp');
    });
  });

  describe('POST /api/networking/connections', () => {
    it('should create a connection request', async () => {
      const response = await request(app)
        .post('/api/networking/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          platform: 'LinkedIn',
          message: 'Hi John, great meeting you at React Summit!',
          status: 'pending'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data).toHaveProperty('platform', 'LinkedIn');
      
      connectionId = response.body.data.id;
    });

    it('should track connection acceptance', async () => {
      const response = await request(app)
        .patch(`/api/networking/connections/${connectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'connected',
          connectedDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'connected');
      expect(response.body.data).toHaveProperty('connectedDate');
    });
  });

  describe('POST /api/networking/meetings', () => {
    it('should schedule a meeting', async () => {
      const response = await request(app)
        .post('/api/networking/meetings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'coffee_chat',
          title: 'Coffee Chat - Career Advice',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Starbucks Downtown',
          agenda: 'Discuss career transition to management',
          duration: 60,
          reminder: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('type', 'coffee_chat');
      expect(response.body.data).toHaveProperty('status', 'scheduled');
      expect(response.body.data).toHaveProperty('reminder', true);
      
      meetingId = response.body.data.id;
    });

    it('should create virtual meeting', async () => {
      const response = await request(app)
        .post('/api/networking/meetings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'virtual',
          title: 'Tech Discussion',
          scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          platform: 'Zoom',
          meetingLink: 'https://zoom.us/j/123456789',
          duration: 30
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', 'Zoom');
      expect(response.body.data).toHaveProperty('meetingLink');
    });
  });

  describe('GET /api/networking/meetings', () => {
    it('should get upcoming meetings', async () => {
      const response = await request(app)
        .get('/api/networking/meetings')
        .query({ status: 'scheduled' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach(meeting => {
        expect(meeting.status).toBe('scheduled');
        expect(new Date(meeting.scheduledDate)).toBeGreaterThan(new Date());
      });
    });

    it('should get meetings by date range', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get('/api/networking/meetings')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(meeting => {
        const meetingDate = new Date(meeting.scheduledDate);
        expect(meetingDate).toBeGreaterThanOrEqual(new Date(startDate));
        expect(meetingDate).toBeLessThanOrEqual(new Date(endDate));
      });
    });
  });

  describe('POST /api/networking/meetings/:id/notes', () => {
    it('should add meeting notes', async () => {
      const response = await request(app)
        .post(`/api/networking/meetings/${meetingId}/notes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Great discussion about React architecture',
          keyTakeaways: [
            'Consider micro-frontends for scalability',
            'Look into Module Federation',
            'Review team structure for better collaboration'
          ],
          actionItems: [
            'Send React resources',
            'Schedule follow-up in 2 weeks',
            'Introduce to Sarah from DevOps team'
          ],
          followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notes');
      expect(response.body.data).toHaveProperty('keyTakeaways');
      expect(response.body.data).toHaveProperty('actionItems');
      expect(response.body.data).toHaveProperty('status', 'completed');
    });
  });

  describe('POST /api/networking/interactions', () => {
    it('should log interaction with contact', async () => {
      const response = await request(app)
        .post('/api/networking/interactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'email',
          subject: 'Follow-up on our coffee chat',
          content: 'Thanks for the great advice...',
          date: new Date().toISOString()
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('type', 'email');
    });

    it('should log social media interaction', async () => {
      const response = await request(app)
        .post('/api/networking/interactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'social_media',
          platform: 'LinkedIn',
          action: 'commented_on_post',
          content: 'Great insights on microservices!',
          date: new Date().toISOString()
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform', 'LinkedIn');
      expect(response.body.data).toHaveProperty('action', 'commented_on_post');
    });
  });

  describe('GET /api/networking/interactions/:contactId', () => {
    it('should get interaction history for contact', async () => {
      const response = await request(app)
        .get(`/api/networking/interactions/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('type');
      expect(response.body.data[0]).toHaveProperty('date');
    });
  });

  describe('POST /api/networking/groups', () => {
    it('should create a networking group', async () => {
      const response = await request(app)
        .post('/api/networking/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'React Developers Network',
          description: 'Local React developers meetup group',
          type: 'professional',
          platform: 'Meetup',
          memberCount: 250,
          joinedDate: new Date().toISOString(),
          activityLevel: 'active',
          tags: ['react', 'javascript', 'frontend']
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('activityLevel', 'active');
      
      groupId = response.body.data.id;
    });
  });

  describe('GET /api/networking/groups', () => {
    it('should get all networking groups', async () => {
      const response = await request(app)
        .get('/api/networking/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('memberCount');
    });

    it('should filter groups by activity level', async () => {
      const response = await request(app)
        .get('/api/networking/groups')
        .query({ activityLevel: 'active' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(group => {
        expect(group.activityLevel).toBe('active');
      });
    });
  });

  describe('POST /api/networking/events', () => {
    it('should create networking event', async () => {
      const response = await request(app)
        .post('/api/networking/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Tech Networking Night',
          description: 'Monthly networking event for tech professionals',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'TechHub Conference Center',
          type: 'networking',
          organizer: 'Tech Community',
          expectedAttendees: 100,
          registrationUrl: 'https://example.com/register',
          tags: ['networking', 'technology', 'careers']
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('status', 'upcoming');
      
      eventId = response.body.data.id;
    });
  });

  describe('POST /api/networking/events/:id/register', () => {
    it('should register for event', async () => {
      const response = await request(app)
        .post(`/api/networking/events/${eventId}/register`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attendanceStatus: 'registered',
          goals: ['Meet 5 new contacts', 'Learn about new technologies'],
          notes: 'Looking forward to connecting with React developers'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('attendanceStatus', 'registered');
      expect(response.body.data).toHaveProperty('goals');
    });
  });

  describe('GET /api/networking/events', () => {
    it('should get upcoming events', async () => {
      const response = await request(app)
        .get('/api/networking/events')
        .query({ status: 'upcoming' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach(event => {
        expect(new Date(event.date)).toBeGreaterThan(new Date());
      });
    });

    it('should get registered events', async () => {
      const response = await request(app)
        .get('/api/networking/events')
        .query({ registered: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(event => {
        expect(event.userRegistration).toBeDefined();
        expect(event.userRegistration.attendanceStatus).toBe('registered');
      });
    });
  });

  describe('POST /api/networking/events/:id/summary', () => {
    it('should add event summary after attendance', async () => {
      const response = await request(app)
        .post(`/api/networking/events/${eventId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attended: true,
          contactsMade: 7,
          newConnections: [
            { name: 'Alice Smith', company: 'StartupXYZ', role: 'CTO' },
            { name: 'Bob Johnson', company: 'BigCorp', role: 'Senior Dev' }
          ],
          keyLearnings: [
            'Microservices architecture trends',
            'Remote team management strategies'
          ],
          followUpActions: [
            'Connect with Alice on LinkedIn',
            'Send Bob the article on React patterns'
          ],
          overallRating: 4
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('contactsMade', 7);
      expect(response.body.data).toHaveProperty('newConnections');
      expect(response.body.data).toHaveProperty('overallRating', 4);
    });
  });

  describe('GET /api/networking/recommendations', () => {
    it('should get connection recommendations', async () => {
      const response = await request(app)
        .get('/api/networking/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestedConnections');
      expect(response.body.data).toHaveProperty('reconnectSuggestions');
      expect(response.body.data).toHaveProperty('upcomingEvents');
      expect(response.body.data).toHaveProperty('groupsToJoin');
    });

    it('should get recommendations based on career goals', async () => {
      const response = await request(app)
        .get('/api/networking/recommendations')
        .query({ careerGoal: 'Engineering Manager' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('targetRoleConnections');
      expect(response.body.data).toHaveProperty('relevantGroups');
    });
  });

  describe('GET /api/networking/analytics', () => {
    it('should get networking analytics', async () => {
      const response = await request(app)
        .get('/api/networking/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalContacts');
      expect(response.body.data).toHaveProperty('activeConnections');
      expect(response.body.data).toHaveProperty('meetingsThisMonth');
      expect(response.body.data).toHaveProperty('networkGrowthRate');
      expect(response.body.data).toHaveProperty('engagementScore');
      expect(response.body.data).toHaveProperty('topConnectionsByInteraction');
    });

    it('should get analytics for date range', async () => {
      const response = await request(app)
        .get('/api/networking/analytics')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-12-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('dateRange');
      expect(response.body.data).toHaveProperty('periodMetrics');
    });
  });

  describe('POST /api/networking/reminders', () => {
    it('should set follow-up reminder', async () => {
      const response = await request(app)
        .post('/api/networking/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'follow_up',
          message: 'Check in about the React resources',
          reminderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          recurring: false
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('type', 'follow_up');
      expect(response.body.data).toHaveProperty('status', 'active');
    });

    it('should set recurring touch-base reminder', async () => {
      const response = await request(app)
        .post('/api/networking/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactId: contactId,
          type: 'touch_base',
          message: 'Monthly check-in',
          reminderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          recurring: true,
          frequencyDays: 30
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('recurring', true);
      expect(response.body.data).toHaveProperty('frequencyDays', 30);
    });
  });

  describe('GET /api/networking/reminders', () => {
    it('should get active reminders', async () => {
      const response = await request(app)
        .get('/api/networking/reminders')
        .query({ status: 'active' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach(reminder => {
        expect(reminder.status).toBe('active');
        expect(new Date(reminder.reminderDate)).toBeGreaterThan(new Date());
      });
    });
  });

  describe('DELETE /api/networking/contacts/:id', () => {
    it('should soft delete a contact', async () => {
      const response = await request(app)
        .delete(`/api/networking/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should not show deleted contacts in list', async () => {
      const response = await request(app)
        .get('/api/networking/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deletedContact = response.body.data.find(c => c.id === contactId);
      expect(deletedContact).toBeUndefined();
    });
  });
});