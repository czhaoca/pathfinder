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
  createTestUser,
  initiateDeletion
} = require('../helpers/users');
const {
  getEmailsSentTo,
  processScheduledJobs,
  clearSentEmails
} = require('../helpers/email');

describe('User Deletion with Cooling-Off Tests', () => {
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
    clearSentEmails();
    testUsers = await generateTestUsers();
  });

  describe('Self-Deletion Flow', () => {
    test('Self-deletion triggers 7-day cooling period', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      const userId = testUsers.regularUser.id;
      
      const response = await request(testApp)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'No longer need account'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('scheduled');
      expect(response.body.data.cooling_off_days).toBe(7);
      expect(response.body.data).toHaveProperty('scheduled_for');
      expect(response.body.data).toHaveProperty('cancellation_token');
      
      // Verify scheduled date is 7 days from now
      const scheduledDate = new Date(response.body.data.scheduled_for);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);
      
      expect(scheduledDate.getDate()).toBe(expectedDate.getDate());
      expect(scheduledDate.getMonth()).toBe(expectedDate.getMonth());
      
      // Verify user status changed
      const user = await getUser(userId);
      expect(user.ACCOUNT_STATUS).toBe('pending_deletion');
    });

    test('Can cancel deletion during cooling-off', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      const userId = testUsers.regularUser.id;
      
      // Initiate deletion
      const deleteResponse = await request(testApp)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Test deletion'
        });
      
      const cancellationToken = deleteResponse.body.data.cancellation_token;
      
      // Cancel deletion
      const cancelResponse = await request(testApp)
        .post(`/api/users/${userId}/cancel-deletion`)
        .send({
          cancellation_token: cancellationToken
        });
      
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.message).toContain('Deletion cancelled');
      
      // Verify user status restored
      const user = await getUser(userId);
      expect(user.ACCOUNT_STATUS).toBe('active');
      expect(user.DELETION_SCHEDULED_AT).toBeNull();
    });

    test('Cannot cancel with invalid token', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      const userId = testUsers.regularUser.id;
      
      // Initiate deletion
      await request(testApp)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Test deletion'
        });
      
      // Try to cancel with wrong token
      const cancelResponse = await request(testApp)
        .post(`/api/users/${userId}/cancel-deletion`)
        .send({
          cancellation_token: 'invalid_token'
        });
      
      expect(cancelResponse.status).toBe(401);
      expect(cancelResponse.body.error).toBe('INVALID_TOKEN');
    });

    test('User can still login during cooling-off period', async () => {
      const user = await createTestUser({
        username: 'cooling_user',
        password: 'Test@Password123'
      });
      
      const userToken = await loginAs(user);
      
      // Initiate deletion
      await request(testApp)
        .delete(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Test'
        });
      
      // Try to login again
      const { hashPassword } = require('../helpers/users');
      const { hash, salt } = await hashPassword('Test@Password123');
      
      const loginResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'cooling_user',
          password_hash: hash,
          client_salt: salt
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data).toHaveProperty('token');
      expect(loginResponse.body.data.user.account_status).toBe('pending_deletion');
    });
  });

  describe('Email Reminders', () => {
    test('Reminders sent on schedule', async () => {
      const { userId } = await initiateDeletion(testUsers.regularUser.id);
      
      // Simulate day 1 (6 days remaining)
      await query(
        `UPDATE pf_users 
         SET deletion_scheduled_at = :1 
         WHERE id = :2`,
        [
          new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          userId
        ]
      );
      
      await processScheduledJobs();
      let emails = await getEmailsSentTo(userId);
      expect(emails).toContainEqual(
        expect.objectContaining({ type: 'deletion_reminder_day_1' })
      );
      
      // Simulate day 3 (4 days remaining)
      await query(
        `UPDATE pf_users 
         SET deletion_scheduled_at = :1 
         WHERE id = :2`,
        [
          new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          userId
        ]
      );
      
      await processScheduledJobs();
      emails = await getEmailsSentTo(userId);
      expect(emails).toContainEqual(
        expect.objectContaining({ type: 'deletion_reminder_day_3' })
      );
      
      // Simulate day 6 (1 day remaining - final warning)
      await query(
        `UPDATE pf_users 
         SET deletion_scheduled_at = :1 
         WHERE id = :2`,
        [
          new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          userId
        ]
      );
      
      await processScheduledJobs();
      emails = await getEmailsSentTo(userId);
      expect(emails).toContainEqual(
        expect.objectContaining({ type: 'deletion_final_warning' })
      );
    });
  });

  describe('Admin Deletion', () => {
    test('Admin can delete user with immediate effect', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      const targetUserId = testUsers.regularUser.id;
      
      const response = await request(testApp)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Admin deletion',
          override_cooling_off: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.immediate).toBe(true);
      
      // Verify user deleted
      const user = await getUser(targetUserId);
      expect(user).toBeNull();
    });

    test('Admin deletion without override follows cooling-off', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      const targetUserId = testUsers.regularUser.id;
      
      const response = await request(testApp)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          confirmation: 'DELETE',
          reason: 'Standard admin deletion'
        });
      
      expect(response.status).toBe(202);
      expect(response.body.data.approval_required).toBe(true);
    });
  });

  describe('Data Cleanup', () => {
    test('User-specific tables are deleted', async () => {
      const user = await createTestUser();
      const userId = user.id;
      
      // Create user-specific data
      await query(
        `CREATE TABLE user_${userId}_data (id NUMBER PRIMARY KEY)`
      );
      
      // Delete user immediately (as site admin)
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      
      await request(testApp)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          confirmation: 'DELETE',
          override_cooling_off: true
        });
      
      // Verify user-specific table deleted
      const tables = await query(
        `SELECT table_name FROM user_tables 
         WHERE table_name = :1`,
        [`USER_${userId}_DATA`]
      );
      
      expect(tables).toHaveLength(0);
    });

    test('Audit logs are preserved after deletion', async () => {
      const userId = testUsers.regularUser.id;
      
      // Generate some audit logs
      const userToken = await loginAs(testUsers.regularUser);
      await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userToken}`);
      
      // Delete user
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      await request(testApp)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          confirmation: 'DELETE',
          override_cooling_off: true
        });
      
      // Verify audit logs still exist
      const auditLogs = await query(
        `SELECT * FROM pf_audit_log 
         WHERE actor_id = :1 OR target_id = :1`,
        [userId]
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });
});