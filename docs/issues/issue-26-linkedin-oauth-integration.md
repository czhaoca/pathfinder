# Issue #26: LinkedIn OAuth Integration with Local Provisioning

## Title
Implement LinkedIn OAuth 2.0 Authentication with Shared SSO Service Architecture

## User Story
As a professional user, I want to sign in with my LinkedIn account so that I can leverage my professional profile data while maintaining control over my local account settings.

## Description
Integrate LinkedIn OAuth 2.0 for user authentication, building on the shared SSO service architecture established for Google OAuth. This implementation will enable LinkedIn sign-in with automatic profile data import, local account provisioning, and manual account merge workflow. The feature includes professional data enrichment from LinkedIn profiles.

## Acceptance Criteria

### OAuth Implementation
- [ ] LinkedIn OAuth 2.0 integration with appropriate scopes
- [ ] Secure OAuth flow leveraging shared SSO service
- [ ] Profile data extraction including professional details
- [ ] Support for LinkedIn profile data import
- [ ] Automatic skill extraction from LinkedIn
- [ ] Experience history import capability

### Shared Architecture
- [ ] Reuse SSO service from Google OAuth implementation
- [ ] Unified account linking interface
- [ ] Common merge workflow with password confirmation
- [ ] Shared token management system
- [ ] Consistent audit logging
- [ ] Feature flag control integration

### Professional Data Enhancement
- [ ] Import work experience from LinkedIn
- [ ] Extract and map skills to internal taxonomy
- [ ] Import education history
- [ ] Capture professional headline and summary
- [ ] Import recommendations (with permission)
- [ ] Periodic profile sync capability

## Technical Implementation

### LinkedIn OAuth Configuration

```javascript
// backend/src/config/oauth.js (extended)
module.exports = {
  // ... existing Google config ...
  
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/auth/linkedin/callback',
    scopes: [
      'openid',
      'profile',
      'email',
      'w_member_social'  // For posting updates (future feature)
    ],
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    profileUrl: 'https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
    
    // Professional data endpoints
    experienceUrl: 'https://api.linkedin.com/v2/positions',
    educationUrl: 'https://api.linkedin.com/v2/educations',
    skillsUrl: 'https://api.linkedin.com/v2/skills',
    
    // Security settings (shared with Google)
    useStateParameter: true,
    usePKCE: true,
    stateExpiration: 600,
    
    // Feature flags
    enabled: process.env.LINKEDIN_OAUTH_ENABLED === 'true',
    allowSignup: process.env.LINKEDIN_OAUTH_ALLOW_SIGNUP === 'true',
    autoImportProfile: process.env.LINKEDIN_AUTO_IMPORT === 'true',
    syncInterval: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
};
```

### Shared SSO Service Extension

```javascript
// backend/src/services/ssoService.js
class SSOService {
  constructor(ssoRepository, encryptionService) {
    this.ssoRepository = ssoRepository;
    this.encryptionService = encryptionService;
    this.providers = new Map();
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  async authenticate(provider, code, state) {
    const providerService = this.providers.get(provider);
    if (!providerService) {
      throw new Error(`Provider ${provider} not configured`);
    }

    return await providerService.handleCallback(code, state);
  }

  async findByProvider(provider, providerUserId) {
    return await this.ssoRepository.findByProvider(provider, providerUserId);
  }

  async create(ssoData) {
    // Encrypt tokens
    const encryptedTokens = await this.encryptTokens(
      ssoData.accessToken,
      ssoData.refreshToken
    );

    return await this.ssoRepository.create({
      ...ssoData,
      accessToken: encryptedTokens.accessToken,
      refreshToken: encryptedTokens.refreshToken
    });
  }

  async updateTokens(ssoAccountId, accessToken, refreshToken, expiresAt) {
    const encryptedTokens = await this.encryptTokens(
      accessToken,
      refreshToken
    );

    return await this.ssoRepository.updateTokens(
      ssoAccountId,
      encryptedTokens.accessToken,
      encryptedTokens.refreshToken,
      expiresAt
    );
  }

  async getLinkedProviders(userId) {
    const accounts = await this.ssoRepository.findByUserId(userId);
    return accounts.map(acc => ({
      provider: acc.provider,
      linkedAt: acc.linkedAt,
      email: acc.email,
      displayName: acc.displayName
    }));
  }

  async unlinkProvider(userId, provider) {
    // Check if user has other auth methods
    const otherProviders = await this.ssoRepository.getOtherProviders(
      userId,
      provider
    );
    
    const user = await this.userRepository.findById(userId);
    const hasPassword = user.passwordHash !== null;

    if (!hasPassword && otherProviders.length === 0) {
      throw new Error('Cannot unlink last authentication method');
    }

    return await this.ssoRepository.removeProvider(userId, provider);
  }

  async encryptTokens(accessToken, refreshToken) {
    return {
      accessToken: accessToken 
        ? await this.encryptionService.encrypt(accessToken)
        : null,
      refreshToken: refreshToken
        ? await this.encryptionService.encrypt(refreshToken)
        : null
    };
  }

  async decryptTokens(encryptedAccess, encryptedRefresh) {
    return {
      accessToken: encryptedAccess
        ? await this.encryptionService.decrypt(encryptedAccess)
        : null,
      refreshToken: encryptedRefresh
        ? await this.encryptionService.decrypt(encryptedRefresh)
        : null
    };
  }
}
```

### LinkedIn OAuth Service

```javascript
// backend/src/services/linkedInOAuthService.js
class LinkedInOAuthService {
  constructor(config, userService, ssoService, profileService, auditService) {
    this.config = config.linkedin;
    this.userService = userService;
    this.ssoService = ssoService;
    this.profileService = profileService;
    this.auditService = auditService;
    this.stateStore = new Map();
  }

  async generateAuthUrl(userId = null, returnUrl = '/', importProfile = false) {
    if (!this.config.enabled) {
      throw new Error('LinkedIn OAuth is not enabled');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    this.stateStore.set(state, {
      userId,
      returnUrl,
      codeVerifier,
      importProfile,
      createdAt: Date.now(),
      expires: Date.now() + (this.config.stateExpiration * 1000)
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${this.config.authorizationUrl}?${params}`;
  }

  async handleCallback(code, state) {
    const stateData = this.stateStore.get(state);
    if (!stateData || Date.now() > stateData.expires) {
      throw new Error('Invalid or expired state');
    }

    this.stateStore.delete(state);

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        code,
        stateData.codeVerifier
      );

      // Get LinkedIn user info
      const linkedInUser = await this.getUserInfo(tokens.access_token);

      // Get professional data if requested
      let professionalData = null;
      if (stateData.importProfile || this.config.autoImportProfile) {
        professionalData = await this.getProfessionalData(tokens.access_token);
      }

      // Process authentication
      const result = await this.processLinkedInAuth(
        linkedInUser,
        professionalData,
        tokens,
        stateData.userId
      );

      // Audit log
      await this.auditService.log({
        userId: result.user.id,
        action: 'LINKEDIN_OAUTH_LOGIN',
        resourceType: 'authentication',
        details: {
          linkedInId: linkedInUser.sub,
          email: linkedInUser.email,
          isNewUser: result.isNewUser,
          profileImported: !!professionalData
        }
      });

      return {
        ...result,
        returnUrl: stateData.returnUrl
      };
    } catch (error) {
      logger.error('LinkedIn OAuth callback error', { error });
      throw error;
    }
  }

  async processLinkedInAuth(linkedInUser, professionalData, tokens, existingUserId) {
    // Check if SSO account exists
    let ssoAccount = await this.ssoService.findByProvider(
      'linkedin',
      linkedInUser.sub
    );

    if (ssoAccount) {
      // Update tokens and professional data
      await this.ssoService.updateTokens(
        ssoAccount.id,
        tokens.access_token,
        tokens.refresh_token,
        new Date(Date.now() + tokens.expires_in * 1000)
      );

      if (professionalData) {
        await this.importProfessionalData(ssoAccount.userId, professionalData);
      }

      const user = await this.userService.findById(ssoAccount.userId);
      return { user, isNewUser: false, ssoAccount };
    }

    // Check for existing user by email
    const existingUser = await this.userService.findByEmail(linkedInUser.email);

    if (existingUser) {
      if (this.config.autoLinkAccounts || existingUserId === existingUser.id) {
        ssoAccount = await this.linkLinkedInAccount(
          existingUser.id,
          linkedInUser,
          tokens
        );

        if (professionalData) {
          await this.importProfessionalData(existingUser.id, professionalData);
        }

        return {
          user: existingUser,
          isNewUser: false,
          ssoAccount,
          accountLinked: true
        };
      } else {
        throw new Error('ACCOUNT_EXISTS_REQUIRES_MERGE');
      }
    }

    // Create new user
    if (!this.config.allowSignup) {
      throw new Error('Sign up with LinkedIn is not allowed');
    }

    const newUser = await this.createUserFromLinkedIn(
      linkedInUser,
      professionalData
    );
    
    ssoAccount = await this.linkLinkedInAccount(
      newUser.id,
      linkedInUser,
      tokens
    );

    return {
      user: newUser,
      isNewUser: true,
      ssoAccount,
      profileImported: !!professionalData
    };
  }

  async createUserFromLinkedIn(linkedInUser, professionalData) {
    // Generate username from name or email
    const nameParts = [
      linkedInUser.given_name?.toLowerCase(),
      linkedInUser.family_name?.toLowerCase()
    ].filter(Boolean);
    
    const baseUsername = nameParts.length > 0
      ? nameParts.join('_').replace(/[^a-z0-9_]/g, '')
      : linkedInUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    let username = baseUsername;
    let counter = 1;
    
    while (await this.userService.usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Create user with LinkedIn data
    const user = await this.userService.create({
      username,
      email: linkedInUser.email,
      emailVerified: linkedInUser.email_verified,
      firstName: linkedInUser.given_name,
      lastName: linkedInUser.family_name,
      avatarUrl: linkedInUser.picture,
      password: crypto.randomBytes(32).toString('hex'),
      source: 'linkedin_oauth',
      
      // Professional fields from LinkedIn
      currentTitle: professionalData?.currentPosition?.title,
      currentCompany: professionalData?.currentPosition?.company,
      professionalHeadline: professionalData?.headline,
      bio: professionalData?.summary
    });

    // Import full professional data
    if (professionalData) {
      await this.importProfessionalData(user.id, professionalData);
    }

    return user;
  }

  async importProfessionalData(userId, data) {
    try {
      // Import work experiences
      if (data.positions?.length > 0) {
        for (const position of data.positions) {
          await this.profileService.addExperience(userId, {
            title: position.title,
            company: position.companyName,
            location: position.location,
            startDate: this.parseLinkedInDate(position.startDate),
            endDate: position.endDate 
              ? this.parseLinkedInDate(position.endDate)
              : null,
            isCurrent: !position.endDate,
            description: position.description,
            source: 'linkedin_import'
          });
        }
      }

      // Import education
      if (data.educations?.length > 0) {
        for (const education of data.educations) {
          await this.profileService.addEducation(userId, {
            institution: education.schoolName,
            degree: education.degree,
            fieldOfStudy: education.fieldOfStudy,
            startDate: this.parseLinkedInDate(education.startDate),
            endDate: this.parseLinkedInDate(education.endDate),
            source: 'linkedin_import'
          });
        }
      }

      // Import skills
      if (data.skills?.length > 0) {
        const skills = data.skills.map(skill => ({
          name: skill.name,
          endorsements: skill.endorsementCount || 0,
          source: 'linkedin_import'
        }));
        
        await this.profileService.updateSkills(userId, skills);
      }

      // Update profile summary
      if (data.summary) {
        await this.profileService.updateSummary(userId, {
          headline: data.headline,
          summary: data.summary,
          location: data.location,
          industry: data.industry
        });
      }

      return { success: true, itemsImported: {
        experiences: data.positions?.length || 0,
        educations: data.educations?.length || 0,
        skills: data.skills?.length || 0
      }};
    } catch (error) {
      logger.error('Failed to import LinkedIn data', { error, userId });
      throw error;
    }
  }

  async getProfessionalData(accessToken) {
    try {
      const [profile, positions, educations, skills] = await Promise.all([
        this.fetchLinkedInProfile(accessToken),
        this.fetchLinkedInPositions(accessToken),
        this.fetchLinkedInEducations(accessToken),
        this.fetchLinkedInSkills(accessToken)
      ]);

      return {
        ...profile,
        positions,
        educations,
        skills,
        currentPosition: positions?.[0]
      };
    } catch (error) {
      logger.error('Failed to fetch LinkedIn professional data', { error });
      // Return partial data if some requests fail
      return null;
    }
  }

  async syncLinkedInProfile(userId) {
    const ssoAccount = await this.ssoService.findByUserAndProvider(
      userId,
      'linkedin'
    );

    if (!ssoAccount) {
      throw new Error('No LinkedIn account linked');
    }

    // Check if sync is needed
    const lastSync = ssoAccount.lastSyncAt;
    const syncInterval = this.config.syncInterval;
    
    if (lastSync && Date.now() - lastSync < syncInterval) {
      return { 
        success: false, 
        message: 'Profile recently synced' 
      };
    }

    // Refresh token if needed
    let accessToken = ssoAccount.accessToken;
    if (ssoAccount.tokenExpiresAt < new Date()) {
      accessToken = await this.refreshAccessToken(ssoAccount);
    }

    // Fetch and import updated data
    const professionalData = await this.getProfessionalData(accessToken);
    if (professionalData) {
      await this.importProfessionalData(userId, professionalData);
      await this.ssoService.updateLastSync(ssoAccount.id);
    }

    return { 
      success: true, 
      message: 'Profile synced successfully' 
    };
  }

  parseLinkedInDate(dateObj) {
    if (!dateObj) return null;
    const { year, month = 1, day = 1 } = dateObj;
    return new Date(year, month - 1, day);
  }
}
```

### Frontend Implementation

```typescript
// frontend/src/components/auth/LinkedInSignIn.tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export const LinkedInSignInButton: React.FC<{
  importProfile?: boolean;
}> = ({ importProfile = true }) => {
  const { signInWithLinkedIn, loading } = useAuth();
  const [importing, setImporting] = useState(false);

  const handleLinkedInSignIn = async () => {
    try {
      setImporting(importProfile);
      const authUrl = await signInWithLinkedIn({ importProfile });
      window.location.href = authUrl;
    } catch (error) {
      toast.error('Failed to initiate LinkedIn sign-in');
      setImporting(false);
    }
  };

  return (
    <button
      onClick={handleLinkedInSignIn}
      disabled={loading || importing}
      className="linkedin-signin-btn"
    >
      <svg className="linkedin-icon" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
      {importing ? 'Importing Profile...' : 'Continue with LinkedIn'}
    </button>
  );
};

// Profile sync component
export const LinkedInProfileSync: React.FC = () => {
  const { user, syncLinkedInProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(user?.linkedInLastSync);

  const isLinkedInConnected = user?.linkedProviders?.includes('linkedin');

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncLinkedInProfile();
      if (result.success) {
        toast.success('LinkedIn profile synced successfully');
        setLastSync(new Date());
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      toast.error('Failed to sync LinkedIn profile');
    } finally {
      setSyncing(false);
    }
  };

  if (!isLinkedInConnected) {
    return (
      <div className="linkedin-sync-prompt">
        <h4>Import Your Professional Profile</h4>
        <p>Connect your LinkedIn account to import your professional experience, skills, and education.</p>
        <LinkedInSignInButton importProfile={true} />
      </div>
    );
  }

  return (
    <div className="linkedin-sync-control">
      <div className="sync-header">
        <img src="/images/linkedin-icon.svg" alt="LinkedIn" />
        <div>
          <h4>LinkedIn Profile Sync</h4>
          <p>
            Last synced: {lastSync 
              ? formatRelativeTime(lastSync)
              : 'Never'}
          </p>
        </div>
      </div>
      
      <button
        onClick={handleSync}
        disabled={syncing}
        className="btn-sync"
      >
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
      
      <div className="sync-info">
        <p>Syncing will update:</p>
        <ul>
          <li>Work experiences</li>
          <li>Education history</li>
          <li>Professional skills</li>
          <li>Profile summary</li>
        </ul>
      </div>
    </div>
  );
};

// Professional data display
export const ImportedProfessionalData: React.FC = () => {
  const { profile } = useProfile();
  const linkedInData = profile?.importedFrom?.linkedin;

  if (!linkedInData) {
    return null;
  }

  return (
    <div className="imported-data-summary">
      <div className="import-header">
        <img src="/images/linkedin-icon.svg" alt="LinkedIn" />
        <span>Imported from LinkedIn</span>
      </div>
      
      <div className="import-stats">
        <div className="stat">
          <span className="value">{linkedInData.experiences}</span>
          <span className="label">Experiences</span>
        </div>
        <div className="stat">
          <span className="value">{linkedInData.skills}</span>
          <span className="label">Skills</span>
        </div>
        <div className="stat">
          <span className="value">{linkedInData.educations}</span>
          <span className="label">Education</span>
        </div>
      </div>
      
      <button onClick={() => navigate('/profile/review-import')}>
        Review Imported Data
      </button>
    </div>
  );
};
```

## Security Considerations

1. **OAuth Security**
   - Reuse secure state management from Google OAuth
   - Token encryption using shared encryption service
   - Secure token refresh mechanism
   - Minimal scope requests

2. **Data Privacy**
   - User consent for profile import
   - Selective data import options
   - Data retention policies
   - GDPR compliance for EU users

3. **Account Security**
   - Shared merge workflow with password verification
   - Consistent audit logging
   - Prevention of account takeover
   - Recovery options

## Testing Requirements

1. **Unit Tests**
   - LinkedIn-specific OAuth flow
   - Professional data parsing
   - Profile import logic
   - Sync functionality

2. **Integration Tests**
   - Full LinkedIn OAuth flow
   - Data import pipeline
   - Account linking with existing SSO
   - Error handling

3. **Data Tests**
   - LinkedIn data format parsing
   - Data transformation accuracy
   - Import deduplication
   - Sync updates

## Documentation Updates

- LinkedIn OAuth setup guide
- Professional data import guide
- Privacy policy updates for LinkedIn data
- User guide for profile syncing

## Dependencies

- Issue #21: Database Schema Optimization (SSO tables)
- Issue #24: Feature Flag Management
- Issue #25: Google OAuth (shared SSO service)
- LinkedIn Developer App creation
- Professional data parsing logic

## Estimated Effort

**Medium (M)** - 3-5 days

### Justification:
- Leverages existing SSO service architecture
- Similar flow to Google OAuth
- Additional complexity for professional data import
- Testing of data import features

## Priority

**Medium** - Valuable for professional users, builds on existing OAuth

## Labels

- `feature`
- `authentication`
- `oauth`
- `linkedin`
- `data-import`