# Issue #25: Google OAuth Integration with Local Provisioning

## Title
Implement Google OAuth 2.0 Authentication with Local Account Provisioning

## User Story
As a user, I want to sign in with my Google account so that I can quickly access the platform without creating a separate password, while maintaining control over my local account settings.

## Description
Integrate Google OAuth 2.0 for user authentication with automatic local account provisioning. Users can sign in with Google, which creates or links to a local account in our database. Manual account merging is supported with password confirmation for security. The feature is controlled via feature flags for gradual rollout.

## Acceptance Criteria

### OAuth Implementation
- [ ] Google OAuth 2.0 integration with proper scopes
- [ ] Secure OAuth flow with state parameter and PKCE
- [ ] Token storage and refresh mechanism
- [ ] Profile data extraction from Google
- [ ] Email verification bypass for Google accounts
- [ ] Support for multiple Google accounts per user

### Account Provisioning
- [ ] Automatic local account creation on first Google sign-in
- [ ] Profile pre-population from Google data
- [ ] Username generation from email or name
- [ ] Account linking for existing emails
- [ ] Manual merge workflow with password confirmation
- [ ] Unlink Google account functionality

### Security & Control
- [ ] Feature flag control for OAuth availability
- [ ] Tenant-specific OAuth client configuration
- [ ] Session management for OAuth users
- [ ] Audit logging for OAuth events
- [ ] Account recovery for OAuth-only users
- [ ] 2FA compatibility with OAuth

## Technical Implementation

### OAuth Configuration

```javascript
// backend/src/config/oauth.js
module.exports = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    
    // Security settings
    useStateParameter: true,
    usePKCE: true,
    stateExpiration: 600, // 10 minutes
    
    // Feature flags
    enabled: process.env.GOOGLE_OAUTH_ENABLED === 'true',
    allowSignup: process.env.GOOGLE_OAUTH_ALLOW_SIGNUP === 'true',
    requireEmailVerification: false,
    autoLinkAccounts: process.env.GOOGLE_OAUTH_AUTO_LINK === 'true'
  }
};
```

### Service Implementation

```javascript
// backend/src/services/googleOAuthService.js
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

class GoogleOAuthService {
  constructor(config, userService, ssoService, auditService) {
    this.config = config.google;
    this.client = new OAuth2Client(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    this.userService = userService;
    this.ssoService = ssoService;
    this.auditService = auditService;
    this.stateStore = new Map(); // In production, use Redis
  }

  async generateAuthUrl(userId = null, returnUrl = '/') {
    // Check feature flag
    if (!this.config.enabled) {
      throw new Error('Google OAuth is not enabled');
    }

    // Generate state and PKCE
    const state = crypto.randomBytes(32).toString('hex');
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

    // Generate authorization URL
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: userId ? 'select_account' : 'consent',
      login_hint: userId ? await this.getUserEmail(userId) : undefined
    });

    return authUrl;
  }

  async handleCallback(code, state) {
    // Validate state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid state parameter');
    }

    if (Date.now() > stateData.expires) {
      this.stateStore.delete(state);
      throw new Error('State parameter expired');
    }

    this.stateStore.delete(state);

    try {
      // Exchange code for tokens
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

      // Audit log
      await this.auditService.log({
        userId: result.user.id,
        action: 'GOOGLE_OAUTH_LOGIN',
        resourceType: 'authentication',
        details: {
          googleId: googleUser.id,
          email: googleUser.email,
          isNewUser: result.isNewUser
        }
      });

      return {
        ...result,
        returnUrl: stateData.returnUrl
      };
    } catch (error) {
      logger.error('Google OAuth callback error', { error, state });
      throw new Error('Authentication failed');
    }
  }

  async processGoogleAuth(googleUser, tokens, existingUserId = null) {
    // Check if SSO account exists
    let ssoAccount = await this.ssoService.findByProvider(
      'google',
      googleUser.id
    );

    if (ssoAccount) {
      // Existing SSO account - update tokens and login
      await this.ssoService.updateTokens(
        ssoAccount.id,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date
      );

      const user = await this.userService.findById(ssoAccount.userId);
      
      return {
        user,
        isNewUser: false,
        ssoAccount
      };
    }

    // Check if email exists in local accounts
    const existingUser = await this.userService.findByEmail(googleUser.email);

    if (existingUser) {
      if (this.config.autoLinkAccounts || existingUserId === existingUser.id) {
        // Link accounts automatically or if user initiated
        ssoAccount = await this.linkGoogleAccount(
          existingUser.id,
          googleUser,
          tokens
        );

        return {
          user: existingUser,
          isNewUser: false,
          ssoAccount,
          accountLinked: true
        };
      } else {
        // Require manual confirmation
        throw new Error('ACCOUNT_EXISTS_REQUIRES_MERGE');
      }
    }

    // Create new user account
    if (!this.config.allowSignup) {
      throw new Error('Sign up with Google is not allowed');
    }

    const newUser = await this.createUserFromGoogle(googleUser);
    ssoAccount = await this.linkGoogleAccount(
      newUser.id,
      googleUser,
      tokens
    );

    return {
      user: newUser,
      isNewUser: true,
      ssoAccount
    };
  }

  async createUserFromGoogle(googleUser) {
    // Generate unique username
    const baseUsername = googleUser.email.split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    let username = baseUsername;
    let counter = 1;
    
    while (await this.userService.usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Create user account
    const user = await this.userService.create({
      username,
      email: googleUser.email,
      emailVerified: googleUser.email_verified,
      firstName: googleUser.given_name,
      lastName: googleUser.family_name,
      avatarUrl: googleUser.picture,
      // Generate random password for OAuth users
      password: crypto.randomBytes(32).toString('hex'),
      source: 'google_oauth'
    });

    return user;
  }

  async linkGoogleAccount(userId, googleUser, tokens) {
    return await this.ssoService.create({
      userId,
      provider: 'google',
      providerUserId: googleUser.id,
      email: googleUser.email,
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(tokens.expiry_date),
      profileData: googleUser,
      isPrimary: false
    });
  }

  async unlinkGoogleAccount(userId) {
    // Check if user has password set
    const user = await this.userService.findById(userId);
    const hasPassword = await this.userService.hasPassword(userId);
    const otherSSO = await this.ssoService.getOtherProviders(userId, 'google');

    if (!hasPassword && otherSSO.length === 0) {
      throw new Error('Cannot unlink: No other authentication method available');
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

  async mergeAccounts(existingUserId, password, googleUser, tokens) {
    // Verify password for existing account
    const verified = await this.userService.verifyPassword(
      existingUserId,
      password
    );

    if (!verified) {
      throw new Error('Invalid password');
    }

    // Link Google account to existing user
    const ssoAccount = await this.linkGoogleAccount(
      existingUserId,
      googleUser,
      tokens
    );

    // Update profile with Google data if missing
    await this.userService.updateProfileFromGoogle(existingUserId, googleUser);

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
  }

  async getUserInfo(accessToken) {
    try {
      const response = await fetch(this.config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get Google user info', { error });
      throw error;
    }
  }

  async refreshAccessToken(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(
      userId,
      'google'
    );

    if (!ssoAccount || !ssoAccount.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const { tokens } = await this.client.refreshAccessToken(
        ssoAccount.refreshToken
      );

      await this.ssoService.updateTokens(
        ssoAccount.id,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date
      );

      return tokens.access_token;
    } catch (error) {
      logger.error('Failed to refresh Google token', { error, userId });
      throw error;
    }
  }
}
```

### API Endpoints

```javascript
// backend/src/api/routes/authRoutes.js
router.get('/auth/google', async (req, res, next) => {
  try {
    // Check feature flag
    if (!req.hasFeature('google_oauth_enabled')) {
      return res.status(403).json({
        error: 'Google authentication is not available'
      });
    }

    const authUrl = await googleOAuthService.generateAuthUrl(
      req.user?.id,
      req.query.returnUrl
    );

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/google/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/login?error=${error}`);
    }

    const result = await googleOAuthService.handleCallback(code, state);

    // Generate JWT tokens
    const tokens = await authService.generateTokens(result.user);

    // Set cookies or return tokens
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.redirect(result.returnUrl || '/dashboard');
  } catch (error) {
    if (error.message === 'ACCOUNT_EXISTS_REQUIRES_MERGE') {
      // Redirect to merge account page
      res.redirect('/auth/merge?provider=google');
    } else {
      res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  }
});

router.post('/auth/google/merge', authenticate, async (req, res, next) => {
  try {
    const { password, googleAuthCode } = req.body;

    // Exchange code for Google user info
    const googleData = await googleOAuthService.exchangeCode(googleAuthCode);

    // Merge accounts
    const result = await googleOAuthService.mergeAccounts(
      req.user.id,
      password,
      googleData.user,
      googleData.tokens
    );

    res.json({
      success: true,
      message: 'Google account successfully linked'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/auth/google/unlink', authenticate, async (req, res, next) => {
  try {
    await googleOAuthService.unlinkGoogleAccount(req.user.id);
    
    res.json({
      success: true,
      message: 'Google account unlinked'
    });
  } catch (error) {
    next(error);
  }
});
```

### Frontend Implementation

```typescript
// frontend/src/components/auth/GoogleSignIn.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export const GoogleSignInButton: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Check if Google OAuth is enabled via feature flag
    checkGoogleOAuthAvailability().then(setIsAvailable);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const authUrl = await signInWithGoogle();
      // Redirect to Google
      window.location.href = authUrl;
    } catch (error) {
      toast.error('Failed to initiate Google sign-in');
    }
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={loading}
      className="google-signin-btn"
    >
      <svg className="google-icon" viewBox="0 0 24 24">
        {/* Google icon SVG */}
      </svg>
      Continue with Google
    </button>
  );
};

// Account merge component
export const GoogleAccountMerge: React.FC = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { mergeGoogleAccount } = useAuth();

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await mergeGoogleAccount(password);
      toast.success('Google account linked successfully');
      navigate('/profile');
    } catch (error) {
      toast.error('Failed to link Google account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-merge-form">
      <h2>Link Google Account</h2>
      <p>
        An account with this email already exists. 
        Enter your password to link your Google account.
      </p>
      
      <form onSubmit={handleMerge}>
        <div className="form-group">
          <label>Current Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            Link Accounts
          </button>
          <a href="/login">Cancel</a>
        </div>
      </form>
      
      <div className="alternative-options">
        <p>Or you can:</p>
        <ul>
          <li>
            <a href="/auth/google?force=new">
              Create a new account with Google
            </a>
          </li>
          <li>
            <a href="/login">
              Sign in with password instead
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

// Profile settings component
export const LinkedAccountsSettings: React.FC = () => {
  const { user, unlinkProvider } = useAuth();
  const hasPassword = user?.hasPassword;
  const linkedProviders = user?.linkedProviders || [];

  const handleUnlink = async (provider: string) => {
    if (!hasPassword && linkedProviders.length === 1) {
      toast.error('Set a password before unlinking your only sign-in method');
      return;
    }

    if (confirm(`Unlink ${provider} account?`)) {
      try {
        await unlinkProvider(provider);
        toast.success(`${provider} account unlinked`);
      } catch (error) {
        toast.error(`Failed to unlink ${provider} account`);
      }
    }
  };

  return (
    <div className="linked-accounts">
      <h3>Linked Accounts</h3>
      
      <div className="provider-list">
        <div className="provider-item">
          <img src="/images/google-icon.svg" alt="Google" />
          <span>Google</span>
          {linkedProviders.includes('google') ? (
            <>
              <span className="status linked">Linked</span>
              <button
                onClick={() => handleUnlink('google')}
                className="btn-unlink"
              >
                Unlink
              </button>
            </>
          ) : (
            <>
              <span className="status">Not linked</span>
              <GoogleSignInButton />
            </>
          )}
        </div>
      </div>
      
      {!hasPassword && linkedProviders.length > 0 && (
        <div className="alert alert-warning">
          <p>
            You're using social login only. 
            <a href="/settings/password">Set a password</a> to secure your account.
          </p>
        </div>
      )}
    </div>
  );
};
```

## Security Considerations

1. **OAuth Security**
   - PKCE implementation for public clients
   - State parameter validation
   - Token encryption at rest
   - Secure token refresh mechanism
   - OAuth scope minimization

2. **Account Security**
   - Password verification for account merging
   - Audit logging of all OAuth events
   - Session invalidation on unlink
   - Recovery options for OAuth-only accounts

3. **Data Protection**
   - Minimal data collection from Google
   - Encrypted storage of OAuth tokens
   - Regular token rotation
   - GDPR-compliant data handling

## Testing Requirements

1. **Unit Tests**
   - OAuth URL generation
   - State validation
   - Token refresh logic
   - Account merge logic

2. **Integration Tests**
   - Full OAuth flow
   - Account provisioning
   - Account linking/unlinking
   - Error handling

3. **Security Tests**
   - CSRF protection
   - State parameter tampering
   - Token storage security
   - Session management

## Documentation Updates

- OAuth setup guide for administrators
- User guide for Google sign-in
- Security best practices
- Troubleshooting guide

## Dependencies

- Issue #21: Database Schema Optimization (SSO tables)
- Issue #24: Feature Flag Management
- Google Cloud Console project setup
- OAuth 2.0 client library

## Estimated Effort

**Large (L)** - 5-7 days

### Justification:
- OAuth implementation complexity
- Account provisioning logic
- Security considerations
- UI components
- Testing OAuth flows

## Priority

**Medium** - Important for user convenience but not critical

## Labels

- `feature`
- `authentication`
- `oauth`
- `google`
- `security`