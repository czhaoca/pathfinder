const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const ErrorHandler = require('./middleware/errorHandler');
const container = require('../container');

// Route imports - V1 (Legacy)
const createAuthRoutes = require('./routes/authRoutes');
const createProfileRoutes = require('./routes/profileRoutes');
const createExperienceRoutes = require('./routes/experienceRoutes');
const createChatRoutes = require('./routes/chatRoutes');
const createCPAPertRoutes = require('./routes/cpaPertRoutes');
const createCPAPertEnhancedRoutes = require('./routes/cpaPertEnhancedRoutes');
const createAnalyticsRoutes = require('./routes/analyticsRoutes');
const createResumeRoutes = require('./routes/resumeRoutes');
const careerPathRoutes = require('./routes/careerPathRoutes');
const networkingRoutes = require('./routes/networkingRoutes');
const createJobSearchRoutes = require('./routes/jobSearchRoutes');
const createLearningRoutes = require('./routes/learningRoutes');
const { initializeRoutes: createInvitationRoutes } = require('./routes/invitationRoutes');
const createAnalyticsDashboardRoutes = require('./routes/analyticsDashboardRoutes');

// Route imports - V2 (New Authentication System)
const authV2Routes = require('../routes/auth.v2');
const usersV2Routes = require('../routes/users.v2');
const adminV2Routes = require('../routes/admin.v2');

class App {
  constructor() {
    this.app = express();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize dependency container
      await container.initialize();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handlers
      this.setupErrorHandlers();
      
      this.isInitialized = true;
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application', { error: error.message });
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Explicit security headers to match docs
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      // HSTS only over HTTPS
      if (req.secure || (req.headers['x-forwarded-proto'] === 'https')) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      }
      next();
    });

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Total-Count']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request processed', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
      });
      
      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5, // limit auth attempts
      skipSuccessfulRequests: true,
      message: 'Too many authentication attempts, please try again later.'
    });

    this.app.use('/api/', limiter);
    this.app.use('/api/auth/', authLimiter);
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API Version 2 routes (New Authentication System with RBAC)
    this.app.use('/api/v2/auth', authV2Routes);
    this.app.use('/api/v2/users', usersV2Routes);
    if (adminV2Routes) {
      this.app.use('/api/v2/admin', adminV2Routes);
    }
    
    // API Version 1 routes (Legacy - with deprecation warning)
    this.app.use('/api/v1/*', (req, res, next) => {
      res.set('X-API-Deprecation-Warning', 'API v1 is deprecated. Please migrate to v2 by June 1, 2024.');
      res.set('X-API-Deprecation-Date', '2024-06-01');
      res.set('X-API-Deprecation-Info', 'https://docs.pathfinder.com/api/migration');
      next();
    });
    
    this.app.use('/api/v1/auth', createAuthRoutes(container));
    this.app.use('/api/v1/profile', createProfileRoutes(container));
    this.app.use('/api/v1/experiences', createExperienceRoutes(container));
    this.app.use('/api/v1/chat', createChatRoutes(container));
    this.app.use('/api/v1/cpa-pert', createCPAPertRoutes(container));
    if (process.env.ENHANCED_PERT_ENABLED === 'true') {
      this.app.use('/api/v1/cpa-pert/enhanced', createCPAPertEnhancedRoutes(container));
    }
    this.app.use('/api/v1/analytics', createAnalyticsRoutes(container));
    this.app.use('/api/v1/analytics/dashboard', createAnalyticsDashboardRoutes(container));
    this.app.use('/api/v1/resume', createResumeRoutes(container));
    this.app.use('/api/v1', careerPathRoutes);
    this.app.use('/api/v1', networkingRoutes);
    this.app.use('/api/v1', createJobSearchRoutes(container));
    this.app.use('/api/v1/learning', createLearningRoutes(container));
    
    // Default unversioned routes (forward to v2)
    this.app.use('/api/auth', authV2Routes);
    this.app.use('/api/users', usersV2Routes);
    if (adminV2Routes) {
      this.app.use('/api/admin', adminV2Routes);
    }
    
    // Invitation routes (both admin and public)
    this.app.use('/api', createInvitationRoutes(container));
    
    // Legacy unversioned routes (forward to v1 with deprecation warning)
    this.app.use('/api/profile', (req, res, next) => {
      res.set('X-API-Warning', 'Unversioned endpoints are deprecated. Please use /api/v2/* endpoints.');
      next();
    }, createProfileRoutes(container));
    this.app.use('/api/experiences', createExperienceRoutes(container));
    this.app.use('/api/chat', createChatRoutes(container));
    this.app.use('/api/cpa-pert', createCPAPertRoutes(container));
    if (process.env.ENHANCED_PERT_ENABLED === 'true') {
      this.app.use('/api/cpa-pert/enhanced', createCPAPertEnhancedRoutes(container));
    }
    this.app.use('/api/analytics', createAnalyticsRoutes(container));
    this.app.use('/api/analytics/dashboard', createAnalyticsDashboardRoutes(container));
    this.app.use('/api/resume', createResumeRoutes(container));
    this.app.use('/api', careerPathRoutes);
    this.app.use('/api', networkingRoutes);
    this.app.use('/api', createJobSearchRoutes(container));
    this.app.use('/api/learning', createLearningRoutes(container));

    // API documentation
    const infoResponder = (req, res) => {
      res.json({
        message: 'Career Navigator API',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            refresh: 'POST /api/auth/refresh',
            logout: 'POST /api/auth/logout'
          },
          profile: {
            get: 'GET /api/profile',
            update: 'PUT /api/profile',
            changePassword: 'POST /api/profile/change-password',
            delete: 'DELETE /api/profile'
          },
          experiences: {
            list: 'GET /api/experiences',
            create: 'POST /api/experiences',
            get: 'GET /api/experiences/:id',
            update: 'PUT /api/experiences/:id',
            delete: 'DELETE /api/experiences/:id'
          },
          chat: {
            message: 'POST /api/chat/message',
            history: 'GET /api/chat/history'
          },
          cpaPert: {
            analyzeExperience: 'POST /api/cpa-pert/analyze-experience',
            competencyMapping: 'GET /api/cpa-pert/competency-mapping/:experienceId',
            generateResponse: 'POST /api/cpa-pert/generate-response',
            complianceCheck: 'GET /api/cpa-pert/compliance-check',
            validateRequirements: 'POST /api/cpa-pert/validate-requirements',
            competencyFramework: 'GET /api/cpa-pert/competency-framework',
            proficiencyAssessment: 'GET /api/cpa-pert/proficiency-assessment/:experienceId',
            responses: 'GET /api/cpa-pert/responses',
            competencyReport: 'GET /api/cpa-pert/competency-report',
            updateResponse: 'PUT /api/cpa-pert/response/:responseId',
            deleteResponse: 'DELETE /api/cpa-pert/response/:responseId',
            batchAnalyze: 'POST /api/cpa-pert/batch/analyze',
            batchGenerate: 'POST /api/cpa-pert/batch/generate'
          },
          analytics: {
            skillsProgression: 'GET /api/analytics/skills-progression',
            careerTrajectory: 'GET /api/analytics/career-trajectory',
            summary: 'GET /api/analytics/summary',
            impactScores: 'GET /api/analytics/impact-scores',
            insights: 'GET /api/analytics/insights',
            export: 'GET /api/analytics/export',
            quantifyAchievements: 'POST /api/analytics/experiences/:experienceId/quantify',
            skillRecommendations: 'POST /api/analytics/skill-recommendations'
          },
          resume: {
            templates: 'GET /api/resume/templates',
            preview: 'GET /api/resume/preview',
            generate: 'POST /api/resume/generate',
            generateVersions: 'POST /api/resume/generate-versions',
            atsOptimization: 'GET /api/resume/ats-optimization',
            updateSection: 'PUT /api/resume/section/:section'
          },
          jobSearch: {
            search: 'GET /api/jobs/search',
            recommended: 'GET /api/jobs/recommended',
            details: 'GET /api/jobs/:jobId',
            matchScores: 'POST /api/jobs/match-scores',
            import: 'POST /api/jobs/import',
            preferences: 'GET /api/job-preferences',
            updatePreferences: 'PUT /api/job-preferences',
            savedSearches: 'GET /api/saved-searches',
            applications: 'GET /api/applications',
            applicationDetails: 'GET /api/applications/:applicationId',
            createApplication: 'POST /api/applications',
            applicationTimeline: 'GET /api/applications/:applicationId/timeline',
            applicationStats: 'GET /api/applications/stats',
            interviewQuestions: 'GET /api/interview-prep/questions',
            interviewPrep: 'GET /api/interview-prep/application/:applicationId',
            interviewResponse: 'POST /api/interview-prep/responses',
            interviewInsights: 'GET /api/interview-prep/insights',
            companies: 'GET /api/companies/search',
            companyDetails: 'GET /api/companies/:companyId'
          },
          learning: {
            coursesSearch: 'GET /api/learning/courses/search',
            coursesRecommended: 'GET /api/learning/courses/recommended',
            coursesEnrolled: 'GET /api/learning/courses/enrolled',
            courseDetails: 'GET /api/learning/courses/:courseId',
            courseEnroll: 'POST /api/learning/courses/enroll',
            courseProgress: 'PUT /api/learning/courses/:enrollmentId/progress',
            courseComplete: 'POST /api/learning/courses/:enrollmentId/complete',
            assessments: 'GET /api/learning/assessments',
            assessmentStart: 'POST /api/learning/assessments/:assessmentId/start',
            assessmentSubmit: 'POST /api/learning/assessments/:assessmentId/submit',
            assessmentResults: 'GET /api/learning/assessments/results',
            certificationsCatalog: 'GET /api/learning/certifications/catalog',
            certificationsMy: 'GET /api/learning/certifications/my',
            certificationsAdd: 'POST /api/learning/certifications/add',
            learningPaths: 'GET /api/learning/learning-paths',
            learningPathsMy: 'GET /api/learning/learning-paths/my',
            learningPathEnroll: 'POST /api/learning/learning-paths/:pathId/enroll',
            learningGoals: 'GET /api/learning/learning-goals',
            learningAnalytics: 'GET /api/learning/learning/analytics'
          }
        }
      });
    };

    this.app.get('/api', infoResponder);
    this.app.get('/api/v1', infoResponder);
  }

  setupErrorHandlers() {
    // 404 handler
    this.app.use(ErrorHandler.notFound());

    // Global error handler
    this.app.use(ErrorHandler.handle());
  }

  getExpressApp() {
    if (!this.isInitialized) {
      throw new Error('Application not initialized. Call initialize() first.');
    }
    return this.app;
  }

  async shutdown() {
    logger.info('Shutting down application...');
    await container.shutdown();
    logger.info('Application shut down complete');
  }
}

module.exports = App;
