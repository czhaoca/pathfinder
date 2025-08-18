/**
 * LinkedIn OAuth Service
 * Handles LinkedIn OAuth 2.0 authentication with PKCE, profile import, and account management
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { AuthenticationError, ValidationError, ConflictError } = require('../utils/errors');

class LinkedInOAuthService {
  constructor(config, userService, ssoService, auditService, database, encryptionService, profileImportService, featureFlagService) {
    this.config = config.linkedin || {};
    this.userService = userService;
    this.ssoService = ssoService;
    this.auditService = auditService;
    this.database = database;
    this.encryptionService = encryptionService;
    this.profileImportService = profileImportService;
    this.featureFlagService = featureFlagService;
    
    // In-memory state store (use Redis in production)
    this.stateStore = new Map();
    
    // Initialize OAuth client
    this.initializeOAuthClient();
    
    // Start cleanup interval for expired states
    this.startStateCleanup();
  }

  initializeOAuthClient() {
    try {
      // LinkedIn OAuth configuration
      this.client = {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUri: this.config.redirectUri,
        authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
        profileUrl: 'https://api.linkedin.com/v2/me',
        positionsUrl: 'https://api.linkedin.com/v2/positions',
        educationUrl: 'https://api.linkedin.com/v2/educations',
        skillsUrl: 'https://api.linkedin.com/v2/skills',
        certificationsUrl: 'https://api.linkedin.com/v2/certifications'
      };
    } catch (error) {
      logger.warn('LinkedIn OAuth client not initialized', { error: error.message });
      this.client = null;
    }
  }

  startStateCleanup() {
    // Clean up expired states every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);
  }

  cleanupExpiredStates() {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (data.expires < now) {
        this.stateStore.delete(state);
      }
    }
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  async generateAuthUrl(userId = null, returnUrl = '/') {
    // Check if OAuth is enabled
    if (!this.config.enabled) {
      throw new ValidationError('LinkedIn OAuth is not enabled');
    }

    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }

    // Validate return URL to prevent open redirect
    if (!this.isValidReturnUrl(returnUrl)) {
      throw new ValidationError('Invalid return URL');
    }

    // Generate state with CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store state with metadata
    this.stateStore.set(state, {
      userId,
      returnUrl,
      codeVerifier,
      createdAt: Date.now(),
      expires: Date.now() + (this.config.stateExpiration * 1000)
    });

    // Get user email for login hint if authenticated
    let loginHint;
    if (userId) {
      try {
        const user = await this.userService.findById(userId);
        loginHint = user?.email;
      } catch (error) {
        logger.warn('Could not get user email for login hint', { userId });
      }
    }

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId || this.client.clientId,
      redirect_uri: this.config.redirectUri || this.client.redirectUri,
      state,
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    if (loginHint) {
      params.append('login_hint', loginHint);
    }

    const authUrl = `${this.client?.authorizationUrl || 'https://www.linkedin.com/oauth/v2/authorization'}?${params.toString()}`;

    // Audit log
    await this.auditService.log({
      userId,
      action: 'LINKEDIN_OAUTH_INITIATED',
      resourceType: 'authentication',
      details: { returnUrl }
    });

    return authUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code, state) {
    // Validate state parameter
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new AuthenticationError('Invalid state parameter');
    }

    // Check state expiration
    if (Date.now() > stateData.expires) {
      this.stateStore.delete(state);
      throw new AuthenticationError('State parameter expired');
    }

    // Remove state to prevent replay attacks
    this.stateStore.delete(state);

    try {
      // Exchange authorization code for tokens with PKCE verification
      const tokens = await this.exchangeCodeForTokens(code, stateData.codeVerifier);

      // Get user info from LinkedIn
      const linkedInUser = await this.getUserInfo(tokens.access_token);

      // Process authentication
      const result = await this.processLinkedInAuth(
        linkedInUser,
        tokens,
        stateData.userId
      );

      // Audit log successful login
      await this.auditService.log({
        userId: result.user.id,
        action: 'LINKEDIN_OAUTH_LOGIN',
        resourceType: 'authentication',
        details: {
          linkedInId: linkedInUser.sub,
          email: linkedInUser.email,
          isNewUser: result.isNewUser,
          accountLinked: result.accountLinked
        }
      });

      return {
        ...result,
        returnUrl: stateData.returnUrl
      };
    } catch (error) {
      logger.error('LinkedIn OAuth callback error', { error: error.message, state });
      
      // Audit log failed attempt
      await this.auditService.log({
        userId: stateData.userId,
        action: 'LINKEDIN_OAUTH_FAILED',
        resourceType: 'authentication',
        status: 'error',
        errorMessage: error.message
      });

      throw new AuthenticationError('Authentication failed');
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, codeVerifier) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.client.redirectUri,
      client_id: this.client.clientId,
      client_secret: this.client.clientSecret,
      code_verifier: codeVerifier
    });

    try {
      const response = await fetch(this.client.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expiry_date: Date.now() + (data.expires_in * 1000)
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user info from LinkedIn
   */
  async getUserInfo(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(this.client.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get LinkedIn user info', { error: error.message });
      throw new Error('Failed to fetch user info');
    }
  }

  /**
   * Get full LinkedIn profile
   */
  async getProfile(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(`${this.client.profileUrl}?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~digitalmediaAsset),headline,summary,location,industry)`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get LinkedIn profile', { error: error.message });
      throw error;
    }
  }

  /**
   * Process LinkedIn authentication
   */
  async processLinkedInAuth(linkedInUser, tokens, existingUserId = null) {
    // Start transaction
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Check if SSO account exists
      let ssoAccount = await this.ssoService.findByProvider(
        'linkedin',
        linkedInUser.sub,
        connection
      );

      if (ssoAccount) {
        // Existing SSO account - update tokens and login
        const encryptedTokens = await this.encryptTokens(tokens);
        
        await this.ssoService.updateTokens(
          ssoAccount.id,
          encryptedTokens.access_token,
          encryptedTokens.refresh_token,
          tokens.expiry_date,
          connection
        );

        const user = await this.userService.findById(ssoAccount.userId, connection);
        
        await connection.execute('COMMIT');
        
        return {
          user,
          isNewUser: false,
          ssoAccount
        };
      }

      // Check if email exists in local accounts
      const existingUser = await this.userService.findByEmail(linkedInUser.email, connection);

      if (existingUser) {
        if (this.config.autoLinkAccounts || existingUserId === existingUser.id) {
          // Link accounts automatically or if user initiated
          ssoAccount = await this.linkLinkedInAccount(
            existingUser.id,
            linkedInUser,
            tokens,
            connection
          );

          await connection.execute('COMMIT');

          return {
            user: existingUser,
            isNewUser: false,
            ssoAccount,
            accountLinked: true
          };
        } else {
          // Require manual confirmation
          await connection.execute('ROLLBACK');
          throw new ConflictError('ACCOUNT_EXISTS_REQUIRES_MERGE');
        }
      }

      // Create new user account
      if (!this.config.allowSignup) {
        await connection.execute('ROLLBACK');
        throw new ValidationError('Sign up with LinkedIn is not allowed');
      }

      const newUser = await this.createUserFromLinkedIn(linkedInUser, connection);
      ssoAccount = await this.linkLinkedInAccount(
        newUser.id,
        linkedInUser,
        tokens,
        connection
      );

      await connection.execute('COMMIT');

      return {
        user: newUser,
        isNewUser: true,
        ssoAccount
      };
    } catch (error) {
      await connection.execute('ROLLBACK');
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Create user account from LinkedIn profile
   */
  async createUserFromLinkedIn(linkedInUser, connection) {
    // Generate unique username from email
    const baseUsername = linkedInUser.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    let username = baseUsername;
    let counter = 1;
    
    // Check for username uniqueness
    while (await this.userService.usernameExists(username, connection)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Create user with LinkedIn profile data
    const user = await this.userService.create({
      username,
      email: linkedInUser.email,
      emailVerified: linkedInUser.email_verified || false,
      firstName: linkedInUser.given_name || '',
      lastName: linkedInUser.family_name || '',
      avatarUrl: linkedInUser.picture,
      // Generate secure random password for OAuth users
      password: crypto.randomBytes(32).toString('hex'),
      source: 'linkedin_oauth'
    }, connection);

    return user;
  }

  /**
   * Link LinkedIn account to existing user
   */
  async linkLinkedInAccount(userId, linkedInUser, tokens, connection) {
    // Encrypt tokens before storage
    const encryptedTokens = await this.encryptTokens(tokens);

    return await this.ssoService.create({
      userId,
      provider: 'linkedin',
      providerUserId: linkedInUser.sub,
      email: linkedInUser.email,
      displayName: linkedInUser.name,
      avatarUrl: linkedInUser.picture,
      accessToken: encryptedTokens.access_token,
      refreshToken: encryptedTokens.refresh_token,
      tokenExpiresAt: new Date(tokens.expiry_date),
      profileData: linkedInUser,
      isPrimary: false
    }, connection);
  }

  /**
   * Import LinkedIn profile data
   */
  async importProfile(userId, accessToken, importOptions = null) {
    const options = importOptions || this.config.importFields;
    const imported = {};

    try {
      // Get full profile
      const profile = await this.getProfile(accessToken);
      
      // Import work experience if enabled
      if (options.workExperience) {
        const positions = await this.getPositions(accessToken);
        imported.workExperience = await this.profileImportService.importWorkExperience(
          userId,
          positions
        );
      }

      // Import education if enabled
      if (options.education) {
        const education = await this.getEducation(accessToken);
        imported.education = await this.profileImportService.importEducation(
          userId,
          education
        );
      }

      // Import skills if enabled
      if (options.skills) {
        const skills = await this.getSkills(accessToken);
        imported.skills = await this.profileImportService.importSkills(
          userId,
          skills
        );
      }

      // Import certifications if enabled
      if (options.certifications) {
        const certifications = await this.getCertifications(accessToken);
        imported.certifications = await this.profileImportService.importCertifications(
          userId,
          certifications
        );
      }

      // Update user profile with LinkedIn data
      if (options.summary || options.profilePhoto || options.location || options.industry) {
        await this.userService.updateProfileFromLinkedIn(userId, profile, options);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'LINKEDIN_PROFILE_IMPORTED',
        resourceType: 'profile',
        details: {
          workExperience: imported.workExperience?.imported || 0,
          education: imported.education?.imported || 0,
          skills: imported.skills?.imported || 0,
          certifications: imported.certifications?.imported || 0
        }
      });

      return {
        profile,
        imported
      };
    } catch (error) {
      logger.error('Failed to import LinkedIn profile', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Import profile with selective options
   */
  async importProfileSelective(userId, accessToken, importOptions) {
    const profile = await this.getProfile(accessToken);
    const imported = {};

    if (importOptions.workExperience) {
      const positions = await this.getPositions(accessToken);
      imported.workExperience = positions.length;
    }

    if (importOptions.skills) {
      const skills = await this.getSkills(accessToken);
      imported.skills = skills.length;
    }

    const result = await this.profileImportService.selectiveImport(
      userId,
      { profile, positions: imported.workExperience ? await this.getPositions(accessToken) : [], 
        skills: imported.skills ? await this.getSkills(accessToken) : [] },
      importOptions
    );

    return {
      profile,
      imported: result.imported
    };
  }

  /**
   * Preview import without saving
   */
  async previewImport(userId, accessToken) {
    const profile = await this.getProfile(accessToken);
    const positions = await this.getPositions(accessToken);
    const education = await this.getEducation(accessToken);
    const skills = await this.getSkills(accessToken);
    const certifications = await this.getCertifications(accessToken);

    const preview = await this.profileImportService.previewImport({
      profile,
      positions,
      education,
      skills,
      certifications
    });

    return { preview };
  }

  /**
   * Sync LinkedIn profile
   */
  async syncProfile(userId, force = false) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(userId, 'linkedin');
    
    if (!ssoAccount) {
      throw new Error('LinkedIn account not linked');
    }

    // Check if sync is needed
    const lastSync = ssoAccount.lastSyncAt ? new Date(ssoAccount.lastSyncAt).getTime() : 0;
    const syncInterval = this.config.syncInterval || 86400000; // 24 hours default
    
    if (!force && (Date.now() - lastSync) < syncInterval) {
      return {
        synced: false,
        message: 'Profile recently synced'
      };
    }

    try {
      // Decrypt and possibly refresh token
      let accessToken = await this.decryptToken(ssoAccount.accessToken);
      
      // Check if token expired
      if (ssoAccount.tokenExpiresAt && new Date(ssoAccount.tokenExpiresAt) < new Date()) {
        accessToken = await this.refreshAccessToken(userId);
      }

      // Get updated profile
      const profile = await this.getProfile(accessToken);
      
      // Map profile data to local schema
      const mapped = await this.profileImportService.mapLinkedInProfile(userId, profile);

      // Update sync timestamp
      await this.ssoService.updateTokens(
        ssoAccount.id,
        ssoAccount.accessToken,
        ssoAccount.refreshToken,
        ssoAccount.tokenExpiresAt,
        null,
        new Date() // lastSyncAt
      );

      // Audit log
      await this.auditService.log({
        userId,
        action: 'LINKEDIN_PROFILE_SYNCED',
        resourceType: 'profile',
        details: { profile: profile.id }
      });

      return {
        synced: true,
        profile,
        mapped,
        lastSyncAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to sync LinkedIn profile', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get LinkedIn positions/work experience
   */
  async getPositions(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(this.client.positionsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      logger.error('Failed to get LinkedIn positions', { error: error.message });
      return [];
    }
  }

  /**
   * Get LinkedIn education
   */
  async getEducation(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(this.client.educationUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      logger.error('Failed to get LinkedIn education', { error: error.message });
      return [];
    }
  }

  /**
   * Get LinkedIn skills
   */
  async getSkills(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(this.client.skillsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      logger.error('Failed to get LinkedIn skills', { error: error.message });
      return [];
    }
  }

  /**
   * Get LinkedIn certifications
   */
  async getCertifications(accessToken) {
    if (!this.client) {
      throw new Error('LinkedIn OAuth client not initialized');
    }
    
    try {
      const response = await fetch(this.client.certificationsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      logger.error('Failed to get LinkedIn certifications', { error: error.message });
      return [];
    }
  }

  /**
   * Merge LinkedIn account with existing account
   */
  async mergeAccounts(existingUserId, password, linkedInUser, tokens) {
    // Verify password for security
    const verified = await this.userService.verifyPassword(existingUserId, password);
    
    if (!verified) {
      throw new AuthenticationError('Invalid password');
    }

    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Link LinkedIn account to existing user
      const ssoAccount = await this.linkLinkedInAccount(
        existingUserId,
        linkedInUser,
        tokens,
        connection
      );

      // Update profile with LinkedIn data if missing
      await this.userService.updateProfileFromLinkedIn(
        existingUserId,
        linkedInUser,
        connection
      );

      await connection.execute('COMMIT');

      // Audit log
      await this.auditService.log({
        userId: existingUserId,
        action: 'LINKEDIN_ACCOUNT_MERGED',
        resourceType: 'sso_account',
        details: {
          linkedInId: linkedInUser.sub,
          email: linkedInUser.email
        }
      });

      return {
        user: await this.userService.findById(existingUserId),
        ssoAccount,
        merged: true
      };
    } catch (error) {
      await connection.execute('ROLLBACK');
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Unlink LinkedIn account from user
   */
  async unlinkLinkedInAccount(userId) {
    // Check if user has other authentication methods
    const hasPassword = await this.userService.hasPassword(userId);
    const otherSSO = await this.ssoService.getOtherProviders(userId, 'linkedin');

    if (!hasPassword && otherSSO.length === 0) {
      throw new ValidationError('Cannot unlink: No other authentication method available');
    }

    // Remove LinkedIn SSO account
    await this.ssoService.removeProvider(userId, 'linkedin');

    // Audit log
    await this.auditService.log({
      userId,
      action: 'LINKEDIN_ACCOUNT_UNLINKED',
      resourceType: 'sso_account'
    });

    return { success: true };
  }

  /**
   * Exchange authorization code for tokens (simplified)
   */
  async exchangeCode(code) {
    const tokens = await this.exchangeCodeForTokens(code, '');
    const linkedInUser = await this.getUserInfo(tokens.access_token);

    return {
      user: linkedInUser,
      tokens
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(userId, 'linkedin');

    if (!ssoAccount || !ssoAccount.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Decrypt refresh token
      const decryptedRefreshToken = await this.decryptToken(ssoAccount.refreshToken);
      
      // Request new access token
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret
      });

      const response = await fetch(this.client.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${await response.text()}`);
      }

      const data = await response.json();

      // Encrypt new tokens
      const encryptedTokens = await this.encryptTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token || decryptedRefreshToken,
        expiry_date: Date.now() + (data.expires_in * 1000)
      });

      // Update tokens in database
      await this.ssoService.updateTokens(
        ssoAccount.id,
        encryptedTokens.access_token,
        encryptedTokens.refresh_token,
        Date.now() + (data.expires_in * 1000)
      );

      return data.access_token;
    } catch (error) {
      logger.error('Failed to refresh LinkedIn token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Validate return URL to prevent open redirect
   */
  isValidReturnUrl(url) {
    // Only allow relative URLs or same-origin URLs
    if (!url) return true;
    
    // Check for protocol-relative URLs
    if (url.startsWith('//')) return false;
    
    // Check for absolute URLs with different origin
    if (url.includes('://')) {
      try {
        const urlObj = new URL(url);
        const allowedOrigin = new URL(this.config.redirectUri).origin;
        return urlObj.origin === allowedOrigin;
      } catch {
        return false;
      }
    }
    
    // Check for javascript: or data: protocols
    if (/^(javascript|data):/i.test(url)) return false;
    
    // Allow relative URLs starting with /
    return url.startsWith('/');
  }

  /**
   * Encrypt OAuth tokens before storage
   */
  async encryptTokens(tokens) {
    if (!this.encryptionService) {
      return tokens;
    }

    return {
      access_token: tokens.access_token ? 
        await this.encryptionService.encrypt(tokens.access_token) : null,
      refresh_token: tokens.refresh_token ? 
        await this.encryptionService.encrypt(tokens.refresh_token) : null
    };
  }

  /**
   * Decrypt OAuth token
   */
  async decryptToken(encryptedToken) {
    if (!this.encryptionService || !encryptedToken) {
      return encryptedToken;
    }

    return await this.encryptionService.decrypt(encryptedToken);
  }

  /**
   * Store encrypted tokens
   */
  async storeTokens(userId, tokens) {
    const encryptedTokens = await this.encryptTokens(tokens);
    await this.ssoService.updateUserTokens(userId, 'linkedin', encryptedTokens);
  }

  /**
   * Get decrypted tokens
   */
  async getTokens(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(userId, 'linkedin');
    
    if (!ssoAccount) {
      return null;
    }

    return {
      access_token: await this.decryptToken(ssoAccount.accessToken),
      refresh_token: await this.decryptToken(ssoAccount.refreshToken)
    };
  }

  /**
   * Get user email for login hint
   */
  async getUserEmail(userId) {
    try {
      const user = await this.userService.findById(userId);
      return user?.email;
    } catch {
      return undefined;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.stateStore.clear();
  }
}

module.exports = LinkedInOAuthService;