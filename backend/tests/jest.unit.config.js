module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/unit/**/*.spec.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|oci-objectstorage)/)'
  ],
  moduleNameMapper: {
    'oci-objectstorage': '<rootDir>/tests/mocks/oci-objectstorage.js',
    'node-fetch': '<rootDir>/tests/mocks/node-fetch.js'
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
  testTimeout: 30000,
  maxWorkers: 1,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
  // No globalSetup/globalTeardown for unit tests
};