/**
 * Unit Tests for Google OAuth Service
 * Tests OAuth flow, account provisioning, linking, and security measures
 */

const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

describe('GoogleOAuthService', () => {
  let googleOAuthService;
  let mockConfig;
  let mockUserService;
  let mockSsoService;
  let mockAuditService;
  let mockOAuth2Client;
  let mockDatabase;
  let mockLogger;
  let mockEncryptionService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3001/api/auth/google/callback',
        scopes: ['openid', 'profile', 'email'],
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        useStateParameter: true,
        usePKCE: true,
        stateExpiration: 600,
        enabled: true,
        allowSignup: true,
        requireEmailVerification: false,
        autoLinkAccounts: true
      }
    };

    // Mock user service
    mockUserService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      usernameExists: jest.fn(),
      hasPassword: jest.fn(),
      verifyPassword: jest.fn(),
      updateProfileFromGoogle: jest.fn()
    };

    // Mock SSO service
    mockSsoService = {
      findByProvider: jest.fn(),
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
      updateTokens: jest.fn(),
      removeProvider: jest.fn(),
      getOtherProviders: jest.fn()
    };

    // Mock audit service
    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined)
    };

    // Mock database
    mockDatabase = {
      execute: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      getConnection: jest.fn().mockReturnValue({
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      })
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn().mockImplementation((data) => `encrypted_${data}`),
      decrypt: jest.fn().mockImplementation((data) => data.replace('encrypted_', ''))
    };

    // Mock OAuth2Client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      refreshAccessToken: jest.fn()
    };

    // Mock the OAuth2Client constructor
    jest.mock('google-auth-library', () => ({
      OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client)
    }));

    // Mock the logger module
    jest.mock('../../../src/utils/logger', () => ({
      logger: mockLogger
    }));

    // Import and instantiate the service after mocking
    const GoogleOAuthService = require('../../../src/services/googleOAuthService');
    googleOAuthService = new GoogleOAuthService(
      mockConfig,
      mockUserService,
      mockSsoService,
      mockAuditService,
      mockDatabase,
      mockEncryptionService
    );
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('generateAuthUrl', () => {
    it('should generate valid OAuth URL with PKCE', async () => {
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?params';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const authUrl = await googleOAuthService.generateAuthUrl(null, '/dashboard');

      expect(authUrl).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          scope: mockConfig.google.scopes,
          state: expect.any(String),
          code_challenge: expect.any(String),
          code_challenge_method: 'S256',
          prompt: 'consent'
        })
      );
    });

    it('should throw error when OAuth is disabled', async () => {
      googleOAuthService.config.enabled = false;

      await expect(googleOAuthService.generateAuthUrl())
        .rejects
        .toThrow('Google OAuth is not enabled');
    });

    it('should store state with correct metadata', async () => {
      const userId = 'user-123';
      const returnUrl = '/profile';

      await googleOAuthService.generateAuthUrl(userId, returnUrl);

      // Check that state was stored
      const state = Array.from(googleOAuthService.stateStore.keys())[0];
      const stateData = googleOAuthService.stateStore.get(state);

      expect(stateData).toMatchObject({
        userId,
        returnUrl,
        codeVerifier: expect.any(String),
        createdAt: expect.any(Number),
        expires: expect.any(Number)
      });
    });

    it('should use select_account prompt for existing users', async () => {
      const userId = 'user-123';
      mockUserService.findById.mockResolvedValue({ email: 'user@example.com' });

      await googleOAuthService.generateAuthUrl(userId, '/');

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'select_account',
          login_hint: 'user@example.com'
        })
      );
    });
  });

  describe('handleCallback', () => {
    const validState = 'valid-state-123';
    const validCode = 'auth-code-456';
    const mockTokens = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expiry_date: Date.now() + 3600000
    };
    const mockGoogleUser = {
      id: 'google-123',
      email: 'user@example.com',
      email_verified: true,
      given_name: 'John',
      family_name: 'Doe',
      name: 'John Doe',
      picture: 'https://example.com/avatar.jpg'
    };

    beforeEach(() => {
      // Setup valid state
      googleOAuthService.stateStore.set(validState, {
        userId: null,
        returnUrl: '/dashboard',
        codeVerifier: 'test-verifier',
        createdAt: Date.now(),
        expires: Date.now() + 600000
      });

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      
      // Mock fetch for getUserInfo
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGoogleUser
      });
    });

    it('should successfully handle callback for new user', async () => {
      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.usernameExists.mockResolvedValue(false);
      
      const newUser = {
        id: 'new-user-id',
        username: 'johndoe',
        email: mockGoogleUser.email,
        firstName: mockGoogleUser.given_name,
        lastName: mockGoogleUser.family_name
      };
      mockUserService.create.mockResolvedValue(newUser);
      
      const ssoAccount = {
        id: 'sso-id',
        userId: newUser.id,
        provider: 'google',
        providerUserId: mockGoogleUser.id
      };
      mockSsoService.create.mockResolvedValue(ssoAccount);

      const result = await googleOAuthService.handleCallback(validCode, validState);

      expect(result).toMatchObject({
        user: newUser,
        isNewUser: true,
        ssoAccount,
        returnUrl: '/dashboard'
      });
      expect(mockUserService.create).toHaveBeenCalled();
      expect(mockSsoService.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: newUser.id,
          action: 'GOOGLE_OAUTH_LOGIN',
          resourceType: 'authentication'
        })
      );
    });

    it('should handle callback for existing SSO user', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: mockGoogleUser.email
      };
      const existingSsoAccount = {
        id: 'sso-id',
        userId: existingUser.id,
        provider: 'google',
        providerUserId: mockGoogleUser.id
      };

      mockSsoService.findByProvider.mockResolvedValue(existingSsoAccount);
      mockUserService.findById.mockResolvedValue(existingUser);

      const result = await googleOAuthService.handleCallback(validCode, validState);

      expect(result).toMatchObject({
        user: existingUser,
        isNewUser: false,
        ssoAccount: existingSsoAccount
      });
      expect(mockSsoService.updateTokens).toHaveBeenCalledWith(
        existingSsoAccount.id,
        mockTokens.access_token,
        mockTokens.refresh_token,
        mockTokens.expiry_date
      );
    });

    it('should auto-link accounts when enabled', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: mockGoogleUser.email
      };

      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(existingUser);
      
      const ssoAccount = {
        id: 'sso-id',
        userId: existingUser.id
      };
      mockSsoService.create.mockResolvedValue(ssoAccount);

      const result = await googleOAuthService.handleCallback(validCode, validState);

      expect(result).toMatchObject({
        user: existingUser,
        isNewUser: false,
        ssoAccount,
        accountLinked: true
      });
    });

    it('should require manual merge when auto-link is disabled', async () => {
      googleOAuthService.config.autoLinkAccounts = false;
      
      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue({
        id: 'existing-user-id',
        email: mockGoogleUser.email
      });

      await expect(googleOAuthService.handleCallback(validCode, validState))
        .rejects
        .toThrow('ACCOUNT_EXISTS_REQUIRES_MERGE');
    });

    it('should reject invalid state parameter', async () => {
      await expect(googleOAuthService.handleCallback(validCode, 'invalid-state'))
        .rejects
        .toThrow('Invalid state parameter');
    });

    it('should reject expired state parameter', async () => {
      const expiredState = 'expired-state';
      googleOAuthService.stateStore.set(expiredState, {
        userId: null,
        returnUrl: '/',
        codeVerifier: 'verifier',
        createdAt: Date.now() - 700000,
        expires: Date.now() - 100000
      });

      await expect(googleOAuthService.handleCallback(validCode, expiredState))
        .rejects
        .toThrow('State parameter expired');
    });

    it('should reject signup when disabled', async () => {
      googleOAuthService.config.allowSignup = false;
      
      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(googleOAuthService.handleCallback(validCode, validState))
        .rejects
        .toThrow('Sign up with Google is not allowed');
    });
  });

  describe('mergeAccounts', () => {
    const existingUserId = 'user-123';
    const password = 'TestPassword123!';
    const mockGoogleUser = {
      id: 'google-456',
      email: 'user@example.com',
      given_name: 'John',
      family_name: 'Doe'
    };
    const mockTokens = {
      access_token: 'access-token',
      refresh_token: 'refresh-token'
    };

    it('should merge accounts with valid password', async () => {
      mockUserService.verifyPassword.mockResolvedValue(true);
      mockUserService.findById.mockResolvedValue({ id: existingUserId });
      
      const ssoAccount = { id: 'sso-id', userId: existingUserId };
      mockSsoService.create.mockResolvedValue(ssoAccount);

      const result = await googleOAuthService.mergeAccounts(
        existingUserId,
        password,
        mockGoogleUser,
        mockTokens
      );

      expect(result).toMatchObject({
        user: { id: existingUserId },
        ssoAccount,
        merged: true
      });
      expect(mockUserService.verifyPassword).toHaveBeenCalledWith(existingUserId, password);
      expect(mockUserService.updateProfileFromGoogle).toHaveBeenCalledWith(
        existingUserId,
        mockGoogleUser
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOOGLE_ACCOUNT_MERGED'
        })
      );
    });

    it('should reject merge with invalid password', async () => {
      mockUserService.verifyPassword.mockResolvedValue(false);

      await expect(
        googleOAuthService.mergeAccounts(existingUserId, 'wrong-password', mockGoogleUser, mockTokens)
      ).rejects.toThrow('Invalid password');

      expect(mockSsoService.create).not.toHaveBeenCalled();
    });
  });

  describe('unlinkGoogleAccount', () => {
    const userId = 'user-123';

    it('should unlink Google account when user has password', async () => {
      mockUserService.hasPassword.mockResolvedValue(true);
      mockSsoService.getOtherProviders.mockResolvedValue([]);
      mockSsoService.removeProvider.mockResolvedValue(true);

      const result = await googleOAuthService.unlinkGoogleAccount(userId);

      expect(result).toEqual({ success: true });
      expect(mockSsoService.removeProvider).toHaveBeenCalledWith(userId, 'google');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOOGLE_ACCOUNT_UNLINKED'
        })
      );
    });

    it('should unlink when user has other SSO providers', async () => {
      mockUserService.hasPassword.mockResolvedValue(false);
      mockSsoService.getOtherProviders.mockResolvedValue([
        { provider: 'github' }
      ]);
      mockSsoService.removeProvider.mockResolvedValue(true);

      const result = await googleOAuthService.unlinkGoogleAccount(userId);

      expect(result).toEqual({ success: true });
    });

    it('should prevent unlinking when no other auth methods', async () => {
      mockUserService.hasPassword.mockResolvedValue(false);
      mockSsoService.getOtherProviders.mockResolvedValue([]);

      await expect(googleOAuthService.unlinkGoogleAccount(userId))
        .rejects
        .toThrow('Cannot unlink: No other authentication method available');

      expect(mockSsoService.removeProvider).not.toHaveBeenCalled();
    });
  });

  describe('createUserFromGoogle', () => {
    const mockGoogleUser = {
      id: 'google-123',
      email: 'john.doe@example.com',
      email_verified: true,
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://example.com/avatar.jpg'
    };

    it('should create user with unique username', async () => {
      mockUserService.usernameExists
        .mockResolvedValueOnce(true)  // johndoe exists
        .mockResolvedValueOnce(true)  // johndoe1 exists
        .mockResolvedValueOnce(false); // johndoe2 available

      const expectedUser = {
        username: 'johndoe2',
        email: mockGoogleUser.email,
        emailVerified: true,
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: mockGoogleUser.picture
      };

      mockUserService.create.mockResolvedValue(expectedUser);

      const result = await googleOAuthService.createUserFromGoogle(mockGoogleUser);

      expect(result).toEqual(expectedUser);
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'johndoe2',
          email: mockGoogleUser.email,
          emailVerified: true,
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: mockGoogleUser.picture,
          source: 'google_oauth',
          password: expect.any(String)
        }),
        undefined
      );
    });

    it('should sanitize username from email', async () => {
      const googleUser = {
        ...mockGoogleUser,
        email: 'test.user+123@example.com'
      };

      mockUserService.usernameExists.mockResolvedValue(false);
      mockUserService.create.mockResolvedValue({ username: 'testuser123' });

      await googleOAuthService.createUserFromGoogle(googleUser);

      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser123',
          password: expect.any(String)
        }),
        undefined
      );
    });
  });

  describe('refreshAccessToken', () => {
    const userId = 'user-123';
    const refreshToken = 'refresh-token';

    it('should refresh access token successfully', async () => {
      const ssoAccount = {
        id: 'sso-id',
        refreshToken
      };
      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 3600000
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ tokens: newTokens });

      const result = await googleOAuthService.refreshAccessToken(userId);

      expect(result).toBe(newTokens.access_token);
      expect(mockSsoService.updateTokens).toHaveBeenCalledWith(
        ssoAccount.id,
        newTokens.access_token,
        newTokens.refresh_token,
        newTokens.expiry_date
      );
    });

    it('should throw error when no refresh token available', async () => {
      mockSsoService.findByUserAndProvider.mockResolvedValue(null);

      await expect(googleOAuthService.refreshAccessToken(userId))
        .rejects
        .toThrow('No refresh token available');
    });
  });

  describe('Security Features', () => {
    describe('PKCE Implementation', () => {
      it('should generate valid PKCE challenge', async () => {
        await googleOAuthService.generateAuthUrl();

        const state = Array.from(googleOAuthService.stateStore.keys())[0];
        const stateData = googleOAuthService.stateStore.get(state);

        // Verify code verifier format (base64url)
        expect(stateData.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);

        // Verify code challenge was generated
        const callArgs = mockOAuth2Client.generateAuthUrl.mock.calls[0][0];
        expect(callArgs.code_challenge).toBeDefined();
        expect(callArgs.code_challenge_method).toBe('S256');
      });

      it('should validate PKCE during callback', async () => {
        const state = 'test-state';
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        
        googleOAuthService.stateStore.set(state, {
          codeVerifier,
          expires: Date.now() + 600000
        });

        mockOAuth2Client.getToken.mockResolvedValue({
          tokens: { access_token: 'token' }
        });
        
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'google-123', email: 'test@example.com' })
        });

        await googleOAuthService.handleCallback('code', state);

        expect(mockOAuth2Client.getToken).toHaveBeenCalledWith({
          code: 'code',
          codeVerifier
        });
      });
    });

    describe('State Parameter Security', () => {
      it('should generate cryptographically secure state', async () => {
        const states = new Set();
        
        // Generate multiple states
        for (let i = 0; i < 10; i++) {
          await googleOAuthService.generateAuthUrl();
          const state = Array.from(googleOAuthService.stateStore.keys())[i];
          states.add(state);
        }

        // All states should be unique
        expect(states.size).toBe(10);

        // States should be of sufficient length (64 hex chars = 32 bytes)
        states.forEach(state => {
          expect(state).toMatch(/^[a-f0-9]{64}$/);
        });
      });

      it('should clean up expired states', async () => {
        // Add expired state
        const expiredState = 'expired';
        googleOAuthService.stateStore.set(expiredState, {
          expires: Date.now() - 1000
        });

        // Add valid state
        const validState = 'valid';
        googleOAuthService.stateStore.set(validState, {
          expires: Date.now() + 600000
        });

        await googleOAuthService.cleanupExpiredStates();

        expect(googleOAuthService.stateStore.has(expiredState)).toBe(false);
        expect(googleOAuthService.stateStore.has(validState)).toBe(true);
      });
    });

    describe('Token Encryption', () => {
      it('should encrypt tokens before storage', async () => {
        const tokens = {
          access_token: 'plain-access-token',
          refresh_token: 'plain-refresh-token'
        };

        const encryptSpy = jest.spyOn(googleOAuthService, 'encryptToken');
        
        await googleOAuthService.storeTokens('user-id', tokens);

        expect(encryptSpy).toHaveBeenCalledWith('plain-access-token');
        expect(encryptSpy).toHaveBeenCalledWith('plain-refresh-token');
      });

      it('should decrypt tokens when retrieving', async () => {
        const encryptedTokens = {
          access_token: 'encrypted-access',
          refresh_token: 'encrypted-refresh'
        };

        mockSsoService.findByUserAndProvider.mockResolvedValue(encryptedTokens);
        
        const decryptSpy = jest.spyOn(googleOAuthService, 'decryptToken');
        
        await googleOAuthService.getTokens('user-id');

        expect(decryptSpy).toHaveBeenCalledWith('encrypted-access');
        expect(decryptSpy).toHaveBeenCalledWith('encrypted-refresh');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle OAuth provider errors gracefully', async () => {
      const state = 'valid-state';
      googleOAuthService.stateStore.set(state, {
        expires: Date.now() + 600000
      });

      mockOAuth2Client.getToken.mockRejectedValue(new Error('invalid_grant'));

      await expect(googleOAuthService.handleCallback('bad-code', state))
        .rejects
        .toThrow('Authentication failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Google OAuth callback error',
        expect.objectContaining({
          error: expect.any(Error),
          state
        })
      );
    });

    it('should handle network errors when fetching user info', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(googleOAuthService.getUserInfo('token'))
        .rejects
        .toThrow('Failed to fetch user info');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get Google user info',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });

    it('should handle database errors during account creation', async () => {
      const state = 'valid-state';
      googleOAuthService.stateStore.set(state, {
        expires: Date.now() + 600000
      });

      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: { access_token: 'token' }
      });
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'google-123', email: 'test@example.com' })
      });

      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockRejectedValue(new Error('Database error'));

      await expect(googleOAuthService.handleCallback('code', state))
        .rejects
        .toThrow('Authentication failed');
    });
  });
});