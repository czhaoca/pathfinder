const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const ErrorHandler = require('./middleware/errorHandler');
const container = require('../container');

// Route imports
const createAuthRoutes = require('./routes/authRoutes');
const createProfileRoutes = require('./routes/profileRoutes');
const createExperienceRoutes = require('./routes/experienceRoutes');
const createChatRoutes = require('./routes/chatRoutes');
const createCPAPertRoutes = require('./routes/cpaPertRoutes');
const createAnalyticsRoutes = require('./routes/analyticsRoutes');
const createResumeRoutes = require('./routes/resumeRoutes');
const careerPathRoutes = require('./routes/careerPathRoutes');
const networkingRoutes = require('./routes/networkingRoutes');

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

    // API routes
    this.app.use('/api/auth', createAuthRoutes(container));
    this.app.use('/api/profile', createProfileRoutes(container));
    this.app.use('/api/experiences', createExperienceRoutes(container));
    this.app.use('/api/chat', createChatRoutes(container));
    this.app.use('/api/cpa-pert', createCPAPertRoutes(container));
    this.app.use('/api/analytics', createAnalyticsRoutes(container));
    this.app.use('/api/resume', createResumeRoutes(container));
    this.app.use('/api', careerPathRoutes);
    this.app.use('/api', networkingRoutes);

    // API documentation
    this.app.get('/api', (req, res) => {
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
          }
        }
      });
    });
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