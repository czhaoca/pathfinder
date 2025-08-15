const request = require('supertest');
const app = require('../../src/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/database');
const { createTestUser, loginAs } = require('../helpers/auth');
const { getRoleService } = require('../../src/services/roleService');

describe('RBAC Integration Tests', () => {
  let db;
  let siteAdminToken, adminToken1, adminToken2, userToken;
  let siteAdminId, adminId1, adminId2, userId;
  
  beforeAll(async () => {
    db = await setupTestDatabase();
    
    // Create test users with different roles
    const siteAdmin = await createTestUser('siteadmin', 'site_admin');
    siteAdminId = siteAdmin.id;
    siteAdminToken = await loginAs(siteAdmin);
    
    const admin1 = await createTestUser('admin1', 'admin');
    adminId1 = admin1.id;
    adminToken1 = await loginAs(admin1);
    
    const admin2 = await createTestUser('admin2', 'admin');
    adminId2 = admin2.id;
    adminToken2 = await loginAs(admin2);
    
    const user = await createTestUser('testuser', 'user');
    userId = user.id;
    userToken = await loginAs(user);
  });
  
  afterAll(async () => {
    await cleanupTestDatabase();
  });
  
  describe('Role Checking', () => {
    test('site_admin can access all protected routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${siteAdminToken}`);
      
      expect(response.status).toBe(200);
    });
    
    test('admin can access admin routes but not site_admin routes', async () => {
      // Can access admin route
      const adminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken1}`);
      
      expect(adminResponse.status).toBe(200);
      
      // Cannot access site_admin only route
      const siteAdminResponse = await request(app)
        .post('/api/roles/assign')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          user_id: userId,
          role: 'admin'
        });
      
      expect(siteAdminResponse.status).toBe(403);
    });
    
    test('user cannot access admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });
    
    test('unauthenticated requests are rejected', async () => {
      const response = await request(app)
        .get('/api/admin/users');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });
  
  describe('Role Assignment', () => {
    test('site_admin can directly assign roles', async () => {
      const newUser = await createTestUser('newuser', 'user');
      
      const response = await request(app)
        .post('/api/roles/assign')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          user_id: newUser.id,
          role: 'admin',
          notes: 'Promoting to admin'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('admin');
      
      // Verify role was assigned
      const roleService = getRoleService();
      const roles = await roleService.getUserRoles(newUser.id);
      expect(roles).toContain('admin');
    });
    
    test('admin cannot directly assign admin role', async () => {
      const newUser = await createTestUser('newuser2', 'user');
      
      const response = await request(app)
        .post('/api/roles/assign')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          user_id: newUser.id,
          role: 'admin'
        });
      
      expect(response.status).toBe(403);
    });
    
    test('site_admin cannot be demoted', async () => {
      const response = await request(app)
        .post('/api/roles/promote')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          user_id: siteAdminId,
          to_role: 'admin',
          justification: 'Testing demotion'
        });
      
      expect(response.status).toBe(403);
    });
  });
  
  describe('Promotion Approval Workflow', () => {
    let promotionId;
    let targetUserId;
    
    beforeEach(async () => {
      const newUser = await createTestUser(`user_${Date.now()}`, 'user');
      targetUserId = newUser.id;
    });
    
    test('admin promotion requires multiple approvals', async () => {
      // First admin initiates promotion
      const initiateResponse = await request(app)
        .post('/api/roles/promote')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          user_id: targetUserId,
          to_role: 'admin',
          justification: 'User has demonstrated admin capabilities'
        });
      
      expect(initiateResponse.status).toBe(200);
      expect(initiateResponse.body.data.status).toBe('pending_approval');
      expect(initiateResponse.body.data.required_approvals).toBe(2);
      
      promotionId = initiateResponse.body.data.promotion_id;
      
      // First admin votes (initiator counts as first vote)
      // Second admin approves
      const approveResponse = await request(app)
        .post('/api/roles/approve-promotion')
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          promotion_id: promotionId,
          vote: 'approve',
          comments: 'Agree with promotion'
        });
      
      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('approved');
      
      // Verify role was changed
      const roleService = getRoleService();
      const roles = await roleService.getUserRoles(targetUserId);
      expect(roles).toContain('admin');
    });
    
    test('cannot vote twice on same promotion', async () => {
      // Create promotion
      const initiateResponse = await request(app)
        .post('/api/roles/promote')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          user_id: targetUserId,
          to_role: 'admin',
          justification: 'Testing double vote'
        });
      
      promotionId = initiateResponse.body.data.promotion_id;
      
      // First vote
      await request(app)
        .post('/api/roles/approve-promotion')
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          promotion_id: promotionId,
          vote: 'approve'
        });
      
      // Try to vote again
      const secondVoteResponse = await request(app)
        .post('/api/roles/approve-promotion')
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          promotion_id: promotionId,
          vote: 'approve'
        });
      
      expect(secondVoteResponse.status).toBe(400);
      expect(secondVoteResponse.body.message).toContain('already voted');
    });
    
    test('site_admin can bypass approval workflow', async () => {
      const response = await request(app)
        .post('/api/roles/promote')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          user_id: targetUserId,
          to_role: 'admin',
          justification: 'Immediate promotion by site admin'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.immediate).toBe(true);
      
      // Verify immediate role change
      const roleService = getRoleService();
      const roles = await roleService.getUserRoles(targetUserId);
      expect(roles).toContain('admin');
    });
  });
  
  describe('Permission Inheritance', () => {
    test('admin inherits user permissions', async () => {
      // Admin can access their own profile (user permission)
      const response = await request(app)
        .get(`/api/users/${adminId1}/profile`)
        .set('Authorization', `Bearer ${adminToken1}`);
      
      expect(response.status).toBe(200);
    });
    
    test('site_admin inherits all permissions', async () => {
      // Can access user routes
      const userResponse = await request(app)
        .get(`/api/users/${siteAdminId}/profile`)
        .set('Authorization', `Bearer ${siteAdminToken}`);
      
      expect(userResponse.status).toBe(200);
      
      // Can access admin routes
      const adminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${siteAdminToken}`);
      
      expect(adminResponse.status).toBe(200);
      
      // Can access site_admin routes
      const siteAdminResponse = await request(app)
        .post('/api/roles/assign')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          user_id: userId,
          role: 'user',
          notes: 'Test'
        });
      
      expect(siteAdminResponse.status).toBe(200);
    });
  });
  
  describe('Resource Ownership', () => {
    test('user can only access own resources', async () => {
      // Can access own profile
      const ownProfileResponse = await request(app)
        .get(`/api/users/${userId}/profile`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(ownProfileResponse.status).toBe(200);
      
      // Cannot access other user's profile
      const otherProfileResponse = await request(app)
        .get(`/api/users/${adminId1}/profile`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(otherProfileResponse.status).toBe(403);
    });
    
    test('admin can access all user resources', async () => {
      // Can access other user's profile
      const response = await request(app)
        .get(`/api/users/${userId}/profile`)
        .set('Authorization', `Bearer ${adminToken1}`);
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Audit Logging', () => {
    test('role changes are audit logged', async () => {
      const newUser = await createTestUser('audituser', 'user');
      
      await request(app)
        .post('/api/roles/assign')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          user_id: newUser.id,
          role: 'admin',
          notes: 'Audit test'
        });
      
      // Check audit log
      const auditLogs = await db.query(
        `SELECT * FROM pf_audit_log 
         WHERE event_name = 'role_assigned' 
         AND target_id = ?
         ORDER BY event_timestamp DESC`,
        [newUser.id]
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].actor_id).toBe(siteAdminId);
      expect(JSON.parse(auditLogs[0].new_values).role).toBe('admin');
    });
    
    test('failed authorization attempts are logged', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      // Check audit log
      const auditLogs = await db.query(
        `SELECT * FROM pf_audit_log 
         WHERE event_name = 'insufficient_permissions' 
         AND actor_id = ?
         ORDER BY event_timestamp DESC`,
        [userId]
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action_result).toBe('failure');
    });
  });
});