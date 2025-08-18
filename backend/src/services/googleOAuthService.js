/**
 * Google OAuth Service
 * Handles Google OAuth 2.0 authentication with PKCE, account provisioning, and secure token management
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { AuthenticationError, ValidationError, ConflictError } = require('../utils/errors');

class GoogleOAuthService {
  constructor(config, userService, ssoService, auditService, database, encryptionService) {
    this.config = config.google || {};
    this.userService = userService;
    this.ssoService = ssoService;
    this.auditService = auditService;
    this.database = database;
    this.encryptionService = encryptionService;
    
    // In-memory state store (use Redis in production)
    this.stateStore = new Map();
    
    // Initialize OAuth client
    this.initializeOAuthClient();
    
    // Start cleanup interval for expired states
    this.startStateCleanup();
  }

  initializeOAuthClient() {
    try {
      // Dynamic import to avoid requiring google-auth-library if not using OAuth
      const { OAuth2Client } = require('google-auth-library');
      this.client = new OAuth2Client(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );
    } catch (error) {
      logger.warn('Google OAuth client not initialized - google-auth-library not installed');
      this.client = null;
    }
  }

  startStateCleanup() {
    // Clean up expired states every 5 minutes
    setInterval(() => {
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
      throw new ValidationError('Google OAuth is not enabled');
    }

    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
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

    // Generate authorization URL
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: userId ? 'select_account' : 'consent',
      login_hint: loginHint
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'GOOGLE_OAUTH_INITIATED',
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
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier: stateData.codeVerifier
      });

      // Get user info from Google
      const googleUser = await this.getUserInfo(tokens.access_token);

      // Process authentication
      const result = await this.processGoogleAuth(
        googleUser,
        tokens,
        stateData.userId
      );

      // Audit log successful login
      await this.auditService.log({
        userId: result.user.id,
        action: 'GOOGLE_OAUTH_LOGIN',
        resourceType: 'authentication',
        details: {
          googleId: googleUser.id,
          email: googleUser.email,
          isNewUser: result.isNewUser,
          accountLinked: result.accountLinked
        }
      });

      return {
        ...result,
        returnUrl: stateData.returnUrl
      };
    } catch (error) {
      logger.error('Google OAuth callback error', { error: error.message, state });
      
      // Audit log failed attempt
      await this.auditService.log({
        userId: stateData.userId,
        action: 'GOOGLE_OAUTH_FAILED',
        resourceType: 'authentication',
        status: 'error',
        errorMessage: error.message
      });

      throw new AuthenticationError('Authentication failed');
    }
  }

  /**
   * Process Google authentication
   */
  async processGoogleAuth(googleUser, tokens, existingUserId = null) {
    // Start transaction
    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Check if SSO account exists
      let ssoAccount = await this.ssoService.findByProvider(
        'google',
        googleUser.id,
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
      const existingUser = await this.userService.findByEmail(googleUser.email, connection);

      if (existingUser) {
        if (this.config.autoLinkAccounts || existingUserId === existingUser.id) {
          // Link accounts automatically or if user initiated
          ssoAccount = await this.linkGoogleAccount(
            existingUser.id,
            googleUser,
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
        throw new ValidationError('Sign up with Google is not allowed');
      }

      const newUser = await this.createUserFromGoogle(googleUser, connection);
      ssoAccount = await this.linkGoogleAccount(
        newUser.id,
        googleUser,
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
   * Create user account from Google profile
   */
  async createUserFromGoogle(googleUser, connection) {
    // Generate unique username from email
    const baseUsername = googleUser.email
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

    // Create user with Google profile data
    const user = await this.userService.create({
      username,
      email: googleUser.email,
      emailVerified: googleUser.email_verified || false,
      firstName: googleUser.given_name || '',
      lastName: googleUser.family_name || '',
      avatarUrl: googleUser.picture,
      // Generate secure random password for OAuth users
      password: crypto.randomBytes(32).toString('hex'),
      source: 'google_oauth'
    }, connection);

    return user;
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId, googleUser, tokens, connection) {
    // Encrypt tokens before storage
    const encryptedTokens = await this.encryptTokens(tokens);

    return await this.ssoService.create({
      userId,
      provider: 'google',
      providerUserId: googleUser.id,
      email: googleUser.email,
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
      accessToken: encryptedTokens.access_token,
      refreshToken: encryptedTokens.refresh_token,
      tokenExpiresAt: new Date(tokens.expiry_date),
      profileData: googleUser,
      isPrimary: false
    }, connection);
  }

  /**
   * Merge Google account with existing account
   */
  async mergeAccounts(existingUserId, password, googleUser, tokens) {
    // Verify password for security
    const verified = await this.userService.verifyPassword(existingUserId, password);
    
    if (!verified) {
      throw new AuthenticationError('Invalid password');
    }

    const connection = await this.database.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Link Google account to existing user
      const ssoAccount = await this.linkGoogleAccount(
        existingUserId,
        googleUser,
        tokens,
        connection
      );

      // Update profile with Google data if missing
      await this.userService.updateProfileFromGoogle(
        existingUserId,
        googleUser,
        connection
      );

      await connection.execute('COMMIT');

      // Audit log
      await this.auditService.log({
        userId: existingUserId,
        action: 'GOOGLE_ACCOUNT_MERGED',
        resourceType: 'sso_account',
        details: {
          googleId: googleUser.id,
          email: googleUser.email
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
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId) {
    // Check if user has other authentication methods
    const hasPassword = await this.userService.hasPassword(userId);
    const otherSSO = await this.ssoService.getOtherProviders(userId, 'google');

    if (!hasPassword && otherSSO.length === 0) {
      throw new ValidationError('Cannot unlink: No other authentication method available');
    }

    // Remove Google SSO account
    await this.ssoService.removeProvider(userId, 'google');

    // Audit log
    await this.auditService.log({
      userId,
      action: 'GOOGLE_ACCOUNT_UNLINKED',
      resourceType: 'sso_account'
    });

    return { success: true };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    const { tokens } = await this.client.getToken(code);
    const googleUser = await this.getUserInfo(tokens.access_token);

    return {
      user: googleUser,
      tokens
    };
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(this.config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get Google user info', { error: error.message });
      throw new Error('Failed to fetch user info');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(userId, 'google');

    if (!ssoAccount || !ssoAccount.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    try {
      // Decrypt refresh token
      const decryptedRefreshToken = await this.decryptToken(ssoAccount.refreshToken);
      
      // Set refresh token on client
      this.client.setCredentials({
        refresh_token: decryptedRefreshToken
      });

      // Refresh the access token
      const { credentials } = await this.client.refreshAccessToken();

      // Encrypt new tokens
      const encryptedTokens = await this.encryptTokens({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || decryptedRefreshToken,
        expiry_date: credentials.expiry_date
      });

      // Update tokens in database
      await this.ssoService.updateTokens(
        ssoAccount.id,
        encryptedTokens.access_token,
        encryptedTokens.refresh_token,
        credentials.expiry_date
      );

      return credentials.access_token;
    } catch (error) {
      logger.error('Failed to refresh Google token', { error: error.message, userId });
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
    await this.ssoService.updateUserTokens(userId, 'google', encryptedTokens);
  }

  /**
   * Get decrypted tokens
   */
  async getTokens(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(userId, 'google');
    
    if (!ssoAccount) {
      return null;
    }

    return {
      access_token: await this.decryptToken(ssoAccount.accessToken),
      refresh_token: await this.decryptToken(ssoAccount.refreshToken)
    };
  }

  /**
   * Encrypt a token for storage
   */
  encryptToken(token) {
    if (!this.encryptionService) {
      return token;
    }
    return this.encryptionService.encrypt(token);
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
}

module.exports = GoogleOAuthService;