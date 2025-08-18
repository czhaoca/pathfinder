module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|oci-objectstorage)/)'
  ],
  moduleNameMapper: {
    'oci-objectstorage': '<rootDir>/tests/mocks/oci-objectstorage.js'
  },
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/index.js',
    '!src/config/**'
  ],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95
    }
  },
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially for database operations
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  globalSetup: '<rootDir>/globalSetup.js',
  globalTeardown: '<rootDir>/globalTeardown.js'
};