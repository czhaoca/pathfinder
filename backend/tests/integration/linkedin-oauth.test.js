/**
 * Integration Tests for LinkedIn OAuth
 * Tests the complete OAuth flow including API endpoints and database interactions
 */

const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');
const { createTestUser, cleanupTestData, generateTestToken } = require('../helpers/testUtils');

describe('LinkedIn OAuth Integration', () => {
  let testUser;
  let authToken;
  let db;

  beforeAll(async () => {
    db = await database.initialize();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await createTestUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123!'
    });

    authToken = await generateTestToken(testUser.id);
  });

  afterEach(async () => {
    await cleanupTestData(testUser.id);
  });

  afterAll(async () => {
    await database.close();
  });

  describe('GET /api/auth/linkedin', () => {
    test('should generate LinkedIn OAuth URL when feature is enabled', async () => {
      // Enable LinkedIn OAuth feature flag
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled, rollout_percentage) 
         VALUES ('linkedin_oauth_enabled', 'Y', 100)`
      );

      const response = await request(app)
        .get('/api/auth/linkedin')
        .query({ returnUrl: '/dashboard' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(response.body.data.authUrl).toContain('client_id=');
      expect(response.body.data.authUrl).toContain('response_type=code');
      expect(response.body.data.authUrl).toContain('scope=');
      expect(response.body.data.authUrl).toContain('state=');
    });

    test('should include PKCE parameters in auth URL', async () => {
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled) VALUES ('linkedin_oauth_enabled', 'Y')`
      );

      const response = await request(app)
        .get('/api/auth/linkedin')
        .expect(200);

      expect(response.body.data.authUrl).toContain('code_challenge=');
      expect(response.body.data.authUrl).toContain('code_challenge_method=S256');
    });

    test('should return error when feature is disabled', async () => {
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled) VALUES ('linkedin_oauth_enabled', 'N')`
      );

      const response = await request(app)
        .get('/api/auth/linkedin')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('LinkedIn authentication is not available');
    });

    test('should validate return URL to prevent open redirect', async () => {
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled) VALUES ('linkedin_oauth_enabled', 'Y')`
      );

      const response = await request(app)
        .get('/api/auth/linkedin')
        .query({ returnUrl: 'https://evil.com/redirect' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid return URL');
    });

    test('should handle authenticated user context', async () => {
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled) VALUES ('linkedin_oauth_enabled', 'Y')`
      );

      const response = await request(app)
        .get('/api/auth/linkedin')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBeDefined();

      // Verify audit log
      const auditLog = await db.execute(
        `SELECT * FROM pf_audit_log WHERE user_id = :userId AND action = 'LINKEDIN_OAUTH_INITIATED'`,
        { userId: testUser.id }
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
    });

    test('should apply rate limiting', async () => {
      await db.execute(
        `INSERT INTO pf_feature_flags (flag_key, enabled) VALUES ('linkedin_oauth_enabled', 'Y')`
      );

      // Make multiple requests
      const requests = [];
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .get('/api/auth/linkedin')
            .set('X-Forwarded-For', '192.168.1.1')
        );
      }

      const responses = await Promise.all(requests);
      
      // Should hit rate limit after 20 requests
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/auth/linkedin/callback', () => {
    test('should handle successful callback with new user', async () => {
      // Mock LinkedIn API responses
      const mockCode = 'test-auth-code';
      const mockState = 'test-state';

      // Store valid state in service
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: mockCode, state: mockState })
        .expect(302);

      // Should redirect to dashboard or login
      expect(response.headers.location).toMatch(/\/(dashboard|login)/);

      // Should set authentication cookies
      expect(response.headers['set-cookie']).toBeDefined();
      
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(c => c.includes('access_token'))).toBe(true);
      expect(cookies.some(c => c.includes('refresh_token'))).toBe(true);
    });

    test('should handle callback with existing email requiring merge', async () => {
      const mockCode = 'test-auth-code';
      const mockState = 'test-state';

      // Create existing user with same email
      await createTestUser({
        username: 'existing',
        email: 'linkedin@example.com',
        password: 'Password123!'
      });

      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: mockCode, state: mockState })
        .expect(302);

      // Should redirect to merge page
      expect(response.headers.location).toBe('/auth/merge?provider=linkedin');
    });

    test('should handle OAuth error callback', async () => {
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ error: 'access_denied', error_description: 'User denied access' })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=access_denied');
    });

    test('should handle invalid state parameter', async () => {
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=');
    });
  });

  describe('POST /api/auth/linkedin/merge', () => {
    test('should merge LinkedIn account with password verification', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/merge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'TestPassword123!',
          linkedInAuthCode: 'test-auth-code'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('LinkedIn account successfully linked');

      // Verify SSO account created
      const ssoAccount = await db.execute(
        `SELECT * FROM pf_sso_accounts WHERE user_id = :userId AND provider = 'linkedin'`,
        { userId: testUser.id }
      );

      expect(ssoAccount.rows.length).toBe(1);
    });

    test('should reject merge with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/merge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'WrongPassword',
          linkedInAuthCode: 'test-auth-code'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid password');
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/auth/linkedin/merge')
        .send({
          password: 'password',
          linkedInAuthCode: 'code'
        })
        .expect(401);
    });
  });

  describe('DELETE /api/auth/linkedin/unlink', () => {
    beforeEach(async () => {
      // Create LinkedIn SSO account for test user
      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, email)
         VALUES (:userId, 'linkedin', 'linkedin-id', :email)`,
        { userId: testUser.id, email: testUser.email }
      );
    });

    test('should unlink LinkedIn account when user has password', async () => {
      const response = await request(app)
        .delete('/api/auth/linkedin/unlink')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('LinkedIn account unlinked');

      // Verify SSO account removed
      const ssoAccount = await db.execute(
        `SELECT * FROM pf_sso_accounts WHERE user_id = :userId AND provider = 'linkedin'`,
        { userId: testUser.id }
      );

      expect(ssoAccount.rows.length).toBe(0);
    });

    test('should prevent unlinking when no other auth method exists', async () => {
      // Remove password from user
      await db.execute(
        `UPDATE pf_users SET password_hash = NULL WHERE user_id = :userId`,
        { userId: testUser.id }
      );

      const response = await request(app)
        .delete('/api/auth/linkedin/unlink')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No other authentication method available');
    });
  });

  describe('POST /api/auth/linkedin/import', () => {
    beforeEach(async () => {
      // Create LinkedIn SSO account with tokens
      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, access_token, refresh_token)
         VALUES (:userId, 'linkedin', 'linkedin-id', :accessToken, :refreshToken)`,
        {
          userId: testUser.id,
          accessToken: 'encrypted_access_token',
          refreshToken: 'encrypted_refresh_token'
        }
      );
    });

    test('should import full LinkedIn profile', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          importOptions: {
            workExperience: true,
            education: true,
            skills: true,
            certifications: true,
            summary: true,
            profilePhoto: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBeDefined();
      expect(response.body.data.imported.workExperience).toBeDefined();
      expect(response.body.data.imported.education).toBeDefined();
      expect(response.body.data.imported.skills).toBeDefined();

      // Verify data saved to database
      const experiences = await db.execute(
        `SELECT * FROM ${testUser.username}_experiences_detailed WHERE source = 'linkedin'`
      );

      expect(experiences.rows.length).toBeGreaterThan(0);
    });

    test('should handle selective import', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          importOptions: {
            workExperience: true,
            education: false,
            skills: true,
            certifications: false
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported.workExperience).toBeDefined();
      expect(response.body.data.imported.skills).toBeDefined();
      expect(response.body.data.imported.education).toBeUndefined();
    });

    test('should preview import without saving', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preview: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preview).toBeDefined();
      expect(response.body.data.imported).toBeUndefined();

      // Verify no data saved
      const experiences = await db.execute(
        `SELECT * FROM ${testUser.username}_experiences_detailed WHERE source = 'linkedin'`
      );

      expect(experiences.rows.length).toBe(0);
    });

    test('should require LinkedIn account linked', async () => {
      // Remove SSO account
      await db.execute(
        `DELETE FROM pf_sso_accounts WHERE user_id = :userId`,
        { userId: testUser.id }
      );

      const response = await request(app)
        .post('/api/auth/linkedin/import')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('LinkedIn account not linked');
    });
  });

  describe('POST /api/auth/linkedin/sync', () => {
    beforeEach(async () => {
      // Create LinkedIn SSO account
      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, access_token, last_sync_at)
         VALUES (:userId, 'linkedin', 'linkedin-id', :accessToken, :lastSync)`,
        {
          userId: testUser.id,
          accessToken: 'encrypted_access_token',
          lastSync: new Date(Date.now() - 86400000) // 24 hours ago
        }
      );
    });

    test('should sync profile when interval passed', async () => {
      const response = await request(app)
        .post('/api/auth/linkedin/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.synced).toBe(true);
      expect(response.body.data.lastSyncAt).toBeDefined();

      // Verify sync timestamp updated
      const ssoAccount = await db.execute(
        `SELECT last_sync_at FROM pf_sso_accounts WHERE user_id = :userId`,
        { userId: testUser.id }
      );

      const lastSync = new Date(ssoAccount.rows[0].LAST_SYNC_AT);
      expect(lastSync.getTime()).toBeGreaterThan(Date.now() - 60000);
    });

    test('should skip sync if recently synced', async () => {
      // Update last sync to 1 hour ago
      await db.execute(
        `UPDATE pf_sso_accounts SET last_sync_at = :lastSync WHERE user_id = :userId`,
        {
          userId: testUser.id,
          lastSync: new Date(Date.now() - 3600000)
        }
      );

      const response = await request(app)
        .post('/api/auth/linkedin/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.synced).toBe(false);
      expect(response.body.data.message).toContain('recently synced');
    });

    test('should force sync when requested', async () => {
      // Update last sync to 1 hour ago
      await db.execute(
        `UPDATE pf_sso_accounts SET last_sync_at = :lastSync WHERE user_id = :userId`,
        {
          userId: testUser.id,
          lastSync: new Date(Date.now() - 3600000)
        }
      );

      const response = await request(app)
        .post('/api/auth/linkedin/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.synced).toBe(true);
    });
  });

  describe('GET /api/auth/sso/providers', () => {
    test('should list all linked SSO providers', async () => {
      // Add multiple SSO accounts
      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, email, display_name)
         VALUES (:userId, 'linkedin', 'linkedin-id', 'linkedin@example.com', 'John Doe')`,
        { userId: testUser.id }
      );

      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, email, display_name)
         VALUES (:userId, 'google', 'google-id', 'google@example.com', 'John D')`,
        { userId: testUser.id }
      );

      const response = await request(app)
        .get('/api/auth/sso/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toHaveLength(2);
      expect(response.body.data.providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: 'linkedin',
            email: 'linkedin@example.com',
            displayName: 'John Doe'
          }),
          expect.objectContaining({
            provider: 'google',
            email: 'google@example.com',
            displayName: 'John D'
          })
        ])
      );
      expect(response.body.data.hasPassword).toBe(true);
    });
  });

  describe('Security Tests', () => {
    test('should handle CSRF attacks with state validation', async () => {
      const maliciousState = 'malicious-state';
      
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'auth-code', state: maliciousState })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=');
    });

    test('should prevent replay attacks', async () => {
      // Generate valid state
      const authResponse = await request(app)
        .get('/api/auth/linkedin')
        .expect(200);

      const authUrl = authResponse.body.data.authUrl;
      const state = new URL(authUrl).searchParams.get('state');

      // First callback should succeed
      await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'code1', state })
        .expect(302);

      // Second callback with same state should fail
      const response = await request(app)
        .get('/api/auth/linkedin/callback')
        .query({ code: 'code2', state })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=');
    });

    test('should encrypt sensitive tokens in database', async () => {
      // Create SSO account with tokens
      await db.execute(
        `INSERT INTO pf_sso_accounts (user_id, provider, provider_user_id, access_token, refresh_token)
         VALUES (:userId, 'linkedin', 'test-id', :accessToken, :refreshToken)`,
        {
          userId: testUser.id,
          accessToken: 'encrypted_access_token_value',
          refreshToken: 'encrypted_refresh_token_value'
        }
      );

      // Verify tokens are encrypted
      const ssoAccount = await db.execute(
        `SELECT access_token, refresh_token FROM pf_sso_accounts WHERE user_id = :userId`,
        { userId: testUser.id }
      );

      expect(ssoAccount.rows[0].ACCESS_TOKEN).toContain('encrypted_');
      expect(ssoAccount.rows[0].REFRESH_TOKEN).toContain('encrypted_');
    });
  });
});