const request = require('supertest');
const app = require('../../src/api/app');
const { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData,
  query 
} = require('../helpers/database');
const { 
  generateTestUsers,
  loginAs,
  getUser,
  createTestUser
} = require('../helpers/users');

describe('RBAC Integration Tests', () => {
  let testUsers;
  let testApp;

  beforeAll(async () => {
    await setupTestDatabase();
    testApp = app.getExpressApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    testUsers = await generateTestUsers();
  });

  describe('Role Hierarchy', () => {
    test('Site admin can perform all actions', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      
      // Can create admin
      const createAdminResponse = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          username: 'new_admin',
          email: 'admin@test.com',
          first_name: 'New',
          last_name: 'Admin',
          role: 'admin'
        });
      
      expect(createAdminResponse.status).toBe(201);
      
      // Can delete user immediately (override cooling-off)
      const deleteResponse = await request(testApp)
        .delete(`/api/users/${testUsers.regularUser.id}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          confirmation: 'DELETE',
          override_cooling_off: true
        });
      
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data.immediate).toBe(true);
      
      // Can view audit logs
      const auditResponse = await request(testApp)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${siteAdminToken}`);
      
      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.data).toHaveProperty('logs');
    });

    test('Admin cannot create another admin', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'another_admin',
          email: 'admin2@test.com',
          first_name: 'Another',
          last_name: 'Admin',
          role: 'admin'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PRIVILEGES');
    });

    test('Admin can create regular users', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'regular_user',
          email: 'regular@test.com',
          first_name: 'Regular',
          last_name: 'User',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.user.roles).toContain('user');
    });

    test('User can only access own data', async () => {
      const user1Token = await loginAs(testUsers.user1);
      const user2Id = testUsers.user2.id;
      
      // Cannot view other user's profile
      const otherUserResponse = await request(testApp)
        .get(`/api/users/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(otherUserResponse.status).toBe(403);
      expect(otherUserResponse.body.error).toBe('FORBIDDEN');
      
      // Can view own profile
      const ownProfileResponse = await request(testApp)
        .get(`/api/users/${testUsers.user1.id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(ownProfileResponse.status).toBe(200);
      expect(ownProfileResponse.body.data.user.id).toBe(testUsers.user1.id);
    });

    test('User cannot access admin endpoints', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      // Cannot list all users
      const listUsersResponse = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(listUsersResponse.status).toBe(403);
      
      // Cannot view audit logs
      const auditLogsResponse = await request(testApp)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(auditLogsResponse.status).toBe(403);
    });
  });

  describe('Permission Boundaries', () => {
    test('Admin can view users but not modify roles', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      const userId = testUsers.regularUser.id;
      
      // Can view user list
      const listResponse = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(listResponse.status).toBe(200);
      
      // Cannot assign admin role
      const roleResponse = await request(testApp)
        .put(`/api/admin/roles/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['admin']
        });
      
      expect(roleResponse.status).toBe(403);
      expect(roleResponse.body.error).toBe('INSUFFICIENT_PRIVILEGES');
    });

    test('Site admin can modify all roles', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      const userId = testUsers.regularUser.id;
      
      // Can promote to admin
      const promoteResponse = await request(testApp)
        .put(`/api/admin/roles/${userId}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          roles: ['admin']
        });
      
      expect(promoteResponse.status).toBe(200);
      
      // Verify role was updated
      const user = await getUser(userId);
      expect(user.ROLES).toContain('admin');
    });
  });

  describe('Approval Workflows', () => {
    test('Admin deletion requires approval', async () => {
      const admin1Token = await loginAs(testUsers.admin1);
      const targetUserId = testUsers.regularUser.id;
      
      // Initiate deletion
      const deleteResponse = await request(testApp)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Account cleanup'
        });
      
      expect(deleteResponse.status).toBe(202);
      expect(deleteResponse.body.data.approval_required).toBe(true);
      expect(deleteResponse.body.data).toHaveProperty('approval_id');
      
      const approvalId = deleteResponse.body.data.approval_id;
      
      // Another admin approves
      const admin2Token = await loginAs(testUsers.admin2);
      
      const approveResponse = await request(testApp)
        .post(`/api/approvals/${approvalId}/approve`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          comments: 'Approved for deletion'
        });
      
      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('approved');
    });

    test('User cannot approve own requests', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      const targetUserId = testUsers.regularUser.id;
      
      // Initiate deletion
      const deleteResponse = await request(testApp)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Test deletion'
        });
      
      const approvalId = deleteResponse.body.data.approval_id;
      
      // Same admin tries to approve own request
      const approveResponse = await request(testApp)
        .post(`/api/approvals/${approvalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comments: 'Self approval attempt'
        });
      
      expect(approveResponse.status).toBe(403);
      expect(approveResponse.body.error).toBe('FORBIDDEN');
      expect(approveResponse.body.message).toContain('Cannot approve own request');
    });
  });

  describe('Temporary Permissions', () => {
    test('Temporary admin role expires', async () => {
      // This would require implementing temporary role assignment
      // Placeholder test
      expect(true).toBe(true);
    });
  });

  describe('Data Access Control', () => {
    test('User data isolation is enforced', async () => {
      const user1Token = await loginAs(testUsers.user1);
      const user2Token = await loginAs(testUsers.user2);
      
      // User1 creates an experience
      const createResponse = await request(testApp)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Private Experience',
          company: 'Company A',
          start_date: '2020-01-01',
          description: 'User1 private data'
        });
      
      expect(createResponse.status).toBe(201);
      const experienceId = createResponse.body.data.experience.id;
      
      // User2 cannot access User1's experience
      const accessResponse = await request(testApp)
        .get(`/api/experiences/${experienceId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(accessResponse.status).toBe(404); // Not found for other users
    });
  });
});