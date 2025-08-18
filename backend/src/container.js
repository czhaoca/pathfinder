/**
 * Dependency Injection Container
 * Manages service dependencies and lifecycle
 */

const DatabaseManager = require('./services/database');
const config = require('./config');
const logger = require('./utils/logger');

// Services
const AuthService = require('./services/authService');
const AuditService = require('./services/auditService');
const UserService = require('./services/userService');
const ExperienceService = require('./services/experienceService');
const ChatService = require('./services/chatService');
const CPAPertService = require('./services/cpaPertService');
const EnhancedCpaPertService = require('./services/cpaPertServiceEnhanced');
const OpenAIChatService = require('./services/openaiChatService');
const AnalyticsService = require('./services/analyticsService');
const ResumeService = require('./services/resumeService');
const CareerPathService = require('./services/careerPathService');
const SkillsGapService = require('./services/skillsGapService');
const LearningService = require('./services/learningService');
const ContactService = require('./services/contactService');
const InteractionService = require('./services/interactionService');
const ReminderService = require('./services/reminderService');
const NetworkingService = require('./services/networkingService');
const JobSearchService = require('./services/jobSearchService');
const JobMatchingService = require('./services/jobMatchingService');
const ApplicationService = require('./services/applicationService');
const InterviewPrepService = require('./services/interviewPrepService');
const CompanyService = require('./services/companyService');
const CourseService = require('./services/courseService');
const SkillAssessmentService = require('./services/skillAssessmentService');
const CertificationService = require('./services/certificationService');
const LearningPathService = require('./services/learningPathService');
const InvitationService = require('./services/invitationService');
const EmailService = require('./services/emailService');
const GoogleOAuthService = require('./services/googleOAuthService');
const LinkedInOAuthService = require('./services/linkedInOAuthService');
const ProfileImportService = require('./services/profileImportService');
const SSOService = require('./services/ssoService');
const FeatureFlagService = require('./services/featureFlagService');
const EncryptionService = require('./services/encryption');

// Repositories
const UserRepository = require('./repositories/userRepository');
const SessionRepository = require('./repositories/sessionRepository');
const AuditRepository = require('./repositories/auditRepository');
const ExperienceRepository = require('./repositories/experienceRepository');
const CPAPertRepository = require('./repositories/cpaPertRepository');
const ChatRepository = require('./repositories/chatRepository');
const AnalyticsRepository = require('./repositories/analyticsRepository');
const InvitationRepository = require('./repositories/invitationRepository');

// Controllers
const AuthController = require('./api/controllers/authController');
const ProfileController = require('./api/controllers/profileController');
const ExperienceController = require('./api/controllers/experienceController');
const ChatController = require('./api/controllers/chatController');
const CPAPertController = require('./api/controllers/cpaPertController');
const EnhancedCpaPertController = require('./api/controllers/cpaPertControllerEnhanced');
const AnalyticsController = require('./api/controllers/analyticsController');
const ResumeController = require('./api/controllers/resumeController');
const CareerPathController = require('./api/controllers/careerPathController');
const NetworkingController = require('./api/controllers/networkingController');
const JobSearchController = require('./api/controllers/jobSearchController');
const LearningController = require('./api/controllers/learningController');

// Middleware
const AuthMiddleware = require('./api/middleware/authMiddleware');
const RateLimiter = require('./services/rate-limiter');

// Utils
const CacheManager = require('./utils/cache');

class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  async initialize() {
    try {
      // Initialize database
      const database = DatabaseManager;
      await database.initialize();
      this.register('database', database, { singleton: true });
      
      // Initialize cache manager
      const cacheManager = new CacheManager();
      await cacheManager.initialize();
      this.register('cacheManager', cacheManager, { singleton: true });

      // Register repositories
      this.register('userRepository', () => new UserRepository(this.get('database')));
      this.register('sessionRepository', () => new SessionRepository(this.get('database')));
      this.register('auditRepository', () => new AuditRepository(this.get('database')));
      this.register('experienceRepository', () => new ExperienceRepository(this.get('database')));
      this.register('cpaPertRepository', () => new CPAPertRepository(this.get('database'), config));
      this.register('chatRepository', () => new ChatRepository(this.get('database')));
      this.register('analyticsRepository', () => new AnalyticsRepository(this.get('database')));
      this.register('invitationRepository', () => new InvitationRepository(this.get('database')));

      // Register services
      this.register('emailService', () => new EmailService(), { singleton: true });
      this.register('auditService', () => new AuditService(this.get('auditRepository')));
      this.register('encryptionService', () => new EncryptionService(), { singleton: true });
      this.register('featureFlagService', () => new FeatureFlagService(
        this.get('database')
      ), { singleton: true });
      this.register('ssoService', () => new SSOService(this.get('database')));
      this.register('googleOAuthService', () => {
        const oauthConfig = require('./config/oauth');
        return new GoogleOAuthService(
          oauthConfig,
          this.get('userService'),
          this.get('ssoService'),
          this.get('auditService'),
          this.get('database'),
          this.get('encryptionService')
        );
      }, { singleton: true });
      
      // Register Profile Import Service
      this.register('profileImportService', () => new ProfileImportService(
        this.get('database'),
        this.get('experienceService'),
        this.get('educationService') || this.get('learningService'),
        this.get('skillsGapService'),
        this.get('certificationService')
      ), { singleton: true });
      
      // Register LinkedIn OAuth Service
      this.register('linkedInOAuthService', () => {
        const oauthConfig = require('./config/oauth');
        return new LinkedInOAuthService(
          oauthConfig,
          this.get('userService'),
          this.get('ssoService'),
          this.get('auditService'),
          this.get('database'),
          this.get('encryptionService'),
          this.get('profileImportService'),
          this.get('featureFlagService')
        );
      }, { singleton: true });
      this.register('openaiService', () => {
        // Only create OpenAI service if API key is available
        if (process.env.OPENAI_API_KEY) {
          return new OpenAIChatService();
        }
        return null;
      }, { singleton: true });
      this.register('authService', () => new AuthService(
        this.get('userRepository'),
        this.get('sessionRepository'),
        this.get('auditService')
      ));
      this.register('invitationService', () => new InvitationService(
        this.get('invitationRepository'),
        this.get('userRepository'),
        this.get('emailService'),
        this.get('auditService'),
        this.get('authService')
      ));
      this.register('userService', () => new UserService(
        this.get('userRepository'),
        this.get('sessionRepository'),
        this.get('auditService')
      ));
      this.register('experienceService', () => new ExperienceService(
        this.get('experienceRepository'),
        this.get('userRepository'),
        this.get('auditService'),
        this.get('openaiService')
      ));
      this.register('chatService', () => new ChatService(
        this.get('userRepository'),
        this.get('auditService'),
        this.get('chatRepository')
      ));
      this.register('cpaPertService', () => new CPAPertService(
        this.get('cpaPertRepository'),
        this.get('experienceRepository'),
        this.get('auditService'),
        this.get('chatService')
      ));
      this.register('cpaPertServiceEnhanced', () => new EnhancedCpaPertService(
        this.get('database'),
        this.get('cacheManager'),
        this.get('openaiService')
      ));
      this.register('analyticsService', () => new AnalyticsService(
        this.get('analyticsRepository'),
        this.get('experienceRepository'),
        this.get('userRepository'),
        this.get('auditService'),
        this.get('openaiService')
      ));
      this.register('resumeService', () => new ResumeService(
        this.get('experienceRepository'),
        this.get('userRepository'),
        this.get('analyticsService'),
        this.get('auditService'),
        this.get('openaiService')
      ));
      
      // Career Path services
      this.register('databaseService', () => this.get('database'));
      this.register('careerPathService', () => new CareerPathService(
        this.get('databaseService')
      ));
      this.register('skillsGapService', () => new SkillsGapService(
        this.get('databaseService'),
        this.get('careerPathService')
      ));
      this.register('learningService', () => new LearningService(
        this.get('databaseService')
      ));
      
      // Professional Networking services
      this.register('contactService', () => new ContactService(
        this.get('databaseService'),
        this.get('auditService')
      ));
      this.register('interactionService', () => new InteractionService(
        this.get('databaseService'),
        this.get('contactService'),
        this.get('auditService')
      ));
      this.register('reminderService', () => new ReminderService(
        this.get('databaseService'),
        this.get('auditService')
      ));
      this.register('networkingService', () => new NetworkingService(
        this.get('databaseService'),
        this.get('contactService'),
        this.get('openaiService')
      ));
      
      // Job Search services
      this.register('companyService', () => new CompanyService(
        this.get('databaseService')
      ));
      this.register('profileService', () => this.get('userService'));
      this.register('jobSearchService', () => new JobSearchService(
        this.get('databaseService'),
        this.get('openaiService'),
        this.get('profileService')
      ));
      this.register('jobMatchingService', () => new JobMatchingService(
        this.get('databaseService'),
        this.get('profileService'),
        this.get('experienceService')
      ));
      this.register('applicationService', () => new ApplicationService(
        this.get('databaseService'),
        this.get('auditService'),
        this.get('resumeService')
      ));
      this.register('interviewPrepService', () => new InterviewPrepService(
        this.get('databaseService'),
        this.get('openaiService'),
        this.get('profileService')
      ));
      
      // Learning & Development services
      this.register('courseService', () => new CourseService(
        this.get('databaseService'),
        this.get('profileService'),
        this.get('skillsGapService'),
        this.get('openaiService')
      ));
      this.register('skillAssessmentService', () => new SkillAssessmentService(
        this.get('databaseService'),
        this.get('openaiService'),
        this.get('experienceService')
      ));
      this.register('certificationService', () => new CertificationService(
        this.get('databaseService'),
        this.get('auditService')
      ));
      this.register('learningPathService', () => new LearningPathService(
        this.get('databaseService'),
        this.get('courseService'),
        this.get('skillAssessmentService'),
        this.get('certificationService')
      ));

      // Register middleware
      this.register('authMiddleware', () => new AuthMiddleware(this.get('authService')));
      this.register('rateLimiter', () => new RateLimiter(), { singleton: true });

      // Register controllers
      this.register('authController', () => new AuthController(
        this.get('authService'),
        this.get('googleOAuthService'),
        this.get('linkedInOAuthService'),
        this.get('ssoService'),
        this.get('featureFlagService')
      ));
      this.register('profileController', () => new ProfileController(this.get('userService')));
      this.register('experienceController', () => new ExperienceController(this.get('experienceService')));
      this.register('chatController', () => new ChatController(this.get('chatService')));
      this.register('cpaPertController', () => new CPAPertController(
        this.get('cpaPertService'),
        this.get('authService')
      ));
      this.register('cpaPertControllerEnhanced', () => new EnhancedCpaPertController(
        this.get('cpaPertServiceEnhanced'),
        this.get('auditService')
      ));
      this.register('analyticsController', () => new AnalyticsController(
        this.get('analyticsService')
      ));
      this.register('resumeController', () => new ResumeController(
        this.get('resumeService')
      ));
      this.register('careerPathController', () => new CareerPathController(
        this.get('careerPathService'),
        this.get('skillsGapService'),
        this.get('learningService')
      ));
      this.register('networkingController', () => new NetworkingController(
        this.get('contactService'),
        this.get('interactionService'),
        this.get('reminderService'),
        this.get('networkingService')
      ));
      this.register('jobSearchController', () => new JobSearchController(
        this.get('jobSearchService'),
        this.get('jobMatchingService'),
        this.get('applicationService'),
        this.get('interviewPrepService'),
        this.get('companyService')
      ));
      this.register('learningController', () => new LearningController(
        this.get('courseService'),
        this.get('skillAssessmentService'),
        this.get('certificationService'),
        this.get('learningPathService')
      ));

      logger.info('Dependency container initialized');
    } catch (error) {
      logger.error('Failed to initialize container', { error: error.message });
      throw error;
    }
  }

  register(name, factory, options = {}) {
    if (typeof factory !== 'function' && !options.singleton) {
      throw new Error(`Service ${name} must be registered with a factory function`);
    }

    this.services.set(name, {
      factory: typeof factory === 'function' ? factory : () => factory,
      singleton: options.singleton || false
    });
  }

  get(name) {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service ${name} not found in container`);
    }

    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory());
      }
      return this.singletons.get(name);
    }

    return service.factory();
  }

  has(name) {
    return this.services.has(name);
  }

  async shutdown() {
    // Cleanup singletons in reverse order
    const cacheManager = this.singletons.get('cacheManager');
    if (cacheManager) {
      await cacheManager.disconnect();
    }
    
    const database = this.singletons.get('database');
    if (database) {
      await database.close();
    }

    this.services.clear();
    this.singletons.clear();
    
    logger.info('Dependency container shut down');
  }
}

// Create singleton container instance
const container = new Container();

module.exports = container;
