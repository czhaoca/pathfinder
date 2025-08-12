/**
 * Jest Test Setup
 * Configure test environment and global utilities
 */

const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test', quiet: true });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-ok';

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Global test utilities
global.testUtils = {
  /**
   * Create a test user object
   */
  createTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
    emailVerified: true,
    ...overrides
  }),

  /**
   * Create a test JWT token
   */
  createTestToken: (userId = 'test-user-id') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: userId, username: 'testuser' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  /**
   * Create test request object
   */
  createTestRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  /**
   * Create test response object
   */
  createTestResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    return res;
  },

  /**
   * Create test next function
   */
  createTestNext: () => jest.fn(),

  /**
   * Wait for async operations
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Clean up database after tests
   */
  cleanupDatabase: async () => {
    // Implement database cleanup logic
    // This would typically truncate test tables
  }
};

// Increase timeout for integration tests
if (process.env.TEST_TYPE === 'integration') {
  jest.setTimeout(30000);
}

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  const dbManager = require('../src/services/database');
  if (dbManager && dbManager.close) {
    await dbManager.close();
  }

  // Close Redis connections
  const redis = require('../src/services/redis');
  if (redis && redis.quit) {
    await redis.quit();
  }
});

// Suppress console errors in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  console.error = jest.fn();
  console.warn = jest.fn();
}