#!/usr/bin/env node

/**
 * Career Navigator Multi-User MCP Server
 * Model Context Protocol server with Oracle Autonomous Database backend
 * Supports multi-user authentication with user-prefixed schema isolation
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const winston = require('winston');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { format, parseISO, isValid } = require('date-fns');

const DatabaseManager = require('../lib/database');
const config = require('../config/mcp-config');

// Environment-specific server configuration
const serverInfo = {
  name: `${config.project.name}-mcp-${config.environment}`,
  version: config.project.version,
  description: `Career Navigator MCP Server (${config.environment.toUpperCase()})`,
  environment: config.environment,
  tablePrefix: config.project.tablePrefix,
  schemaPrefix: config.project.schemaPrefix,
  databaseConfig: config.database[config.environment]
};

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

if (config.logging.logFile) {
  logger.add(new winston.transports.File({ filename: config.logging.logFile }));
}

/**
 * Validation schemas for MCP tool inputs
 */
const schemas = {
  // Authentication schemas
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().max(255).optional(),
    lastName: Joi.string().max(255).optional()
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    mfaCode: Joi.string().optional()
  }),

  // Experience schemas
  storeExperience: Joi.object({
    title: Joi.string().max(255).required(),
    organization: Joi.string().max(255).optional(),
    department: Joi.string().max(255).optional(),
    location: Joi.string().max(255).optional(),
    description: Joi.string().max(config.mcp.limits.maxDescriptionLength).required(),
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().optional(),
    isCurrent: Joi.boolean().default(false),
    experienceType: Joi.string().valid('work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training').required(),
    employmentType: Joi.string().valid('full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer').optional(),
    extractedSkills: Joi.array().items(Joi.object()).max(config.mcp.limits.maxSkillsPerExperience).optional(),
    keyHighlights: Joi.array().items(Joi.object()).max(config.mcp.limits.maxHighlightsPerExperience).optional(),
    quantifiedImpacts: Joi.object().optional(),
    technologiesUsed: Joi.array().items(Joi.string()).optional(),
    achievements: Joi.array().items(Joi.object()).optional(),
    teamSize: Joi.number().min(0).optional(),
    budgetManaged: Joi.number().min(0).optional(),
    revenueImpact: Joi.number().optional(),
    costSavings: Joi.number().min(0).optional()
  }),
  
  searchExperiences: Joi.object({
    query: Joi.string().optional(),
    experienceType: Joi.string().valid('work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training').optional(),
    isCurrent: Joi.boolean().optional(),
    dateFrom: Joi.string().isoDate().optional(),
    dateTo: Joi.string().isoDate().optional(),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }),

  updateProfile: Joi.object({
    totalYearsExperience: Joi.number().min(0).max(100).optional(),
    industries: Joi.array().items(Joi.string()).optional(),
    coreStrengths: Joi.object().optional(),
    technicalSkills: Joi.object().optional(),
    softSkills: Joi.object().optional(),
    leadershipSkills: Joi.object().optional(),
    careerInterests: Joi.object().optional(),
    careerGoals: Joi.object().optional(),
    careerProgression: Joi.object().optional(),
    keyAchievements: Joi.object().optional(),
    educationSummary: Joi.object().optional(),
    certifications: Joi.object().optional(),
    languages: Joi.object().optional(),
    volunteerExperience: Joi.object().optional()
  }),

  updateQuickSummary: Joi.object({
    executiveSummary: Joi.string().max(1000).required(),
    headline: Joi.string().max(255).required(),
    keySkills: Joi.array().items(Joi.string()).max(10).optional(),
    yearsExperience: Joi.number().min(0).max(100).optional(),
    currentRole: Joi.string().max(255).optional(),
    currentCompany: Joi.string().max(255).optional(),
    industries: Joi.array().items(Joi.string()).max(3).optional(),
    educationLevel: Joi.string().max(100).optional(),
    topCertifications: Joi.array().items(Joi.string()).optional(),
    location: Joi.string().max(255).optional(),
    careerGoals: Joi.object().optional(),
    uniqueValueProps: Joi.object().optional(),
    availability: Joi.string().max(100).optional()
  })
};

class CareerNavigatorMCP {
  constructor() {
    this.server = new Server(
      {
        name: config.mcp.server.name,
        version: config.mcp.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.performanceMetrics = {
      toolCalls: 0,
      totalResponseTime: 0,
      errors: 0,
      authAttempts: 0,
      lastReset: Date.now()
    };

    this.setupTools();
    this.setupEventHandlers();
  }

  /**
   * Extract and validate authentication token
   */
  async validateAuth(request) {
    const authHeader = request.meta?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header. Use: Authorization: Bearer <token>');
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');

      // Get user details and verify session
      const user = await DatabaseManager.getUserById(decoded.userId);
      if (!user || user.account_status !== 'active') {
        throw new Error('User account not found or inactive');
      }

      // Check if session is still active
      const session = await DatabaseManager.getActiveSession(this.hashToken(token));
      if (!session) {
        throw new Error('Invalid or expired session');
      }

      // Update last activity
      await DatabaseManager.updateSessionActivity(session.session_id);

      return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        schemaPrefix: user.schema_prefix
      };
    } catch (error) {
      await this.auditLog(null, 'AUTH_FAILED', { error: error.message });
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  /**
   * Hash token for secure storage
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Audit log helper
   */
  async auditLog(userId, action, details = {}) {
    try {
      await DatabaseManager.insertAuditLog({
        userId,
        action,
        resourceType: details.resourceType || null,
        resourceId: details.resourceId || null,
        requestData: details.requestData ? JSON.stringify(details.requestData) : null,
        responseCode: details.responseCode || null,
        executionTimeMs: details.executionTime || null,
        success: details.success !== false,
        errorMessage: details.error || null
      });
    } catch (error) {
      logger.error('Audit logging failed', { error: error.message });
    }
  }

  /**
   * Setup MCP tool handlers
   */
  setupTools() {
    // Tool execution handler with authentication
    this.server.setRequestHandler('tools/call', async (request) => {
      const startTime = Date.now();
      let user = null;

      try {
        // Public endpoints that don't require authentication
        if (['register', 'login', 'health_check'].includes(request.params.name)) {
          return await this.handlePublicTool(request.params.name, request.params.arguments);
        }

        // Authenticate user for protected endpoints
        user = await this.validateAuth(request);
        logger.info(`MCP tool called: ${request.params.name}`, {
          tool: request.params.name,
          user: user.username,
          hasArguments: !!request.params.arguments
        });

        let result;
        switch (request.params.name) {
          case 'store_experience':
            result = await this.storeExperience(user, request.params.arguments);
            break;
          case 'get_quick_context':
            result = await this.getQuickContext(user, request.params.arguments);
            break;
          case 'get_detailed_profile':
            result = await this.getDetailedProfile(user, request.params.arguments);
            break;
          case 'search_experiences':
            result = await this.searchExperiences(user, request.params.arguments);
            break;
          case 'update_profile':
            result = await this.updateProfile(user, request.params.arguments);
            break;
          case 'update_quick_summary':
            result = await this.updateQuickSummary(user, request.params.arguments);
            break;
          case 'get_skills_analysis':
            result = await this.getSkillsAnalysis(user, request.params.arguments);
            break;
          case 'get_career_suggestions':
            result = await this.getCareerSuggestions(user, request.params.arguments);
            break;
          case 'logout':
            result = await this.logout(user, request.params.arguments);
            break;
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }

        const duration = Date.now() - startTime;
        this.updatePerformanceMetrics(duration, false);
        
        // Audit successful operation
        await this.auditLog(user.userId, request.params.name, {
          resourceType: 'MCP_TOOL',
          executionTime: duration,
          success: true
        });
        
        logger.info(`MCP tool completed: ${request.params.name}`, {
          tool: request.params.name,
          user: user.username,
          duration: `${duration}ms`,
          success: true
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        this.updatePerformanceMetrics(duration, true);
        
        // Audit failed operation
        if (user) {
          await this.auditLog(user.userId, request.params.name, {
            resourceType: 'MCP_TOOL',
            executionTime: duration,
            success: false,
            error: error.message
          });
        }
        
        logger.error(`MCP tool failed: ${request.params.name}`, {
          tool: request.params.name,
          user: user?.username || 'anonymous',
          duration: `${duration}ms`,
          error: error.message
        });

        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });

    // Tool list handler
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          // Public tools
          {
            name: 'register',
            description: 'Register a new user account',
            inputSchema: {
              type: 'object',
              properties: {
                username: { 
                  type: 'string', 
                  description: 'Unique username (3-30 alphanumeric characters)',
                  minLength: 3,
                  maxLength: 30
                },
                email: { 
                  type: 'string', 
                  format: 'email',
                  description: 'Valid email address'
                },
                password: { 
                  type: 'string', 
                  description: 'Strong password (minimum 8 characters)',
                  minLength: 8
                },
                firstName: { 
                  type: 'string', 
                  description: 'First name (optional)',
                  maxLength: 255
                },
                lastName: { 
                  type: 'string', 
                  description: 'Last name (optional)',
                  maxLength: 255
                }
              },
              required: ['username', 'email', 'password']
            }
          },
          {
            name: 'login',
            description: 'Authenticate user and receive access token',
            inputSchema: {
              type: 'object',
              properties: {
                username: { 
                  type: 'string', 
                  description: 'Username or email'
                },
                password: { 
                  type: 'string', 
                  description: 'User password'
                },
                mfaCode: { 
                  type: 'string', 
                  description: 'Multi-factor authentication code (if enabled)'
                }
              },
              required: ['username', 'password']
            }
          },
          {
            name: 'health_check',
            description: 'Check server and database health status',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'No parameters required'
            }
          },

          // Protected tools (require authentication)
          {
            name: 'store_experience',
            description: 'Store a new professional experience with optional skills extraction and analysis',
            inputSchema: {
              type: 'object',
              properties: {
                title: { 
                  type: 'string', 
                  description: 'Experience title or role name',
                  maxLength: 255
                },
                organization: { 
                  type: 'string', 
                  description: 'Organization, company, or institution name',
                  maxLength: 255
                },
                department: { 
                  type: 'string', 
                  description: 'Department or division',
                  maxLength: 255
                },
                location: { 
                  type: 'string', 
                  description: 'Location (city, state, country)',
                  maxLength: 255
                },
                description: { 
                  type: 'string', 
                  description: 'Detailed description of the experience, responsibilities, and achievements',
                  maxLength: config.mcp.limits.maxDescriptionLength
                },
                startDate: { 
                  type: 'string', 
                  format: 'date',
                  description: 'Start date in YYYY-MM-DD format'
                },
                endDate: { 
                  type: 'string', 
                  format: 'date',
                  description: 'End date in YYYY-MM-DD format (optional for current experiences)'
                },
                isCurrent: { 
                  type: 'boolean', 
                  description: 'Whether this is a current/ongoing experience',
                  default: false
                },
                experienceType: { 
                  type: 'string', 
                  enum: ['work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training'],
                  description: 'Type of professional experience'
                },
                employmentType: { 
                  type: 'string', 
                  enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer'],
                  description: 'Employment type'
                },
                extractedSkills: {
                  type: 'array',
                  description: 'Skills identified from this experience',
                  items: { type: 'object' }
                },
                keyHighlights: {
                  type: 'array',
                  description: 'Key achievements and highlights',
                  items: { type: 'object' }
                }
              },
              required: ['title', 'description', 'startDate', 'experienceType']
            }
          },
          {
            name: 'get_quick_context',
            description: 'Get rapid professional summary for conversation context (< 10ms target)',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'No parameters required - returns current quick professional summary'
            }
          },
          {
            name: 'get_detailed_profile',
            description: 'Get comprehensive professional profile with career analysis (< 50ms target)',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'No parameters required - returns full professional profile'
            }
          },
          {
            name: 'search_experiences',
            description: 'Search through professional experiences with filters (< 200ms target)',
            inputSchema: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'Text search across titles, descriptions, and organizations'
                },
                experienceType: { 
                  type: 'string',
                  enum: ['work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training'],
                  description: 'Filter by experience type'
                },
                isCurrent: { 
                  type: 'boolean', 
                  description: 'Filter for current/ongoing experiences'
                },
                dateFrom: { 
                  type: 'string', 
                  format: 'date',
                  description: 'Start date filter (YYYY-MM-DD)'
                },
                dateTo: { 
                  type: 'string', 
                  format: 'date',
                  description: 'End date filter (YYYY-MM-DD)'
                },
                limit: { 
                  type: 'integer', 
                  minimum: 1, 
                  maximum: 50, 
                  default: 10,
                  description: 'Maximum number of results to return'
                }
              }
            }
          },
          {
            name: 'update_profile',
            description: 'Update aggregated professional profile summary (Level 2)',
            inputSchema: {
              type: 'object',
              properties: {
                totalYearsExperience: { type: 'number', description: 'Total years of professional experience' },
                industries: { type: 'array', items: { type: 'string' }, description: 'Industries of experience' },
                coreStrengths: { type: 'object', description: 'Core professional strengths analysis' },
                technicalSkills: { type: 'object', description: 'Technical skills and expertise' },
                softSkills: { type: 'object', description: 'Soft skills and interpersonal abilities' },
                leadershipSkills: { type: 'object', description: 'Leadership skills and experience' },
                careerInterests: { type: 'object', description: 'Career interests and aspirations' },
                careerGoals: { type: 'object', description: 'Career goals and objectives' },
                careerProgression: { type: 'object', description: 'Career progression timeline' },
                keyAchievements: { type: 'object', description: 'Top career achievements' },
                educationSummary: { type: 'object', description: 'Educational background summary' },
                certifications: { type: 'object', description: 'Professional certifications' },
                languages: { type: 'object', description: 'Language skills' },
                volunteerExperience: { type: 'object', description: 'Volunteer experience summary' }
              }
            }
          },
          {
            name: 'update_quick_summary',
            description: 'Update quick professional summary for rapid context (Level 3)',
            inputSchema: {
              type: 'object',
              properties: {
                executiveSummary: { 
                  type: 'string', 
                  maxLength: 1000,
                  description: '2-3 sentence professional summary'
                },
                headline: { 
                  type: 'string', 
                  maxLength: 255,
                  description: 'Professional headline or tagline'
                },
                keySkills: { 
                  type: 'array', 
                  items: { type: 'string' },
                  maxItems: 10,
                  description: 'Top 8-10 professional skills'
                },
                yearsExperience: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Total years of professional experience'
                },
                currentRole: { 
                  type: 'string', 
                  maxLength: 255,
                  description: 'Current job title or role'
                },
                currentCompany: { 
                  type: 'string', 
                  maxLength: 255,
                  description: 'Current company or organization'
                },
                industries: { 
                  type: 'array', 
                  items: { type: 'string' },
                  maxItems: 3,
                  description: '2-3 primary industries of experience'
                },
                educationLevel: { 
                  type: 'string', 
                  maxLength: 100,
                  description: 'Highest education level achieved'
                },
                topCertifications: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Top professional certifications'
                },
                location: { 
                  type: 'string', 
                  maxLength: 255,
                  description: 'Current location or preferred work location'
                },
                careerGoals: { 
                  type: 'object', 
                  description: 'Current career objectives and goals'
                },
                uniqueValueProps: { 
                  type: 'object', 
                  description: 'Unique value propositions'
                },
                availability: { 
                  type: 'string', 
                  maxLength: 100,
                  description: 'Current availability status'
                }
              },
              required: ['executiveSummary', 'headline']
            }
          },
          {
            name: 'get_skills_analysis',
            description: 'Analyze skills across all experiences and provide insights',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'Returns comprehensive skills analysis and recommendations'
            }
          },
          {
            name: 'get_career_suggestions',
            description: 'Get AI-powered career path suggestions based on experience profile',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'Returns personalized career path recommendations'
            }
          },
          {
            name: 'logout',
            description: 'Logout user and invalidate session',
            inputSchema: { 
              type: 'object', 
              properties: {},
              description: 'No parameters required - invalidates current session'
            }
          }
        ]
      };
    });
  }

  /**
   * Handle public tools that don't require authentication
   */
  async handlePublicTool(toolName, args) {
    switch (toolName) {
      case 'register':
        return await this.register(args);
      case 'login':
        return await this.login(args);
      case 'health_check':
        return await this.healthCheck(args);
      default:
        throw new Error(`Unknown public tool: ${toolName}`);
    }
  }

  /**
   * User Registration Tool
   */
  async register(args) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.register.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Check if username or email already exists
      const existingUser = await DatabaseManager.findUserByUsernameOrEmail(value.username, value.email);
      if (existingUser) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(value.password, 12);

      // Generate schema prefix
      const schemaPrefix = `usr_${value.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Create user
      const userId = await DatabaseManager.createUser({
        username: value.username,
        email: value.email,
        passwordHash,
        schemaPrefix,
        firstName: value.firstName,
        lastName: value.lastName
      });

      // Create user-specific schema
      await DatabaseManager.createUserSpecificSchema(schemaPrefix);

      const duration = Date.now() - startTime;

      await this.auditLog(userId, 'USER_REGISTRATION', {
        resourceType: 'USER_ACCOUNT',
        resourceId: value.username,
        executionTime: duration,
        success: true
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `User ${value.username} registered successfully`,
            userId: userId,
            schemaPrefix: schemaPrefix,
            nextSteps: [
              'Use login tool with your credentials to get an access token',
              'Include the token in Authorization header for all subsequent requests'
            ],
            responseTime: `${duration}ms`
          }, null, 2)
        }]
      };
    } catch (error) {
      await this.auditLog(null, 'USER_REGISTRATION_FAILED', {
        resourceType: 'USER_ACCOUNT',
        resourceId: value.username,
        error: error.message
      });
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * User Login Tool
   */
  async login(args) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.login.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      this.performanceMetrics.authAttempts++;

      // Get user by username or email
      const user = await DatabaseManager.findUserByUsernameOrEmail(value.username, value.username);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (user.account_status !== 'active') {
        throw new Error('Account is not active');
      }

      // Verify password
      const validPassword = await bcrypt.compare(value.password, user.password_hash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // TODO: Verify MFA if enabled
      // if (user.mfa_secret && !this.verifyMFA(value.mfaCode, user.mfa_secret)) {
      //   throw new Error('Invalid MFA code');
      // }

      // Generate JWT token
      const tokenPayload = {
        userId: user.user_id,
        username: user.username,
        schemaPrefix: user.schema_prefix
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '24h' }
      );

      // Create session
      const sessionId = await DatabaseManager.createUserSession({
        userId: user.user_id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Update last login
      await DatabaseManager.updateLastLogin(user.user_id);

      const duration = Date.now() - startTime;

      await this.auditLog(user.user_id, 'LOGIN_SUCCESS', {
        resourceType: 'USER_SESSION',
        resourceId: sessionId,
        executionTime: duration,
        success: true
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Login successful',
            token: token,
            expiresIn: '24h',
            user: {
              username: user.username,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name
            },
            usage: {
              includeTokenInHeader: 'Authorization: Bearer <token>',
              example: `Authorization: Bearer ${token.substring(0, 20)}...`
            },
            responseTime: `${duration}ms`
          }, null, 2)
        }]
      };
    } catch (error) {
      await this.auditLog(null, 'LOGIN_FAILED', {
        resourceType: 'USER_SESSION',
        resourceId: value.username,
        error: error.message
      });
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Health Check Tool
   */
  async healthCheck(args) {
    const startTime = Date.now();
    
    try {
      const dbHealth = await DatabaseManager.healthCheck();
      const duration = Date.now() - startTime;

      const systemStats = this.getPerformanceStats();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: config.mcp.server.version,
            environment: config.environment,
            database: {
              status: dbHealth.status,
              responseTime: dbHealth.responseTime,
              connection: dbHealth.connection
            },
            server: {
              uptime: systemStats.uptime,
              toolCalls: systemStats.toolCalls,
              authAttempts: this.performanceMetrics.authAttempts,
              averageResponseTime: systemStats.averageResponseTime,
              errorRate: systemStats.errorRate
            },
            responseTime: `${duration}ms`
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Logout Tool
   */
  async logout(user, args) {
    try {
      // Invalidate current session
      await DatabaseManager.invalidateUserSessions(user.userId);

      await this.auditLog(user.userId, 'LOGOUT', {
        resourceType: 'USER_SESSION',
        success: true
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Logout successful',
            note: 'All sessions have been invalidated'
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Store Experience Tool Implementation (with user context)
   */
  async storeExperience(user, args) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.storeExperience.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      // Store experience in user's schema
      const experienceId = await DatabaseManager.storeUserExperience(user.schemaPrefix, value);
      
      const duration = Date.now() - startTime;
      
      // Trigger async profile aggregation (fire and forget)
      setImmediate(() => this.triggerProfileAggregation(user));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Experience "${value.title}" stored successfully`,
            experienceId: experienceId,
            responseTime: `${duration}ms`,
            nextSteps: [
              'Profile aggregation triggered automatically',
              'Use get_detailed_profile to see updated career analysis',
              'Use get_quick_context for rapid conversation context'
            ]
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Store experience failed', { error: error.message, user: user.username, args: value });
      throw new Error(`Failed to store experience: ${error.message}`);
    }
  }

  /**
   * Get Quick Context Tool Implementation (Level 3 - Target: < 10ms)
   */
  async getQuickContext(user, args = {}) {
    const startTime = Date.now();
    
    try {
      const context = await DatabaseManager.getUserQuickContext(user.schemaPrefix);
      const duration = Date.now() - startTime;
      
      // Check performance target
      if (duration > config.mcp.performance.quickContextTimeout) {
        logger.warn(`Quick context exceeded target response time`, {
          duration: `${duration}ms`,
          target: `${config.mcp.performance.quickContextTimeout}ms`,
          user: user.username
        });
      }

      if (!context) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'No quick context available. Please update your profile first.',
              suggestion: 'Use update_quick_summary tool to create your professional summary',
              responseTime: `${duration}ms`
            }, null, 2)
          }]
        };
      }

      // Parse JSON fields safely
      const keySkills = context.key_skills ? JSON.parse(context.key_skills) : [];
      const industries = context.industries ? JSON.parse(context.industries) : [];
      const careerGoals = context.career_goals ? JSON.parse(context.career_goals) : {};
      const uniqueValueProps = context.unique_value_props ? JSON.parse(context.unique_value_props) : {};

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executiveSummary: context.executive_summary,
            headline: context.headline,
            keySkills: keySkills,
            yearsExperience: context.years_experience,
            currentRole: context.current_role,
            currentCompany: context.current_company,
            industries: industries,
            educationLevel: context.education_level,
            location: context.location,
            careerGoals: careerGoals,
            uniqueValueProps: uniqueValueProps,
            availability: context.availability,
            lastUpdated: context.last_updated,
            responseTime: `${duration}ms`,
            performanceTarget: duration <= config.mcp.performance.quickContextTimeout ? 'MET' : 'EXCEEDED'
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get quick context failed', { error: error.message, user: user.username });
      throw new Error(`Failed to retrieve quick context: ${error.message}`);
    }
  }

  /**
   * Get Detailed Profile Tool Implementation (Level 2 - Target: < 50ms)
   */
  async getDetailedProfile(user, args = {}) {
    const startTime = Date.now();
    
    try {
      const profile = await DatabaseManager.getUserDetailedProfile(user.schemaPrefix);
      const duration = Date.now() - startTime;
      
      // Check performance target
      if (duration > config.mcp.performance.profileContextTimeout) {
        logger.warn(`Detailed profile exceeded target response time`, {
          duration: `${duration}ms`,
          target: `${config.mcp.performance.profileContextTimeout}ms`,
          user: user.username
        });
      }

      if (!profile) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'No detailed profile available. Please update your profile first.',
              suggestion: 'Use update_profile tool to create your comprehensive career analysis',
              responseTime: `${duration}ms`
            }, null, 2)
          }]
        };
      }

      // Parse JSON fields safely
      const profileData = {
        totalYearsExperience: profile.total_years_experience,
        industries: profile.industries ? JSON.parse(profile.industries) : [],
        coreStrengths: profile.core_strengths ? JSON.parse(profile.core_strengths) : {},
        technicalSkills: profile.technical_skills ? JSON.parse(profile.technical_skills) : {},
        softSkills: profile.soft_skills ? JSON.parse(profile.soft_skills) : {},
        leadershipSkills: profile.leadership_skills ? JSON.parse(profile.leadership_skills) : {},
        careerInterests: profile.career_interests ? JSON.parse(profile.career_interests) : {},
        careerGoals: profile.career_goals ? JSON.parse(profile.career_goals) : {},
        careerProgression: profile.career_progression ? JSON.parse(profile.career_progression) : {},
        keyAchievements: profile.key_achievements ? JSON.parse(profile.key_achievements) : {},
        educationSummary: profile.education_summary ? JSON.parse(profile.education_summary) : {},
        certifications: profile.certifications ? JSON.parse(profile.certifications) : {},
        languages: profile.languages ? JSON.parse(profile.languages) : {},
        volunteerExperience: profile.volunteer_experience ? JSON.parse(profile.volunteer_experience) : {},
        lastRegenerated: profile.last_regenerated,
        responseTime: `${duration}ms`,
        performanceTarget: duration <= config.mcp.performance.profileContextTimeout ? 'MET' : 'EXCEEDED'
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(profileData, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get detailed profile failed', { error: error.message, user: user.username });
      throw new Error(`Failed to retrieve detailed profile: ${error.message}`);
    }
  }

  /**
   * Search Experiences Tool Implementation (Level 1 - Target: < 200ms)
   */
  async searchExperiences(user, args = {}) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.searchExperiences.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      const experiences = await DatabaseManager.searchUserExperiences(user.schemaPrefix, {
        searchText: value.query,
        experienceType: value.experienceType,
        isCurrent: value.isCurrent,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        limit: value.limit
      });
      
      const duration = Date.now() - startTime;
      
      // Check performance target
      if (duration > config.mcp.performance.detailedContextTimeout) {
        logger.warn(`Search experiences exceeded target response time`, {
          duration: `${duration}ms`,
          target: `${config.mcp.performance.detailedContextTimeout}ms`,
          user: user.username
        });
      }

      // Parse JSON fields for each experience
      const processedExperiences = experiences.map(exp => ({
        experienceId: exp.experience_id,
        title: exp.title,
        organization: exp.organization,
        department: exp.department,
        location: exp.location,
        description: exp.description,
        startDate: exp.start_date,
        endDate: exp.end_date,
        isCurrent: exp.is_current === 1,
        experienceType: exp.experience_type,
        employmentType: exp.employment_type,
        extractedSkills: exp.extracted_skills ? JSON.parse(exp.extracted_skills) : null,
        keyHighlights: exp.key_highlights ? JSON.parse(exp.key_highlights) : null,
        quantifiedImpacts: exp.quantified_impacts ? JSON.parse(exp.quantified_impacts) : null,
        technologiesUsed: exp.technologies_used ? JSON.parse(exp.technologies_used) : null,
        achievements: exp.achievements ? JSON.parse(exp.achievements) : null,
        teamSize: exp.team_size,
        budgetManaged: exp.budget_managed,
        revenueImpact: exp.revenue_impact,
        costSavings: exp.cost_savings,
        createdAt: exp.created_at,
        updatedAt: exp.updated_at
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: value,
            results: processedExperiences,
            totalFound: processedExperiences.length,
            responseTime: `${duration}ms`,
            performanceTarget: duration <= config.mcp.performance.detailedContextTimeout ? 'MET' : 'EXCEEDED'
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Search experiences failed', { error: error.message, user: user.username, query: value });
      throw new Error(`Failed to search experiences: ${error.message}`);
    }
  }

  /**
   * Update Profile Tool Implementation
   */
  async updateProfile(user, args) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.updateProfile.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      await DatabaseManager.updateUserProfileSummary(user.schemaPrefix, value);
      const duration = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Profile summary updated successfully',
            updatedFields: Object.keys(value),
            responseTime: `${duration}ms`,
            nextSteps: [
              'Use get_detailed_profile to view updated career analysis',
              'Consider updating quick_summary for optimized context retrieval'
            ]
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Update profile failed', { error: error.message, user: user.username, data: value });
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Update Quick Summary Tool Implementation
   */
  async updateQuickSummary(user, args) {
    const startTime = Date.now();
    
    // Validate input
    const { error, value } = schemas.updateQuickSummary.validate(args);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    try {
      await DatabaseManager.updateUserQuickSummary(user.schemaPrefix, value);
      const duration = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Quick summary updated successfully',
            updatedFields: Object.keys(value),
            responseTime: `${duration}ms`,
            optimizationNote: 'Quick summary optimized for < 10ms retrieval in conversations'
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Update quick summary failed', { error: error.message, user: user.username, data: value });
      throw new Error(`Failed to update quick summary: ${error.message}`);
    }
  }

  /**
   * Get Skills Analysis Tool Implementation
   */
  async getSkillsAnalysis(user, args = {}) {
    const startTime = Date.now();
    
    try {
      // Get all experiences with skills data
      const experiences = await DatabaseManager.searchUserExperiences(user.schemaPrefix, { limit: 50 });
      
      // Analyze skills across experiences
      const skillsAnalysis = this.analyzeSkillsFromExperiences(experiences);
      const duration = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            skillsAnalysis,
            totalExperiences: experiences.length,
            responseTime: `${duration}ms`,
            analysisDate: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get skills analysis failed', { error: error.message, user: user.username });
      throw new Error(`Failed to analyze skills: ${error.message}`);
    }
  }

  /**
   * Get Career Suggestions Tool Implementation
   */
  async getCareerSuggestions(user, args = {}) {
    const startTime = Date.now();
    
    try {
      // Get current profile data
      const [quickContext, detailedProfile] = await Promise.all([
        DatabaseManager.getUserQuickContext(user.schemaPrefix),
        DatabaseManager.getUserDetailedProfile(user.schemaPrefix)
      ]);
      
      // Generate career suggestions based on profile
      const suggestions = this.generateCareerSuggestions(quickContext, detailedProfile);
      const duration = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            careerSuggestions: suggestions,
            basedOnProfile: !!detailedProfile,
            basedOnQuickContext: !!quickContext,
            responseTime: `${duration}ms`,
            generatedAt: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get career suggestions failed', { error: error.message, user: user.username });
      throw new Error(`Failed to generate career suggestions: ${error.message}`);
    }
  }

  /**
   * Helper methods (skills analysis and career suggestions)
   */
  analyzeSkillsFromExperiences(experiences) {
    const skillsMap = new Map();
    const skillsByCategory = {
      technical: new Map(),
      soft: new Map(),
      industrySpecific: new Map()
    };

    experiences.forEach(exp => {
      if (exp.extracted_skills) {
        try {
          const skills = JSON.parse(exp.extracted_skills);
          skills.forEach(skill => {
            const name = skill.name || skill;
            const category = skill.category || 'general';
            
            // Overall skills frequency
            skillsMap.set(name, (skillsMap.get(name) || 0) + 1);
            
            // Category-specific analysis
            if (skillsByCategory[category]) {
              skillsByCategory[category].set(name, (skillsByCategory[category].get(name) || 0) + 1);
            }
          });
        } catch (parseError) {
          logger.warn('Failed to parse skills for experience', { experienceId: exp.experience_id });
        }
      }
    });

    // Convert maps to sorted arrays
    const topSkills = Array.from(skillsMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, frequency: count }));

    const categorizedSkills = {};
    Object.keys(skillsByCategory).forEach(category => {
      categorizedSkills[category] = Array.from(skillsByCategory[category].entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, frequency: count }));
    });

    return {
      topSkills,
      categorizedSkills,
      totalUniqueSkills: skillsMap.size,
      skillsGrowthPotential: this.identifySkillGaps(topSkills)
    };
  }

  identifySkillGaps(topSkills) {
    // Simplified implementation - in production would use market data
    const inDemandSkills = [
      'JavaScript', 'Python', 'Cloud Computing', 'Data Analysis', 
      'Project Management', 'Leadership', 'Communication', 'Problem Solving'
    ];

    const currentSkills = topSkills.map(s => s.skill.toLowerCase());
    const gaps = inDemandSkills.filter(skill => 
      !currentSkills.some(current => current.includes(skill.toLowerCase()))
    );

    return {
      recommendedSkills: gaps.slice(0, 5),
      note: 'Based on current market demand and career progression patterns'
    };
  }

  generateCareerSuggestions(quickContext, detailedProfile) {
    // Simplified implementation - in production would use AI/ML models
    const suggestions = [];

    if (quickContext && quickContext.key_skills) {
      try {
        const skills = JSON.parse(quickContext.key_skills);
        
        if (skills.some(skill => skill.toLowerCase().includes('data'))) {
          suggestions.push({
            careerPath: 'Data Science & Analytics',
            alignment: 'High',
            nextSteps: ['Advanced analytics certification', 'Machine learning courses', 'Portfolio development'],
            growthOutlook: 'Excellent'
          });
        }

        if (skills.some(skill => skill.toLowerCase().includes('management'))) {
          suggestions.push({
            careerPath: 'Leadership & Management',
            alignment: 'High',
            nextSteps: ['Leadership development program', 'MBA consideration', 'Team management experience'],
            growthOutlook: 'Strong'
          });
        }

        if (skills.some(skill => ['javascript', 'python', 'programming'].some(tech => skill.toLowerCase().includes(tech)))) {
          suggestions.push({
            careerPath: 'Software Engineering & Technology',
            alignment: 'High',
            nextSteps: ['Full-stack development', 'Cloud certifications', 'Open source contributions'],
            growthOutlook: 'Excellent'
          });
        }
      } catch (parseError) {
        logger.warn('Failed to parse skills for career suggestions');
      }
    }

    // Add general suggestions if no specific ones found
    if (suggestions.length === 0) {
      suggestions.push({
        careerPath: 'Professional Development',
        alignment: 'Medium',
        nextSteps: ['Complete professional profile', 'Skills assessment', 'Career goals clarification'],
        growthOutlook: 'Variable',
        note: 'Complete your profile for more personalized suggestions'
      });
    }

    return suggestions;
  }

  /**
   * Trigger profile aggregation (background process)
   */
  async triggerProfileAggregation(user) {
    try {
      logger.info('Profile aggregation triggered', { user: user.username, environment: config.environment });
      
      // In a production system, this would trigger:
      // 1. Skills extraction from new experience
      // 2. Career progression analysis update
      // 3. Profile summary regeneration
      // 4. Quick context optimization
      
    } catch (error) {
      logger.error('Profile aggregation failed', { error: error.message, user: user.username });
    }
  }

  /**
   * Setup event handlers for lifecycle management
   */
  setupEventHandlers() {
    // Graceful shutdown handlers
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(duration, isError) {
    this.performanceMetrics.toolCalls++;
    this.performanceMetrics.totalResponseTime += duration;
    if (isError) {
      this.performanceMetrics.errors++;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const uptime = Date.now() - this.performanceMetrics.lastReset;
    return {
      uptime: `${Math.floor(uptime / 1000)}s`,
      toolCalls: this.performanceMetrics.toolCalls,
      averageResponseTime: this.performanceMetrics.toolCalls > 0 
        ? `${Math.round(this.performanceMetrics.totalResponseTime / this.performanceMetrics.toolCalls)}ms`
        : '0ms',
      errorRate: this.performanceMetrics.toolCalls > 0
        ? `${Math.round((this.performanceMetrics.errors / this.performanceMetrics.toolCalls) * 100)}%`
        : '0%',
      errors: this.performanceMetrics.errors
    };
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      // Initialize database connection
      await DatabaseManager.initialize();
      
      // Test database health
      const health = await DatabaseManager.healthCheck();
      if (health.status !== 'healthy') {
        throw new Error(`Database health check failed: ${health.error}`);
      }

      // Connect MCP transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info(`🚀 Career Navigator Multi-User MCP Server started`, {
        environment: config.environment,
        database: config.database[config.environment].serviceName,
        features: {
          authentication: 'JWT with bcrypt',
          userIsolation: 'Schema-based',
          sessionManagement: 'Database-backed',
          auditLogging: 'Comprehensive'
        },
        performance: {
          quickContextTarget: `${config.mcp.performance.quickContextTimeout}ms`,
          profileContextTarget: `${config.mcp.performance.profileContextTimeout}ms`,
          detailedContextTarget: `${config.mcp.performance.detailedContextTimeout}ms`
        }
      });

      // Log performance stats periodically
      if (config.monitoring.performanceMetrics.enabled) {
        setInterval(() => {
          const stats = this.getPerformanceStats();
          logger.info('Performance metrics', stats);
        }, config.monitoring.performanceMetrics.collectInterval);
      }
      
    } catch (error) {
      logger.error('Failed to start MCP server', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Career Navigator Multi-User MCP Server...');
    
    try {
      await DatabaseManager.close();
      logger.info('✅ Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  }
}

// Environment validation
const requiredEnvVars = ['JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`⚠️  Missing environment variable: ${envVar}`);
    if (envVar === 'JWT_SECRET') {
      console.error('   Add to your .env file: JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new CareerNavigatorMCP();
  server.start();
}

module.exports = CareerNavigatorMCP;