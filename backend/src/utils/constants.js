/**
 * Application-wide constants
 */

module.exports = {
  // Authentication
  AUTH: {
    SALT_ROUNDS: 10,
    SESSION_DURATION_MS: 15 * 60 * 1000, // 15 minutes
    REFRESH_TOKEN_DURATION_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30 * 60 * 1000 // 30 minutes
  },
  
  // API Limits
  LIMITS: {
    MAX_MESSAGE_LENGTH: 2000,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    DEFAULT_HISTORY_LIMIT: 50,
    MAX_HISTORY_LIMIT: 200,
    MAX_BULK_OPERATIONS: 50,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_RESUME_PAGES: 3
  },
  
  // Database
  DB: {
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
    CONNECTION_TIMEOUT_MS: 30000,
    QUERY_TIMEOUT_MS: 60000
  },
  
  // OpenAI
  OPENAI: {
    DEFAULT_MODEL: 'gpt-4',
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.7,
    TIMEOUT_MS: 30000
  },
  
  // Resume
  RESUME: {
    TEMPLATES: ['professional', 'modern', 'executive', 'technical', 'creative'],
    FORMATS: ['pdf', 'docx', 'json'],
    ATS_SCORE_THRESHOLDS: {
      EXCELLENT: 80,
      GOOD: 60,
      POOR: 40
    },
    SECTIONS: {
      REQUIRED: ['personal', 'experiences'],
      OPTIONAL: ['skills', 'education', 'achievements', 'certifications']
    }
  },
  
  // Analytics
  ANALYTICS: {
    SKILL_PROFICIENCY_LEVELS: {
      EXPERT: { min: 80, label: 'Expert' },
      ADVANCED: { min: 60, label: 'Advanced' },
      INTERMEDIATE: { min: 40, label: 'Intermediate' },
      BEGINNER: { min: 0, label: 'Beginner' }
    },
    IMPACT_SCORE_WEIGHTS: {
      QUANTIFIABLE_METRICS: 0.4,
      SKILL_COMPLEXITY: 0.3,
      ROLE_SENIORITY: 0.2,
      DURATION: 0.1
    }
  },
  
  // CPA PERT
  CPA_PERT: {
    COMPETENCY_LEVELS: {
      LEVEL_1: { min: 0, max: 2, label: 'Entry' },
      LEVEL_2: { min: 2, max: 5, label: 'Intermediate' },
      LEVEL_3: { min: 5, max: 10, label: 'Senior' },
      LEVEL_4: { min: 10, label: 'Expert' }
    },
    REQUIRED_HOURS: {
      TOTAL: 2000,
      TECHNICAL: 1200,
      ENABLING: 800
    }
  },
  
  // Error Codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  },
  
  // Regular Expressions
  REGEX: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    USERNAME: /^[a-zA-Z0-9_-]{3,30}$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    PHONE: /^\+?[1-9]\d{1,14}$/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    LINKEDIN: /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/
  }
};