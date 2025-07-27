// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'test-database-url';

// Database configuration for tests
process.env.OCI_DB_TEST_PASSWORD = 'test-password';
process.env.OCI_DB_TEST_SERVICE_NAME = 'test-service';
process.env.OCI_DB_TEST_HOST = 'test-host';
process.env.OCI_DB_TEST_USERNAME = 'test-user';

// Security configuration
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long!!';

// MCP configuration
process.env.MCP_PORT = '3001';

// API configuration
process.env.API_PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:5173';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};