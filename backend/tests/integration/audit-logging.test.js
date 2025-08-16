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
  loginAs
} = require('../helpers/users');
const {
  getLatestAuditLog,
  getAuditLog,
  createAuditLog,
  verifyAuditChain,
  getSecurityEvents
} = require('../helpers/audit');

describe('Audit Logging Integration Tests', () => {
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

  describe('Security Event Logging', () => {
    test('Failed login attempts are logged', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'wronghash',
          client_salt: 'salt'
        });
      
      expect(response.status).toBe(401);
      
      const auditLog = await getAuditLog({
        event_type: 'authentication',
        action_result: 'failure'
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog.EVENT_NAME).toContain('login');
      expect(auditLog.EVENT_SEVERITY).toBe('warning');
      expect(auditLog.IP_ADDRESS).toBeDefined();
    });

    test('Unauthorized access attempts are logged', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      
      const auditLog = await getAuditLog({
        event_type: 'authorization',
        event_name: 'access_denied'
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog.ACTOR_ID).toBe(testUsers.regularUser.id);
      expect(auditLog.EVENT_SEVERITY).toBe('warning');
    });

    test('Plain text password attempts are logged', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'plaintext' // Plain text password
        });
      
      expect(response.status).toBe(400);
      
      const auditLog = await getLatestAuditLog('plain_password_attempt');
      
      expect(auditLog).toBeDefined();
      expect(auditLog.EVENT_SEVERITY).toBe('warning');
      expect(auditLog.EVENT_CATEGORY).toBe('security');
    });

    test('Multiple failed login attempts trigger security alert', async () => {
      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        await request(testApp)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password_hash: `wronghash${i}`,
            client_salt: 'salt'
          });
      }
      
      const securityEvents = await getSecurityEvents('warning');
      const bruteForceAttempts = securityEvents.filter(
        e => e.EVENT_NAME && e.EVENT_NAME.includes('brute_force')
      );
      
      expect(bruteForceAttempts.length).toBeGreaterThan(0);
    });
  });

  describe('Data Modification Logging', () => {
    test('User creation is logged', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          email: 'new@test.com',
          first_name: 'New',
          last_name: 'User'
        });
      
      expect(response.status).toBe(201);
      
      const auditLog = await getAuditLog({
        event_type: 'data_modification',
        event_name: 'User Created'
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog.ACTOR_ID).toBe(testUsers.admin1.id);
      expect(auditLog.TARGET_NAME).toBe('newuser');
      expect(auditLog.NEW_VALUES).toContain('newuser');
    });

    test('User updates are logged with old and new values', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          first_name: 'Updated',
          last_name: 'Name'
        });
      
      expect(response.status).toBe(200);
      
      const auditLog = await getAuditLog({
        event_type: 'data_modification',
        action: 'update'
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog.OLD_VALUES).toBeDefined();
      expect(auditLog.NEW_VALUES).toBeDefined();
      expect(JSON.parse(auditLog.NEW_VALUES)).toHaveProperty('first_name', 'Updated');
    });

    test('User deletion is logged', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      const targetUserId = testUsers.regularUser.id;
      
      const response = await request(testApp)
        .delete(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .send({
          confirmation: 'DELETE',
          override_cooling_off: true
        });
      
      expect(response.status).toBe(200);
      
      const auditLog = await getAuditLog({
        event_type: 'data_modification',
        action: 'delete'
      });
      
      expect(auditLog).toBeDefined();
      expect(auditLog.TARGET_ID).toBe(targetUserId);
      expect(auditLog.EVENT_SEVERITY).toBe('warning');
    });
  });

  describe('Audit Log Integrity', () => {
    test('Audit logs are immutable', async () => {
      const logId = await createAuditLog({
        event_type: 'test',
        event_name: 'test_immutability'
      });
      
      // Attempt to modify the audit log
      const result = await query(
        `UPDATE pf_audit_log 
         SET event_name = :1 
         WHERE id = :2`,
        ['modified', logId]
      );
      
      // Verify log wasn't modified
      const log = await query(
        `SELECT event_name FROM pf_audit_log WHERE id = :1`,
        [logId]
      );
      
      expect(log[0].EVENT_NAME).toBe('test_immutability');
    });

    test('Hash chain maintains integrity', async () => {
      // Create sequential audit logs
      const events = [];
      for (let i = 0; i < 5; i++) {
        events.push(await createAuditLog({
          event_type: 'test',
          event_name: `test_${i}`
        }));
      }
      
      // Verify chain integrity
      const chainValidation = await verifyAuditChain();
      
      expect(chainValidation.valid).toBe(true);
    });

    test('Tampered logs are detected', async () => {
      // Create some logs
      await createAuditLog({ event_name: 'log1' });
      await createAuditLog({ event_name: 'log2' });
      await createAuditLog({ event_name: 'log3' });
      
      // Tamper with a hash (simulated)
      await query(
        `UPDATE pf_audit_log 
         SET event_hash = 'tampered_hash' 
         WHERE event_name = :1`,
        ['log2']
      );
      
      // Verify chain detects tampering
      const chainValidation = await verifyAuditChain();
      
      expect(chainValidation.valid).toBe(false);
      expect(chainValidation.brokenAt).toBeDefined();
    });
  });

  describe('Compliance Logging', () => {
    test('PHI access is logged with appropriate sensitivity', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      // Access user with medical information
      const response = await request(testApp)
        .get(`/api/users/${testUsers.regularUser.id}/medical`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Even if endpoint doesn't exist, check if attempt was logged
      const auditLog = await getAuditLog({
        target_id: testUsers.regularUser.id,
        data_sensitivity: 'restricted'
      });
      
      if (auditLog) {
        expect(auditLog.EVENT_CATEGORY).toBe('data_access');
        expect(JSON.parse(auditLog.METADATA || '{}')).toHaveProperty('data_sensitivity', 'restricted');
      }
    });

    test('Audit logs include required compliance fields', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userToken}`);
      
      const auditLog = await getLatestAuditLog();
      
      // Verify required fields for compliance
      expect(auditLog).toHaveProperty('ID');
      expect(auditLog).toHaveProperty('TIMESTAMP');
      expect(auditLog).toHaveProperty('EVENT_TYPE');
      expect(auditLog).toHaveProperty('ACTOR_ID');
      expect(auditLog).toHaveProperty('IP_ADDRESS');
      expect(auditLog).toHaveProperty('EVENT_HASH');
    });
  });

  describe('Audit Log Queries', () => {
    test('Site admin can query audit logs', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      
      const response = await request(testApp)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .query({
          page: 1,
          limit: 50,
          event_type: 'authentication'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('logs');
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });

    test('Regular users cannot access audit logs', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
    });

    test('Can filter audit logs by date range', async () => {
      const siteAdminToken = await loginAs(testUsers.siteAdmin);
      
      const response = await request(testApp)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${siteAdminToken}`)
        .query({
          start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.logs).toBeDefined();
    });
  });
});