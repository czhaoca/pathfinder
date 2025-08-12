export const config = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  APP_NAME: 'Pathfinder',
  VERSION: '0.1.0-beta.1',
  ENVIRONMENT: import.meta.env.MODE || 'development',
  
  // Feature flags
  features: {
    cpaPert: true,
    jobSearch: true,
    learning: true,
    networking: true,
    analytics: true
  },
  
  // API endpoints
  endpoints: {
    auth: {
      login: '/auth/login',
      register: '/auth/register',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
      verify: '/auth/verify'
    },
    user: {
      profile: '/user/profile',
      update: '/user/update',
      preferences: '/user/preferences'
    },
    experiences: {
      list: '/experiences',
      create: '/experiences',
      update: '/experiences/:id',
      delete: '/experiences/:id',
      search: '/experiences/search'
    },
    cpaPert: {
      analyze: '/cpa-pert/analyze',
      generate: '/cpa-pert/generate',
      report: '/cpa-pert/report',
      compliance: '/cpa-pert/compliance'
    }
  },
  
  // Storage keys
  storage: {
    authToken: 'pathfinder_auth_token',
    refreshToken: 'pathfinder_refresh_token',
    user: 'pathfinder_user',
    preferences: 'pathfinder_preferences'
  },
  
  // Timeouts
  timeouts: {
    api: 30000, // 30 seconds
    auth: 15000, // 15 seconds
    upload: 60000 // 60 seconds
  }
};