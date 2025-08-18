/**
 * Integration Tests for Google OAuth API Endpoints
 * Tests the complete OAuth flow including authentication, account linking, and error scenarios
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

describe('Google OAuth Integration', () => {
  let app;
  let database;
  let googleOAuthService;
  let featureFlagService;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Setup test database
    database = await require('../helpers/database').setupTestDatabase();
    
    // Initialize services
    const container = require('../../src/container');
    await container.initialize(database);
    
    // Get app instance
    app = require('../../src/api/app');
    
    // Get services
    googleOAuthService = container.get('googleOAuthService');
    featureFlagService = container.get('featureFlagService');
    
    // Enable Google OAuth feature flag
    await featureFlagService.setFlag('google_oauth_enabled', true);
    await featureFlagService.setFlag('google_oauth_allow_signup', true);
    await featureFlagService.setFlag('google_oauth_auto_link', true);
  });

  beforeEach(async () => {
    // Clear test data
    await database.execute(`DELETE FROM pf_sso_accounts`);
    await database.execute(`DELETE FROM pf_user_sessions`);
    await database.execute(`DELETE FROM pf_users WHERE email LIKE '%@test.example.com'`);
    await database.commit();

    // Create test user
    testUser = {
      userId: uuidv4(),
      username: 'testuser',
      email: 'testuser@test.example.com',
      passwordHash: '$2b$10$test.hash'
    };
    
    await database.execute(`
      INSERT INTO pf_users (user_id, username, email, password_hash)
      VALUES (:userId, :username, :email, :passwordHash)
    `, testUser);
    await database.commit();

    // Generate auth token for authenticated requests
    authToken = jwt.sign(
      { userId: testUser.userId, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    await database.close();
  });

  describe('GET /api/auth/google', () => {
    it('should generate OAuth authorization URL', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .query({ returnUrl: '/dashboard' })
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toMatch(/^https:\/\/accounts\.google\.com/);
      expect(response.body.authUrl).toContain('client_id=');
      expect(response.body.authUrl).toContain('redirect_uri=');
      expect(response.body.authUrl).toContain('scope=');
      expect(response.body.authUrl).toContain('state=');
      expect(response.body.authUrl).toContain('code_challenge=');
    });

    it('should include user hint for authenticated users', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.authUrl).toContain('login_hint=');
    });

    it('should return 403 when feature flag is disabled', async () => {
      await featureFlagService.setFlag('google_oauth_enabled', false);

      const response = await request(app)
        .get('/api/auth/google')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Google authentication is not available');

      // Re-enable for other tests
      await featureFlagService.setFlag('google_oauth_enabled', true);
    });

    it('should validate returnUrl parameter', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .query({ returnUrl: 'javascript:alert(1)' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid return URL');
    });
  });

  describe('GET /api/auth/google/callback', () => {
    let validState;
    let validCode;

    beforeEach(async () => {
      // Generate valid state
      const authUrlResponse = await request(app)
        .get('/api/auth/google')
        .expect(200);

      // Extract state from URL
      const url = new URL(authUrlResponse.body.authUrl);
      validState = url.searchParams.get('state');
      validCode = 'valid-auth-code';

      // Mock Google token exchange
      jest.spyOn(googleOAuthService.client, 'getToken').mockResolvedValue({
        tokens: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expiry_date: Date.now() + 3600000
        }
      });

      // Mock Google user info
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'google-user-123',
          email: 'newuser@test.example.com',
          email_verified: true,
          given_name: 'New',
          family_name: 'User',
          picture: 'https://example.com/avatar.jpg'
        })
      });
    });

    it('should handle successful OAuth callback for new user', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: validState })
        .expect(302);

      // Should redirect to dashboard
      expect(response.headers.location).toBe('/dashboard');

      // Check cookies were set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some(c => c.startsWith('refresh_token='))).toBe(true);

      // Verify user was created
      const result = await database.execute(`
        SELECT * FROM pf_users WHERE email = 'newuser@test.example.com'
      `);
      expect(result.rows).toHaveLength(1);

      // Verify SSO account was created
      const ssoResult = await database.execute(`
        SELECT * FROM pf_sso_accounts 
        WHERE provider = 'google' AND provider_user_id = 'google-user-123'
      `);
      expect(ssoResult.rows).toHaveLength(1);
    });

    it('should handle callback for existing SSO user', async () => {
      // Create existing SSO account
      await database.execute(`
        INSERT INTO pf_sso_accounts (
          sso_account_id, user_id, provider, provider_user_id, email
        ) VALUES (
          :ssoId, :userId, 'google', 'google-user-123', :email
        )
      `, {
        ssoId: uuidv4(),
        userId: testUser.userId,
        email: testUser.email
      });
      await database.commit();

      // Mock user info with existing email
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'google-user-123',
          email: testUser.email,
          email_verified: true
        })
      });

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: validState })
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');

      // Verify tokens were updated
      const ssoResult = await database.execute(`
        SELECT access_token, refresh_token FROM pf_sso_accounts 
        WHERE provider = 'google' AND user_id = :userId
      `, { userId: testUser.userId });
      
      expect(ssoResult.rows[0].ACCESS_TOKEN).toBeDefined();
      expect(ssoResult.rows[0].REFRESH_TOKEN).toBeDefined();
    });

    it('should auto-link accounts when enabled', async () => {
      // Mock user info with existing email
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'google-new-id',
          email: testUser.email,
          email_verified: true
        })
      });

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: validState })
        .expect(302);

      // Verify SSO account was linked to existing user
      const ssoResult = await database.execute(`
        SELECT * FROM pf_sso_accounts 
        WHERE user_id = :userId AND provider = 'google'
      `, { userId: testUser.userId });
      
      expect(ssoResult.rows).toHaveLength(1);
      expect(ssoResult.rows[0].PROVIDER_USER_ID).toBe('google-new-id');
    });

    it('should redirect to merge page when auto-link is disabled', async () => {
      await featureFlagService.setFlag('google_oauth_auto_link', false);

      // Mock user info with existing email
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'google-new-id',
          email: testUser.email,
          email_verified: true
        })
      });

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: validState })
        .expect(302);

      expect(response.headers.location).toBe('/auth/merge?provider=google');

      // Re-enable for other tests
      await featureFlagService.setFlag('google_oauth_auto_link', true);
    });

    it('should handle OAuth errors', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' })
        .expect(302);

      expect(response.headers.location).toBe('/login?error=access_denied');
    });

    it('should reject invalid state parameter', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: 'invalid-state' })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=');
    });

    it('should reject when signup is disabled for new users', async () => {
      await featureFlagService.setFlag('google_oauth_allow_signup', false);

      const response = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: validCode, state: validState })
        .expect(302);

      expect(response.headers.location).toContain('/login?error=');

      // Re-enable for other tests
      await featureFlagService.setFlag('google_oauth_allow_signup', true);
    });
  });

  describe('POST /api/auth/google/merge', () => {
    let googleAuthCode;
    let mockGoogleUser;

    beforeEach(async () => {
      googleAuthCode = 'merge-auth-code';
      mockGoogleUser = {
        id: 'google-merge-123',
        email: testUser.email,
        given_name: 'Test',
        family_name: 'User'
      };

      // Mock exchange code
      jest.spyOn(googleOAuthService, 'exchangeCode').mockResolvedValue({
        user: mockGoogleUser,
        tokens: {
          access_token: 'merge-access-token',
          refresh_token: 'merge-refresh-token'
        }
      });

      // Mock password verification
      jest.spyOn(googleOAuthService.userService, 'verifyPassword')
        .mockResolvedValue(true);
    });

    it('should merge accounts with valid password', async () => {
      const response = await request(app)
        .post('/api/auth/google/merge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'ValidPassword123!',
          googleAuthCode
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Google account successfully linked'
      });

      // Verify SSO account was created
      const ssoResult = await database.execute(`
        SELECT * FROM pf_sso_accounts 
        WHERE user_id = :userId AND provider = 'google'
      `, { userId: testUser.userId });
      
      expect(ssoResult.rows).toHaveLength(1);
    });

    it('should reject merge with invalid password', async () => {
      jest.spyOn(googleOAuthService.userService, 'verifyPassword')
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/google/merge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'WrongPassword',
          googleAuthCode
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid password');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/auth/google/merge')
        .send({
          password: 'password',
          googleAuthCode
        })
        .expect(401);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/auth/google/merge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveProperty('password');
      expect(response.body.errors).toHaveProperty('googleAuthCode');
    });
  });

  describe('DELETE /api/auth/google/unlink', () => {
    beforeEach(async () => {
      // Create SSO account for test user
      await database.execute(`
        INSERT INTO pf_sso_accounts (
          sso_account_id, user_id, provider, provider_user_id
        ) VALUES (
          :ssoId, :userId, 'google', 'google-unlink-123'
        )
      `, {
        ssoId: uuidv4(),
        userId: testUser.userId
      });
      await database.commit();
    });

    it('should unlink Google account when user has password', async () => {
      const response = await request(app)
        .delete('/api/auth/google/unlink')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Google account unlinked'
      });

      // Verify SSO account was removed
      const ssoResult = await database.execute(`
        SELECT * FROM pf_sso_accounts 
        WHERE user_id = :userId AND provider = 'google'
      `, { userId: testUser.userId });
      
      expect(ssoResult.rows).toHaveLength(0);
    });

    it('should prevent unlinking when no other auth method', async () => {
      // Remove password from user
      await database.execute(`
        UPDATE pf_users 
        SET password_hash = NULL 
        WHERE user_id = :userId
      `, { userId: testUser.userId });
      await database.commit();

      const response = await request(app)
        .delete('/api/auth/google/unlink')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No other authentication method');
    });

    it('should allow unlinking when user has other SSO provider', async () => {
      // Remove password but add another SSO provider
      await database.execute(`
        UPDATE pf_users 
        SET password_hash = NULL 
        WHERE user_id = :userId
      `, { userId: testUser.userId });
      
      await database.execute(`
        INSERT INTO pf_sso_accounts (
          sso_account_id, user_id, provider, provider_user_id
        ) VALUES (
          :ssoId, :userId, 'github', 'github-123'
        )
      `, {
        ssoId: uuidv4(),
        userId: testUser.userId
      });
      await database.commit();

      const response = await request(app)
        .delete('/api/auth/google/unlink')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/auth/google/unlink')
        .expect(401);
    });
  });

  describe('Security Tests', () => {
    describe('CSRF Protection', () => {
      it('should validate CSRF token on state callback', async () => {
        // Generate state without CSRF token
        const maliciousState = 'malicious-state';
        
        const response = await request(app)
          .get('/api/auth/google/callback')
          .query({ code: 'code', state: maliciousState })
          .expect(302);

        expect(response.headers.location).toContain('/login?error=');
      });
    });

    describe('Rate Limiting', () => {
      it('should rate limit OAuth initiation attempts', async () => {
        // Make multiple requests
        for (let i = 0; i < 10; i++) {
          await request(app)
            .get('/api/auth/google')
            .expect(200);
        }

        // Next request should be rate limited
        const response = await request(app)
          .get('/api/auth/google')
          .expect(429);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Too many requests');
      });

      it('should rate limit callback attempts per IP', async () => {
        // Make multiple failed callback attempts
        for (let i = 0; i < 5; i++) {
          await request(app)
            .get('/api/auth/google/callback')
            .query({ code: 'bad-code', state: 'bad-state' })
            .expect(302);
        }

        // Next request should be rate limited
        const response = await request(app)
          .get('/api/auth/google/callback')
          .query({ code: 'code', state: 'state' })
          .expect(429);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('Token Security', () => {
      it('should encrypt OAuth tokens in database', async () => {
        // Complete OAuth flow
        const authUrlResponse = await request(app)
          .get('/api/auth/google')
          .expect(200);

        const url = new URL(authUrlResponse.body.authUrl);
        const state = url.searchParams.get('state');

        // Mock successful OAuth
        jest.spyOn(googleOAuthService.client, 'getToken').mockResolvedValue({
          tokens: {
            access_token: 'plain-access-token',
            refresh_token: 'plain-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        });

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 'google-secure-123',
            email: 'secure@test.example.com',
            email_verified: true
          })
        });

        await request(app)
          .get('/api/auth/google/callback')
          .query({ code: 'secure-code', state })
          .expect(302);

        // Check tokens in database are encrypted
        const ssoResult = await database.execute(`
          SELECT access_token, refresh_token FROM pf_sso_accounts 
          WHERE provider_user_id = 'google-secure-123'
        `);

        const storedTokens = ssoResult.rows[0];
        expect(storedTokens.ACCESS_TOKEN).not.toBe('plain-access-token');
        expect(storedTokens.REFRESH_TOKEN).not.toBe('plain-refresh-token');
        
        // Tokens should be encrypted (check for encryption pattern)
        expect(storedTokens.ACCESS_TOKEN).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
        expect(storedTokens.REFRESH_TOKEN).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      });
    });

    describe('Audit Logging', () => {
      it('should log all OAuth events', async () => {
        // Clear audit log
        await database.execute(`DELETE FROM pf_audit_log`);
        await database.commit();

        // Generate auth URL
        await request(app)
          .get('/api/auth/google')
          .expect(200);

        // Check audit log
        const auditResult = await database.execute(`
          SELECT action FROM pf_audit_log ORDER BY created_at DESC
        `);

        expect(auditResult.rows.some(r => 
          r.ACTION === 'GOOGLE_OAUTH_INITIATED'
        )).toBe(true);
      });

      it('should log failed authentication attempts', async () => {
        await request(app)
          .get('/api/auth/google/callback')
          .query({ code: 'bad-code', state: 'bad-state' })
          .expect(302);

        const auditResult = await database.execute(`
          SELECT action, status FROM pf_audit_log 
          WHERE action = 'GOOGLE_OAUTH_FAILED'
          ORDER BY created_at DESC
        `);

        expect(auditResult.rows).toHaveLength(1);
        expect(auditResult.rows[0].STATUS).toBe('error');
      });
    });
  });
});