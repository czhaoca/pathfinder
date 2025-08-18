/**
 * OAuth Configuration
 * Centralized configuration for OAuth providers
 */

module.exports = {
  google: {
    // OAuth client credentials
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    
    // OAuth scopes
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    
    // OAuth endpoints
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    revocationUrl: 'https://oauth2.googleapis.com/revoke',
    
    // Security settings
    useStateParameter: true,
    usePKCE: true,
    stateExpiration: 600, // 10 minutes in seconds
    
    // Feature flags - these can be overridden by database feature flags
    enabled: process.env.GOOGLE_OAUTH_ENABLED === 'true',
    allowSignup: process.env.GOOGLE_OAUTH_ALLOW_SIGNUP !== 'false', // Default true
    requireEmailVerification: false, // Google verifies emails
    autoLinkAccounts: process.env.GOOGLE_OAUTH_AUTO_LINK === 'true',
    
    // Domain restrictions (optional)
    allowedDomains: process.env.GOOGLE_ALLOWED_DOMAINS ? 
      process.env.GOOGLE_ALLOWED_DOMAINS.split(',').map(d => d.trim()) : [],
    
    // Rate limiting
    maxAttemptsPerHour: 10,
    maxCallbacksPerHour: 20
  },
  
  linkedin: {
    // OAuth client credentials
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/auth/linkedin/callback',
    
    // OAuth scopes
    scopes: (process.env.LINKEDIN_OAUTH_SCOPES || 'openid profile email w_member_social').split(' '),
    
    // OAuth endpoints
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    profileUrl: 'https://api.linkedin.com/v2/me',
    positionsUrl: 'https://api.linkedin.com/v2/positions',
    educationUrl: 'https://api.linkedin.com/v2/educations',
    skillsUrl: 'https://api.linkedin.com/v2/skills',
    certificationsUrl: 'https://api.linkedin.com/v2/certifications',
    
    // Security settings
    useStateParameter: true,
    usePKCE: true,
    stateExpiration: parseInt(process.env.LINKEDIN_STATE_EXPIRATION || '300'), // 5 minutes default
    
    // Feature flags
    enabled: process.env.LINKEDIN_OAUTH_ENABLED === 'true',
    allowSignup: process.env.LINKEDIN_ALLOW_SIGNUP !== 'false', // Default true
    requireEmailVerification: false, // LinkedIn verifies emails
    autoLinkAccounts: process.env.LINKEDIN_AUTO_LINK_ACCOUNTS === 'true',
    
    // Import settings
    importFields: {
      workExperience: process.env.LINKEDIN_IMPORT_WORK_EXPERIENCE !== 'false',
      education: process.env.LINKEDIN_IMPORT_EDUCATION !== 'false',
      skills: process.env.LINKEDIN_IMPORT_SKILLS !== 'false',
      certifications: process.env.LINKEDIN_IMPORT_CERTIFICATIONS !== 'false',
      summary: process.env.LINKEDIN_IMPORT_SUMMARY !== 'false',
      profilePhoto: process.env.LINKEDIN_IMPORT_PROFILE_PHOTO !== 'false',
      location: process.env.LINKEDIN_IMPORT_LOCATION !== 'false',
      industry: process.env.LINKEDIN_IMPORT_INDUSTRY !== 'false'
    },
    
    // Sync settings
    syncInterval: parseInt(process.env.LINKEDIN_SYNC_INTERVAL || '86400000'), // 24 hours default
    syncEnabledDefault: process.env.LINKEDIN_SYNC_ENABLED_DEFAULT === 'true',
    
    // Rate limiting
    maxAttemptsPerHour: 20,
    maxImportsPerHour: 10,
    maxSyncsPerHour: 20
  },
  
  // Future providers can be added here
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/auth/github/callback',
    scopes: ['user:email', 'read:user'],
    enabled: false // Not implemented yet
  },
  
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback',
    tenant: process.env.MICROSOFT_TENANT || 'common',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    enabled: false // Not implemented yet
  },
  
  // Global OAuth settings
  global: {
    // Session settings
    sessionDuration: 15 * 60 * 1000, // 15 minutes
    refreshThreshold: 5 * 60 * 1000, // Refresh if less than 5 minutes left
    
    // Security
    requireHttps: process.env.NODE_ENV === 'production',
    sameSiteCookie: 'strict',
    secureCookie: process.env.NODE_ENV === 'production',
    
    // Cleanup
    stateCleanupInterval: 5 * 60 * 1000, // 5 minutes
    maxStatesPerSession: 5,
    
    // Logging
    logLevel: process.env.OAUTH_LOG_LEVEL || 'info',
    auditAllEvents: process.env.OAUTH_AUDIT_ALL === 'true'
  }
};

/**
 * Validate OAuth configuration
 */
function validateOAuthConfig() {
  const config = module.exports;
  const errors = [];
  
  // Check Google OAuth if enabled
  if (config.google.enabled) {
    if (!config.google.clientId) {
      errors.push('GOOGLE_CLIENT_ID is required when Google OAuth is enabled');
    }
    if (!config.google.clientSecret) {
      errors.push('GOOGLE_CLIENT_SECRET is required when Google OAuth is enabled');
    }
    
    // Warn about production settings
    if (process.env.NODE_ENV === 'production') {
      if (config.google.redirectUri.includes('localhost')) {
        errors.push('Google OAuth redirect URI should not use localhost in production');
      }
      if (!config.global.requireHttps) {
        errors.push('HTTPS should be required in production for OAuth');
      }
    }
  }
  
  return errors;
}

// Export validation function
module.exports.validateConfig = validateOAuthConfig;