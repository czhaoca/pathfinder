/**
 * Unit Tests for LinkedIn OAuth Service
 * Tests OAuth 2.0 flow, profile import, and account management
 */

const LinkedInOAuthService = require('../../../src/services/linkedInOAuthService');
const { AuthenticationError, ValidationError, ConflictError } = require('../../../src/utils/errors');

describe('LinkedInOAuthService', () => {
  let service;
  let mockConfig;
  let mockUserService;
  let mockSsoService;
  let mockAuditService;
  let mockDatabase;
  let mockEncryptionService;
  let mockLinkedInClient;
  let mockProfileImportService;
  let mockFeatureFlagService;

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      linkedin: {
        enabled: true,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/auth/linkedin/callback',
        scopes: ['openid', 'profile', 'email', 'w_member_social'],
        userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
        profileUrl: 'https://api.linkedin.com/v2/me',
        stateExpiration: 300,
        allowSignup: true,
        autoLinkAccounts: false,
        syncInterval: 86400000, // 24 hours
        importFields: {
          workExperience: true,
          education: true,
          skills: true,
          certifications: true,
          summary: true,
          profilePhoto: true,
          location: true,
          industry: true
        }
      }
    };

    // Mock user service
    mockUserService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      usernameExists: jest.fn(),
      verifyPassword: jest.fn(),
      hasPassword: jest.fn(),
      updateProfileFromLinkedIn: jest.fn()
    };

    // Mock SSO service
    mockSsoService = {
      findByProvider: jest.fn(),
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
      updateTokens: jest.fn(),
      removeProvider: jest.fn(),
      getOtherProviders: jest.fn(),
      updateUserTokens: jest.fn(),
      getUserProviders: jest.fn()
    };

    // Mock audit service
    mockAuditService = {
      log: jest.fn()
    };

    // Mock database
    mockDatabase = {
      getConnection: jest.fn(() => ({
        execute: jest.fn(),
        close: jest.fn()
      }))
    };

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn(val => `encrypted_${val}`),
      decrypt: jest.fn(val => val.replace('encrypted_', ''))
    };

    // Mock LinkedIn client
    mockLinkedInClient = {
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getUserInfo: jest.fn(),
      getProfile: jest.fn(),
      getPositions: jest.fn(),
      getEducation: jest.fn(),
      getSkills: jest.fn(),
      getCertifications: jest.fn()
    };

    // Mock profile import service
    mockProfileImportService = {
      importWorkExperience: jest.fn(),
      importEducation: jest.fn(),
      importSkills: jest.fn(),
      importCertifications: jest.fn(),
      mapLinkedInProfile: jest.fn(),
      previewImport: jest.fn(),
      selectiveImport: jest.fn()
    };

    // Mock feature flag service
    mockFeatureFlagService = {
      isEnabled: jest.fn()
    };

    // Create service instance
    service = new LinkedInOAuthService(
      mockConfig,
      mockUserService,
      mockSsoService,
      mockAuditService,
      mockDatabase,
      mockEncryptionService,
      mockProfileImportService,
      mockFeatureFlagService
    );

    // Inject mock client
    service.client = mockLinkedInClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAuthUrl', () => {
    test('should generate authorization URL with PKCE', async () => {
      const userId = 'test-user-id';
      const returnUrl = '/dashboard';
      
      mockLinkedInClient.getAuthorizationUrl.mockReturnValue(
        'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=test-client-id'
      );

      const authUrl = await service.generateAuthUrl(userId, returnUrl);

      expect(authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(service.stateStore.size).toBe(1);
      
      const [state] = service.stateStore.keys();
      const stateData = service.stateStore.get(state);
      
      expect(stateData).toMatchObject({
        userId,
        returnUrl,
        codeVerifier: expect.any(String),
        createdAt: expect.any(Number),
        expires: expect.any(Number)
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        action: 'LINKEDIN_OAUTH_INITIATED',
        resourceType: 'authentication',
        details: { returnUrl }
      });
    });

    test('should throw error when LinkedIn OAuth is disabled', async () => {
      mockConfig.linkedin.enabled = false;

      await expect(service.generateAuthUrl()).rejects.toThrow(ValidationError);
      await expect(service.generateAuthUrl()).rejects.toThrow('LinkedIn OAuth is not enabled');
    });

    test('should prevent open redirect attacks', async () => {
      const maliciousUrl = 'https://evil.com/redirect';
      
      await expect(
        service.generateAuthUrl(null, maliciousUrl)
      ).rejects.toThrow(ValidationError);
      await expect(
        service.generateAuthUrl(null, maliciousUrl)
      ).rejects.toThrow('Invalid return URL');
    });

    test('should include login hint for existing users', async () => {
      const userId = 'test-user-id';
      const userEmail = 'user@example.com';
      
      mockUserService.findById.mockResolvedValue({
        id: userId,
        email: userEmail
      });

      mockLinkedInClient.getAuthorizationUrl.mockImplementation((options) => {
        expect(options.login_hint).toBe(userEmail);
        return 'https://www.linkedin.com/oauth/v2/authorization';
      });

      await service.generateAuthUrl(userId, '/');

      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('handleCallback', () => {
    test('should handle successful OAuth callback', async () => {
      const code = 'auth-code';
      const state = 'test-state';
      const stateData = {
        userId: null,
        returnUrl: '/dashboard',
        codeVerifier: 'test-verifier',
        createdAt: Date.now(),
        expires: Date.now() + 300000
      };

      service.stateStore.set(state, stateData);

      const tokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600
      };

      const linkedInUser = {
        sub: 'linkedin-user-id',
        email: 'user@example.com',
        email_verified: true,
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://linkedin.com/photo.jpg'
      };

      mockLinkedInClient.getAccessToken.mockResolvedValue(tokens);
      mockLinkedInClient.getUserInfo.mockResolvedValue(linkedInUser);

      const user = {
        id: 'user-id',
        username: 'johndoe',
        email: 'user@example.com'
      };

      mockSsoService.findByProvider.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.usernameExists.mockResolvedValue(false);
      mockUserService.create.mockResolvedValue(user);
      mockSsoService.create.mockResolvedValue({ id: 'sso-id' });

      const connection = {
        execute: jest.fn(),
        close: jest.fn()
      };
      mockDatabase.getConnection.mockResolvedValue(connection);

      const result = await service.handleCallback(code, state);

      expect(result).toMatchObject({
        user,
        isNewUser: true,
        returnUrl: '/dashboard'
      });

      expect(service.stateStore.has(state)).toBe(false);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: user.id,
        action: 'LINKEDIN_OAUTH_LOGIN',
        resourceType: 'authentication',
        details: expect.objectContaining({
          linkedInId: linkedInUser.sub,
          email: linkedInUser.email,
          isNewUser: true
        })
      });
    });

    test('should handle invalid state parameter', async () => {
      await expect(
        service.handleCallback('code', 'invalid-state')
      ).rejects.toThrow(AuthenticationError);
      await expect(
        service.handleCallback('code', 'invalid-state')
      ).rejects.toThrow('Invalid state parameter');
    });

    test('should handle expired state', async () => {
      const state = 'expired-state';
      const stateData = {
        userId: null,
        returnUrl: '/',
        codeVerifier: 'test-verifier',
        createdAt: Date.now() - 600000,
        expires: Date.now() - 300000 // Expired 5 minutes ago
      };

      service.stateStore.set(state, stateData);

      await expect(
        service.handleCallback('code', state)
      ).rejects.toThrow(AuthenticationError);
      await expect(
        service.handleCallback('code', state)
      ).rejects.toThrow('State parameter expired');

      expect(service.stateStore.has(state)).toBe(false);
    });

    test('should handle account linking when email exists', async () => {
      const code = 'auth-code';
      const state = 'test-state';
      const stateData = {
        userId: 'existing-user-id',
        returnUrl: '/',
        codeVerifier: 'test-verifier',
        createdAt: Date.now(),
        expires: Date.now() + 300000
      };

      service.stateStore.set(state, stateData);

      const existingUser = {
        id: 'existing-user-id',
        email: 'user@example.com'
      };

      mockUserService.findByEmail.mockResolvedValue(existingUser);
      mockConfig.linkedin.autoLinkAccounts = true;

      const connection = {
        execute: jest.fn(),
        close: jest.fn()
      };
      mockDatabase.getConnection.mockResolvedValue(connection);

      mockLinkedInClient.getAccessToken.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh'
      });

      mockLinkedInClient.getUserInfo.mockResolvedValue({
        sub: 'linkedin-id',
        email: 'user@example.com'
      });

      mockSsoService.findByProvider.mockResolvedValue(null);
      mockSsoService.create.mockResolvedValue({ id: 'sso-id' });

      const result = await service.handleCallback(code, state);

      expect(result).toMatchObject({
        user: existingUser,
        isNewUser: false,
        accountLinked: true
      });
    });

    test('should require manual merge when auto-link disabled', async () => {
      const code = 'auth-code';
      const state = 'test-state';
      const stateData = {
        userId: null,
        returnUrl: '/',
        codeVerifier: 'test-verifier',
        createdAt: Date.now(),
        expires: Date.now() + 300000
      };

      service.stateStore.set(state, stateData);

      const existingUser = {
        id: 'existing-user-id',
        email: 'user@example.com'
      };

      mockUserService.findByEmail.mockResolvedValue(existingUser);
      mockConfig.linkedin.autoLinkAccounts = false;

      const connection = {
        execute: jest.fn(),
        close: jest.fn()
      };
      mockDatabase.getConnection.mockResolvedValue(connection);

      mockLinkedInClient.getAccessToken.mockResolvedValue({
        access_token: 'token'
      });

      mockLinkedInClient.getUserInfo.mockResolvedValue({
        sub: 'linkedin-id',
        email: 'user@example.com'
      });

      mockSsoService.findByProvider.mockResolvedValue(null);

      await expect(
        service.handleCallback(code, state)
      ).rejects.toThrow(ConflictError);
      await expect(
        service.handleCallback(code, state)
      ).rejects.toThrow('ACCOUNT_EXISTS_REQUIRES_MERGE');
    });
  });

  describe('importProfile', () => {
    test('should import full LinkedIn profile', async () => {
      const userId = 'user-id';
      const accessToken = 'access-token';

      const linkedInProfile = {
        id: 'linkedin-id',
        localizedFirstName: 'John',
        localizedLastName: 'Doe',
        headline: 'Software Engineer',
        summary: 'Experienced developer',
        profilePicture: {
          displayImage: 'https://linkedin.com/photo.jpg'
        },
        location: {
          country: 'US',
          postalCode: '12345'
        },
        industry: 'Computer Software'
      };

      const positions = [
        {
          title: 'Senior Developer',
          companyName: 'Tech Corp',
          startDate: { year: 2020, month: 1 },
          endDate: null,
          description: 'Leading development team',
          location: 'San Francisco, CA'
        }
      ];

      const education = [
        {
          schoolName: 'University',
          degreeName: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startDate: { year: 2012 },
          endDate: { year: 2016 }
        }
      ];

      const skills = ['JavaScript', 'Python', 'React', 'Node.js'];

      const certifications = [
        {
          name: 'AWS Certified',
          authority: 'Amazon',
          licenseNumber: '123456',
          startDate: { year: 2021, month: 6 }
        }
      ];

      mockLinkedInClient.getProfile.mockResolvedValue(linkedInProfile);
      mockLinkedInClient.getPositions.mockResolvedValue(positions);
      mockLinkedInClient.getEducation.mockResolvedValue(education);
      mockLinkedInClient.getSkills.mockResolvedValue(skills);
      mockLinkedInClient.getCertifications.mockResolvedValue(certifications);

      mockProfileImportService.importWorkExperience.mockResolvedValue({ imported: 1 });
      mockProfileImportService.importEducation.mockResolvedValue({ imported: 1 });
      mockProfileImportService.importSkills.mockResolvedValue({ imported: 4 });
      mockProfileImportService.importCertifications.mockResolvedValue({ imported: 1 });

      const result = await service.importProfile(userId, accessToken);

      expect(result).toMatchObject({
        profile: linkedInProfile,
        imported: {
          workExperience: { imported: 1 },
          education: { imported: 1 },
          skills: { imported: 4 },
          certifications: { imported: 1 }
        }
      });

      expect(mockProfileImportService.importWorkExperience).toHaveBeenCalledWith(
        userId,
        positions
      );
      expect(mockProfileImportService.importEducation).toHaveBeenCalledWith(
        userId,
        education
      );
      expect(mockProfileImportService.importSkills).toHaveBeenCalledWith(
        userId,
        skills
      );
      expect(mockProfileImportService.importCertifications).toHaveBeenCalledWith(
        userId,
        certifications
      );

      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        action: 'LINKEDIN_PROFILE_IMPORTED',
        resourceType: 'profile',
        details: expect.objectContaining({
          workExperience: 1,
          education: 1,
          skills: 4,
          certifications: 1
        })
      });
    });

    test('should handle selective profile import', async () => {
      const userId = 'user-id';
      const accessToken = 'access-token';
      const importOptions = {
        workExperience: true,
        education: false,
        skills: true,
        certifications: false
      };

      mockLinkedInClient.getProfile.mockResolvedValue({
        id: 'linkedin-id',
        localizedFirstName: 'John'
      });

      mockLinkedInClient.getPositions.mockResolvedValue([
        { title: 'Developer', companyName: 'Company' }
      ]);

      mockLinkedInClient.getSkills.mockResolvedValue(['JavaScript']);

      mockProfileImportService.selectiveImport.mockResolvedValue({
        imported: {
          workExperience: 1,
          skills: 1
        }
      });

      const result = await service.importProfileSelective(userId, accessToken, importOptions);

      expect(result.imported).toMatchObject({
        workExperience: 1,
        skills: 1
      });

      expect(mockLinkedInClient.getEducation).not.toHaveBeenCalled();
      expect(mockLinkedInClient.getCertifications).not.toHaveBeenCalled();
    });

    test('should preview import without saving', async () => {
      const userId = 'user-id';
      const accessToken = 'access-token';

      const profile = {
        id: 'linkedin-id',
        localizedFirstName: 'John',
        localizedLastName: 'Doe'
      };

      mockLinkedInClient.getProfile.mockResolvedValue(profile);
      mockLinkedInClient.getPositions.mockResolvedValue([]);
      mockLinkedInClient.getEducation.mockResolvedValue([]);
      mockLinkedInClient.getSkills.mockResolvedValue([]);
      mockLinkedInClient.getCertifications.mockResolvedValue([]);

      mockProfileImportService.previewImport.mockResolvedValue({
        preview: {
          profile,
          positions: [],
          education: [],
          skills: [],
          certifications: []
        }
      });

      const result = await service.previewImport(userId, accessToken);

      expect(result.preview).toBeDefined();
      expect(mockProfileImportService.importWorkExperience).not.toHaveBeenCalled();
      expect(mockProfileImportService.importEducation).not.toHaveBeenCalled();
    });
  });

  describe('syncProfile', () => {
    test('should sync profile data from LinkedIn', async () => {
      const userId = 'user-id';
      const ssoAccount = {
        id: 'sso-id',
        userId,
        accessToken: 'encrypted_access-token',
        refreshToken: 'encrypted_refresh-token',
        lastSyncAt: new Date(Date.now() - 86400000) // 24 hours ago
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);

      const profile = {
        id: 'linkedin-id',
        localizedFirstName: 'John',
        localizedLastName: 'Doe'
      };

      mockLinkedInClient.getProfile.mockResolvedValue(profile);
      mockProfileImportService.mapLinkedInProfile.mockResolvedValue({
        mapped: true
      });

      const result = await service.syncProfile(userId);

      expect(result).toMatchObject({
        synced: true,
        profile,
        lastSyncAt: expect.any(Date)
      });

      expect(mockSsoService.updateTokens).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        action: 'LINKEDIN_PROFILE_SYNCED',
        resourceType: 'profile',
        details: expect.any(Object)
      });
    });

    test('should skip sync if recently synced', async () => {
      const userId = 'user-id';
      const ssoAccount = {
        id: 'sso-id',
        userId,
        lastSyncAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);
      mockConfig.linkedin.syncInterval = 86400000; // 24 hours

      const result = await service.syncProfile(userId);

      expect(result).toMatchObject({
        synced: false,
        message: 'Profile recently synced'
      });

      expect(mockLinkedInClient.getProfile).not.toHaveBeenCalled();
    });

    test('should force sync when requested', async () => {
      const userId = 'user-id';
      const ssoAccount = {
        id: 'sso-id',
        userId,
        accessToken: 'encrypted_access-token',
        lastSyncAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);

      const profile = { id: 'linkedin-id' };
      mockLinkedInClient.getProfile.mockResolvedValue(profile);
      mockProfileImportService.mapLinkedInProfile.mockResolvedValue({
        mapped: true
      });

      const result = await service.syncProfile(userId, true); // Force sync

      expect(result.synced).toBe(true);
      expect(mockLinkedInClient.getProfile).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    test('should refresh expired access token', async () => {
      const userId = 'user-id';
      const ssoAccount = {
        id: 'sso-id',
        userId,
        refreshToken: 'encrypted_refresh-token'
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      mockLinkedInClient.refreshAccessToken.mockResolvedValue(newTokens);

      const result = await service.refreshAccessToken(userId);

      expect(result).toBe('new-access-token');
      expect(mockSsoService.updateTokens).toHaveBeenCalledWith(
        'sso-id',
        'encrypted_new-access-token',
        'encrypted_new-refresh-token',
        expect.any(Number)
      );
    });

    test('should throw error when no refresh token available', async () => {
      const userId = 'user-id';
      
      mockSsoService.findByUserAndProvider.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken(userId)
      ).rejects.toThrow('No refresh token available');
    });
  });

  describe('unlinkLinkedInAccount', () => {
    test('should unlink LinkedIn account when other auth methods exist', async () => {
      const userId = 'user-id';

      mockUserService.hasPassword.mockResolvedValue(true);
      mockSsoService.getOtherProviders.mockResolvedValue([]);
      mockSsoService.removeProvider.mockResolvedValue({ success: true });

      const result = await service.unlinkLinkedInAccount(userId);

      expect(result.success).toBe(true);
      expect(mockSsoService.removeProvider).toHaveBeenCalledWith(userId, 'linkedin');
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        action: 'LINKEDIN_ACCOUNT_UNLINKED',
        resourceType: 'sso_account'
      });
    });

    test('should prevent unlinking when no other auth method exists', async () => {
      const userId = 'user-id';

      mockUserService.hasPassword.mockResolvedValue(false);
      mockSsoService.getOtherProviders.mockResolvedValue([]);

      await expect(
        service.unlinkLinkedInAccount(userId)
      ).rejects.toThrow(ValidationError);
      await expect(
        service.unlinkLinkedInAccount(userId)
      ).rejects.toThrow('Cannot unlink: No other authentication method available');
    });
  });

  describe('mergeAccounts', () => {
    test('should merge LinkedIn account with password verification', async () => {
      const userId = 'user-id';
      const password = 'password123';
      const linkedInUser = {
        sub: 'linkedin-id',
        email: 'user@example.com'
      };
      const tokens = {
        access_token: 'token',
        refresh_token: 'refresh'
      };

      mockUserService.verifyPassword.mockResolvedValue(true);
      mockUserService.findById.mockResolvedValue({ id: userId });

      const connection = {
        execute: jest.fn(),
        close: jest.fn()
      };
      mockDatabase.getConnection.mockResolvedValue(connection);

      mockSsoService.create.mockResolvedValue({ id: 'sso-id' });

      const result = await service.mergeAccounts(userId, password, linkedInUser, tokens);

      expect(result).toMatchObject({
        user: { id: userId },
        merged: true
      });

      expect(mockUserService.verifyPassword).toHaveBeenCalledWith(userId, password);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId,
        action: 'LINKEDIN_ACCOUNT_MERGED',
        resourceType: 'sso_account',
        details: expect.objectContaining({
          linkedInId: linkedInUser.sub
        })
      });
    });

    test('should reject merge with invalid password', async () => {
      const userId = 'user-id';
      const password = 'wrong-password';

      mockUserService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.mergeAccounts(userId, password, {}, {})
      ).rejects.toThrow(AuthenticationError);
      await expect(
        service.mergeAccounts(userId, password, {}, {})
      ).rejects.toThrow('Invalid password');
    });
  });

  describe('stateCleanup', () => {
    test('should clean up expired states periodically', async () => {
      // Add some states
      const now = Date.now();
      service.stateStore.set('expired-1', {
        expires: now - 1000
      });
      service.stateStore.set('expired-2', {
        expires: now - 2000
      });
      service.stateStore.set('valid', {
        expires: now + 10000
      });

      expect(service.stateStore.size).toBe(3);

      // Manually trigger cleanup
      service.cleanupExpiredStates();

      expect(service.stateStore.size).toBe(1);
      expect(service.stateStore.has('valid')).toBe(true);
      expect(service.stateStore.has('expired-1')).toBe(false);
      expect(service.stateStore.has('expired-2')).toBe(false);
    });
  });

  describe('encryptionHandling', () => {
    test('should encrypt tokens before storage', async () => {
      const tokens = {
        access_token: 'plain-access',
        refresh_token: 'plain-refresh'
      };

      const encrypted = await service.encryptTokens(tokens);

      expect(encrypted).toEqual({
        access_token: 'encrypted_plain-access',
        refresh_token: 'encrypted_plain-refresh'
      });

      expect(mockEncryptionService.encrypt).toHaveBeenCalledTimes(2);
    });

    test('should decrypt tokens when retrieving', async () => {
      const encryptedToken = 'encrypted_token-value';
      
      const decrypted = await service.decryptToken(encryptedToken);

      expect(decrypted).toBe('token-value');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(encryptedToken);
    });

    test('should handle missing encryption service', async () => {
      service.encryptionService = null;

      const tokens = {
        access_token: 'plain-access',
        refresh_token: 'plain-refresh'
      };

      const result = await service.encryptTokens(tokens);

      expect(result).toEqual(tokens);
    });
  });
});