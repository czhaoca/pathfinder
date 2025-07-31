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
const OpenAIChatService = require('./services/openaiChatService');

// Repositories
const UserRepository = require('./repositories/userRepository');
const SessionRepository = require('./repositories/sessionRepository');
const AuditRepository = require('./repositories/auditRepository');
const ExperienceRepository = require('./repositories/experienceRepository');
const CPAPertRepository = require('./repositories/cpaPertRepository');
const ChatRepository = require('./repositories/chatRepository');

// Controllers
const AuthController = require('./api/controllers/authController');
const ProfileController = require('./api/controllers/profileController');
const ExperienceController = require('./api/controllers/experienceController');
const ChatController = require('./api/controllers/chatController');
const CPAPertController = require('./api/controllers/cpaPertController');

// Middleware
const AuthMiddleware = require('./api/middleware/authMiddleware');

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

      // Register repositories
      this.register('userRepository', () => new UserRepository(this.get('database')));
      this.register('sessionRepository', () => new SessionRepository(this.get('database')));
      this.register('auditRepository', () => new AuditRepository(this.get('database')));
      this.register('experienceRepository', () => new ExperienceRepository(this.get('database')));
      this.register('cpaPertRepository', () => new CPaPertRepository(this.get('database'), config));
      this.register('chatRepository', () => new ChatRepository(this.get('database')));

      // Register services
      this.register('auditService', () => new AuditService(this.get('auditRepository')));
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

      // Register middleware
      this.register('authMiddleware', () => new AuthMiddleware(this.get('authService')));

      // Register controllers
      this.register('authController', () => new AuthController(this.get('authService')));
      this.register('profileController', () => new ProfileController(this.get('userService')));
      this.register('experienceController', () => new ExperienceController(this.get('experienceService')));
      this.register('chatController', () => new ChatController(this.get('chatService')));
      this.register('cpaPertController', () => new CPAPertController(
        this.get('cpaPertService'),
        this.get('authService')
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