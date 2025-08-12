module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/index.js',
    '!src/config/**',
    '!src/database/setup/**',
    '!src/database/seeds/**',
    '!src/database/migrations/**',
    '!src/utils/logger.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/api/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/src/api/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1'
  }
};