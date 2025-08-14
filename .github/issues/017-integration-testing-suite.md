---
name: Testing
about: Comprehensive integration testing suite
title: 'test: [Integration] Create comprehensive integration testing suite'
labels: testing, quality, priority:high, backend
assignees: ''

---

## 📋 Description
Develop a comprehensive integration testing suite that validates the complete authentication system, RBAC implementation, password security, and audit logging. Tests should cover all user flows, edge cases, security scenarios, and compliance requirements.

## 🎯 Acceptance Criteria
- [ ] Authentication flow tests (login, logout, refresh)
- [ ] RBAC permission tests for all role combinations
- [ ] Password lifecycle tests (creation, retrieval, reset, expiry)
- [ ] User deletion with cooling-off period tests
- [ ] Site admin provisioning tests
- [ ] Audit logging verification tests
- [ ] Configuration management tests
- [ ] Database transaction and rollback tests
- [ ] API versioning and backwards compatibility tests
- [ ] Performance and load tests
- [ ] Security vulnerability tests
- [ ] Compliance validation tests

## 🧪 Test Implementation

### Test Structure
```javascript
// backend/tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/database');
const { generateTestUsers } = require('../helpers/users');

describe('Authentication Integration Tests', () => {
  let testUsers;
  
  beforeAll(async () => {
    await setupTestDatabase();
    testUsers = await generateTestUsers();
  });
  
  afterAll(async () => {
    await cleanupTestDatabase();
  });
  
  describe('Registration Flow', () => {
    test('Admin can register new user without password', async () => {
      const admin = testUsers.admin;
      const adminToken = await loginAs(admin);
      
      const response = await request(app)
        .post('/api/v2/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@test.com',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.password_retrieval_token).toBeDefined();
      expect(response.body.data.password_retrieval_token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    });
    
    test('Rejects registration with password in request', async () => {
      const adminToken = await loginAs(testUsers.admin);
      
      const response = await request(app)
        .post('/api/v2/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'baduser',
          email: 'bad@test.com',
          password: 'should-not-work', // This should be rejected
          first_name: 'Bad',
          last_name: 'User'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
    });
    
    test('User cannot register other users', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(app)
        .post('/api/v2/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'unauthorized',
          email: 'unauthorized@test.com',
          first_name: 'Un',
          last_name: 'Authorized'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FORBIDDEN');
    });
  });
  
  describe('Password Retrieval', () => {
    test('Can retrieve password with valid token', async () => {
      const { retrievalToken } = await createUserWithToken();
      
      const response = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({
          retrieval_token: retrievalToken
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.temporary_password).toBeDefined();
      expect(response.body.data.temporary_password).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/);
      expect(response.body.data.must_change).toBe(true);
    });
    
    test('Token is single-use only', async () => {
      const { retrievalToken } = await createUserWithToken();
      
      // First retrieval succeeds
      const response1 = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({ retrieval_token: retrievalToken });
      
      expect(response1.status).toBe(200);
      
      // Second retrieval fails
      const response2 = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({ retrieval_token: retrievalToken });
      
      expect(response2.status).toBe(404);
      expect(response2.body.error).toBe('INVALID_TOKEN');
    });
    
    test('Token expires after configured time', async () => {
      const { retrievalToken } = await createUserWithToken();
      
      // Fast-forward time
      jest.advanceTimersByTime(61 * 60 * 1000); // 61 minutes
      
      const response = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({ retrieval_token: retrievalToken });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('INVALID_TOKEN');
    });
  });
  
  describe('Login with Client Hashing', () => {
    test('Successful login with hashed password', async () => {
      const { username, password } = await createUserWithPassword();
      const { hash, salt } = await hashPassword(password);
      
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username,
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refresh_token).toBeDefined();
      expect(response.body.data.expires_at).toBeDefined();
    });
    
    test('Rejects plain text password', async () => {
      const { username, password } = await createUserWithPassword();
      
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username,
          password: password // Plain text - should be rejected
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
      
      // Verify audit log captured this security event
      const auditLog = await getLatestAuditLog('plain_password_attempt');
      expect(auditLog).toBeDefined();
      expect(auditLog.event_severity).toBe('warning');
    });
    
    test('Forces password change for temporary password', async () => {
      const { username, tempPassword } = await createUserWithTempPassword();
      const { hash, salt } = await hashPassword(tempPassword);
      
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username,
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.must_change_password).toBe(true);
      expect(response.body.change_token).toBeDefined();
    });
  });
});

describe('RBAC Integration Tests', () => {
  describe('Role Hierarchy', () => {
    test('Site admin can perform all actions', async () => {
      const siteAdmin = await loginAs('site_admin');
      
      // Can create admin
      const createAdmin = await request(app)
        .post('/api/v2/auth/register')
        .set('Authorization', `Bearer ${siteAdmin}`)
        .send({ ...testUserData, role: 'admin' });
      expect(createAdmin.status).toBe(201);
      
      // Can delete user immediately
      const deleteUser = await request(app)
        .delete(`/api/v2/users/${testUsers.regularUser.id}`)
        .set('Authorization', `Bearer ${siteAdmin}`)
        .send({ 
          confirmation: 'DELETE',
          override_cooling_off: true 
        });
      expect(deleteUser.status).toBe(200);
      expect(deleteUser.body.data.immediate).toBe(true);
    });
    
    test('Admin cannot create another admin', async () => {
      const admin = await loginAs('admin');
      
      const response = await request(app)
        .post('/api/v2/auth/register')
        .set('Authorization', `Bearer ${admin}`)
        .send({ ...testUserData, role: 'admin' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PRIVILEGES');
    });
    
    test('User can only access own data', async () => {
      const user1 = await loginAs(testUsers.user1);
      const user2Id = testUsers.user2.id;
      
      // Cannot view other user
      const response = await request(app)
        .get(`/api/v2/users/${user2Id}`)
        .set('Authorization', `Bearer ${user1}`);
      
      expect(response.status).toBe(403);
      
      // Can view self
      const selfResponse = await request(app)
        .get(`/api/v2/users/${testUsers.user1.id}`)
        .set('Authorization', `Bearer ${user1}`);
      
      expect(selfResponse.status).toBe(200);
    });
  });
  
  describe('Approval Workflows', () => {
    test('Admin promotion requires multiple approvals', async () => {
      const admin1 = await loginAs(testUsers.admin1);
      const admin2 = await loginAs(testUsers.admin2);
      const userId = testUsers.regularUser.id;
      
      // First admin initiates promotion
      const initiate = await request(app)
        .put(`/api/v2/users/${userId}/role`)
        .set('Authorization', `Bearer ${admin1}`)
        .send({
          new_role: 'admin',
          reason: 'Promotion for good performance'
        });
      
      expect(initiate.status).toBe(200);
      expect(initiate.body.data.status).toBe('pending_approval');
      const approvalId = initiate.body.data.approval_id;
      
      // Second admin approves
      const approve = await request(app)
        .post(`/api/v2/approvals/${approvalId}/approve`)
        .set('Authorization', `Bearer ${admin2}`)
        .send({
          comments: 'Approved'
        });
      
      expect(approve.status).toBe(200);
      expect(approve.body.data.status).toBe('completed');
      
      // Verify role changed
      const user = await getUser(userId);
      expect(user.roles).toContain('admin');
    });
  });
});

describe('User Deletion with Cooling-Off', () => {
  test('Self-deletion triggers 7-day cooling period', async () => {
    const user = await createTestUser();
    const token = await loginAs(user);
    
    const response = await request(app)
      .delete(`/api/v2/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmation: 'DELETE',
        reason: 'No longer need account'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('scheduled');
    expect(response.body.data.cooling_off_days).toBe(7);
    
    const scheduledDate = new Date(response.body.data.scheduled_for);
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 7);
    
    expect(scheduledDate.getDate()).toBe(expectedDate.getDate());
  });
  
  test('Can cancel deletion during cooling-off', async () => {
    const { userId, cancellationToken } = await initiateDeletion();
    
    const response = await request(app)
      .post(`/api/v2/users/${userId}/cancel-deletion`)
      .send({
        cancellation_token: cancellationToken
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify user still exists and active
    const user = await getUser(userId);
    expect(user.account_status).toBe('active');
  });
  
  test('Reminders sent on schedule', async () => {
    const { userId } = await initiateDeletion();
    
    // Day 1 reminder
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    await processScheduledJobs();
    let emails = await getEmailsSentTo(userId);
    expect(emails).toContainEqual(
      expect.objectContaining({ type: 'deletion_reminder_day_1' })
    );
    
    // Day 3 reminder
    jest.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
    await processScheduledJobs();
    emails = await getEmailsSentTo(userId);
    expect(emails).toContainEqual(
      expect.objectContaining({ type: 'deletion_reminder_day_3' })
    );
    
    // Day 6 final warning
    jest.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);
    await processScheduledJobs();
    emails = await getEmailsSentTo(userId);
    expect(emails).toContainEqual(
      expect.objectContaining({ type: 'deletion_final_warning' })
    );
  });
});

describe('Audit Logging', () => {
  test('All security events are logged', async () => {
    // Failed login
    await request(app)
      .post('/api/v2/auth/login')
      .send({
        username: 'testuser',
        password_hash: 'wronghash',
        client_salt: 'salt'
      });
    
    const failedLogin = await getAuditLog({
      event_type: 'authentication',
      action_result: 'failure'
    });
    expect(failedLogin).toBeDefined();
    
    // Unauthorized access
    const userToken = await loginAs('user');
    await request(app)
      .post('/api/v2/auth/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send(testUserData);
    
    const unauthorized = await getAuditLog({
      event_type: 'authorization',
      event_name: 'access_denied'
    });
    expect(unauthorized).toBeDefined();
  });
  
  test('Audit logs are immutable', async () => {
    const logId = await createAuditLog(testEvent);
    
    // Attempt to modify
    const result = await db.query(
      'UPDATE pf_audit_log SET event_name = ? WHERE id = ?',
      ['modified', logId]
    );
    
    expect(result.rowsAffected).toBe(0); // Trigger prevents update
  });
  
  test('Hash chain maintains integrity', async () => {
    // Create sequential events
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push(await createAuditLog({
        event_type: 'test',
        event_name: `test_${i}`
      }));
    }
    
    // Verify chain
    for (let i = 1; i < events.length; i++) {
      const current = await getAuditLog(events[i]);
      const previous = await getAuditLog(events[i-1]);
      
      expect(current.previous_hash).toBe(previous.event_hash);
    }
  });
});

describe('Performance Tests', () => {
  test('Concurrent user registrations', async () => {
    const adminToken = await loginAs('admin');
    const promises = [];
    
    // Create 100 users concurrently
    for (let i = 0; i < 100; i++) {
      promises.push(
        request(app)
          .post('/api/v2/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: `user_${i}`,
            email: `user${i}@test.com`,
            first_name: 'Test',
            last_name: `User${i}`
          })
      );
    }
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.status === 201);
    
    expect(successful.length).toBeGreaterThan(95); // Allow some failures
  });
  
  test('Login performance under load', async () => {
    const users = await createTestUsers(50);
    const loginPromises = [];
    
    const startTime = Date.now();
    
    for (const user of users) {
      const { hash, salt } = await hashPassword(user.password);
      loginPromises.push(
        request(app)
          .post('/api/v2/auth/login')
          .send({
            username: user.username,
            password_hash: hash,
            client_salt: salt
          })
      );
    }
    
    await Promise.all(loginPromises);
    const duration = Date.now() - startTime;
    
    // Average login time should be < 200ms
    expect(duration / 50).toBeLessThan(200);
  });
});

describe('Security Tests', () => {
  test('SQL injection attempts are blocked', async () => {
    const attempts = [
      "admin' OR '1'='1",
      "'; DROP TABLE pf_users; --",
      "admin'/*",
      "' UNION SELECT * FROM pf_users --"
    ];
    
    for (const attempt of attempts) {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: attempt,
          password_hash: 'hash',
          client_salt: 'salt'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).not.toContain('SQL');
    }
  });
  
  test('Rate limiting prevents brute force', async () => {
    const responses = [];
    
    // Attempt 11 logins (limit is 10)
    for (let i = 0; i < 11; i++) {
      responses.push(
        await request(app)
          .post('/api/v2/auth/login')
          .send({
            username: 'testuser',
            password_hash: `wrong_${i}`,
            client_salt: 'salt'
          })
      );
    }
    
    // First 10 should be 401
    expect(responses.slice(0, 10).every(r => r.status === 401)).toBe(true);
    
    // 11th should be rate limited
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

### Compliance Tests
```javascript
// backend/tests/integration/compliance.test.js
describe('HIPAA Compliance', () => {
  test('PHI is encrypted at rest', async () => {
    const userId = await createUserWithPHI();
    
    // Query database directly
    const rawData = await db.query(
      'SELECT bio, medical_notes FROM pf_user_profiles WHERE user_id = ?',
      [userId]
    );
    
    // Verify data is encrypted (not readable)
    expect(rawData.bio).not.toContain('medical');
    expect(rawData.bio).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 encrypted
  });
  
  test('Audit trail for all PHI access', async () => {
    const userId = await createUserWithPHI();
    const token = await loginAs('admin');
    
    // Access PHI
    await request(app)
      .get(`/api/v2/users/${userId}/profile`)
      .set('Authorization', `Bearer ${token}`);
    
    // Verify audit log
    const audit = await getAuditLog({
      event_type: 'data_access',
      target_id: userId,
      data_sensitivity: 'restricted'
    });
    
    expect(audit).toBeDefined();
    expect(audit.actor_id).toBeDefined();
    expect(audit.ip_address).toBeDefined();
  });
});

describe('GDPR Compliance', () => {
  test('Right to erasure (deletion)', async () => {
    const userId = await createTestUser();
    
    // Request deletion
    await requestDeletion(userId);
    
    // Fast forward 7 days
    jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
    await processScheduledDeletions();
    
    // Verify complete deletion
    const user = await db.query(
      'SELECT * FROM pf_users WHERE id = ?',
      [userId]
    );
    expect(user).toBeNull();
    
    // Verify user-specific tables deleted
    const tables = await getUserTables(userId);
    expect(tables).toHaveLength(0);
  });
  
  test('Data portability (export)', async () => {
    const userId = await createTestUser();
    const token = await loginAs(userId);
    
    const response = await request(app)
      .get('/api/v2/users/me/export')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.format).toBe('json');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data).toHaveProperty('experiences');
    expect(response.body.data).toHaveProperty('skills');
  });
});
```

## 📊 Test Coverage Requirements
- Statement coverage: > 95%
- Branch coverage: > 90%
- Function coverage: > 95%
- Line coverage: > 95%

## 🔗 Dependencies
- Depends on: #8-#15 (All features implemented)
- Blocks: Production deployment

## 📈 Success Metrics
- All tests passing: 100%
- No critical security vulnerabilities
- Performance benchmarks met
- Compliance requirements validated

---

**Estimated Effort**: 13 story points
**Sprint**: 3 (API & Documentation)
**Target Completion**: Week 6